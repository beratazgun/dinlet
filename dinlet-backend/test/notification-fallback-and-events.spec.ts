import { describe, expect, it, vi } from "vitest";
import type { ConfigService } from "@nestjs/config";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import type { FastifyRequest } from "fastify";

import { NotificationsService } from "#/infra/notifications/notifications.service.js";
import { NOTIFICATION_TEMPLATES } from "#/infra/notifications/constants/notification-templates.constant.js";
import type { NotificationProvider } from "#/infra/notifications/providers/abstract.provider.js";
import { AuthEventHandler } from "#/modules/auth/event/auth.event-handler.js";
import {
  ACCOUNT_DELETION_REQUESTED_EVENT,
  ACCOUNT_LOCKED_EVENT,
  AccountDeletionRequestedEvent,
  AccountLockedEvent,
  NEW_DEVICE_LOGIN_EVENT,
  NewDeviceLoginEvent,
  PASSWORD_CHANGED_EVENT,
  PASSWORD_RESET_REQUESTED_EVENT,
  PasswordChangedEvent,
  PasswordResetRequestedEvent,
  USER_EMAIL_VERIFIED_EVENT,
  USER_REGISTERED_EVENT,
  UserEmailVerifiedEvent,
  UserRegisteredEvent,
} from "#/modules/auth/event/auth.events.js";
import type { AuthUserRepository } from "#/modules/auth/repository/index.js";
import type { EmailQueueService } from "#/infra/queue/index.js";
import type { RedisLoginAttemptHelper } from "#/infra/redis/helpers/redis-login-attempt.helper.js";
import { AuthSocialService } from "#/modules/auth/services/auth-social.service.js";
import { AuthPasswordService } from "#/modules/auth/services/auth-password.service.js";
import { AccountType, UserStatus } from "#database/enums.js";

describe("Notification Templates & Events Integration", () => {
  describe("NotificationsService code-level fallback", () => {
    it("veritabanında şablon olmasa bile tüm 9 şablon kod içi fallback ile çözülür ve loglanır", async () => {
      // Mock DB: NotificationTemplates tablosu tamamen BOŞ (first() => null döner)
      const mockDb = {
        client: {
          orm: {
            public: {
              NotificationTemplates: {
                where: () => ({
                  first: vi.fn().mockResolvedValue(null),
                }),
              },
            },
          },
        },
      };

      const mockConfig = {
        get: vi.fn((key: string) => {
          if (key === "EMAIL_DELIVERY") return "log";
          if (key === "ALERT_EMAIL") return "ops@dinlet.app";
          return null;
        }),
      };

      const mockProvider: NotificationProvider = {
        send: vi.fn().mockResolvedValue({ success: true }),
        test: vi.fn().mockResolvedValue(true),
      };

      const service = new NotificationsService(
        { "email.provider": mockProvider },
        mockDb as any,
        mockConfig as unknown as ConfigService<any>,
      );

      for (const t of NOTIFICATION_TEMPLATES) {
        const result = await service.sendEmailWithFallback({
          to: "test@dinlet.app",
          code: t.code,
          variables: t.sampleVariables,
        });

        expect(result.success).toBe(true);
      }
    });

    it("bilinmeyen bir kod geldiğinde hata döner", async () => {
      const mockDb = {
        client: {
          orm: {
            public: {
              NotificationTemplates: {
                where: () => ({
                  first: vi.fn().mockResolvedValue(null),
                }),
              },
            },
          },
        },
      };

      const mockConfig = {
        get: vi.fn(() => "log"),
      };

      const service = new NotificationsService(
        {},
        mockDb as any,
        mockConfig as unknown as ConfigService<any>,
      );

      const result = await service.sendEmailWithFallback({
        to: "test@dinlet.app",
        code: "NON_EXISTING_TEMPLATE",
        variables: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("template bulunamadı");
    });
  });

  describe("AuthEventHandler email enqueuing", () => {
    const mockUser = {
      id: 42,
      name: "Elif",
      surname: "Yılmaz",
      email: "elif@dinlet.app",
    };

    const mockUserRepo = {
      findById: vi.fn().mockResolvedValue(mockUser),
    };

    const mockEmailQueue = {
      enqueueEmail: vi.fn().mockResolvedValue(undefined),
    };

    const mockConfig = {
      get: vi.fn((key: string) => {
        if (key === "SERVICE_DOMAIN") return "https://api.dinlet.app";
        if (key === "FRONTEND_URL") return "https://dinlet.app";
        return null;
      }),
    };

    const mockLoginAttempts = {
      reset: vi.fn().mockResolvedValue(undefined),
    };

    const handler = new AuthEventHandler(
      mockConfig as unknown as ConfigService<any>,
      mockUserRepo as unknown as AuthUserRepository,
      mockEmailQueue as unknown as EmailQueueService,
      mockLoginAttempts as unknown as RedisLoginAttemptHelper,
    );

    it("USER_REGISTERED_EVENT -> VERIFICATION_EMAIL", async () => {
      mockEmailQueue.enqueueEmail.mockClear();
      await handler.handleUserRegistered(new UserRegisteredEvent(42, "token-123"));

      expect(mockEmailQueue.enqueueEmail).toHaveBeenCalledWith({
        to: "elif@dinlet.app",
        code: "VERIFICATION_EMAIL",
        variables: expect.objectContaining({
          name: "Elif",
          surname: "Yılmaz",
          confirmUrl: expect.stringContaining("token-123"),
        }),
      });
    });

    it("USER_EMAIL_VERIFIED_EVENT -> WELCOME", async () => {
      mockEmailQueue.enqueueEmail.mockClear();
      await handler.handleUserEmailVerified(new UserEmailVerifiedEvent(42));

      expect(mockEmailQueue.enqueueEmail).toHaveBeenCalledWith({
        to: "elif@dinlet.app",
        code: "WELCOME",
        variables: { name: "Elif", surname: "Yılmaz" },
      });
    });

    it("PASSWORD_RESET_REQUESTED_EVENT -> PASSWORD_RESET_EMAIL", async () => {
      mockEmailQueue.enqueueEmail.mockClear();
      await handler.handlePasswordResetRequested(
        new PasswordResetRequestedEvent(42, "reset-token-456"),
      );

      expect(mockEmailQueue.enqueueEmail).toHaveBeenCalledWith({
        to: "elif@dinlet.app",
        code: "PASSWORD_RESET_EMAIL",
        variables: expect.objectContaining({
          userName: "Elif Yılmaz",
          resetLink: expect.stringContaining("reset-token-456"),
          expiresIn: "15 dakika",
        }),
      });
    });

    it("PASSWORD_CHANGED_EVENT -> PASSWORD_CHANGED", async () => {
      mockEmailQueue.enqueueEmail.mockClear();
      await handler.handlePasswordChanged(new PasswordChangedEvent(42));

      expect(mockEmailQueue.enqueueEmail).toHaveBeenCalledWith({
        to: "elif@dinlet.app",
        code: "PASSWORD_CHANGED",
        variables: { name: "Elif", surname: "Yılmaz" },
      });
    });

    it("ACCOUNT_DELETION_REQUESTED_EVENT -> ACCOUNT_DELETION_EMAIL", async () => {
      mockEmailQueue.enqueueEmail.mockClear();
      await handler.handleAccountDeletionRequested(
        new AccountDeletionRequestedEvent(42, "654321"),
      );

      expect(mockEmailQueue.enqueueEmail).toHaveBeenCalledWith({
        to: "elif@dinlet.app",
        code: "ACCOUNT_DELETION_EMAIL",
        variables: {
          code: "654321",
          name: "Elif",
          surname: "Yılmaz",
          expiresIn: "5 dakika",
        },
      });
    });

    it("ACCOUNT_LOCKED_EVENT -> ACCOUNT_LOCKED", async () => {
      mockEmailQueue.enqueueEmail.mockClear();
      await handler.handleAccountLocked(
        new AccountLockedEvent(42, 900, "192.168.1.1"),
      );

      expect(mockEmailQueue.enqueueEmail).toHaveBeenCalledWith({
        to: "elif@dinlet.app",
        code: "ACCOUNT_LOCKED",
        variables: expect.objectContaining({
          name: "Elif",
          surname: "Yılmaz",
          lockedForMinutes: 15,
          ipAddress: "192.168.1.1",
        }),
      });
    });

    it("NEW_DEVICE_LOGIN_EVENT -> NEW_DEVICE_LOGIN", async () => {
      mockEmailQueue.enqueueEmail.mockClear();
      await handler.handleNewDeviceLogin(
        new NewDeviceLoginEvent(
          42,
          "192.168.1.1",
          "Mozilla/5.0 iOS",
          "2026-10-09T10:00:00Z",
        ),
      );

      expect(mockEmailQueue.enqueueEmail).toHaveBeenCalledWith({
        to: "elif@dinlet.app",
        code: "NEW_DEVICE_LOGIN",
        variables: expect.objectContaining({
          name: "Elif",
          surname: "Yılmaz",
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0 iOS",
        }),
      });
    });
  });

  describe("Social signup welcome email trigger", () => {
    it("yeni sosyal kullanıcı kaydolunca USER_EMAIL_VERIFIED_EVENT yayınlanır", async () => {
      const mockIdentityService = {
        verifyGoogle: vi.fn().mockResolvedValue({
          provider: AccountType.GOOGLE,
          providerAccountId: "google-123",
          email: "googleuser@dinlet.app",
          isEmailVerified: true,
          name: "Can",
          surname: "Demir",
        }),
      };

      const mockUserRepo = {
        findOrCreateSocialUser: vi.fn().mockResolvedValue({
          id: 99,
          role: { id: 1, code: "USER" },
          status: UserStatus.ACTIVE,
          isNewUser: true,
        }),
        updateLastLogin: vi.fn().mockResolvedValue(undefined),
      };

      const mockSessionService = {
        issueSession: vi.fn().mockResolvedValue({ status: 200, message: "Giriş başarılı" }),
      };

      const mockEventEmitter = {
        emit: vi.fn(),
      };

      const socialService = new AuthSocialService(
        mockIdentityService as any,
        mockUserRepo as any,
        mockSessionService as any,
        mockEventEmitter as unknown as EventEmitter2,
      );

      await socialService.loginWithGoogle(
        { idToken: "sample-google-id-token" },
        { ipAddress: "127.0.0.1", userAgent: "mobile" },
        {} as FastifyRequest,
      );

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        USER_EMAIL_VERIFIED_EVENT,
        expect.objectContaining({ userId: 99 }),
      );
    });

    it("önceden kayıtlı sosyal kullanıcı tekrar giriş yapınca WELCOME tetiklenmez", async () => {
      const mockIdentityService = {
        verifyGoogle: vi.fn().mockResolvedValue({
          provider: AccountType.GOOGLE,
          providerAccountId: "google-123",
          email: "googleuser@dinlet.app",
          isEmailVerified: true,
          name: "Can",
          surname: "Demir",
        }),
      };

      const mockUserRepo = {
        findOrCreateSocialUser: vi.fn().mockResolvedValue({
          id: 99,
          role: { id: 1, code: "USER" },
          status: UserStatus.ACTIVE,
          isNewUser: false,
        }),
        updateLastLogin: vi.fn().mockResolvedValue(undefined),
      };

      const mockSessionService = {
        issueSession: vi.fn().mockResolvedValue({ status: 200, message: "Giriş başarılı" }),
      };

      const mockEventEmitter = {
        emit: vi.fn(),
      };

      const socialService = new AuthSocialService(
        mockIdentityService as any,
        mockUserRepo as any,
        mockSessionService as any,
        mockEventEmitter as unknown as EventEmitter2,
      );

      await socialService.loginWithGoogle(
        { idToken: "sample-google-id-token" },
        { ipAddress: "127.0.0.1", userAgent: "mobile" },
        {} as FastifyRequest,
      );

      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe("Password reset token resend", () => {
    it("aktif token olsa bile hata fırlatmaz, tokenı yeniler ve PASSWORD_RESET_REQUESTED_EVENT yayınlar", async () => {
      const mockUser = {
        id: 77,
        email: "sifremiunuttum@dinlet.app",
        isEmailVerified: true,
        accounts: [{ type: AccountType.LOCAL }],
      };

      const mockUserRepo = {
        findByEmail: vi.fn().mockResolvedValue(mockUser),
      };

      const mockTokenRepo = {
        findActiveVerificationTokenByUserId: vi.fn().mockResolvedValue({
          token: "existing-active-token",
        }),
        createPasswordResetToken: vi.fn(),
      };

      const mockEventEmitter = {
        emit: vi.fn(),
      };

      const service = new AuthPasswordService(
        mockUserRepo as any,
        mockTokenRepo as any,
        {} as any,
        mockEventEmitter as unknown as EventEmitter2,
        {} as any,
        {} as any,
        {} as any,
      );

      const response = await service.forgotPassword({ email: mockUser.email });

      expect(response.message).toContain("bağlantısı gönderildi");
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        PASSWORD_RESET_REQUESTED_EVENT,
        expect.objectContaining({ userId: 77, resetToken: "existing-active-token" }),
      );
    });
  });
});
