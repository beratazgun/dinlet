import { describe, expect, it } from "vitest";

import {
  REDACTED,
  redactSensitive,
  toAuditPayload,
} from "#/infra/audit/utils/index.js";

describe("audit-payload.util", () => {
  it("should redact sensitive fields in regular objects", () => {
    const input = { username: "john", password: "plain_password" };
    expect(redactSensitive(input)).toEqual({
      username: "john",
      password: REDACTED,
    });
  });

  it("should redact old and new values in diff items when field name is sensitive", () => {
    const diff = [
      { field: "name", old: "oldName", new: "newName" },
      { field: "password", old: "oldSecret", new: "newSecret" },
      { field: "apiKey", old: "key123", new: "key456" },
    ];

    const result = toAuditPayload(diff);

    expect(result).toEqual([
      { field: "name", old: "oldName", new: "newName" },
      { field: "password", old: REDACTED, new: REDACTED },
      { field: "apiKey", old: REDACTED, new: REDACTED },
    ]);
  });
});
