import { Injectable, Logger, NotFoundException } from "@nestjs/common";

import type { PageQueryDto } from "#/core/dtos/request/index.js";
import { NoContentResponse, OkResponse } from "#/core/http/index.js";
import { Paginator } from "#/core/utils/paginator.js";
import { S3Service } from "#/infra/s3/s3.service.js";
import { MediaRepository } from "#/modules/media/repository/index.js";
import type { Media } from "#/modules/media/types/index.js";

/** Kullanıcının kendi yüklediği dosyalar. */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly mediaRepository: MediaRepository,
    private readonly s3Service: S3Service,
    private readonly paginator: Paginator,
  ) {}

  /** Kullanıcının kendi yüklediği medyaları (yeniden eskiye) listeler. */
  async list(query: PageQueryDto, userId: number): Promise<OkResponse> {
    const { docs, pagination } = await this.paginator.apply({
      page: query.page,
      limit: query.limit,
      count: () => this.mediaRepository.countByUploader(userId),
      query: (window) =>
        this.mediaRepository.findPageByUploader(userId, window),
    });

    return new OkResponse("Medyalar listelendi", docs, {
      meta: { pagination },
    });
  }

  /** Kullanıcının kendi medyasını getirir; başkasınınki "bulunamadı" sayılır. */
  async get(id: number, userId: number): Promise<OkResponse> {
    return new OkResponse("Medya getirildi", await this.findOwned(id, userId));
  }

  /** Kullanıcının kendi medyasını kaydı ve depolamadaki nesnesiyle siler. */
  async delete(id: number, userId: number): Promise<NoContentResponse> {
    const media = await this.findOwned(id, userId);

    const deleted = await this.mediaRepository.deleteOwned(id, userId);
    if (!deleted) throw new NotFoundException(`Medya bulunamadı: ${id}`);

    // Kayıt silindi; nesne silinemezse yalnızca loglanır (yetim nesne zararsız).
    await this.s3Service.deleteFile(media.storageKey).catch((error: unknown) =>
      this.logger.warn(
        `Medya nesnesi silinemedi (${media.storageKey}): ${String(error)}`,
      ),
    );

    return new NoContentResponse("Medya silindi");
  }

  private async findOwned(id: number, userId: number): Promise<Media> {
    const media = await this.mediaRepository.findOwnedById(id, userId);
    if (!media) throw new NotFoundException(`Medya bulunamadı: ${id}`);
    return media;
  }
}
