import { describe, expect, it, vi } from "vitest";

import type { NotificationGateway } from "#/modules/notification/gateways/index.js";
import type { NotificationRepository } from "#/modules/notification/repository/index.js";
import { NotificationDispatchService } from "#/modules/notification/services/index.js";
import { NotificationType } from "#database/enums.js";

describe("NotificationDispatchService", () => {
  it("bildirimi kaydeder ve kayıtlı hâlini alıcıya anlık iletir", async () => {
    const stored = { id: 5, recipientId: 3, message: "m" };
    const repository = { create: vi.fn().mockResolvedValue(stored) };
    const gateway = { notify: vi.fn() };
    const service = new NotificationDispatchService(
      repository as unknown as NotificationRepository,
      gateway as unknown as NotificationGateway,
    );

    const result = await service.send({
      recipientId: 3,
      type: NotificationType.PASSWORD_CHANGED,
      message: "m",
    });

    expect(result).toBe(stored);
    expect(gateway.notify).toHaveBeenCalledWith(3, stored);
  });

  it("kayıt başarısızsa iletmez", async () => {
    const repository = { create: vi.fn().mockRejectedValue(new Error("db")) };
    const gateway = { notify: vi.fn() };
    const service = new NotificationDispatchService(
      repository as unknown as NotificationRepository,
      gateway as unknown as NotificationGateway,
    );

    await expect(
      service.send({
        recipientId: 3,
        type: NotificationType.DOCUMENT_READY,
        message: "m",
      }),
    ).rejects.toThrow("db");
    expect(gateway.notify).not.toHaveBeenCalled();
  });
});
