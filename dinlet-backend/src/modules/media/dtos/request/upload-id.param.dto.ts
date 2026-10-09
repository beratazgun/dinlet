import { ApiProperty } from "@nestjs/swagger";
import { Matches } from "class-validator";

export class UploadIdParamDto {
  @ApiProperty({ type: String, example: "k3j9x0a1b2c3d4e5f6g7h8i9" })
  @Matches(/^[a-z0-9]{24}$/, { message: "Geçersiz yükleme kimliği" })
  uploadId!: string;
}
