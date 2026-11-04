import type { Metadata } from "next";
import { AuthProvider } from "@/features/auth/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrackPoli Admin",
  description: "TrackPoli administration — invitation-only.",
};

// Phase 1 shell is intentionally minimal: the real app shell (navigation, header, snackbar/dialog
// hosts, loading/empty/error/not-found states, focus management) is built in P1-12. English (UK);
// all interface text moves into next-intl in a later task.
//
// AuthProvider makes the auth context available app-wide. The server-resolved user is wired in with the
// sign-in flow (ADR-0005); until then the context is present with no signed-in user, so useAuth() works
// everywhere and the build stays independent of runtime env.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <AuthProvider user={null}>{children}</AuthProvider>
      </body>
    </html>
  );
}
