// Public consumer surface layout (Phase 3, ADR-0036). This route group is the public, unauthenticated
// TrackPoli app — distinct from the admin shell in (app). It sits inside the app's /admin basePath for
// now (next.config.ts), under the /app segment, so its routes never collide with the admin's own
// /parties, /policies, … (ADR-0036 records the interim placement and the separate-hosting follow-up).
//
// The frame is a centred mobile column that works from 320px up (universal-browser-device-support). A
// "Skip to main content" link is the first focusable element (WCAG 2.4.1); colour via semantic tokens.

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[28rem] flex-col bg-background shadow-sm">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
    </div>
  );
}
