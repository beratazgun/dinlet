import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Length } from "class-validator";

export class DeleteAccountBodyDto {
  @ApiProperty({ example: "123456", minLength: 6, maxLength: 6 })
  @IsString({ message: "Doğrulama kodu metin olmalıdır." })
  @IsNotEmpty({ message: "Doğrulama kodu zorunludur." })
  @Length(6, 6, { message: "Doğrulama kodu 6 haneli olmalıdır." })
  code!: string;
}
