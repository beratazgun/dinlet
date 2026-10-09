import { applyDecorators } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose, Transform } from "class-transformer";
import { MediaFilter, MediaUrl } from "#/core/utils/media-url.js";
import { MediaUrlItemResDto } from "#/core/dtos/response/media-url-item.res.dto.js";

interface CdnUrlOptions {
  /** Swagger açıklaması. */
  description?: string;
  /** Field opsiyonel mi? (Swagger + nullable çıktı için). */
  optional?: boolean;
}

interface CdnUrlSingleOptions extends CdnUrlOptions {
  /**
   * `storageKey`'in okunacağı kaynak alan. Verilmezse field'ın kendi değeri
   * kullanılır (ör. `url` çıktısını `storageKey`'den üretmek için `"storageKey"`).
   */
  source?: string;
}

interface CdnUrlListOptions extends CdnUrlOptions {
  /** Liste hangi mime türlerine indirgensin? Default: 'all'. */
  filter?: MediaFilter;
}

/**
 * Tek bir `storageKey` string'ini CDN URL'e çevirir.
 *
 * Kullanım: response DTO içinde `storageKey` alanı tutulan field'a koy.
 * `@Serialize()` `excludeExtraneousValues: true` kullandığı için `@Expose()`
 * birlikte uygulanır.
 */
export function CdnUrl(options: CdnUrlSingleOptions = {}) {
  const { description, optional, source } = options;
  return applyDecorators(
    optional
      ? ApiPropertyOptional({
          type: String,
          description,
          example: "https://cdn.example.com/path/to/file.jpg",
          nullable: true,
        })
      : ApiProperty({
          type: String,
          description,
          example: "https://cdn.example.com/path/to/file.jpg",
        }),
    Expose(),
    Transform(({ value, obj }: { value: unknown; obj: Record<string, unknown> }) =>
      MediaUrl.toUrl((source ? obj[source] : value) as string | null),
    ),
  );
}

/**
 * `{ storageKey, mimeType }` benzeri medya kayıtlarından CDN URL listesi üretir.
 *
 * Kullanım: response DTO'da medya alanını `string[]` olarak işaretle.
 */
export function CdnUrlList(options: CdnUrlListOptions = {}) {
  const { description, optional, filter = "all" } = options;
  return applyDecorators(
    optional
      ? ApiPropertyOptional({
          type: [String],
          description,
          example: ["https://cdn.example.com/path/to/file.jpg"],
        })
      : ApiProperty({
          type: [String],
          description,
          example: ["https://cdn.example.com/path/to/file.jpg"],
        }),
    Expose(),
    Transform(({ value }) => {
      if (!Array.isArray(value)) return [];
      return MediaUrl.toUrls(value, filter);
    }),
  );
}

/**
 * `{ storageKey, mimeType, fileName? }` benzeri kayıtları
 * `{ url, type, mimeType }[]` çıktısına çevirir.
 *
 * Tek string yerine medya türü + mime bilgisi de döndürmek istediğinde
 * (frontend'in `<img>` vs `<video>` seçmesi gerektiği durumlar) bunu kullan.
 */
export function CdnMediaList(options: CdnUrlListOptions = {}) {
  const { description, optional, filter = "all" } = options;
  return applyDecorators(
    optional
      ? ApiPropertyOptional({
          type: [MediaUrlItemResDto],
          description,
        })
      : ApiProperty({
          type: [MediaUrlItemResDto],
          description,
        }),
    Expose(),
    Transform(({ value }) => {
      if (!Array.isArray(value)) return [];
      return MediaUrl.toItems(value, filter);
    }),
  );
}
