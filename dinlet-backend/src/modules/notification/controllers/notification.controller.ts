import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  ApiErrorResponses,
  ApiSuccessResponse,
  CurrentUser,
  Serialize,
} from "#/core/decorators/index.js";
import { EmptyResDto } from "#/core/dtos/response/index.js";
import type { OkResponse } from "#/core/http/index.js";
import {
  NotificationIdParamDto,
  NotificationListQueryDto,
  NotificationResDto,
  UnreadCountResDto,
} from "#/modules/notification/dtos/index.js";
import { NotificationService } from "#/modules/notification/services/index.js";
import type { SessionUser } from "#/types/index.js";

/**
 * Kullanıcının uygulama içi bildirimleri. Yeni bildirimler ayrıca
 * `/notifications` WebSocket namespace'inden anlık iletilir.
 */
@ApiTags("Notification")
@ApiCookieAuth()
@Controller("notifications")
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @Serialize(NotificationResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Bildirimlerimi listele" })
  @ApiSuccessResponse({
    model: NotificationResDto,
    isArray: true,
    pagination: "cursor",
    description: "Bildirimler",
  })
  @ApiErrorResponses(400, 401, 500)
  list(
    @Query() query: NotificationListQueryDto,
    @CurrentUser() user: SessionUser,
  ): Promise<OkResponse> {
    return this.notificationService.list(query, user.id);
  }

  @Get("unread-count")
  @Serialize(UnreadCountResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Okunmamış bildirim sayısı" })
  @ApiSuccessResponse({ model: UnreadCountResDto, description: "Sayı" })
  @ApiErrorResponses(401, 500)
  unreadCount(@CurrentUser() user: SessionUser): Promise<OkResponse> {
    return this.notificationService.countUnread(user.id);
  }

  @Patch("read-all")
  @Serialize(EmptyResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Tüm bildirimleri okundu işaretle" })
  @ApiSuccessResponse({ description: "Bildirimler okundu işaretlendi" })
  @ApiErrorResponses(401, 403, 500)
  readAll(@CurrentUser() user: SessionUser): Promise<OkResponse> {
    return this.notificationService.markAllRead(user.id);
  }

  @Patch(":id/read")
  @Serialize(EmptyResDto)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Bildirimi okundu işaretle" })
  @ApiSuccessResponse({ description: "Bildirim okundu işaretlendi" })
  @ApiErrorResponses(400, 401, 403, 404, 500)
  read(
    @Param() params: NotificationIdParamDto,
    @CurrentUser() user: SessionUser,
  ): Promise<OkResponse> {
    return this.notificationService.markRead(params.id, user.id);
  }
}
