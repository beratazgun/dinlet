import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";

import { ToBoolean } from "#/core/decorators/index.js";
import { CursorQueryDto } from "#/core/dtos/request/index.js";

/** Bildirim listesi: keyset sayfalama + yalnızca okunmamışlar filtresi. */
export class NotificationListQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ type: Boolean, example: true })
  @ToBoolean()
  @IsOptional()
  @IsBoolean({ message: "unreadOnly true veya false olmalıdır" })
  unreadOnly?: boolean;
}
