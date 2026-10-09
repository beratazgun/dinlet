import { Module } from "@nestjs/common";
import { DateManager } from "#/core/utils/date-manager.js";
import { Paginator } from "#/core/utils/paginator.js";
import { MediaControllers } from "#/modules/media/controllers/index.js";
import { MediaRepositories } from "#/modules/media/repository/index.js";
import { MediaServices } from "#/modules/media/services/index.js";

// S3Service ve RedisPendingUploadHelper global modüllerden (S3Module, RedisModule) gelir.
const MediaProviders = [DateManager, Paginator];

@Module({
  controllers: [...MediaControllers],
  providers: [...MediaRepositories, ...MediaServices, ...MediaProviders],
  // Belge modülü yüklenen PDF'in sahipliğini doğrular.
  exports: [...MediaRepositories],
})
export class MediaModule {}
