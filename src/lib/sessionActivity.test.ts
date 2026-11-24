import { describe, expect, it } from "vitest";
import {
  ACTIVITY_COOKIE,
  evaluateActivity,
  evaluateAbsoluteCap,
  readActivity,
  signActivity,
} from "./sessionActivity";

const limits = { idleMs: 15 * 60_000, absoluteMs: 4 * 60 * 60_000 };
const SECRET = "test-internal-secret";

describe("evaluateActivity", () => {
  it("is active within both windows", () => {
    expect(evaluateActivity({ start: 0, last: 0 }, 5 * 60_000, limits)).toBe("active");
  });

  it("is idle-expired exactly at the idle limit", () => {
    expect(evaluateActivity({ start: 0, last: 0 }, 15 * 60_000, limits)).toBe("idle-expired");
  });

  it("is still active one millisecond before the idle limit", () => {
    expect(evaluateActivity({ start: 0, last: 0 }, 15 * 60_000 - 1, limits)).toBe("active");
  });

  it("is absolute-expired at the 4-hour cap even when just active", () => {
    const now = 4 * 60 * 60_000;
    expect(evaluateActivity({ start: 0, last: now }, now, limits)).toBe("absolute-expired");
  });

  it("prefers absolute-expired over idle-expired when both are past", () => {
    const now = 5 * 60 * 60_000; // past both
    expect(evaluateActivity({ start: 0, last: 0 }, now, limits)).toBe("absolute-expired");
  });

  it("stays active when activity keeps advancing below the absolute cap", () => {
    const now = 3 * 60 * 60_000;
    expect(evaluateActivity({ start: 0, last: now - 60_000 }, now, limits)).toBe("active");
  });
});

describe("evaluateAbsoluteCap (the cookie-less fallback from the session_started_at claim)", () => {
  const ABS = limits.absoluteMs;

  it("is absolute-expired once the session is older than the hard cap", () => {
    const start = 0;
    expect(evaluateAbsoluteCap(start, ABS, ABS)).toBe("absolute-expired");
    expect(evaluateAbsoluteCap(start, ABS + 60_000, ABS)).toBe("absolute-expired");
  });

  it("allows (null) a session still within the cap — a brand-new session is never expired", () => {
    const now = 1_000_000;
    expect(evaluateAbsoluteCap(now, now, ABS)).toBeNull(); // just started
    expect(evaluateAbsoluteCap(now - (ABS - 1), now, ABS)).toBeNull(); // 1ms before the cap
  });

  it("gives no opinion (null) when the claim is absent, so routing falls back to the cookie", () => {
    expect(evaluateAbsoluteCap(null, 10 * ABS, ABS)).toBeNull();
  });

  it("never reports idle — only the absolute cap is enforceable from the claim", () => {
    // A long-idle but not-yet-absolute session is allowed here (idle needs the cookie / registry).
    const now = 3 * 60 * 60_000; // 3h old, under the 4h cap
    expect(evaluateAbsoluteCap(0, now, ABS)).toBeNull();
  });
});

describe("signActivity / readActivity", () => {
  it("round-trips a signed payload", async () => {
    const cookie = await signActivity({ start: 1000, last: 2000 }, SECRET);
    expect(await readActivity(cookie, SECRET)).toEqual({ start: 1000, last: 2000 });
  });

  it("rejects a cookie signed with a different secret", async () => {
    const cookie = await signActivity({ start: 1000, last: 2000 }, SECRET);
    expect(await readActivity(cookie, "other-secret")).toBeNull();
  });

  it("rejects a tampered payload (timestamps no longer match the signature)", async () => {
    const cookie = await signActivity({ start: 1000, last: 2000 }, SECRET);
    const [, mac] = cookie.split(".");
    const forgedBody = Buffer.from(JSON.stringify({ s: 0, l: 0 })).toString("base64url");
    expect(await readActivity(`${forgedBody}.${mac}`, SECRET)).toBeNull();
  });

  it("rejects empty, malformed, and non-two-part values (fails closed)", async () => {
    expect(await readActivity(undefined, SECRET)).toBeNull();
    expect(await readActivity("", SECRET)).toBeNull();
    expect(await readActivity("nodot", SECRET)).toBeNull();
    expect(await readActivity("!!!.$$$", SECRET)).toBeNull();
  });

  it("exposes a stable cookie name", () => {
    expect(ACTIVITY_COOKIE).toBe("tp-activity");
  });
});
