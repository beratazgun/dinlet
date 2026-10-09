import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { LEGAL_DOCUMENT_SLUGS } from "#/modules/auth/legal/legal-documents.js";

export class LegalSectionDto {
  @ApiProperty({ example: "Veri sorumlusu" })
  @Expose()
  heading!: string;

  @ApiProperty({
    type: [String],
    description: "Paragraflar; `• ` ile başlayanlar madde olarak gösterilir",
  })
  @Expose()
  body!: string[];
}

export class LegalDocumentResDto {
  @ApiProperty({ enum: LEGAL_DOCUMENT_SLUGS })
  @Expose()
  document!: string;

  @ApiProperty({ example: "Aydınlatma Metni" })
  @Expose()
  title!: string;

  @ApiProperty({
    example: "2026-10-01",
    description: "Onay defterine yazılan metin sürümü",
  })
  @Expose()
  version!: string;

  @ApiProperty({ type: [LegalSectionDto] })
  @Expose()
  @Type(() => LegalSectionDto)
  sections!: LegalSectionDto[];
}
