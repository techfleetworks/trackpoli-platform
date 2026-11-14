"use client";

import * as React from "react";

import { SettingsCard } from "@/features/settings/SettingsCard";
import { AcceptedPolicies, type AcceptedPolicy } from "@/features/terms/AcceptedPolicies";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { ErrorState } from "@/components/ui/states";
import { useSnackbar } from "@/components/ui/snackbar";
import { apiFetch } from "@/lib/apiFetch";
import { formatDate, formatDateTime } from "@/lib/formatDate";
import { roleLabel, type AdminRole } from "@/lib/roles";
import type { ProfileDetails } from "./profileData";

// The Settings Profile tab (TP1-11, P1-14). View mode shows the administrator's own details; Edit mode lets
// them change ONLY their display name (the one self-service profile field — email and role are changed for an
// administrator by a manager through Manage administrators, not here). The edit posts to
// /admin/api/settings/display-name, which updates only the caller's own row under RLS and lets the DB trigger
// write the audit event; this component never touches Supabase (components render and format, AGENTS.md). The
// read-only "Policies you've accepted" list below reuses the TP1-08 AcceptedPolicies component (the immutable
// consent history, compliance-data-lifecycle). The typed outcome from the endpoint is branched on here.

const COPY = {
  heading: "Profile",
  subtitle: "Your account details.",
  edit: "Edit",
  name: "Display name",
  nameHint: "The name shown to other administrators (1–120 characters).",
  email: "Email",
  emailNote: "Managed by your workspace",
  role: "Role",
  memberSince: "Member since",
  lastSignIn: "Last sign-in",
  never: "Never",
  dash: "—",
  save: "Save",
  saving: "Saving…",
  cancel: "Cancel",
  invalid: "Enter a name of 1 to 120 characters.",
  sessionExpired: "Your session has expired. Sign in again.",
  generic: "Something went wrong. Please try again.",
  success: "Your name was saved.",
  acceptedTitle: "Policies you've accepted",
  acceptedSubtitle: "The policies you agreed to, and when.",
  unavailable: "Your profile could not be loaded. Please refresh the page.",
} as const;

type UpdateResponse =
  | { outcome: "done"; displayName: string }
  | { outcome: "invalid" }
  | { outcome: "no_session" }
  | { outcome: "error" };

const bodyMedium =
  "text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)]";
const labelSmall =
  "text-[length:var(--md-body-small-size)] leading-[var(--md-body-small-line)] tracking-[var(--md-body-small-tracking)]";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className={`${labelSmall} text-muted-foreground`}>{label}</dt>
      <dd className={`m-0 ${bodyMedium} text-foreground`}>{value}</dd>
    </div>
  );
}

export function ProfileTab({
  email,
  role,
  initial,
  acceptances,
}: {
  email: string | null;
  role: AdminRole | null;
  initial: ProfileDetails | null;
  acceptances: readonly AcceptedPolicy[];
}) {
  const { show } = useSnackbar();
  const [displayName, setDisplayName] = React.useState(initial?.displayName ?? "");
  const [editing, setEditing] = React.useState(false);

  if (!initial) {
    return (
      <SettingsCard title={COPY.heading} titleId="profile-title">
        <ErrorState title="Profile unavailable" body={COPY.unavailable} />
      </SettingsCard>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {editing ? (
        <ProfileEditCard
          current={displayName}
          email={email}
          onCancel={() => setEditing(false)}
          onSaved={(name) => {
            setDisplayName(name);
            setEditing(false);
            show({ message: COPY.success });
          }}
        />
      ) : (
        <SettingsCard
          title={COPY.heading}
          titleId="profile-title"
          subtitle={COPY.subtitle}
          action={
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>
              {COPY.edit}
            </Button>
          }
        >
          <dl className="grid gap-5 sm:grid-cols-2">
            <Detail label={COPY.name} value={displayName} />
            <Detail label={COPY.email} value={email ?? COPY.dash} />
            <Detail label={COPY.role} value={role ? roleLabel(role) : COPY.dash} />
            <Detail
              label={COPY.memberSince}
              value={formatDate(initial.createdAt) || COPY.dash}
            />
            <Detail
              label={COPY.lastSignIn}
              value={initial.lastSignInAt ? formatDateTime(initial.lastSignInAt) : COPY.never}
            />
          </dl>
        </SettingsCard>
      )}

      <SettingsCard title={COPY.acceptedTitle} titleId="accepted-policies-title" subtitle={COPY.acceptedSubtitle}>
        <AcceptedPolicies acceptances={acceptances} />
      </SettingsCard>
    </div>
  );
}

function ProfileEditCard({
  current,
  email,
  onCancel,
  onSaved,
}: {
  current: string;
  email: string | null;
  onCancel: () => void;
  onSaved: (displayName: string) => void;
}) {
  const [name, setName] = React.useState(current);
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setNameError(null);
    setFormError(null);
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 120) {
      setNameError(COPY.invalid);
      return;
    }
    setPending(true);
    try {
      const res = await apiFetch<UpdateResponse>("/admin/api/settings/display-name", {
        method: "POST",
        body: { displayName: trimmed },
      });
      if (res.outcome === "done") {
        onSaved(res.displayName);
        return;
      }
      if (res.outcome === "invalid") {
        setNameError(COPY.invalid);
        return;
      }
      setFormError(res.outcome === "no_session" ? COPY.sessionExpired : COPY.generic);
    } catch {
      setFormError(COPY.generic);
    } finally {
      setPending(false);
    }
  }

  return (
    <SettingsCard title={COPY.heading} titleId="profile-title" subtitle={COPY.subtitle}>
      <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
        <FormField
          label={COPY.name}
          hint={COPY.nameHint}
          value={name}
          maxLength={120}
          autoComplete="name"
          onChange={(e) => setName(e.target.value)}
          error={nameError ?? undefined}
        />
        <div className="flex flex-col gap-0.5">
          <span className={`${labelSmall} text-muted-foreground`}>{COPY.email}</span>
          <span className={`${bodyMedium} text-foreground`}>{email ?? COPY.dash}</span>
          <span className={`${labelSmall} text-muted-foreground`}>{COPY.emailNote}</span>
        </div>
        {formError ? (
          <p role="alert" className={`${labelSmall} text-destructive`}>
            {formError}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            {COPY.cancel}
          </Button>
          <Button type="submit" disabled={pending || name.trim() === ""}>
            {pending ? COPY.saving : COPY.save}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}
