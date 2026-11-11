// Centralised English (UK) copy for the terms & privacy acceptance screen (TP1-08; Figma 1468:2352).
// usability-ux-universal-design (content-and-plain-language): each string is a whole, self-contained
// message; anything with a variable is a FUNCTION that interpolates once, never string "+" at the call site.
// Role/document labels live in policies.ts (policyLabel). This is the only place the screen's copy lives.

export const termsStrings = {
  appName: "TrackPoli Admin",

  heading: "Terms and privacy notice",
  subtext: "Read both documents, then accept them to continue. You'll be asked again only if either one changes.",

  // The re-acceptance variant (a new version was published since the last acceptance).
  reHeading: "We've updated our terms",
  reSubtext: "Read what changed, then accept the new versions to keep using TrackPoli Admin.",
  whatChangedTitle: "What's changed",
  whatChangedBody:
    "We've published a new version of the documents below. Your previous acceptance still stands for the old version; accepting here records your agreement to the current one.",

  // The document panel.
  versionRow: (label: string, version: string, isPlaceholder: boolean) =>
    isPlaceholder ? `${label} · Version ${version} · Placeholder text` : `${label} · Version ${version}`,
  /** Accessible name for the scrollable document region (universal-accessibility-wcag). */
  documentRegionLabel: (label: string, version: string) => `${label}, version ${version}`,

  // The acceptance controls.
  checkboxLabelLead: "I have read and agree to the",
  checkboxLabelMid: "and the",
  checkboxLabelEnd: ".",
  /** The full sentence, used as the control's accessible name where links are not rendered. */
  checkboxAccessibleName: (termsLabel: string, privacyLabel: string) =>
    `I have read and agree to the ${termsLabel} and the ${privacyLabel}.`,
  accept: "Accept and continue",
  accepting: "Accepting…",
  decline: "Decline and sign out",
  footnote: "Your acceptance is saved with the document versions and the time. Declining signs you out.",

  errors: {
    couldNotSave: "We couldn't save your acceptance. Check your connection and try again.",
    newVersion: "The terms were updated while you were reading. Read the new version, then accept again.",
  },
} as const;
