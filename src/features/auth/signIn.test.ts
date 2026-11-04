import { describe, expect, it, vi } from "vitest";
import {
  performSignIn,
  SignInBlocked,
  SIGN_IN_TIMING_FLOOR_MS,
  type SignInPorts,
} from "./signIn";

const INPUT = { email: "abe@example.test", password: "x".repeat(12), turnstileToken: "tok", ip: "1.2.3.4" };

// Fake ports with a controllable clock. By default now() stays at 0, so the failure padding is exercised.
function makePorts(over: Partial<SignInPorts> & { clock?: number[] } = {}): SignInPorts & {
  sleepMock: ReturnType<typeof vi.fn>;
  recordFailureMock: ReturnType<typeof vi.fn>;
  attemptMock: ReturnType<typeof vi.fn>;
} {
  const clock = over.clock ?? [0, 0];
  let i = 0;
  const sleepMock = vi.fn(async () => undefined);
  const recordFailureMock = vi.fn(async () => undefined);
  const attemptMock = vi.fn(async () => false);
  return {
    checkSignIn: over.checkSignIn ?? (async () => ({ allowed: true })),
    attemptPassword: over.attemptPassword ?? attemptMock,
    recordFailure: over.recordFailure ?? recordFailureMock,
    now: over.now ?? (() => clock[Math.min(i++, clock.length - 1)]),
    sleep: over.sleep ?? sleepMock,
    sleepMock,
    recordFailureMock,
    attemptMock,
  };
}

describe("performSignIn", () => {
  it("returns a padded generic failure for a paused account and never checks the password", async () => {
    const ports = makePorts({ checkSignIn: async () => ({ allowed: false }) });
    const result = await performSignIn(INPUT, ports);
    expect(result).toEqual({ outcome: "failed" });
    expect(ports.attemptMock).not.toHaveBeenCalled();
    expect(ports.sleepMock).toHaveBeenCalledWith(SIGN_IN_TIMING_FLOOR_MS);
  });

  it("returns a padded generic failure for a wrong password and records the failure", async () => {
    const ports = makePorts({ attemptPassword: async () => false });
    const result = await performSignIn(INPUT, ports);
    expect(result).toEqual({ outcome: "failed" });
    expect(ports.recordFailureMock).toHaveBeenCalledWith({ email: INPUT.email, ip: INPUT.ip });
    expect(ports.sleepMock).toHaveBeenCalledWith(SIGN_IN_TIMING_FLOOR_MS);
  });

  it("is indistinguishable between an unknown email and a wrong password", async () => {
    const paused = await performSignIn(INPUT, makePorts({ checkSignIn: async () => ({ allowed: false }) }));
    const wrong = await performSignIn(INPUT, makePorts({ attemptPassword: async () => false }));
    expect(paused).toEqual(wrong); // same outcome shape; both { outcome: "failed" }
  });

  it("succeeds without padding or recording a failure when the password is correct", async () => {
    const ports = makePorts({ attemptPassword: async () => true });
    const result = await performSignIn(INPUT, ports);
    expect(result).toEqual({ outcome: "success" });
    expect(ports.recordFailureMock).not.toHaveBeenCalled();
    expect(ports.sleepMock).not.toHaveBeenCalled();
  });

  it("does not pad when the failure path already exceeded the timing floor", async () => {
    const ports = makePorts({
      checkSignIn: async () => ({ allowed: false }),
      clock: [0, SIGN_IN_TIMING_FLOOR_MS + 50],
    });
    const result = await performSignIn(INPUT, ports);
    expect(result).toEqual({ outcome: "failed" });
    expect(ports.sleepMock).not.toHaveBeenCalled();
  });

  it("reports a failed bot check as a distinct, unpadded block", async () => {
    const ports = makePorts({
      checkSignIn: async () => {
        throw new SignInBlocked("turnstile");
      },
    });
    const result = await performSignIn(INPUT, ports);
    expect(result).toEqual({ outcome: "blocked", reason: "turnstile", retryAfterSeconds: undefined });
    expect(ports.sleepMock).not.toHaveBeenCalled();
  });

  it("passes a rate-limit block through with its retry hint", async () => {
    const ports = makePorts({
      checkSignIn: async () => {
        throw new SignInBlocked("rate_limited", 60);
      },
    });
    const result = await performSignIn(INPUT, ports);
    expect(result).toEqual({ outcome: "blocked", reason: "rate_limited", retryAfterSeconds: 60 });
  });
});
