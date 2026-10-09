import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import {
  LEGAL_DOCUMENT_SLUGS,
  type LegalDocumentSlug,
} from "#/modules/auth/legal/legal-documents.js";

export class LegalDocumentParamDto {
  @ApiProperty({ enum: LEGAL_DOCUMENT_SLUGS, example: "privacy-notice" })
  @IsIn(LEGAL_DOCUMENT_SLUGS, { message: "Böyle bir metin yok" })
  document!: LegalDocumentSlug;
}
