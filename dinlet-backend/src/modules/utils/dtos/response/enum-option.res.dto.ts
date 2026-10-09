import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

/** Enum seçeneği (value/label) response DTO'su. */
export class EnumOptionResDto {
  @ApiProperty()
  @Expose()
  value!: string;

  @ApiProperty()
  @Expose()
  label!: string;
}
