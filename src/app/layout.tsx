import type { Metadata } from "next";
import { Mulish, Figtree, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { getSessionUser } from "@/features/auth/session";
import { SessionGuard } from "@/features/auth/session/SessionGuard";
import { sessionLimits } from "@/lib/config";
import "./globals.css";

// Brand type (ADR-0018), self-hosted via next/font and exposed as CSS variables the token layer reads
// (--tp-font-heading / --tp-font-body / --tp-font-mono). Mulish = headings (600/700/800), Figtree =
// body + UI (400/500/600), Geist Mono = code (500). Replaces Roboto/MD3 (ADR-0006).
const mulish = Mulish({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-mulish",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-figtree",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TrackPoli Admin",
  description: "TrackPoli administration — invitation-only.",
};

// Phase 1 shell is intentionally minimal: the full app shell (navigation, header, snackbar/dialog hosts,
// loading/empty/error/not-found states, focus management) is built in P1-12. English (UK); interface text
// moves into next-intl in a later task. AuthProvider carries the server-resolved user (from the HttpOnly
// cookie session) to client components; getSessionUser is env-safe, so the build does not need secrets.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <html lang="en-GB" className={`${mulish.variable} ${figtree.variable} ${geistMono.variable}`}>
      <body>
        <AuthProvider user={user}>
          {children}
          {/* Safe sessions (TP1-05): idle/absolute warnings + cross-tab sync, only for a signed-in admin. */}
          <SessionGuard enabled={user !== null} limits={sessionLimits()} />
        </AuthProvider>
      </body>
    </html>
  );
}
