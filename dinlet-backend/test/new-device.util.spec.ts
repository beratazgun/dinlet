import { describe, expect, it } from "vitest";

import {
  deviceKeyOf,
  shouldAlertNewDevice,
} from "#/modules/auth/utils/new-device.util.js";

describe("new-device.util", () => {
  it("sürüm numaralarını yok sayar", () => {
    expect(deviceKeyOf("Mozilla/5.0 Chrome/131.0.1 Safari/537.36")).toBe(
      deviceKeyOf("Mozilla/5.0 Chrome/132.0.4 Safari/537.36"),
    );
  });

  it("farklı tarayıcı/OS'u farklı cihaz sayar", () => {
    expect(deviceKeyOf("Mozilla/5.0 (Macintosh) Chrome/131.0")).not.toBe(
      deviceKeyOf("Mozilla/5.0 (Windows NT 10.0) Firefox/133.0"),
    );
  });

  it("user-agent yoksa cihaz tanımlanamaz", () => {
    expect(deviceKeyOf(null)).toBeNull();
    expect(deviceKeyOf("   ")).toBeNull();
  });

  it("yalnızca bilinen cihazı olan hesapta yeni cihaz için uyarır", () => {
    expect(shouldAlertNewDevice({ isNewDevice: true, knownDeviceCountBefore: 0 })).toBe(false);
    expect(shouldAlertNewDevice({ isNewDevice: true, knownDeviceCountBefore: 2 })).toBe(true);
    expect(shouldAlertNewDevice({ isNewDevice: false, knownDeviceCountBefore: 2 })).toBe(false);
  });
});
