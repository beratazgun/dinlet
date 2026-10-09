export const USER_REGISTERED_EVENT = "auth.user.registered";
export const USER_EMAIL_VERIFIED_EVENT = "auth.user.email-verified";
export const PASSWORD_RESET_REQUESTED_EVENT = "auth.password-reset.requested";
export const PASSWORD_CHANGED_EVENT = "auth.password.changed";

export class UserRegisteredEvent {
  constructor(
    public readonly userId: number,
    public readonly verificationToken: string,
  ) {}
}

export class UserEmailVerifiedEvent {
  constructor(public readonly userId: number) {}
}

export class PasswordResetRequestedEvent {
  constructor(
    public readonly userId: number,
    public readonly resetToken: string,
  ) {}
}

export class PasswordChangedEvent {
  constructor(public readonly userId: number) {}
}

export const ACCOUNT_DELETION_REQUESTED_EVENT = "auth.account-deletion.requested";
export const ACCOUNT_LOCKED_EVENT = "auth.account.locked";
export const NEW_DEVICE_LOGIN_EVENT = "auth.login.new-device";
export const USER_DELETED_EVENT = "auth.user.deleted";

/**
 * Hesap silindi (anonimleştirildi). Diğer modüller kullanıcıya ait verileri
 * kapatır; kalıcı silme zamanlanmış temizlik işindedir.
 */
export class UserDeletedEvent {
  constructor(public readonly userId: number) {}
}

export class AccountDeletionRequestedEvent {
  constructor(
    public readonly userId: number,
    public readonly confirmationCode: string,
  ) {}
}

/** Çok sayıda başarısız giriş sonrası hesap geçici olarak kilitlendi. */
export class AccountLockedEvent {
  constructor(
    public readonly userId: number,
    public readonly lockedForSeconds: number,
    public readonly ipAddress: string,
  ) {}
}

/** Hesaba daha önce görülmemiş bir cihazdan giriş yapıldı. */
export class NewDeviceLoginEvent {
  constructor(
    public readonly userId: number,
    public readonly ipAddress: string,
    public readonly userAgent: string,
    /** ISO 8601 */
    public readonly loggedInAt: string,
  ) {}
}
