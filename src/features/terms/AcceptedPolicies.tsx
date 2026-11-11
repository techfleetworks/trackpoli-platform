// The "what I accepted and when" list for the Profile tab (TP1-08 builds the component; TP1-11 places it).
// Pure presentation: it takes the acceptance rows as props (the Profile page reads policy_acceptances for
// the signed-in administrator through a hook/service — components never touch Supabase, see AGENTS.md), and
// renders each as document · version · accepted-at. The record is immutable and attributed (migration 009),
// so this is a read-only history; there is no edit or delete control by design (compliance-data-lifecycle:
// a consent record is tamper-evident evidence, not mutable data).

import { formatDateTime } from "@/lib/formatDate";
import type { PolicyDocument } from "./policies";
import { policyLabel } from "./policies";

export interface AcceptedPolicy {
  readonly document: PolicyDocument;
  readonly version: string;
  /** ISO timestamp (UTC) from policy_acceptances.accepted_at. */
  readonly acceptedAt: string;
}

export function AcceptedPolicies({ acceptances }: { acceptances: readonly AcceptedPolicy[] }) {
  const bodySmall =
    "text-[length:var(--md-body-small-size)] leading-[var(--md-body-small-line)] tracking-[var(--md-body-small-tracking)]";

  if (acceptances.length === 0) {
    return <p className={`m-0 text-muted-foreground ${bodySmall}`}>No acceptances recorded yet.</p>;
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {acceptances.map((acceptance) => (
        <li
          key={`${acceptance.document}-${acceptance.version}`}
          className="flex flex-col gap-0.5 border-b border-border pb-3 last:border-b-0 last:pb-0"
        >
          <span className="text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)] text-foreground">
            {policyLabel(acceptance.document)} · Version {acceptance.version}
          </span>
          <span className={`text-muted-foreground ${bodySmall}`}>
            Accepted {formatDateTime(acceptance.acceptedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
