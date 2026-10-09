import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NotFound,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EnvType } from "#config/env.validation.js";
import { FastifyUploadedFile } from "#/types/index.js";

interface UploadResult {
  path: string;
  key: string;
  url: string;
}

export interface CreateUploadUrlInput {
  key: string;
  contentType: string;
  /** Bayt cinsinden; imzaya girer, istemci farklı boyutta dosya yükleyemez. */
  contentLength: number;
  /** URL'in geçerlilik süresi (saniye). */
  expiresInSeconds: number;
}

export interface UploadUrl {
  /** İstemcinin `PUT` ile dosyayı doğrudan yükleyeceği imzalı URL. */
  url: string;
  /** İstekte birebir gönderilmesi gereken başlıklar. */
  headers: Record<string, string>;
}

export interface StoredObjectInfo {
  size: number;
  contentType: string | null;
}

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  /**
   * Presigned URL'ler tarayıcıya verilir; imza host'u içerdiği için
   * `R2_PUBLIC_ENDPOINT` (yoksa `R2_ENDPOINT`) ile ayrı bir istemci kullanılır.
   */
  private readonly presignClient: S3Client;
  private readonly bucketName: string;
  private readonly mediaBaseUrl: string;
  private readonly logger = new Logger(S3Service.name);

  constructor(private configService: ConfigService<EnvType>) {
    this.bucketName = this.configService.get("R2_BUCKET_NAME", "");
    this.mediaBaseUrl = this.configService.get("R2_CDN_BASE_URL", "");

    const endpoint = this.configService.get("R2_ENDPOINT", "");
    const clientConfig = {
      region: "auto",
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.configService.get<string>("R2_ACCESS_KEY_ID")!,
        secretAccessKey: this.configService.get<string>(
          "R2_SECRET_ACCESS_KEY",
        )!,
      },
    };
    this.s3Client = new S3Client({ ...clientConfig, endpoint });
    this.presignClient = new S3Client({
      ...clientConfig,
      endpoint:
        this.configService.get("R2_PUBLIC_ENDPOINT", { infer: true }) ||
        endpoint,
    });

    this.logger.log(`S3 Service initialized (R2) - Bucket: ${this.bucketName}`);
  }

  /**
   * Getter for mediaBaseUrl (dışarıdan erişim için)
   */
  getMediaBaseUrl(path: string): string {
    return `${this.mediaBaseUrl}/${path}`;
  }

  /**
   * Dosya yükle - key parametre olarak alınır
   */
  async uploadFile(
    file: FastifyUploadedFile,
    key: string,
  ): Promise<UploadResult> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);

      const path = `${key}`;
      const url = this.getMediaBaseUrl(path);

      this.logger.log(`File uploaded successfully: ${key}`);

      return { path, key, url: url };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to upload file (key=${key}): ${error.message}`,
          error.stack,
        );
      }

      throw error;
    }
  }

  /**
   * Buffer'dan dosya yükle - key parametre olarak alınır
   */
  async uploadBuffer(
    buffer: Buffer,
    mimetype: string,
    key: string,
  ): Promise<UploadResult> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      });

      await this.s3Client.send(command);

      const path = `${key}`;
      const url = this.getMediaBaseUrl(path);

      this.logger.log(`Buffer uploaded successfully: ${key}`);

      return { path, key, url: url };
    } catch (error) {
      this.logger.error(
        `Failed to upload buffer (key=${key}): ${this.describeError(error)}`,
      );
      throw error;
    }
  }

  /**
   * AggregateError (örn. ECONNREFUSED) `message` boş döner — alt hataları
   * birleştirip okunabilir bir özet üret.
   */
  private describeError(err: unknown): string {
    if (!err || typeof err !== "object") return String(err);
    const e = err as {
      message?: string;
      code?: string;
      name?: string;
      errors?: Array<{
        message?: string;
        code?: string;
        address?: string;
        port?: number;
      }>;
    };
    if (e.message) return e.message;
    if (e.errors?.length) {
      return e.errors
        .map(
          (sub) =>
            `${sub.code ?? sub.message ?? "unknown"}` +
            (sub.address ? ` ${sub.address}:${sub.port}` : ""),
        )
        .join("; ");
    }
    return `${e.name ?? "Error"}${e.code ? ` (${e.code})` : ""}`;
  }

  /**
   * Nesnenin ilk `bytes` baytını okur (ör. dosya imzası kontrolü). Nesne
   * yoksa veya okunamazsa `null`.
   */
  async getFileHead(pathOrKey: string, bytes: number): Promise<Buffer | null> {
    const key = this.extractKeyFromPath(pathOrKey);
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Range: `bytes=0-${bytes - 1}`,
        }),
      );
      const byteArray = await response.Body?.transformToByteArray();
      return byteArray ? Buffer.from(byteArray) : null;
    } catch (error) {
      this.logger.warn(
        `Dosya başı okunamadı (key=${key}): ${this.describeError(error)}`,
      );
      return null;
    }
  }

  /**
   * S3'ten dosyayı Buffer olarak indir
   */
  async getFileBuffer(pathOrKey: string): Promise<Buffer | null> {
    const key = this.extractKeyFromPath(pathOrKey);
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      const byteArray = await response.Body?.transformToByteArray();

      if (!byteArray) return null;

      return Buffer.from(byteArray);
    } catch (error) {
      if (error instanceof Error)
        this.logger.error(
          `Failed to get file buffer: ${error.message}`,
          error.stack,
        );
      return null;
    }
  }

  /**
   * Path'den S3 key'i ayıkla (bucket adını çıkarır)
   */
  extractKeyFromPath(path: string): string {
    if (!path) return "";
    const parts = path.split("/");
    if (parts[0] === this.bucketName) {
      return parts.slice(1).join("/");
    }
    return path;
  }

  /**
   * Dosyayı bir konumdan diğerine kopyala (temp -> final için)
   */
  async copyFile(
    sourcePath: string,
    destinationKey: string,
  ): Promise<UploadResult> {
    const sourceKey = this.extractKeyFromPath(sourcePath);

    try {
      const command = new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceKey}`,
        Key: destinationKey,
      });

      await this.s3Client.send(command);

      const path = `${destinationKey}`;
      const url = this.getMediaBaseUrl(path);

      this.logger.log(`File copied: ${sourceKey} -> ${destinationKey}`);

      return { path, key: destinationKey, url: url };
    } catch (error) {
      if (error instanceof Error)
        this.logger.error(`Failed to copy file: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Tek dosya sil
   */
  async deleteFile(pathOrKey: string): Promise<void> {
    const key = this.extractKeyFromPath(pathOrKey);
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);

      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error) {
      if (error instanceof Error)
        this.logger.error(
          `Failed to delete file: ${error.message}`,
          error.stack,
        );
      throw error;
    }
  }

  /**
   * Bir önekin altındaki tüm nesneleri siler (ör. bir notun ses klasörü).
   * Silinen nesne sayısını döner.
   */
  async deleteByPrefix(prefix: string): Promise<number> {
    if (!prefix.endsWith("/")) {
      throw new Error(`Önek '/' ile bitmeli (yanlışlıkla geniş silme olmasın): ${prefix}`);
    }
    let deleted = 0;
    let continuationToken: string | undefined;
    do {
      const page = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      const keys = (page.Contents ?? [])
        .map((object) => object.Key)
        .filter((key): key is string => Boolean(key));
      if (keys.length > 0) {
        await this.deleteFiles(keys);
        deleted += keys.length;
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
    return deleted;
  }

  /**
   * Bulk dosya silme
   */
  async deleteFiles(pathsOrKeys: string[]): Promise<void> {
    if (pathsOrKeys.length === 0) return;

    const objects = pathsOrKeys.map((pk) => ({
      Key: this.extractKeyFromPath(pk),
    }));

    try {
      const command = new DeleteObjectsCommand({
        Bucket: this.bucketName,
        Delete: {
          Objects: objects,
          Quiet: false,
        },
      });

      const result = await this.s3Client.send(command);

      this.logger.log(
        `Bulk delete completed - Deleted: ${result.Deleted?.length || 0}, Errors: ${result.Errors?.length || 0}`,
      );

      if (result.Errors && result.Errors.length > 0) {
        this.logger.error("Some files failed to delete:", result.Errors);
      }
    } catch (error) {
      if (error instanceof Error)
        this.logger.error(
          `Failed to bulk delete files: ${error.message}`,
          error.stack,
        );
      throw error;
    }
  }

  /**
   * İstemcinin dosyayı sunucuya uğramadan yükleyeceği imzalı `PUT` URL'i.
   */
  async createUploadUrl(input: CreateUploadUrlInput): Promise<UploadUrl> {
    const url = await getSignedUrl(
      this.presignClient,
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: input.key,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
      }),
      {
        expiresIn: input.expiresInSeconds,
        // Bu başlıklar imzaya girer; istemci farklı tip/boyut gönderemez.
        signableHeaders: new Set(["content-type", "content-length"]),
      },
    );
    return {
      url,
      headers: {
        "Content-Type": input.contentType,
        "Content-Length": String(input.contentLength),
      },
    };
  }

  /**
   * Nesnenin boyutu ve tipi; nesne yoksa `null`.
   */
  async stat(pathOrKey: string): Promise<StoredObjectInfo | null> {
    const key = this.extractKeyFromPath(pathOrKey);
    try {
      const head = await this.s3Client.send(
        new HeadObjectCommand({ Bucket: this.bucketName, Key: key }),
      );
      return {
        size: head.ContentLength ?? 0,
        contentType: head.ContentType ?? null,
      };
    } catch (error) {
      if (
        error instanceof NotFound ||
        (error as { name?: string }).name === "NotFound"
      ) {
        return null;
      }
      if (error instanceof Error)
        this.logger.error(
          `Failed to stat file: ${error.message}`,
          error.stack,
        );
      throw error;
    }
  }

  /**
   * Bucket adını döndür
   */
  getBucketName(): string {
    return this.bucketName;
  }
}
