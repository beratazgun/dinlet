import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

export class DocumentPreflightBodyDto {
  @ApiProperty({
    type: Number,
    example: 12,
    description:
      "`POST /media/uploads/:id/complete` ile tamamlanan PDF'in ID'si",
  })
  @IsInt({ message: "Medya ID tam sayı olmalıdır" })
  @Min(1, { message: "Medya ID en az 1 olmalıdır" })
  mediaId!: number;
}
