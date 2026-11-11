"use client";

// The client seam for recording a terms/privacy acceptance (TP1-08). It posts the versions the user read to
// the app's own /admin/api/terms route (never Supabase directly — ADR-0005), which forwards to the
// record-terms edge function with the session. Following the sign-in pattern, a version conflict is a
// BUSINESS OUTCOME returned in a 200 body ("stale_version"), not a transport error, so the screen can show
// the "new version" path; only a real transport/5xx failure throws, which maps to the retryable error.

import { useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import type { PolicyDocument } from "./policies";

export interface AcceptanceInput {
  readonly document: PolicyDocument;
  readonly version: string;
}

export type RecordTermsOutcome = "accepted" | "stale-version" | "error";

interface TermsApiResponse {
  readonly outcome: "accepted" | "stale_version";
}

export function useRecordTerms() {
  const [submitting, setSubmitting] = useState(false);

  async function submit(acceptances: readonly AcceptanceInput[]): Promise<RecordTermsOutcome> {
    setSubmitting(true);
    try {
      const result = await apiFetch<TermsApiResponse>("/admin/api/terms", {
        method: "POST",
        body: { acceptances },
      });
      return result.outcome === "stale_version" ? "stale-version" : "accepted";
    } catch {
      // apiFetch already reported through the spine; the screen shows the retryable "could not save" error.
      return "error";
    } finally {
      setSubmitting(false);
    }
  }

  return { submitting, submit } as const;
}
