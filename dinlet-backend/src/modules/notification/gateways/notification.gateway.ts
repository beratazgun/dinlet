import { Logger } from "@nestjs/common";
import {
  type OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { plainToInstance } from "class-transformer";
import type { Namespace, Socket } from "socket.io";

import type { AuthenticatedSocketData } from "#/infra/session/index.js";
import { NotificationResDto } from "#/modules/notification/dtos/index.js";
import type { Notification } from "#/modules/notification/types/index.js";

/** İstemcinin dinleyeceği olay adı. */
export const NOTIFICATION_EVENT = "notification";

const userRoom = (userId: number) => `user:${userId}`;

/**
 * `/notifications` namespace'i. Kimlik doğrulama `SessionIoAdapter`'da,
 * el sıkışmada yapılır; buraya yalnızca oturumu geçerli soketler ulaşır.
 * Her soket kullanıcısının odasına katılır; bildirim odaya yayınlanır, böylece
 * kullanıcının tüm sekme/cihazları (ve tüm instance'lar) aynı anda alır.
 *
 * İstemci: `io("<api>/notifications", { withCredentials: true })` →
 * `socket.on("notification", (n) => …)`.
 */
@WebSocketGateway({ namespace: "/notifications" })
export class NotificationGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  private readonly server!: Namespace;

  async handleConnection(socket: Socket): Promise<void> {
    const { user } = socket.data as AuthenticatedSocketData;
    await socket.join(userRoom(user.id));
  }

  /**
   * Kullanıcının tüm açık bağlantılarına bir olay yayınlar (ör.
   * `document:progress`). En iyi çabadır; kalıcı durum API'den okunur.
   */
  emitToUser(userId: number, event: string, payload: unknown): void {
    try {
      this.server.to(userRoom(userId)).emit(event, payload);
    } catch (error) {
      this.logger.warn(
        `Olay iletilemedi (${event}, user=${userId}): ${String(error)}`,
      );
    }
  }

  /**
   * Bildirimi alıcının açık bağlantılarına anlık iletir. Teslim garantisi
   * yoktur; kalıcı kayıt veritabanındadır, istemci bağlanınca listeyi çeker.
   */
  notify(recipientId: number, notification: Notification): void {
    try {
      const payload = plainToInstance(NotificationResDto, notification, {
        excludeExtraneousValues: true,
      });
      this.server.to(userRoom(recipientId)).emit(NOTIFICATION_EVENT, payload);
    } catch (error) {
      // Anlık iletim en iyi çabadır; kayıt zaten veritabanında.
      this.logger.warn(
        `Bildirim iletilemedi (user=${recipientId}): ${String(error)}`,
      );
    }
  }
}
