import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
  ACCOUNT_LOCKED_EVENT,
  AccountLockedEvent,
  NEW_DEVICE_LOGIN_EVENT,
  NewDeviceLoginEvent,
  PASSWORD_CHANGED_EVENT,
  PasswordChangedEvent,
  USER_DELETED_EVENT,
  UserDeletedEvent,
} from "#/modules/auth/event/auth.events.js";
import { PushTokenRepository } from "#/modules/notification/repository/index.js";
import { NotificationDispatchService } from "#/modules/notification/services/index.js";
import type { NewNotification } from "#/modules/notification/types/index.js";
import { NotificationType } from "#database/enums.js";

/**
 * Hesap güvenliğini ilgilendiren olayları uygulama içi bildirime çevirir.
 * Yeni bir bildirim kaynağı eklemek için aynı kalıp izlenir: kaynak modül
 * event yayınlar, burada (veya konuya göre yeni bir handler'da) dinlenir.
 */
@Injectable()
export class NotificationEventHandler {
  private readonly logger = new Logger(NotificationEventHandler.name);

  constructor(
    private readonly dispatchService: NotificationDispatchService,
    private readonly pushTokenRepository: PushTokenRepository,
  ) {}

  /** Silinen hesabın cihazlarına artık bildirim gitmez. */
  @OnEvent(USER_DELETED_EVENT, { async: true })
  async handleUserDeleted(event: UserDeletedEvent): Promise<void> {
    try {
      await this.pushTokenRepository.deleteAllForUser(event.userId);
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }

  @OnEvent(PASSWORD_CHANGED_EVENT)
  async handlePasswordChanged(event: PasswordChangedEvent): Promise<void> {
    await this.send({
      recipientId: event.userId,
      type: NotificationType.PASSWORD_CHANGED,
      title: "Şifreniz değiştirildi",
      message:
        "Hesabınızın şifresi değiştirildi. Bu işlemi siz yapmadıysanız hemen şifrenizi sıfırlayın.",
    });
  }

  @OnEvent(ACCOUNT_LOCKED_EVENT)
  async handleAccountLocked(event: AccountLockedEvent): Promise<void> {
    await this.send({
      recipientId: event.userId,
      type: NotificationType.ACCOUNT_LOCKED,
      title: "Hesabınız geçici olarak kilitlendi",
      message: `Çok sayıda başarısız giriş denemesi nedeniyle girişler ${Math.ceil(event.lockedForSeconds / 60)} dakika kilitlendi (IP: ${event.ipAddress}). Siz değilseniz şifrenizi değiştirin.`,
    });
  }

  @OnEvent(NEW_DEVICE_LOGIN_EVENT)
  async handleNewDeviceLogin(event: NewDeviceLoginEvent): Promise<void> {
    await this.send({
      recipientId: event.userId,
      type: NotificationType.NEW_DEVICE_LOGIN,
      title: "Yeni bir cihazdan giriş yapıldı",
      message: `Hesabınıza yeni bir cihazdan giriş yapıldı (IP: ${event.ipAddress}). Siz değilseniz oturumu sonlandırıp şifrenizi değiştirin.`,
    });
  }

  private async send(input: NewNotification): Promise<void> {
    try {
      await this.dispatchService.send(input);
    } catch (error) {
      // Handler hatası ana işlemi etkilemez.
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }
}
