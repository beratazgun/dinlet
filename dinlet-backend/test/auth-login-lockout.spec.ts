import { UnprocessableEntityException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import type { FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooManyAttemptsException } from "#/core/exceptions/index.js";
import { DateManager } from "#/core/utils/date-manager.js";
import { verifyPassword } from "#/core/utils/hash.js";
import type { RedisGetMeHelper } from "#/infra/redis/helpers/redis-get-me.helper.js";
import type { RedisLoginAttemptHelper } from "#/infra/redis/helpers/redis-login-attempt.helper.js";
import {
  ACCOUNT_LOCKED_EVENT,
  AccountLockedEvent,
} from "#/modules/auth/event/auth.events.js";
import type {
  AuthTokenRepository,
  AuthUserRepository,
} from "#/modules/auth/repository/index.js";
import type { AuthSessionService } from "#/modules/auth/services/auth-session.service.js";
import type { ConsentService } from "#/modules/auth/services/consent.service.js";
import { AuthService } from "#/modules/auth/services/auth.service.js";
import {
  LOGIN_LOCK_SECONDS,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from "#/modules/auth/utils/login-lockout.util.js";
import { AccountType, UserStatus } from "#database/enums.js";
import type { EnvType } from "#config/env.validation.js";

vi.mock("#/core/utils/hash.js", () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

const candidate = {
  id: 1,
  isEmailVerified: true,
  status: UserStatus.ACTIVE,
  role: { id: 1, code: "USER", isSuper: false },
  accounts: [{ type: AccountType.LOCAL, password: "hash" }],
};

const body = { email: "a@example.com", password: "secret" };
const metadata = { ipAddress: "1.2.3.4", userAgent: "ua" };
const request = {} as FastifyRequest;

describe("AuthService.login — hesap kilitleme", () => {
  let tracker: Record<keyof RedisLoginAttemptHelper, ReturnType<typeof vi.fn>>;
  let users: {
    findLoginUserByEmail: ReturnType<typeof vi.fn>;
    updateLastLogin: ReturnType<typeof vi.fn>;
  };
  let sessions: { issueSession: ReturnType<typeof vi.fn> };
  let events: { emit: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    vi.mocked(verifyPassword).mockResolvedValue(true);
    tracker = {
      lockedForSeconds: vi.fn().mockResolvedValue(0),
      recordFailure: vi.fn().mockResolvedValue(1),
      lock: vi.fn(),
      reset: vi.fn(),
    };
    users = {
      findLoginUserByEmail: vi.fn().mockResolvedValue(candidate),
      updateLastLogin: vi.fn(),
    };
    sessions = { issueSession: vi.fn().mockResolvedValue("issued") };
    events = { emit: vi.fn() };
    service = new AuthService(
      users as unknown as AuthUserRepository,
      {} as AuthTokenRepository,
      sessions as unknown as AuthSessionService,
      events as unknown as EventEmitter2,
      {} as RedisGetMeHelper,
      tracker as unknown as RedisLoginAttemptHelper,
      new DateManager(),
      {} as ConsentService,
      {} as ConfigService<EnvType>,
    );
  });

  it("kilitliyken parolaya bakmadan reddeder", async () => {
    tracker.lockedForSeconds.mockResolvedValue(120);

    const error = await service
      .login(body, metadata, request)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TooManyAttemptsException);
    expect((error as TooManyAttemptsException).retryAfterSeconds).toBe(120);
    expect(users.findLoginUserByEmail).not.toHaveBeenCalled();
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("eşik altındaki yanlış parolayı sayar ve geçersiz kimlik hatası döner", async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false);

    await expect(service.login(body, metadata, request)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(tracker.recordFailure).toHaveBeenCalledWith(
      body.email,
      expect.any(Number),
    );
    expect(tracker.lock).not.toHaveBeenCalled();
  });

  it("eşikte kilitler, kilit hatası döner ve ACCOUNT_LOCKED_EVENT yayınlar", async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false);
    tracker.recordFailure.mockResolvedValue(MAX_FAILED_LOGIN_ATTEMPTS);

    await expect(service.login(body, metadata, request)).rejects.toBeInstanceOf(
      TooManyAttemptsException,
    );
    expect(tracker.lock).toHaveBeenCalledWith(body.email, LOGIN_LOCK_SECONDS);
    const [eventName, event] = events.emit.mock.calls[0]!;
    expect(eventName).toBe(ACCOUNT_LOCKED_EVENT);
    expect(event).toBeInstanceOf(AccountLockedEvent);
    expect(event).toMatchObject({ userId: 1, ipAddress: "1.2.3.4" });
  });

  it("kayıtlı olmayan e-postayı da sayar ama event yayınlamaz", async () => {
    users.findLoginUserByEmail.mockResolvedValue(null);
    tracker.recordFailure.mockResolvedValue(MAX_FAILED_LOGIN_ATTEMPTS);

    await expect(service.login(body, metadata, request)).rejects.toBeInstanceOf(
      TooManyAttemptsException,
    );
    expect(tracker.lock).toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("başarılı girişte sayacı sıfırlar ve oturum açar", async () => {
    await service.login(body, metadata, request);

    expect(tracker.reset).toHaveBeenCalledWith(body.email);
    expect(tracker.recordFailure).not.toHaveBeenCalled();
    expect(sessions.issueSession).toHaveBeenCalled();
  });
});
