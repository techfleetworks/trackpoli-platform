"use client";

// The terms & privacy acceptance screen (TP1-08; Figma 1468:2352). A signed-in administrator reads both
// documents (tabbed, scrollable) and makes an explicit affirmative acceptance (the checkbox gates the
// button) before any other screen or data (Q-1-20). It records the CURRENT versions via the app's own
// /admin/api/terms route (never Supabase directly, ADR-0005). Presentation + wiring only: the versions and
// the document text come from the server page; the gate and the acceptance record are server-side.
//
// Built on the shadcn/ui design system in grayscale (ADR-0011/ADR-0006): the error banner is the neutral
// Alert whose icon carries the meaning, not a colour. The scrollable document is a labelled, keyboard-
// focusable region and the tabs/checkbox get their a11y contract from Radix (universal-accessibility-wcag).

import { useId, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/Icon";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/apiFetch";
import { report } from "@/lib/report";
import markIcon from "@/features/auth/assets/mark.svg";
import type { PolicyDocument } from "./policies";
import { termsStrings as t } from "./strings";
import { useRecordTerms } from "./useRecordTerms";

export interface TermsPolicyView {
  readonly document: PolicyDocument;
  readonly label: string;
  readonly version: string;
  readonly isPlaceholder: boolean;
  readonly body: string;
}

export interface TermsAcceptanceProps {
  /** The current documents (terms + privacy) with their versions and bodies, read by the server page. */
  readonly policies: readonly TermsPolicyView[];
  /** "reaccept" shows the "we've updated" heading + what-changed note (an older acceptance exists). */
  readonly variant?: "first" | "reaccept";
  /** True after a version-conflict reload: show the "new version published" banner (Figma error state). */
  readonly staleBanner?: boolean;
}

export function TermsAcceptance({ policies, variant = "first", staleBanner = false }: TermsAcceptanceProps) {
  const checkboxId = useId();
  const titleId = useId();
  const [activeTab, setActiveTab] = useState<string>(policies[0]?.document ?? "terms");
  const [accepted, setAccepted] = useState(false);
  const [clientError, setClientError] = useState(false);
  const { submitting, submit } = useRecordTerms();

  const termsLabel = policies.find((p) => p.document === "terms")?.label ?? "Terms of use";
  const privacyLabel = policies.find((p) => p.document === "privacy")?.label ?? "Privacy notice";
  const bannerMessage = staleBanner ? t.errors.newVersion : clientError ? t.errors.couldNotSave : null;

  async function onAccept() {
    if (!accepted || submitting) return;
    setClientError(false);
    const outcome = await submit(policies.map((p) => ({ document: p.document, version: p.version })));
    if (outcome === "accepted") {
      // Full-page load so the server re-gates: now accepted, the user flows on to two-factor / the app.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload so the server re-reads acceptance and routes on
      window.location.assign("/admin");
    } else if (outcome === "stale-version") {
      // The version changed while they read: reload so the server fetches the new text and shows the banner.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload to re-read the now-current document versions
      window.location.assign("/admin/terms?stale=1");
    } else {
      setClientError(true);
    }
  }

  async function onDecline() {
    if (submitting) return;
    try {
      await apiFetch("/admin/api/sign-out", { method: "POST" });
    } catch (error) {
      // Report, but leave the gate anyway: the next request re-runs the server guards, so a failed sign-out
      // call never traps a declining user on the terms screen.
      report("debug", "terms decline sign-out failed", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload so cleared session cookies apply
    window.location.assign("/admin/sign-in");
  }

  const bodySmall =
    "text-[length:var(--md-body-small-size)] leading-[var(--md-body-small-line)] tracking-[var(--md-body-small-tracking)]";

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--md-surface-container-high)] p-6">
      <section
        aria-labelledby={titleId}
        className="flex w-[640px] max-w-full flex-col gap-[22px] rounded-[var(--md-shape-card)] bg-[var(--md-surface-container-lowest)] p-10 shadow-[var(--md-elevation-card)]"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-primary">
            <Icon src={markIcon} size={22} />
          </span>
          <span className="text-[length:var(--md-title-medium-size)] font-medium leading-[var(--md-title-medium-line)] tracking-[var(--md-title-medium-tracking)] text-foreground">
            {t.appName}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <h1
            id={titleId}
            className="m-0 text-[length:var(--md-headline-medium-size)] font-normal leading-[var(--md-headline-medium-line)] tracking-[var(--md-headline-medium-tracking)] text-foreground"
          >
            {variant === "reaccept" ? t.reHeading : t.heading}
          </h1>
          <p className={`m-0 text-muted-foreground ${bodySmall}`}>
            {variant === "reaccept" ? t.reSubtext : t.subtext}
          </p>
        </div>

        {variant === "reaccept" ? (
          <div className="flex flex-col gap-1 rounded-[var(--md-shape-banner)] bg-accent px-4 py-3">
            <span className="text-[length:var(--md-label-large-size)] font-semibold tracking-[var(--md-label-large-tracking)] text-foreground">
              {t.whatChangedTitle}
            </span>
            <span className={`text-muted-foreground ${bodySmall}`}>{t.whatChangedBody}</span>
          </div>
        ) : null}

        {bannerMessage ? (
          <Alert>
            <TriangleAlert aria-hidden="true" />
            <AlertDescription>{bannerMessage}</AlertDescription>
          </Alert>
        ) : null}

        <div className="overflow-hidden rounded-[var(--md-shape-field)] border border-border">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList aria-label={t.heading} className="border-b border-border">
              {policies.map((policy) => (
                <TabsTrigger key={policy.document} value={policy.document}>
                  {policy.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {policies.map((policy) => (
              <TabsContent key={policy.document} value={policy.document} className="flex flex-col">
                <p className={`m-0 border-b border-border px-4 py-2.5 text-muted-foreground ${bodySmall}`}>
                  {t.versionRow(policy.label, policy.version, policy.isPlaceholder)}
                </p>
                <div
                  role="region"
                  aria-label={t.documentRegionLabel(policy.label, policy.version)}
                  tabIndex={0}
                  className="h-[232px] overflow-y-auto whitespace-pre-line px-4 py-3 text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)] text-foreground outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
                >
                  {policy.body}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id={checkboxId}
            checked={accepted}
            onCheckedChange={(value) => setAccepted(value === true)}
            disabled={submitting}
            className="mt-0.5"
          />
          <Label htmlFor={checkboxId} className={`cursor-pointer font-normal text-foreground ${bodySmall}`}>
            {t.checkboxLabelLead}{" "}
            <Button type="button" variant="link" size="inline" className="align-baseline" onClick={() => setActiveTab("terms")}>
              {termsLabel}
            </Button>{" "}
            {t.checkboxLabelMid}{" "}
            <Button type="button" variant="link" size="inline" className="align-baseline" onClick={() => setActiveTab("privacy")}>
              {privacyLabel}
            </Button>
            {t.checkboxLabelEnd}
          </Label>
        </div>

        <Button
          variant="secondary"
          className="w-full"
          type="button"
          disabled={!accepted || submitting}
          onClick={onAccept}
        >
          {submitting ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              {t.accepting}
            </>
          ) : (
            t.accept
          )}
        </Button>

        <div className="flex justify-center">
          <Button type="button" variant="link" size="inline" onClick={onDecline} disabled={submitting}>
            {t.decline}
          </Button>
        </div>

        <p className={`m-0 text-center text-muted-foreground ${bodySmall}`}>{t.footnote}</p>
      </section>
    </main>
  );
}
