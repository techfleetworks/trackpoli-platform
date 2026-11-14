// The SMTP transport for the security-alert emails (TP1-12, P1-18). This is the ONLY Deno/mailer-specific
// part of the notices feature — the templates and the fan-out live in the pure noticeTemplates.ts (so they
// are unit-tested in CI). buildSmtpTransport reads the SMTP_* function secrets (the trackpoli.com mailbox at
// Porkbun) and returns a NoticeTransport, or null when SMTP is not configured yet. During the domain-blocked
// period (Q-1-21) it returns null, so every caller stays INERT: it reports "skipped" and never fails or
// undoes the account change (the ADR-0015 "fail-closed but inert" pattern, ADR-0023). The mailer is imported
// DYNAMICALLY — only when SMTP is configured — so the inert path pulls in no mail dependency at all.

import type { NoticeTransport } from "./noticeTemplates.ts";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

/** Read the SMTP settings from the function secrets, or null when any required value is absent (inert). */
export function readSmtpConfig(): SmtpConfig | null {
  const host = Deno.env.get("SMTP_HOST");
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  const from = Deno.env.get("SMTP_FROM");
  if (!host || !user || !pass || !from) return null;
  const port = Number(Deno.env.get("SMTP_PORT") ?? "465");
  return { host, port, user, pass, from };
}

/** Build the live SMTP transport, or null when unconfigured (the current domain-blocked state). The concrete
 *  mailer client can be swapped here at wiring time without touching any caller. */
export async function buildSmtpTransport(): Promise<NoticeTransport | null> {
  const cfg = readSmtpConfig();
  if (!cfg) return null;
  // Dynamic import so the inert path never loads the mailer. nodemailer runs under the Supabase edge (Deno)
  // runtime via the npm: specifier the rest of the functions already use (npm:zod, etc.).
  const nodemailer = (await import("npm:nodemailer@6.9.16")).default;
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  return {
    async send(to, content) {
      await transporter.sendMail({ from: cfg.from, to, subject: content.subject, text: content.text });
    },
  };
}
