import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

import { Trim } from "#/core/decorators/query-transform.decorator.js";
import { JobCategory } from "#database/enums.js";

export type JsonValue =
  boolean | number | string | null | JsonValue[] | { [key: string]: JsonValue };

export class CreateJobBodyDto {
  @ApiProperty({ maxLength: 100, example: "DAILY_CLEANUP" })
  @Trim()
  @IsString({ message: "Job kodu metin olmalıdır" })
  @IsNotEmpty({ message: "Job kodu boş olamaz" })
  @MaxLength(100, { message: "Job kodu en fazla 100 karakter olabilir" })
  code!: string;

  @ApiProperty({ maxLength: 200, example: "Günlük temizlik" })
  @Trim()
  @IsString({ message: "Job adı metin olmalıdır" })
  @IsNotEmpty({ message: "Job adı boş olamaz" })
  @MaxLength(200, { message: "Job adı en fazla 200 karakter olabilir" })
  name!: string;

  @ApiPropertyOptional({ example: "Eski kayıtları temizler" })
  @Trim()
  @IsOptional()
  @IsString({ message: "Açıklama metin olmalıdır" })
  @MinLength(1, { message: "Açıklama boş olamaz" })
  description?: string;

  @ApiPropertyOptional({ enum: JobCategory })
  @IsOptional()
  @IsEnum(JobCategory, { message: "Geçersiz job kategorisi" })
  category?: JobCategory;

  @ApiProperty({ maxLength: 50, example: "0 0 * * *" })
  @Trim()
  @IsString({ message: "Cron deseni metin olmalıdır" })
  @IsNotEmpty({ message: "Cron deseni boş olamaz" })
  @MaxLength(50, { message: "Cron deseni en fazla 50 karakter olabilir" })
  cronPattern!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean({ message: "Aktiflik değeri boolean olmalıdır" })
  isActive?: boolean;

  @ApiPropertyOptional({ default: 3, minimum: 0 })
  @IsOptional()
  @IsInt({ message: "Tekrar limiti tam sayı olmalıdır" })
  @Min(0, { message: "Tekrar limiti negatif olamaz" })
  retryLimit?: number;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject({ message: "Job parametreleri obje olmalıdır" })
  params?: Record<string, JsonValue>;
}
