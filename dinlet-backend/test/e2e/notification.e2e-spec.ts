import { io, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { HttpClient } from "./support/http-client.js";
import {
  createActiveUser,
  startTestApp,
  type TestApp,
  type TestUser,
} from "./support/test-app.js";

interface NotificationItem {
  id: number;
  type: { raw: string; display: string };
  title: string | null;
  message: string;
  isRead: boolean;
}

describe("Notification (e2e)", () => {
  let testApp: TestApp;
  let user: TestUser;
  let client: HttpClient;
  const sockets: Socket[] = [];

  function connect(headers: Record<string, string>): Socket {
    const socket = io(`${testApp.baseUrl}/notifications`, {
      transports: ["websocket"],
      extraHeaders: headers,
      reconnection: false,
    });
    sockets.push(socket);
    return socket;
  }

  function waitFor<T>(socket: Socket, event: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`'${event}' gelmedi`)), 5_000);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  beforeAll(async () => {
    testApp = await startTestApp();
    user = await createActiveUser(testApp.app);
    client = await new HttpClient(testApp.baseUrl).login(user.email, user.password);
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) socket.disconnect();
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("oturumsuz WebSocket bağlantısını reddeder", async () => {
    const socket = connect({ "user-agent": client.userAgent });
    const error = await waitFor<Error>(socket, "connect_error");
    expect(error.message).toMatch(/Oturum/);
  });

  it("izin verilmeyen Origin'den gelen bağlantıyı reddeder", async () => {
    const socket = connect({
      cookie: client.cookieHeader,
      "user-agent": client.userAgent,
      origin: "https://evil.example.com",
    });
    await expect(waitFor(socket, "connect")).rejects.toThrow();
  });

  it("başka cihazdan kullanılan oturum cookie'sini reddeder", async () => {
    const socket = connect({
      cookie: client.cookieHeader,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0) Another/1.0",
    });
    await waitFor(socket, "connect_error");
  });

  it("şifre değişince bildirimi anlık iletir ve kaydeder", async () => {
    const socket = connect({ cookie: client.cookieHeader, "user-agent": client.userAgent });
    await waitFor(socket, "connect");
    const pushed = waitFor<NotificationItem>(socket, "notification");

    const newPassword = "E2eChanged456!";
    const changed = await client.patch("/auth/change-password", {
      currentPassword: user.password,
      newPassword,
      confirmPassword: newPassword,
    });
    expect(changed.status).toBe(200);

    const notification = await pushed;
    expect(notification.type.raw).toBe("PASSWORD_CHANGED");
    expect(notification.isRead).toBe(false);

    const list = await client.get<NotificationItem[]>("/notifications");
    expect(list.status).toBe(200);
    expect(list.body.data![0]).toMatchObject({ id: notification.id, isRead: false });
    expect(list.body.meta).toMatchObject({ pagination: { hasNextPage: false, nextCursor: null } });

    const unread = await client.get<{ unreadCount: number }>("/notifications/unread-count");
    expect(unread.body.data!.unreadCount).toBe(1);
  });

  it("okundu işaretler ve başkasının bildirimine dokunamaz", async () => {
    const list = await client.get<NotificationItem[]>("/notifications?unreadOnly=true");
    const target = list.body.data![0];

    const other = await createActiveUser(testApp.app);
    const otherClient = await new HttpClient(testApp.baseUrl).login(other.email, other.password);
    expect((await otherClient.patch(`/notifications/${target.id}/read`)).status).toBe(404);

    expect((await client.patch(`/notifications/${target.id}/read`)).status).toBe(200);
    const unread = await client.get<{ unreadCount: number }>("/notifications/unread-count");
    expect(unread.body.data!.unreadCount).toBe(0);

    const readAll = await client.patch("/notifications/read-all");
    expect(readAll.status).toBe(200);
  });
});
