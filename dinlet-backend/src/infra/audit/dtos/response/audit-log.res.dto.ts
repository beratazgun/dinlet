import { ApiProperty, type ApiPropertyOptions } from "@nestjs/swagger";
import { Expose } from "class-transformer";

import {
  DateTransformer,
  DateTransformerValueDto,
} from "#/core/decorators/index.js";

/** İstek/yanıt parçası: redakte edilmiş JSON, dizi, metin veya kırpılmış önizleme. */
const AUDIT_PAYLOAD_SCHEMA: ApiPropertyOptions = {
  nullable: true,
  oneOf: [
    { type: "object", additionalProperties: true },
    { type: "array", items: {} },
    { type: "string" },
  ],
};

/** Liste elemanı (gövdesiz özet). */
export class AuditLogResDto {
  @ApiProperty({ type: Number, example: 1 })
  @Expose()
  id!: number;

  @ApiProperty({ type: String, example: "3f0c1f8e-5a8e-4f0b-9c67-1d2e3f4a5b6c" })
  @Expose()
  requestId!: string;

  @ApiProperty({ type: String, example: "POST" })
  @Expose()
  method!: string;

  @ApiProperty({ type: String, nullable: true, example: "/api/v1/auth/login" })
  @Expose()
  route!: string | null;

  @ApiProperty({ type: String, example: "/api/v1/auth/login" })
  @Expose()
  url!: string;

  @ApiProperty({ type: Number, example: 200 })
  @Expose()
  statusCode!: number;

  @ApiProperty({ type: Number, example: 42, description: "Milisaniye" })
  @Expose()
  durationMs!: number;

  @ApiProperty({ type: Number, nullable: true })
  @Expose()
  userId!: number | null;

  @ApiProperty({ type: String, nullable: true, example: "ADMIN" })
  @Expose()
  roleCode!: string | null;

  @ApiProperty({ type: String, nullable: true, example: "127.0.0.1" })
  @Expose()
  ipAddress!: string | null;

  @ApiProperty({ type: String, nullable: true })
  @Expose()
  errorMessage!: string | null;

  @ApiProperty({ type: DateTransformerValueDto })
  @Expose()
  @DateTransformer({ format: "dd MMMM yyyy HH:mm:ss", withRawAndDisplay: true })
  createdAt!: DateTransformerValueDto<string>;
}

/** Detay: özet + istemci/uç bilgisi + istek/yanıt gövdeleri. */
export class AuditLogDetailResDto extends AuditLogResDto {
  @ApiProperty({ type: String, nullable: true })
  @Expose()
  userAgent!: string | null;

  @ApiProperty({ type: String, nullable: true, example: "AuthController" })
  @Expose()
  controller!: string | null;

  @ApiProperty({ type: String, nullable: true, example: "login" })
  @Expose()
  handler!: string | null;

  @ApiProperty(AUDIT_PAYLOAD_SCHEMA)
  @Expose()
  requestHeaders!: unknown;

  @ApiProperty(AUDIT_PAYLOAD_SCHEMA)
  @Expose()
  requestQuery!: unknown;

  @ApiProperty(AUDIT_PAYLOAD_SCHEMA)
  @Expose()
  requestParams!: unknown;

  @ApiProperty(AUDIT_PAYLOAD_SCHEMA)
  @Expose()
  requestBody!: unknown;

  @ApiProperty(AUDIT_PAYLOAD_SCHEMA)
  @Expose()
  responseBody!: unknown;

  @ApiProperty({
    nullable: true,
    description: "Varlık üzerindeki eski ve yeni değer farkları (diff)",
    oneOf: [
      {
        type: "array",
        items: {
          type: "object",
          properties: {
            field: { type: "string", example: "cronPattern" },
            old: { nullable: true, example: "*/5 * * * *" },
            new: { nullable: true, example: "0 0 * * *" },
          },
        },
      },
      { type: "object", additionalProperties: true },
      { type: "string" },
    ],
  })
  @Expose()
  changes!: unknown;
}

/** Varlık üzerinde gerçekleşen tek bir alanın eski/yeni değer farkı. */
export class AuditFieldChangeResDto {
  @ApiProperty({ type: String, example: "cronPattern", description: "Değişen alan adı" })
  @Expose()
  field!: string;

  @ApiProperty({ nullable: true, example: "*/5 * * * *", description: "Eski değer" })
  @Expose()
  old!: unknown;

  @ApiProperty({ nullable: true, example: "0 0 * * *", description: "Yeni değer" })
  @Expose()
  new!: unknown;
}

