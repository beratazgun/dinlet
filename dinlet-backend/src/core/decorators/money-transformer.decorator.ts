import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class MoneyTransformerValueDto {
  raw: string;
  display: string;
}

export interface MoneyTransformerOptions {
  /**
   * Intl locale degeri
   * varsayilan: tr-TR
   */
  locale?: string;
  /**
   * Para birimi
   * varsayilan: TRY
   */
  currency?: string;
  /**
   * Intl format stili
   * varsayilan: currency
   */
  style?: 'currency' | 'decimal';
  /**
   * Para birimi gosterim tipi
   * varsayilan: symbol
   */
  currencyDisplay?: 'code' | 'symbol' | 'narrowSymbol' | 'name';
  /**
   * Minimum ondalik basamak sayisi
   */
  minimumFractionDigits?: number;
  /**
   * Maksimum ondalik basamak sayisi
   */
  maximumFractionDigits?: number;
  /**
   * Null/undefined degerleri atla
   */
  skipNullish?: boolean;
  /**
   * Hata durumunda varsayilan deger
   */
  defaultValue?: MoneyTransformerValueDto | null;
}

interface DecimalLike {
  toString(): string;
}

function isDecimalLike(value: unknown): value is DecimalLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toString' in value &&
    typeof value.toString === 'function'
  );
}

/**
 * Para degerlerini { raw, display } formatinda donduren decorator
 */
export function MoneyTransformer(options: MoneyTransformerOptions = {}) {
  return (target: object, propertyKey: string) => {
    Transform(({ value }) => {
      try {
        if (value == null) {
          if (options.skipNullish) return value;
          if (options.defaultValue !== undefined) return options.defaultValue;
          return { raw: null, display: null };
        }

        const rawValue =
          typeof value === 'number'
            ? value.toString()
            : typeof value === 'string'
              ? value.trim()
              : isDecimalLike(value)
                ? value.toString()
                : null;

        if (!rawValue) {
          throw new Error('Unsupported money type');
        }

        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue)) {
          throw new Error('Invalid money value');
        }

        const formatter = new Intl.NumberFormat(options.locale ?? 'tr-TR', {
          style: options.style ?? 'currency',
          currency: options.currency ?? 'TRY',
          currencyDisplay: options.currencyDisplay ?? 'symbol',
          minimumFractionDigits: options.minimumFractionDigits,
          maximumFractionDigits: options.maximumFractionDigits,
        });

        return {
          raw: rawValue,
          display: formatter.format(numericValue),
        };
      } catch (_error) {
        if (options.defaultValue !== undefined) {
          return options.defaultValue;
        }

        return {
          raw: value != null ? String(value) : null,
          display: value != null ? String(value) : null,
        };
      }
    })(target, propertyKey);

    ApiProperty({
      type: 'object',
      properties: {
        raw: {
          type: 'string',
          description: 'Ham para degeri',
          nullable: true,
          example: '15000.50',
        },
        display: {
          type: 'string',
          description: 'Formatlanmis para degeri',
          nullable: true,
          example: '₺15.000,50',
        },
      },
      required: ['raw', 'display'],
    } as never)(target, propertyKey);
  };
}
