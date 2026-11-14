# BDD coverage index

Generated from the feature files by `bdd-index-generate.mjs` - do not edit by hand.

| Feature | Scenario | Domain | Audience | Use case | Category | Quality | Severity | Status |
|---|---|---|---|---|---|---|---|---|
| admins/invite-admins.feature | A failed profile insert rolls back the created auth user | admins | maintainer | invite-rollback | adverse | reliability | high | covered |
| admins/invite-admins.feature | A manager invites an administrator who accepts, sets a password and enrols two-factor | admins | administrator | E2E-03 | happy | security | critical | covered |
| admins/invite-admins.feature | An expired or already-used invite link creates no session | admins | administrator | E2E-04 | adverse | security | high | covered |
| admins/invite-admins.feature | An invited session is funnelled to accept-invite and its data stays blocked | admins | administrator | invite-gate | permission | security | high | covered |
| admins/invite-admins.feature | Inviting an email already in use is rejected | admins | administrator-manager | invite-duplicate-email | adverse | security | medium | covered |
| admins/invite-admins.feature | Only an Administrator Manager can invite, resend or revoke | admins | administrator | invite-manager-only | permission | security | high | covered |
| admins/invite-admins.feature | Resending an invitation is throttled per invited administrator | admins | administrator-manager | resend-rate-limited | boundary | security | medium | covered |
| admins/invite-admins.feature | Revoking a pending invitation deletes the account and kills the link | admins | administrator-manager | invite-revoked | happy | functional | medium | covered |
| admins/invite-admins.feature | Submitting the activation twice activates the account exactly once | admins | administrator | activate-idempotent | edge | reliability | medium | covered |
| admins/manage-admins.feature | A failed profile write restores the auth email so the two stores never diverge | admins | maintainer | change-email-rollback | adverse | reliability | high | covered |
| admins/manage-admins.feature | A management function without a verified two-factor session is refused | admins | administrator-manager | manage-requires-aal2 | permission | security | high | covered |
| admins/manage-admins.feature | Best-effort side-effects are reported, never silently swallowed, and never widen access | admins | maintainer | manage-defence-in-depth | edge | reliability | medium | covered |
| admins/manage-admins.feature | Changing an email ends sessions, unlinks Google and keeps two-factor | admins | administrator-manager | change-email | happy | security | high | covered |
| admins/manage-admins.feature | Changing to an address already in use, or to your own account, is rejected | admins | administrator-manager | change-email-duplicate | adverse | security | medium | covered |
| admins/manage-admins.feature | Deactivating a signed-in administrator ends their access at once | admins | administrator-manager | E2E-09 | happy | security | critical | covered |
| admins/manage-admins.feature | Demoting the last active manager is blocked by the database guard | admins | administrator-manager | change-role-last-manager | adverse | security | high | covered |
| admins/manage-admins.feature | Only a deactivated administrator can be reactivated | admins | administrator-manager | reactivate | happy | functional | medium | covered |
| admins/manage-admins.feature | Only an Administrator Manager can run the management functions | admins | administrator-manager | manage-manager-only | permission | security | high | covered |
| admins/manage-admins.feature | Recreating a lost-authenticator account keeps the audit trail and issues a new invite | admins | administrator-manager | E2E-17 | happy | functional | high | covered |
| admins/manage-admins.feature | Recreating your own account or the last manager is refused | admins | administrator-manager | recreate-guard | permission | security | high | covered |
| admins/manage-admins.feature | The account_deleted snapshot carries the identity, and the operational log never does | admins | administrator-manager | recreate-audit | edge | security | high | covered |
| admins/manage-admins.feature | The last Administrator Manager cannot remove their own access | admins | administrator-manager | E2E-10 | permission | security | critical | covered |
| auth/password-recovery.feature | A Google-only account gets the same screen and no recovery email | auth | administrator | google-only-no-password | negative | security | medium | covered |
| auth/password-recovery.feature | A reset request reveals nothing about whether an account exists | auth | anonymous | account-enumeration | negative | security | critical | covered |
| auth/password-recovery.feature | A reused or expired reset link is refused and creates no session | auth | administrator | reset-link-single-use | adverse | security | high | covered |
| auth/password-recovery.feature | Completing a reset ends all sessions and clears the lockout counter | auth | administrator | reset-completion | happy | security | high | covered |
| auth/password-recovery.feature | Every reset request requires a valid bot-check token | auth | anonymous | bot-check | adverse | security | high | covered |
| auth/password-recovery.feature | Repeated reset requests never lock the targeted account | auth | anonymous | no-lockout-on-request | adverse | security | medium | covered |
| auth/password-recovery.feature | The one-time token is exchanged only on an explicit continue, not on a page fetch | auth | anonymous | scanner-safe-link | adverse | security | high | covered |
| auth/password-recovery.feature | The reset-request endpoint rejects a non-server caller | auth | anonymous | internal-only-endpoint | permission | security | high | covered |
| auth/role-based-access.feature | A guard redirect for a visitor without a session resolves to a single-basePath sign-in URL | auth | anonymous | guard-redirect-basepath | permission | functional | critical | covered |
| auth/role-based-access.feature | A missing route shows the not-found screen inside the shell | auth | administrator | not-found | negative | security | low | covered |
| auth/role-based-access.feature | A session whose role cannot be confirmed is treated as not a manager | auth | administrator | unreadable-role-fail-closed | adverse | security | high | covered |
| auth/role-based-access.feature | A signed-in administrator is bounced off the public-only sign-in screen | auth | anonymous | public-only | happy | security | medium | covered |
| auth/role-based-access.feature | An Administrator is denied a manager route in the page and the API | auth | administrator | E2E-08 | permission | security | critical | covered |
| auth/role-based-access.feature | An Administrator manager may open the manager route and read the manager data | auth | administrator-manager | manager-allowed | happy | security | high | covered |
| auth/role-based-access.feature | The manager navigation is hidden for an Administrator but never relied on for security | auth | administrator | manager-nav-hidden | permission | security | medium | covered |
| auth/role-based-access.feature | The manager navigation is shown to an Administrator manager | auth | administrator-manager | manager-nav-shown | happy | security | low | covered |
| auth/safe-sessions.feature | A deleted activity cookie fails open to the session's other controls, never a lockout | auth | administrator | timeout-fail-open | adverse | security | medium | covered |
| auth/safe-sessions.feature | A normal sign-out does not revoke the administrator's other devices | auth | administrator | local-sign-out-scope | negative | security | medium | covered |
| auth/safe-sessions.feature | A tampered last-activity cookie is never accepted to extend a session | auth | administrator | forged-activity-cookie | adverse | security | high | covered |
| auth/safe-sessions.feature | An expired session calling an API is sent to the session-expired screen | auth | anonymous | expired-api-401 | adverse | security | medium | covered |
| auth/safe-sessions.feature | An idle session warns, then lands on the session-expired screen keeping the return path | auth | administrator | E2E-06 | happy | security | high | covered |
| auth/safe-sessions.feature | An over-idle session is rejected server-side, not just in the browser | auth | administrator | middleware-enforced | adverse | security | high | covered |
| auth/safe-sessions.feature | Choosing Stay signed in extends the session | auth | administrator | stay-signed-in | happy | security | medium | covered |
| auth/safe-sessions.feature | Signing out in one tab signs out the other within two seconds | auth | administrator | E2E-07 | happy | security | high | covered |
| auth/safe-sessions.feature | Signing out other sessions leaves this session signed in | auth | administrator | sign-out-others | happy | security | high | covered |
| auth/safe-sessions.feature | The session ends at the 4-hour absolute limit even while active | auth | administrator | absolute-limit | adverse | security | high | covered |
| auth/security-alert-emails.feature | A security notice never carries a sign-in link or a secret | auth | administrator | notice-no-links-or-secrets | adverse | security | high | covered |
| auth/security-alert-emails.feature | A skipped or failed send logs one operational event and never undoes the change | auth | maintainer | notice-failed-send-reported | edge | reliability | medium | covered |
| auth/security-alert-emails.feature | A slow or failing notice never blocks or reverses the user's change | auth | administrator | notice-best-effort-nonblocking | edge | reliability | low | covered |
| auth/security-alert-emails.feature | Each account-security change sends one out-of-band notice to the right address | auth | administrator | E2E-18 | happy | security | high | covered |
| auth/security-alert-emails.feature | Only the TrackPoli server can trigger the password or two-factor notice | auth | administrator-manager | notice-internal-only | permission | security | high | covered |
| auth/sign-in-protection.feature | A fifth wrong attempt pauses the account | auth | anonymous | repeated-failures | adverse | security | critical | covered |
| auth/sign-in-protection.feature | A successful sign-in clears the failure counter | auth | administrator-manager | success-clears-failures | happy | functional | medium | covered |
| auth/sign-in-protection.feature | An unknown email and a wrong password are indistinguishable | auth | anonymous | account-enumeration | negative | security | critical | covered |
| auth/sign-in-protection.feature | Every attempt requires a valid bot-check token | auth | anonymous | bot-check | adverse | security | high | covered |
| auth/sign-in-protection.feature | The pre-authentication endpoints reject a non-server caller | auth | anonymous | internal-only-endpoint | permission | security | high | covered |
| auth/two-factor.feature | A code is required at every sign-in once enrolled | auth | administrator | signin-step-up | happy | security | high | covered |
| auth/two-factor.feature | A hijacked open session cannot replace the device without re-authentication | auth | administrator | replacement-requires-reauth | adverse | security | high | covered |
| auth/two-factor.feature | A lost authenticator is not self-service and must be a manager recreate | auth | administrator | lost-device-no-self-service | negative | security | medium | covered |
| auth/two-factor.feature | A signed-in administrator with no factor is forced to enrol before any data route | auth | administrator | forced-enrolment | happy | security | high | covered |
| auth/two-factor.feature | A wrong code at the verify step is refused and the session stays aal1 | auth | administrator | verify-wrong-code | negative | security | medium | covered |
| auth/two-factor.feature | Enrol at first sign-in, then replace the device, and the next sign-in needs a code | auth | administrator | E2E-11 | happy | security | high | covered |
| auth/two-factor.feature | Forced enrolment applies to Google sign-ins too | auth | administrator | forced-enrolment-google | permission | security | high | covered |
| auth/two-factor.feature | No data is reachable until the second factor is satisfied | auth | administrator | aal2-data-gate | permission | security | critical | covered |
| auth/two-factor.feature | Repeated wrong codes during replacement are rate-limited, not endlessly retriable | auth | administrator | replacement-attempt-cap | adverse | security | medium | covered |
| auth/two-factor.feature | Replacing a device requires password and the current code for an email administrator | auth | administrator | device-replacement | happy | security | high | covered |
| auth/two-factor.feature | Replacing a device uses Google re-auth and the current code for a Google-only administrator | auth | administrator | device-replacement-google | happy | security | high | covered |
| auth/two-factor.feature | The only Admin manager who loses their device cannot self-recreate from the app | auth | administrator-manager | lost-device-only-manager | adverse | security | medium | covered |
| auth/two-factor.feature | Two-factor cannot be switched off | auth | administrator | no-self-disable | adverse | security | high | covered |
| design-system/component-accessibility.feature | A disabled control is non-interactive and announced as disabled | design-system | assistive-tech | disabled-control | edge | accessibility | medium | covered |
| design-system/component-accessibility.feature | Components render consistently across supported browsers | design-system | end-user | cross-browser | edge | functional | medium | covered |
| design-system/component-accessibility.feature | Grayscale components meet WCAG 2.2 AA contrast | design-system | assistive-tech | grayscale-contrast | boundary | accessibility | high | covered |
| design-system/component-accessibility.feature | The alert announces errors to screen readers | design-system | assistive-tech | alert-a11y | happy | accessibility | high | covered |
| design-system/component-accessibility.feature | The button is keyboard operable with a visible focus state | design-system | assistive-tech | button-a11y | happy | accessibility | high | covered |
| design-system/component-accessibility.feature | The input exposes its label and invalid state to assistive tech | design-system | assistive-tech | input-a11y | happy | accessibility | high | covered |
| design-system/migration.feature | The app shell (side nav + error screens) uses design-system components with behaviour parity | design-system | administrator | shell-migrated | happy | functional | high | covered |
| design-system/migration.feature | The forgot-password screen uses design-system components with behaviour parity | design-system | end-user | forgot-password-migrated | happy | functional | high | covered |
| design-system/migration.feature | The session-timeout warning dialog uses design-system components with behaviour parity | design-system | end-user | session-warning-migrated | happy | functional | high | covered |
| design-system/migration.feature | The set-new-password screen uses design-system components with behaviour parity | design-system | end-user | reset-password-migrated | happy | functional | high | covered |
| design-system/migration.feature | The sign-in screen uses design-system components with behaviour parity | design-system | end-user | signin-migrated | happy | functional | high | covered |
| design-system/migration.feature | The two-factor card and device-replacement modal use design-system components with behaviour parity | design-system | end-user | settings-2fa-migrated | happy | functional | high | covered |
| design-system/migration.feature | The two-factor enrolment wizard uses design-system components with behaviour parity | design-system | end-user | mfa-enrol-migrated | happy | functional | high | covered |
| ops/observability.feature | A server failure is recorded in both the operational log and Sentry | ops | maintainer | observability-dual-sink | happy | reliability | medium | covered |
| ops/observability.feature | Errors reach Sentry scrubbed, with a request id and user id but never an email | ops | maintainer | observability-scrubbed-reports | happy | compliance | high | covered |
| ops/observability.feature | Ten failed sign-ins in five minutes raise an alert | ops | administrator-manager | observability-failed-sign-ins-alert | adverse | security | high | covered |
| ops/observability.feature | With no DSN configured nothing is sent and the app is unaffected | ops | maintainer | observability-inert-until-configured | edge | reliability | low | covered |
| settings/profile-and-security.feature | A Google-only account has no password to change | settings | administrator | change-password-google-only | negative | security | medium | covered |
| settings/profile-and-security.feature | A new password shorter than the minimum is refused after the current one is proven | settings | administrator | change-password-weak-new | boundary | security | medium | covered |
| settings/profile-and-security.feature | A wrong current password is rejected and throttled, changing nothing | settings | administrator | change-password-wrong-current | adverse | security | high | covered |
| settings/profile-and-security.feature | An empty or over-long display name is rejected without a write | settings | administrator | edit-display-name-invalid | boundary | functional | low | covered |
| settings/profile-and-security.feature | Changing your own password re-verifies the current one and keeps you signed in | settings | administrator | change-own-password | happy | security | high | covered |
| settings/profile-and-security.feature | Editing your display name updates only your own profile | settings | administrator | edit-own-display-name | happy | functional | medium | covered |
| settings/profile-and-security.feature | Signing out other sessions asks for confirmation first | settings | administrator | settings-sign-out-confirm | happy | security | medium | covered |
| settings/profile-and-security.feature | The old Security URL and the Google re-auth return both land on the Security tab | settings | administrator | settings-security-redirect | edge | functional | low | covered |
| settings/profile-and-security.feature | The Settings tabs and the not-yet-active controls are operable and honest | settings | assistive-tech | settings-tabs-a11y | happy | accessibility | medium | covered |
| settings/profile-and-security.feature | The settings writes only ever touch your own account | settings | administrator | settings-self-only | permission | security | high | covered |
| settings/profile-and-security.feature | The Workspace rules tab is shown only to an Administrator Manager | settings | administrator-manager | settings-workspace-tab-role-aware | permission | functional | low | covered |
| shell/admin-shell.feature | A keyboard user can skip the navigation and reach the main content | shell | assistive-tech | E2E-13 | happy | accessibility | high | covered |
| shell/admin-shell.feature | An automated accessibility scan finds no serious or critical violations | shell | assistive-tech | E2E-14 | happy | accessibility | high | covered |
| shell/admin-shell.feature | The manager navigation entry is hidden for an Administrator | shell | administrator | manager-nav-hidden-shell | permission | accessibility | medium | covered |
| shell/admin-shell.feature | The navigation drawer traps focus and returns it on close | shell | assistive-tech | E2E-13 | happy | accessibility | high | covered |
| shell/admin-shell.feature | The navigation is a rail on desktop and a drawer on small screens | shell | end-user | responsive-nav | happy | functional | medium | covered |
| shell/admin-shell.feature | The password field keeps paste and the correct autocomplete, never exposing the value | shell | end-user | password-field-paste | happy | security | medium | covered |
| shell/admin-shell.feature | The shell renders at the 320px minimum width without horizontal scrolling | shell | end-user | responsive-min-width | boundary | functional | medium | covered |
| terms/accept-terms.feature | A new version forces an existing administrator to accept again | terms | administrator | E2E-15 | happy | security | high | covered |
| terms/accept-terms.feature | A newly invited administrator is sent to terms first and acceptance is recorded | terms | administrator | E2E-15 | happy | security | critical | covered |
| terms/accept-terms.feature | A recorded acceptance cannot be changed or deleted | terms | maintainer | immutable-consent-record | adverse | compliance | high | covered |
| terms/accept-terms.feature | Accepting a version that is no longer current is rejected as a conflict | terms | administrator | stale-version-rejected | adverse | security | high | covered |
| terms/accept-terms.feature | Declining signs the administrator out | terms | end-user | decline-signs-out | happy | functional | medium | covered |
| terms/accept-terms.feature | Submitting the same acceptance twice records it once | terms | administrator | idempotent-accept | edge | reliability | medium | covered |
| terms/accept-terms.feature | The acceptance is reachable and operable by keyboard with an explicit affirmative act | terms | assistive-tech | terms-a11y | happy | accessibility | high | covered |
| terms/accept-terms.feature | Until acceptance a signed-in administrator can read only their own profile row | terms | administrator | terms-data-gate | permission | security | critical | covered |
