import {
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DateManager } from "#/core/utils/date-manager.js";
import type {
  PendingUpload,
  RedisPendingUploadHelper,
} from "#/infra/redis/helpers/redis-pending-upload.helper.js";
import type { S3Service } from "#/infra/s3/s3.service.js";
import type { MediaRepository } from "#/modules/media/repository/index.js";
import type { EnvType } from "#config/env.validation.js";
import { MediaUploadService } from "#/modules/media/services/index.js";

const upload: PendingUpload = {
  uploadId: "abc123abc123abc123abc123",
  userId: 7,
  temporaryKey: "tmp/uploads/7/abc123abc123abc123abc123.pdf",
  fileName: "a.pdf",
  mimeType: "application/pdf",
  size: 100,
};

describe("MediaUploadService.completeUpload", () => {
  let pendingUploads: {
    save: ReturnType<typeof vi.fn>;
    take: ReturnType<typeof vi.fn>;
  };
  let s3: Record<"stat" | "copyFile" | "deleteFile" | "getFileHead", ReturnType<typeof vi.fn>>;
  let mediaRepository: { create: ReturnType<typeof vi.fn> };
  let service: MediaUploadService;
  const params = { uploadId: upload.uploadId };

  beforeEach(() => {
    pendingUploads = {
      save: vi.fn(),
      take: vi.fn().mockResolvedValue(upload),
    };
    s3 = {
      stat: vi.fn().mockResolvedValue({ size: 100, contentType: "application/pdf" }),
      getFileHead: vi.fn().mockResolvedValue(Buffer.from("%PDF-")),
      copyFile: vi.fn().mockResolvedValue(undefined),
      deleteFile: vi.fn().mockResolvedValue(undefined),
    };
    mediaRepository = {
      create: vi
        .fn()
        .mockImplementation((input) => ({ id: 1, ...input, createdAt: "x" })),
    };
    service = new MediaUploadService(
      mediaRepository as unknown as MediaRepository,
      pendingUploads as unknown as RedisPendingUploadHelper,
      s3 as unknown as S3Service,
      new DateManager(),
      { getOrThrow: () => "1000" } as unknown as ConfigService<EnvType>,
    );
  });

  it("geçici nesneyi kalıcı anahtara taşır, kaydı açar ve geçiciyi siler", async () => {
    const response = await service.completeUpload(params, 7);

    const [source, destination] = s3.copyFile.mock.calls[0] as [string, string];
    expect(source).toBe(upload.temporaryKey);
    expect(destination).toMatch(
      /^media\/7\/\d{4}-\d{2}\/abc123abc123abc123abc123\.pdf$/,
    );
    expect(response.data).toMatchObject({
      storageKey: destination,
      uploaderId: 7,
      size: 100,
    });
    expect(s3.deleteFile).toHaveBeenCalledWith(upload.temporaryKey);
    expect(pendingUploads.save).not.toHaveBeenCalled();
  });

  it("başka kullanıcının yüklemesini bulunamadı sayar ve kaydı geri koyar", async () => {
    await expect(service.completeUpload(params, 8)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(pendingUploads.save).toHaveBeenCalledWith(upload, expect.any(Number));
    expect(s3.stat).not.toHaveBeenCalled();
  });

  it("nesne henüz yoksa kaydı geri koyar ki istemci tekrar deneyebilsin", async () => {
    s3.stat.mockResolvedValue(null);

    await expect(service.completeUpload(params, 7)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(pendingUploads.save).toHaveBeenCalledWith(upload, expect.any(Number));
  });

  it.each([
    { size: 999, contentType: "application/pdf" },
    { size: 100, contentType: "text/html" },
  ])("bildirilenden farklı nesneyi siler ve reddeder (%o)", async (stored) => {
    s3.stat.mockResolvedValue(stored);

    await expect(service.completeUpload(params, 7)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(s3.deleteFile).toHaveBeenCalledWith(upload.temporaryKey);
    expect(s3.copyFile).not.toHaveBeenCalled();
    expect(mediaRepository.create).not.toHaveBeenCalled();
  });

  it("kayıt yazılamazsa kopyalanan kalıcı nesneyi temizler", async () => {
    mediaRepository.create.mockRejectedValue(new Error("db down"));

    await expect(service.completeUpload(params, 7)).rejects.toThrow("db down");
    const destination = s3.copyFile.mock.calls[0]![1];
    expect(s3.deleteFile).toHaveBeenCalledWith(destination);
  });

  it("PDF imzası taşımayan dosyayı reddeder ve geçici nesneyi siler", async () => {
    s3.getFileHead.mockResolvedValue(Buffer.from("<html"));

    await expect(service.completeUpload(params, 7)).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(s3.deleteFile).toHaveBeenCalledWith(upload.temporaryKey);
    expect(s3.copyFile).not.toHaveBeenCalled();
  });
});
