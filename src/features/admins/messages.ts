// Feature copy for Admin management (TP1-10, P1-13). Plain language (usability-ux-universal-design), kept out
// of the ui/ primitives (the dependency points features -> ui, never the reverse). Dialog copy takes the
// target's name so each dialog addresses the person directly. The "what happens next" notes describe the real
// backend behaviour; the email-changed copy deliberately does NOT claim a notification was sent, because that
// notice is parked for TP1-12 (ADR-0021).

export const ADMIN_LIST = {
  title: "Admin management",
  invite: "Invite admin",
  searchLabel: "Search administrators",
  searchPlaceholder: "Search by name or email",
  sortLastSignIn: "Sorted by last sign-in",
  columns: {
    name: "Name",
    role: "Role",
    status: "Status",
    lastSignIn: "Last sign-in",
    added: "Added",
    actions: "Actions",
  },
  tabs: { all: "All", active: "Active", invited: "Invited", deactivated: "Deactivated" },
  neverSignedIn: "Never",
  loading: "Loading administrators…",
  error: {
    title: "Couldn't load administrators",
    body: "Something went wrong on our side. Your data is safe. Try again in a moment.",
    retry: "Try again",
  },
  empty: {
    title: "No administrators match these filters",
    body: "Try a different search or status, or clear the filters.",
    clear: "Clear filters",
  },
  count: (shown: number, total: number) => `Showing ${shown} of ${total}`,
} as const;

export const ROW_MENU = {
  label: (name: string) => `Actions for ${name}`,
  changeRole: "Change role",
  changeEmail: "Change email",
  recreate: "Recreate account",
  deactivate: "Deactivate",
  reactivate: "Reactivate",
  resend: "Resend invitation",
  revoke: "Revoke invitation",
} as const;

export const ROLE_OPTIONS = [
  { value: "admin", label: "Administrator" },
  { value: "admin_manager", label: "Administrator Manager" },
] as const;

export const INVITE = {
  title: "Invite an administrator",
  body: "They get an email with a link to accept the terms, set a password, and turn on two-factor before they can sign in.",
  emailLabel: "Email address",
  emailPlaceholder: "name@organisation.org",
  nameLabel: "Full name",
  namePlaceholder: "First and last name",
  roleLabel: "Role",
  whatNext:
    "They stay in the Invited list until they finish setting up. An Administrator Manager can also invite and manage other administrators.",
  submit: "Send invitation",
  pending: "Sending…",
  invalidEmail: "Enter a valid email address.",
  success: (email: string) => `Invitation sent to ${email}.`,
} as const;

export const CHANGE_ROLE = {
  title: (name: string) => `Change ${name}'s role?`,
  roleLabel: "Role",
  whatNext:
    "An Administrator Manager can invite and manage other administrators. The change applies now; they see it the next time their session refreshes.",
  submit: "Change role",
  pending: "Changing…",
  success: (name: string, roleName: string) => `${name} is now ${roleName}.`,
} as const;

export const CHANGE_EMAIL = {
  title: (name: string) => `Change email for ${name}?`,
  body: (name: string) => `Change the email address ${name} uses to sign in.`,
  currentLabel: "Current email",
  newLabel: "New email",
  newPlaceholder: "name@organisation.org",
  whatNext:
    "Their current sessions end and they sign in again with the new address. If they used Google to sign in, that link is removed; their two-factor stays set up.",
  submit: "Change email",
  pending: "Changing…",
  invalidEmail: "Enter a valid email address.",
  sameEmail: "That is already this administrator's email.",
  inUse: "Another administrator already uses that email.",
  success: (name: string) => `${name}'s email was changed.`,
} as const;

export const DEACTIVATE = {
  title: (name: string) => `Deactivate ${name}?`,
  body: "They can no longer sign in, and their current sessions end now.",
  whatNext:
    "Their records and history stay. You can reactivate them later, which lets them sign in again. You cannot deactivate the last Administrator Manager.",
  submit: "Deactivate",
  pending: "Deactivating…",
  success: (name: string) => `${name} was deactivated.`,
} as const;

export const REACTIVATE = {
  title: (name: string) => `Reactivate ${name}?`,
  body: "They can sign in again with their existing email and password.",
  whatNext: "They sign in as before and will be asked for their two-factor code.",
  submit: "Reactivate",
  pending: "Reactivating…",
  success: (name: string) => `${name} was reactivated.`,
} as const;

export const RECREATE = {
  title: (name: string) => `Recreate account for ${name}?`,
  body: (name: string) =>
    `Use this when ${name} has lost their authenticator and can't sign in. Their account is deleted and a fresh invitation is sent for the same email, name and role.`,
  whatNext:
    "Their old sessions end and they set up two-factor again from the new invitation. Earlier activity still shows their name, so the history is kept. You cannot recreate your own account or the last Administrator Manager.",
  confirmLabel: "Type their email to confirm",
  confirmPlaceholder: "name@organisation.org",
  confirmMismatch: "That does not match this administrator's email.",
  submit: "Recreate account",
  pending: "Recreating…",
  success: (name: string) => `${name}'s account was recreated and a new invitation was sent.`,
} as const;

export const LAST_MANAGER = {
  title: "Can't remove the last Administrator Manager",
  body: "There must always be at least one active Administrator Manager, so the team is never locked out. Make another administrator a manager first, then try again.",
  dismiss: "OK",
} as const;

// The fallback message for an unexpected edge-error code the dialogs don't special-case.
export const GENERIC_ERROR = "Something went wrong. Please try again.";
