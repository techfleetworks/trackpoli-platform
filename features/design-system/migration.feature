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
