"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { YourRoleCard } from "./YourRoleCard";
import { ProfileTab } from "./profile/ProfileTab";
import { SecurityTab } from "./security/SecurityTab";
import { NotificationsTab } from "./NotificationsTab";
import { PreferencesTab } from "./PreferencesTab";
import { WorkspaceRulesTab } from "./WorkspaceRulesTab";
import { MANAGER_ROLE, type AdminRole } from "@/lib/roles";
import type { ProfileDetails } from "./profile/profileData";
import type { AcceptedPolicy } from "@/features/terms/AcceptedPolicies";
import type { TwoFactorStatus } from "./security/twoFactor";

// The role-aware Settings shell (TP1-11, P1-14). A single tabbed surface replaces the former standalone
// /settings/security page: Profile, Security, Notifications and Preferences for everyone, plus a Workspace
// rules tab shown ONLY to an Admin manager. The tab-visibility is RENDERING, not authorization — the database
// (RLS) still guards every action, and the manager-only data behind Workspace rules is a later ticket
// (ADR-0012). The initial tab comes from the server (?tab=…, resolved and clamped to a role-allowed value
// before it reaches here) so a deep link and the /settings/security → Security redirect both land correctly.
// The Tabs primitive (Radix) carries the tablist/keyboard/aria contract (universal-accessibility-wcag). No
// data access here — the page reads, this renders the already-fetched data.

export type SettingsTab = "profile" | "security" | "notifications" | "preferences" | "workspace";

const headlineMedium =
  "text-[length:var(--md-headline-medium-size)] font-[number:var(--md-headline-medium-weight)] leading-[var(--md-headline-medium-line)] tracking-[var(--md-headline-medium-tracking)]";

export function SettingsTabs({
  role,
  email,
  profile,
  acceptances,
  twoFactor,
  initialTab,
}: {
  role: AdminRole | null;
  email: string | null;
  profile: ProfileDetails | null;
  acceptances: readonly AcceptedPolicy[];
  twoFactor: TwoFactorStatus;
  initialTab: SettingsTab;
}) {
  const isManager = role === MANAGER_ROLE;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12">
      <h1 className={`m-0 text-foreground ${headlineMedium}`}>Settings</h1>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Tabs defaultValue={initialTab} className="gap-6">
          <TabsList className="overflow-x-auto border-b border-border">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            {isManager ? <TabsTrigger value="workspace">Workspace rules</TabsTrigger> : null}
          </TabsList>

          <TabsContent value="profile">
            <ProfileTab email={email} role={role} initial={profile} acceptances={acceptances} />
          </TabsContent>
          <TabsContent value="security">
            <SecurityTab status={twoFactor} />
          </TabsContent>
          <TabsContent value="notifications">
            <NotificationsTab />
          </TabsContent>
          <TabsContent value="preferences">
            <PreferencesTab />
          </TabsContent>
          {isManager ? (
            <TabsContent value="workspace">
              <WorkspaceRulesTab />
            </TabsContent>
          ) : null}
        </Tabs>

        <aside className="lg:sticky lg:top-12 lg:self-start">
          <YourRoleCard role={role} />
        </aside>
      </div>
    </main>
  );
}
