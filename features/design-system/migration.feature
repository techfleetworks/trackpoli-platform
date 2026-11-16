Feature: Existing features migrate to the design system

  # PR 3 (sign-in pilot, ADR-0011) migrates the sign-in flow to the shadcn/ui primitives with behaviour
  # parity. Executed at the lowest layer that proves it: the SignInPage unit test (RTL + Vitest) drives
  # this behaviour (generic error + remaining-attempts helper, locked view, password toggle). The later
  # migration scenarios (old-component removal, per-screen rollback) land with their own PRs (4-7).

  @audience:end-user @usecase:signin-migrated @category:happy @quality:functional @severity:high
  Scenario: The sign-in screen uses design-system components with behaviour parity
    Given the sign-in screen migrated to the design-system button, input, and alert
    When a user signs in with valid credentials
    Then the flow behaves exactly as before the migration
    And the password visibility toggle and error banner still work

  # PR 4 (password-reset flow). Executed by ForgotPasswordPage.test.tsx and ResetPasswordPage.test.tsx.

  @audience:end-user @usecase:forgot-password-migrated @category:happy @quality:functional @severity:high
  Scenario: The forgot-password screen uses design-system components with behaviour parity
    Given the forgot-password screen migrated to the design-system input, label and alert
    When a user requests a reset link
    Then the flow behaves exactly as before the migration
    And the enumeration-safe check-your-email acknowledgement still shows

  @audience:end-user @usecase:reset-password-migrated @category:happy @quality:functional @severity:high
  Scenario: The set-new-password screen uses design-system components with behaviour parity
    Given the set-new-password screen migrated to the design-system input, label, alert and button
    When a user sets a matching password that meets the length rule
    Then the flow behaves exactly as before the migration
    And the password visibility toggles and the mismatch helper still work

  # PR 5 (MFA enrol). Executed by MfaEnrolPage.test.tsx.

  @audience:end-user @usecase:mfa-enrol-migrated @category:happy @quality:functional @severity:high
  Scenario: The two-factor enrolment wizard uses design-system components with behaviour parity
    Given the MFA-enrol wizard migrated to the design-system button, input and alert
    When a new administrator enrols through the instructions, QR and code steps
    Then the flow behaves exactly as before the migration
    And the step actions, back links, sign-out and wrong-code alert still work

  # PR 6 (settings/security). Executed by TwoFactorCard.test.tsx.

  @audience:end-user @usecase:settings-2fa-migrated @category:happy @quality:functional @severity:high
  Scenario: The two-factor card and device-replacement modal use design-system components with behaviour parity
    Given the two-factor card and replacement modal migrated to the design-system button, input and alert
    When an administrator replaces their authenticator device
    Then the flow behaves exactly as before the migration
    And the re-authentication, new-device, code steps, lost-device path and modal actions still work

  # PR 7 (session-timeout warning, the final migration PR). Executed by SessionWarningDialog.test.tsx.

  @audience:end-user @usecase:session-warning-migrated @category:happy @quality:functional @severity:high
  Scenario: The session-timeout warning dialog uses design-system components with behaviour parity
    Given the session-timeout warning dialog migrated to the design-system button
    When the dialog warns an administrator their session is about to end
    Then the flow behaves exactly as before the migration
    And both actions stay keyboard-focusable buttons with focus on the primary and the trap intact

  # Shell (TP1-06 app shell, clears the last 7 waivers). Executed by SideNav.test.tsx and ErrorState.test.tsx.

  @audience:administrator @usecase:shell-migrated @category:happy @quality:functional @severity:high
  Scenario: The app shell (side nav + error screens) uses design-system components with behaviour parity
    Given the side-nav controls and the error-state action migrated to the design-system button
    When an administrator collapses the nav, expands a section, or opens a forbidden/not-found screen
    Then the controls behave exactly as before the migration
    And they stay native buttons with their names and aria state, and the nav links stay basePath-relative

  # Auth-card shell migration (ADR-0028): the 9 auth screens move their card shell to the shared AuthCard on
  # the design-system Card primitive and the shared authCard.module.css is deleted. Behaviour parity is proven
  # by the existing per-screen suites plus AuthCard.test.tsx; the security properties are unchanged because the
  # migration is presentation-only (no auth/session/password logic touched).

  @audience:administrator @usecase:auth-card-migrated @category:happy @quality:functional @severity:high
  Scenario: The auth screens share the design-system AuthCard shell with behaviour parity
    Given the auth screens migrated their card shell to the shared AuthCard component
    When an administrator opens any auth screen
    Then each screen behaves exactly as before the migration
    And the brand lockup, the labelled card and the footer note are preserved

  @security @audience:administrator @usecase:auth-card-security-parity @category:adverse @quality:security @severity:high
  Scenario: The auth-card migration preserves the screens' security properties
    Given the auth card shell moved to the shared AuthCard component with no auth, session or password logic changed
    When the forgot-password and session-expired screens render after the migration
    Then the enumeration-safe "check your email" acknowledgement copy is unchanged
    And the session-expired screen still fires a best-effort server sign-out on mount

  # Notice-screen per-screen layout migration (ADR-0028 follow-up): the check-your-email and account-locked
  # screens drop their per-screen CSS Modules for design-system Tailwind utilities. Presentation-only.

  @audience:administrator @usecase:notice-layout-migrated @category:happy @quality:functional @severity:medium
  Scenario: The notice screens render their content with design-system utilities after dropping the CSS Module
    Given the check-your-email and account-locked screens migrated their per-screen layout off the CSS Module
    When each screen renders
    Then the icon chip, the centred heading and body, and the action still display as before

  @security @audience:administrator @usecase:notice-layout-security-parity @category:adverse @quality:security @severity:high
  Scenario: The notice-screen layout migration keeps the enumeration-safe copy
    Given the check-your-email screen migrated its layout with no logic change
    When it renders after a password-reset request
    Then the enumeration-safe conditional "If an account exists" copy is unchanged

  # Form-screen layout migration (ADR-0028 follow-up): the forgot-password and two-step verification screens
  # drop their per-screen CSS Modules for design-system Tailwind utilities. Presentation-only.

  @audience:administrator @usecase:form-layout-migrated @category:happy @quality:functional @severity:medium
  Scenario: The forgot-password and verification screens render with design-system utilities after dropping the CSS Module
    Given the forgot-password and two-step verification screens migrated their per-screen layout off the CSS Module
    When each screen renders
    Then the heading, the field, the submit action and any helper still display and behave as before

  @security @audience:administrator @usecase:form-layout-security-parity @category:adverse @quality:security @severity:high
  Scenario: The form-screen layout migration keeps the enumeration-safe and no-detail behaviour
    Given the forgot-password screen migrated its layout with no logic change
    When a password reset is requested
    Then the same enumeration-safe "sent" acknowledgement shows whether or not the account exists

  # Sign-in & set-new-password layout migration (ADR-0028 follow-up): drop the per-screen CSS Modules for
  # design-system utilities (heading, fields, forgot/back links, the "or" divider, the requirements panel).

  @audience:administrator @usecase:signin-reset-layout-migrated @category:happy @quality:functional @severity:medium
  Scenario: The sign-in and set-new-password screens render with design-system utilities after dropping the CSS Module
    Given the sign-in and set-new-password screens migrated their per-screen layout off the CSS Module
    When each screen renders
    Then the heading, fields, links, divider and password-requirements panel still display and behave as before

  @security @audience:administrator @usecase:signin-reset-layout-security-parity @category:adverse @quality:security @severity:high
  Scenario: The sign-in and reset layout migration preserves the credential-handling behaviour
    Given the sign-in and set-new-password screens migrated their layout with no logic change
    When a user signs in or sets a new password
    Then the generic no-detail sign-in errors and the length-only password policy are unchanged

  # Continue (/auth/confirm) & session-expired layout migration (ADR-0028 follow-up): drop the per-screen
  # CSS Modules for design-system utilities (icon chip, centred heading/body, cancel/back links). Presentation-only.

  @audience:administrator @usecase:confirm-expired-layout-migrated @category:happy @quality:functional @severity:medium
  Scenario: The continue and session-expired screens render with design-system utilities after dropping the CSS Module
    Given the continue and session-expired screens migrated their per-screen layout off the CSS Module
    When each screen renders in any of its states
    Then the icon chip, the centred heading and body, the primary action and the back/cancel link still display and behave as before

  @security @audience:administrator @usecase:confirm-expired-layout-security-parity @category:adverse @quality:security @severity:high
  Scenario: The continue and session-expired layout migration preserves the token-on-click and safe-redirect behaviour
    Given the continue and session-expired screens migrated their layout with no logic change
    When a one-time link is opened and a session later expires
    Then the token is still exchanged only on Continue and the session-expired return path stays restricted to an in-app /admin path

  # Turnstile slot & session-warning dialog migration (ADR-0029): drop the per-screen CSS Modules for
  # design-system utilities; adds a --scrim token (the dialog overlay colour had no token). Presentation-only.

  @audience:administrator @usecase:turnstile-warndialog-layout-migrated @category:happy @quality:functional @severity:medium
  Scenario: The Turnstile slot and session-warning dialog render with design-system utilities after dropping the CSS Module
    Given the Turnstile slot and the session-warning alertdialog migrated their layout off the CSS Module
    When each renders in any of its states
    Then the slot placeholder/widget and the dialog scrim, surface, note and actions still display as before

  @security @audience:administrator @usecase:turnstile-warndialog-security-parity @category:adverse @quality:security @severity:high
  Scenario: The Turnstile and session-warning migration preserves the bot-check reset and the alertdialog focus trap
    Given the Turnstile slot and the session-warning dialog migrated their layout with no logic change
    When a sign-in attempt fails and later a session is about to expire
    Then the single-use Turnstile token is still reset for a fresh challenge and the alertdialog keeps its focus trap and focus restore

  # MFA-enrol wizard migration (ADR-0028 follow-up): drop the per-screen CSS Module for design-system
  # utilities across all wizard steps (progress bar, QR frame, key box, icon chips, info rows). Presentation-only.

  @audience:administrator @usecase:mfa-enrol-layout-migrated @category:happy @quality:functional @severity:medium
  Scenario: The two-factor enrolment wizard renders with design-system utilities after dropping the CSS Module
    Given the MFA-enrol wizard migrated its per-screen layout off the CSS Module
    When each step renders (instructions, scan, manual key, code, success, paused, session-expired, failed)
    Then the step-progress bar, QR frame, key box, icon chips, info rows and actions still display and behave as before

  @security @audience:administrator @usecase:mfa-enrol-layout-security-parity @category:adverse @quality:security @severity:high
  Scenario: The MFA-enrol layout migration preserves the enrolment and lockout behaviour
    Given the MFA-enrol wizard migrated its layout with no logic change
    When a new administrator enters a wrong code, exhausts attempts, or the setup session lapses
    Then the wrong-code, too-many-attempts (paused) and 401 session-expired outcomes are unchanged and the factor is only confirmed server-side

  # Two-factor card + device-replacement modal migration (ADR-0028 follow-up; adopts the ADR-0029 --scrim
  # token for the overlay): drop the per-screen CSS Module for design-system utilities. Presentation-only.

  @audience:administrator @usecase:twofactor-card-layout-migrated @category:happy @quality:functional @severity:medium
  Scenario: The two-factor card and replacement modal render with design-system utilities after dropping the CSS Module
    Given the Security-tab two-factor card and its device-replacement modal migrated their layout off the CSS Module
    When the card and each wizard step render (intro, reauth, new device, new code, lost device, paused, success, failed)
    Then the card, the scrim overlay, the step headers, the QR/key, the info boxes and the actions still display and behave as before

  @security @audience:administrator @usecase:twofactor-card-security-parity @category:adverse @quality:security @severity:high
  Scenario: The two-factor card layout migration preserves the re-authentication and replacement safeguards
    Given the two-factor replacement modal migrated its layout with no logic change
    When an administrator re-authenticates, enters a wrong current or new code, or exhausts attempts
    Then re-auth is still required with a current-device code, the wrong-code and too-many-attempts outcomes are unchanged, and the factor is replaced only server-side

  # Dead-code removal (ADR-0011 cleanup): the unused hand-built Banner component is deleted; the shadcn Alert
  # primitive already owns the role=alert notice surface. No behaviour change - parity is the empty set.

  @audience:administrator @usecase:banner-dead-code-removed @category:happy @quality:functional @severity:low
  Scenario: Removing the unused Banner component changes nothing a user can see
    Given the hand-built Banner component had no importers and was never rendered
    When it is deleted and the shadcn Alert primitive remains the role=alert notice surface
    Then every screen still shows its alerts and the full test suite stays green

  @security @audience:administrator @usecase:banner-dead-code-removed-security @category:adverse @quality:security @severity:low
  Scenario: Removing the unused Banner component removes no security-relevant surface
    Given the Banner component was dead code with no renderers
    When it is deleted
    Then no error, alert or notice that any security flow relies on is lost, because those use the Alert primitive
