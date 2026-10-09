import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class GoogleMobileLoginBodyDto {
  @ApiProperty({
    type: String,
    description: "Yerel Google Sign-In'den dönen `idToken`",
  })
  @IsString({ message: "idToken metin olmalıdır" })
  @IsNotEmpty({ message: "idToken zorunludur" })
  @MaxLength(4096, { message: "idToken çok uzun" })
  idToken!: string;
}
