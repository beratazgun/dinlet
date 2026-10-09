import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

/** Destek: içeriği bir kullanıcıya ücretsiz tanımlar (ör. sorunlu satın alma). */
export class GrantStoreItemBodyDto {
  @ApiProperty({ type: Number, example: 42 })
  @IsInt({ message: "Kullanıcı ID tam sayı olmalıdır" })
  @Min(1, { message: "Kullanıcı ID en az 1 olmalıdır" })
  userId!: number;
}
