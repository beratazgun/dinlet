import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class UnreadCountResDto {
  @ApiProperty({ type: Number, example: 3 })
  @Expose()
  unreadCount!: number;
}
