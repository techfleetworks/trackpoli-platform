// The terms and privacy documents, by version. Q-1-22: the approved legal text does not exist yet, so
// version "0" is a clearly-labelled PLACEHOLDER (the DB seeds both documents at version "0", migration 009).
// When the real text lands it ships as version "1", which bumps policy_versions.current_version and forces
// re-acceptance via has_accepted_current_policies() - no code change to the gate. This module is the single
// place the document copy lives for now; a later ticket can move it to a versioned content store. Keeping it
// in one module means the /terms screen (server) and the Profile acceptance list read the same source.
//
// IMPORTANT (compliance-data-lifecycle): consent recorded against placeholder text is a build/test artifact,
// NOT production-defensible consent. The screen says so, and go-live requires the real version-1 text first.

export type PolicyDocument = "terms" | "privacy";

export const POLICY_DOCUMENTS: readonly PolicyDocument[] = ["terms", "privacy"] as const;

/** The human label for a document (used in the tabs, the version row and the acceptance list). */
export function policyLabel(document: PolicyDocument): string {
  return document === "terms" ? "Terms of use" : "Privacy notice";
}

export interface PolicyContent {
  readonly document: PolicyDocument;
  readonly label: string;
  readonly version: string;
  /** True while the text is the version-0 placeholder (shown to the reader, recorded for honesty). */
  readonly isPlaceholder: boolean;
  readonly body: string;
}

const PLACEHOLDER_TERMS = `Terms of use (placeholder text, version 0)

1. Who can use this console. TrackPoli Admin is for administrators invited by an Admin manager. Keep your sign-in details and your authenticator device to yourself.

2. How you handle records. Add and change politician, party and policy records accurately and cite a source for every claim. Do not publish material you cannot support.

3. Activity is logged. Sign-ins, changes and approvals are recorded in an audit log that Admin managers can review.

4. Access can be withdrawn. An Admin manager may deactivate an account at any time; deactivation blocks access to the console and its data.

This is placeholder text for version 0. The approved Terms of use will replace it as version 1, which will ask you to accept again.`;

const PLACEHOLDER_PRIVACY = `Privacy notice (placeholder text, version 0)

1. What we hold about you. Your administrator profile (name, email and role), your sign-in and activity history, and the record of when you accepted these documents.

2. Why we hold it. To run the console, to keep it secure, and to keep an auditable record of who did what and who agreed to these terms.

3. How long we keep it. For as long as your account is active, plus the period our accountability obligations require; the record that you accepted these documents is kept as evidence even after the account ends.

4. Your choices. Ask an Admin manager to see or correct what we hold about you.

This is placeholder text for version 0. The approved Privacy notice will replace it as version 1, which will ask you to accept again.`;

/**
 * Resolve the content to show for a document at a given version. Version "0" returns the placeholder body;
 * any later version returns a short placeholder that names the version (the real copy for v1+ is not written
 * yet, Q-1-22) so the screen and the re-acceptance flow still render correctly against a bumped version.
 */
export function resolvePolicyContent(document: PolicyDocument, version: string): PolicyContent {
  const label = policyLabel(document);
  if (version === "0") {
    return {
      document,
      label,
      version,
      isPlaceholder: true,
      body: document === "terms" ? PLACEHOLDER_TERMS : PLACEHOLDER_PRIVACY,
    };
  }
  return {
    document,
    label,
    version,
    isPlaceholder: true,
    body: `${label} (placeholder text, version ${version})\n\nThe approved ${label.toLowerCase()} for version ${version} has not been added yet. Accepting here records your agreement to version ${version} of this document.`,
  };
}
