// Security-alert email templates and fan-out (TP1-12, P1-18). PURE on purpose: no Deno, npm:, jsr: or network
// imports, so (a) a Deno edge function can import it, and (b) the Node test suite (vitest) can import it by a
// relative path to assert the content and the fan-out. The SMTP transport itself lives in notices.ts (the only
// Deno/dynamic-import part); here the transport is an injected port, so sendSecurityNotice is unit-testable
// with a fake.
//
// The notices carry NO links and NO secrets (NFR-P4, OWASP "Security notices must not become an attack"):
// they state only WHAT changed, WHEN (UTC, day-month-year), and WHAT TO DO if it wasn't the person. They
// never echo the address, token, password or any link, so a notice that reaches the wrong inbox leaks nothing
// and cannot be used for phishing.

export type SecurityNoticeType = "email_changed" | "password_changed" | "two_factor_replaced";

export interface NoticeContent {
  readonly subject: string;
  readonly text: string;
}

/** A transport that delivers one message. Injected, so the fan-out is testable without a real mailer. */
export interface NoticeTransport {
  send(to: string, content: NoticeContent): Promise<void>;
}

/** UTC day-month-year with 24-hour time, e.g. "13-11-2026 20:45 UTC". Timestamps are stored/shown in UTC
 *  (compliance-data-lifecycle audit timestamps; Q-C-10), and this uses only UTC getters so it is identical on
 *  the server and in a test regardless of the host time zone. */
export function formatUtc(when: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const dd = p(when.getUTCDate());
  const mm = p(when.getUTCMonth() + 1);
  const yyyy = when.getUTCFullYear();
  const hh = p(when.getUTCHours());
  const min = p(when.getUTCMinutes());
  return `${dd}-${mm}-${yyyy} ${hh}:${min} UTC`;
}

const WHAT_TO_DO =
  "If you did not make this change, contact your Administrator Manager immediately — your account may have been accessed by someone else.";

const SIGNATURE = "— TrackPoli Admin security\nThis is an automated security alert. We never include sign-in links or codes in these messages.";

/** Build the notice for one change type. `when` is the moment of the change (UTC). No address, link or secret
 *  appears in the body by design. */
export function buildNotice(type: SecurityNoticeType, when: Date): NoticeContent {
  const at = formatUtc(when);
  switch (type) {
    case "email_changed":
      return {
        subject: "Your TrackPoli admin email address was changed",
        text:
          `The email address on your TrackPoli Admin account was changed on ${at}.\n\n` +
          `This notice was sent to both the previous and the new address so you see it either way.\n\n` +
          `${WHAT_TO_DO}\n\n${SIGNATURE}\n`,
      };
    case "password_changed":
      return {
        subject: "Your TrackPoli admin password was changed",
        text:
          `The password on your TrackPoli Admin account was changed on ${at}.\n\n` +
          `You stay signed in on the device that made the change; your other sessions are not affected by a ` +
          `password change.\n\n${WHAT_TO_DO}\n\n${SIGNATURE}\n`,
      };
    case "two_factor_replaced":
      return {
        subject: "Your TrackPoli admin two-factor device was replaced",
        text:
          `The two-factor (authenticator) device on your TrackPoli Admin account was replaced on ${at}.\n\n` +
          `Only the new device can now produce your sign-in codes.\n\n${WHAT_TO_DO}\n\n${SIGNATURE}\n`,
      };
  }
}

export interface FanOutResult {
  /** How many recipients were attempted. */
  readonly attempted: number;
  /** How many sends threw. The caller logs one operational event when this is > 0, without undoing the change. */
  readonly failed: number;
}

/** Send one notice to each recipient through the injected transport. Each recipient is attempted independently
 *  so one bad address does not stop the others; failures are COUNTED, never thrown, because the account change
 *  has already happened and a notice is best-effort (the caller reports a non-zero `failed`, never undoes). */
export async function sendSecurityNotice(
  transport: NoticeTransport,
  recipients: readonly string[],
  type: SecurityNoticeType,
  when: Date,
): Promise<FanOutResult> {
  const content = buildNotice(type, when);
  let failed = 0;
  for (const to of recipients) {
    try {
      await transport.send(to, content);
    } catch {
      failed += 1;
    }
  }
  return { attempted: recipients.length, failed };
}
