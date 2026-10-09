import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

import { endOfDay, parseISO, startOfDay } from "date-fns";
import { type DateFormatType, DateManager } from "#/core/utils/index.js";

export class DateTransformerValueDto<T = Date | string | number | null> {
  @ApiProperty({
    type: "string",
    format: "date-time",
    nullable: true,
    description: "Ham tarih değeri",
    example: "2026-03-07T10:30:00.000Z",
  })
  raw: string | null;

  @ApiProperty({
    type: "string",
    nullable: true,
    description:
      "Goruntulenecek tarih degeri. Format verilirse metin, verilmezse ISO tarih stringi olarak serilesir.",
    example: "7 Mart 2026 Cumartesi",
  })
  display: T;
}

export interface DateTransformerOptions {
  /**
   * Dönüştürülecek format tipi
   * Hem parse etmek hem de formatlamak için kullanılır
   */
  format?: DateFormatType;
  /**
   * Türkiye saat dilimine dönüştürülsün mü?
   */
  toTurkeyTime?: boolean;
  /**
   * Günün başlangıcına ayarlansın mı? (00:00:00)
   */
  startOfDay?: boolean;
  /**
   * Günün sonuna ayarlansın mı? (23:59:59.999)
   */
  endOfDay?: boolean;
  /**
   * ISO 8601 formatında döndürülsün mü?
   */
  toISO?: boolean;
  /**
   * Hata durumunda varsayılan değer
   */
  defaultValue?: unknown;
  /**
   * Null/undefined değerleri atla
   */
  skipNullish?: boolean;

  /**
   * saat, dakika, saniye formatında döndürülmesi için
   */
  toDuration?: boolean;

  /**
   *  Dönüşüm sırasında tarih aralığı hesaplaması yapılsın mı?
   *  Bu, tarihlerin arasındaki süreyi hesaplamak için kullanılabilir.
   *  örn: "1 saat 30 dakika önce"
   */
  getTimeBetween?: boolean;

  /**
   * date-fns formatDistanceToNow kullanılsın mı?
   * örn: "3 saat önce"
   */
  formatDistanceToNow?: boolean;

  /**
   * true ise { raw, display } formatında döndürülür
   */
  withRawAndDisplay?: boolean;
}

export function DateTransformer(options: DateTransformerOptions = {}) {
  return Transform(({ value }) => {
    options = {
      withRawAndDisplay: options.withRawAndDisplay ?? true,
      ...options,
    };
    const toRawDateTime = (date: Date | null): string | null => {
      if (!date) {
        return null;
      }

      if (isNaN(date.getTime())) {
        return null;
      }

      return date.toISOString();
    };

    const createResponse = <T>(
      raw: Date | null,
      display: T,
    ): DateTransformerValueDto<T> | T => {
      if (!options.withRawAndDisplay) {
        return display;
      }

      return {
        raw: toRawDateTime(raw),
        display,
      };
    };

    try {
      // Null veya undefined değerleri kontrol et
      if (value == null) {
        if (options.skipNullish) {
          return value;
        }

        if (options.defaultValue !== undefined) {
          return options.defaultValue;
        }

        return createResponse(null, null);
      }

      const dateManager = new DateManager();
      let processedDate: Date;

      // String ise parse et
      if (typeof value === "string") {
        // ISO 8601 formatını kontrol et (YYYY-MM-DDTHH:mm:ss.sssZ formatı)
        if (value.includes("T") || value.includes("Z")) {
          processedDate = parseISO(value);
        } else {
          processedDate = new Date(value);
        }

        if (isNaN(processedDate.getTime())) {
          throw new Error("Invalid date string");
        }
      }
      // Date objesi ise direkt kullan
      else if (value instanceof Date) {
        if (isNaN(value.getTime())) {
          throw new Error("Invalid date object");
        }
        processedDate = new Date(value);
      }
      // Number ise timestamp olarak kabul et
      else if (typeof value === "number") {
        processedDate = new Date(value);
        if (isNaN(processedDate.getTime())) {
          throw new Error("Invalid timestamp");
        }
      }
      // Diğer tipler için hata
      else {
        throw new Error("Unsupported date type");
      }

      // Türkiye saat dilimine dönüştür
      if (options.toTurkeyTime) {
        // format yoksa Date objesi döndür
        processedDate = dateManager.toTurkeyTime(processedDate) as Date;

        if (options.format) {
          return createResponse(
            processedDate,
            dateManager.getFormattedDate(processedDate, options.format),
          );
        }
      }

      // getTimeBetween için şu anki zamanla karşılaştır
      if (options.getTimeBetween) {
        return createResponse(
          processedDate,
          dateManager.getTimeBetween(processedDate),
        );
      }

      // Günün başlangıcına ayarla
      if (options.startOfDay) {
        processedDate = startOfDay(processedDate);
      }

      // Günün sonuna ayarla
      if (options.endOfDay) {
        processedDate = endOfDay(processedDate);
      }

      // ISO formatında döndür
      if (options.toISO) {
        return createResponse(
          processedDate,
          dateManager.formatDateForISO8601(processedDate),
        );
      }

      // Şu anki zamanla karşılaştırıp "X saat önce" formatında döndür
      if (options.toDuration) {
        return createResponse(
          processedDate,
          dateManager.getTimeBetween(processedDate),
        );
      }

      if (options.formatDistanceToNow) {
        return createResponse(
          processedDate,
          dateManager.formatDistanceToNow(processedDate),
        );
      }

      // Belirli bir formatta döndür
      if (options.format) {
        return createResponse(
          processedDate,
          dateManager.getFormattedDate(processedDate, options.format),
        );
      }

      return createResponse(processedDate, processedDate);
    } catch (error) {
      if (options.defaultValue !== undefined) {
        return options.defaultValue;
      }

      if (options.withRawAndDisplay) {
        const fallbackRaw =
          value instanceof Date
            ? toRawDateTime(value)
            : typeof value === "string"
              ? value
              : null;

        return {
          raw: fallbackRaw,
          display: value,
        };
      }

      return value;
    }
  });
}
