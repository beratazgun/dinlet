import { Expose } from "class-transformer";
import type { MediaKind } from "#/core/utils/media-url.js";

export class MediaUrlItemResDto {
  /**
   * CDN üzerindeki tam URL
   * @example https://cdn.example.com/reports/telegram/123/1718-abc.jpg
   */
  @Expose()
  url!: string;

  /**
   * Medya türü. Dosya uzantısı + mimeType kombinasyonu ile belirlenir.
   * @example image
   */
  @Expose()
  type!: MediaKind;

  /**
   * Orijinal mimeType (DB kaydı).
   * @example image/jpeg
   */
  @Expose()
  mimeType!: string;
}
