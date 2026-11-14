import { describe, it, expect, vi } from "vitest";

// The security-alert templates + fan-out are a pure module shared by the Deno edge functions; vitest imports
// it directly (relative path) so the content rules (NFR-P4: no links/secrets) and the fan-out semantics are
// proven in CI even though the edge runtime itself is not unit-tested here.
import {
  buildNotice,
  formatUtc,
  sendSecurityNotice,
  type NoticeTransport,
  type SecurityNoticeType,
} from "../../../../supabase/functions/_shared/noticeTemplates";

const WHEN = new Date("2026-11-13T20:45:00Z");

describe("formatUtc", () => {
  it("renders UTC day-month-year with 24-hour time regardless of host zone", () => {
    expect(formatUtc(WHEN)).toBe("13-11-2026 20:45 UTC");
  });
});

describe("buildNotice", () => {
  const types: SecurityNoticeType[] = ["email_changed", "password_changed", "two_factor_replaced"];

  it.each(types)("%s notice states what+when, tells the user what to do, and carries no links or codes", (type) => {
    const notice = buildNotice(type, WHEN);
    expect(notice.subject.length).toBeGreaterThan(0);
    expect(notice.text).toContain("13-11-2026 20:45 UTC");
    expect(notice.text).toContain("Administrator Manager");
    // NFR-P4 / OWASP: never a link or a secret in a security notice.
    expect(notice.text).not.toMatch(/https?:\/\//i);
    expect(notice.text.toLowerCase()).not.toContain("password:");
    expect(notice.text.toLowerCase()).not.toContain("token");
    expect(notice.text.toLowerCase()).not.toContain("code:");
  });
});

describe("sendSecurityNotice", () => {
  it("sends one message to each recipient (email change → old and new)", async () => {
    const sent: string[] = [];
    const transport: NoticeTransport = { send: async (to) => void sent.push(to) };
    const result = await sendSecurityNotice(transport, ["old@example.com", "new@example.com"], "email_changed", WHEN);
    expect(sent).toEqual(["old@example.com", "new@example.com"]);
    expect(result).toEqual({ attempted: 2, failed: 0 });
  });

  it("counts a failed recipient without throwing, so the change is never undone", async () => {
    const transport: NoticeTransport = {
      send: vi.fn(async (to: string) => {
        if (to === "bad@example.com") throw new Error("smtp down");
      }),
    };
    const result = await sendSecurityNotice(
      transport,
      ["good@example.com", "bad@example.com"],
      "password_changed",
      WHEN,
    );
    expect(result).toEqual({ attempted: 2, failed: 1 });
  });
});
