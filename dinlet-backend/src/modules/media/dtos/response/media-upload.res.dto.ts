import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

import {
  DateTransformer,
  DateTransformerValueDto,
} from "#/core/decorators/index.js";

export class MediaUploadResDto {
  @ApiProperty({
    type: String,
    description: "Tamamlama ucunda kullanılacak kimlik",
    example: "k3j9x0a1b2c3d4e5f6g7h8i9",
  })
  @Expose()
  uploadId!: string;

  @ApiProperty({
    type: String,
    description: "Dosyanın `PUT` ile doğrudan yükleneceği imzalı URL",
  })
  @Expose()
  uploadUrl!: string;

  @ApiProperty({
    type: "object",
    additionalProperties: { type: "string" },
    description: "`PUT` isteğinde birebir gönderilecek başlıklar",
    example: { "Content-Type": "image/jpeg", "Content-Length": "248331" },
  })
  @Expose()
  headers!: Record<string, string>;

  @ApiProperty({ type: DateTransformerValueDto })
  @Expose()
  @DateTransformer({ format: "dd MMMM yyyy HH:mm", withRawAndDisplay: true })
  expiresAt!: DateTransformerValueDto<string>;
}
