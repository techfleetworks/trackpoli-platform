// Pure domain service: no React, no Next, no web globals. Owns the static site
// metadata so the UI layer only renders it (decisions.md: business data lives in a
// service, not in the component).

export interface SiteInfo {
  readonly name: string;
  readonly tagline: string;
  readonly audiences: readonly string[];
}

export function getSiteInfo(): SiteInfo {
  return {
    name: "TrackPoli",
    tagline:
      "Track political accountability in Nigeria, in plain language, backed by sources.",
    audiences: ["Newbies", "Advocates", "Citizens", "Veterans"],
  };
}
