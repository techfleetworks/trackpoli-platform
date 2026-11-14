Feature: My profile and security settings (P1-14)
  An administrator manages their own account from one tabbed Settings page: Profile (view their details and
  edit their display name), Security (change password, replace the two-factor device, sign out other
  sessions), and the layout-only Notifications and Preferences tabs; an Administrator Manager additionally
  sees a Workspace rules tab. Only two things are self-service writes this ticket — the display name and the
  password — and each is the caller acting on their OWN account: the display name updates only the caller's
  profiles row under RLS (profiles_update_own_name) and the password change re-verifies the current password
  before setting the new one. Re-verification reuses GoTrue's native sign-in, so a wrong password is
  rate-limited, never an unthrottled oracle (OWASP Authentication). A Google-only account has no password
  identity, so the change-password path is hidden and the endpoint refuses it. RLS is the authorization
  boundary (ADR-0012); the tabs, the role-aware Workspace tab and the disabled layout controls are rendering
  and routing only. The device-replacement (E2E-11, two-factor.feature) and sign-out-others (safe-sessions.
  feature) behaviours are unchanged — this ticket places their cards in the Security tab, it does not rewrite
  them.

  @audience:administrator @usecase:change-own-password @category:happy @security @owasp:authentication @severity:high
  Scenario: Changing your own password re-verifies the current one and keeps you signed in
    Given a password administrator signed in with a verified two-factor session
    When they submit their correct current password and a new password of at least 12 characters
    Then the current password is re-verified through the rate-limited sign-in path before anything changes
    And the password is updated and the auth.password_changed audit event is recorded by the database trigger
    And they stay signed in on this device, and their other devices are not signed out by the change

  @audience:administrator @usecase:change-password-wrong-current @category:adverse @security @owasp:authentication @severity:high
  Scenario: A wrong current password is rejected and throttled, changing nothing
    Given a password administrator on the change-password dialog
    When they submit an incorrect current password
    Then the re-verification fails and the result is wrong_password, so the new password is never applied
    And repeated attempts are limited by the sign-in rate limit, so this is not an unthrottled password oracle
    And no auth.password_changed event is recorded

  @audience:administrator @usecase:change-password-weak-new @category:boundary @security @owasp:authentication @severity:medium
  Scenario: A new password shorter than the minimum is refused after the current one is proven
    Given a password administrator who has proven their current password
    When they submit a new password shorter than 12 characters
    Then the change is refused as weak_password and the stored password is unchanged
    And the client also blocks a new password under 12 characters and a confirmation that does not match

  @audience:administrator @usecase:change-password-google-only @category:negative @security @owasp:authentication @severity:medium
  Scenario: A Google-only account has no password to change
    Given a Google-only administrator with no email password identity
    When they open the Security tab
    Then the change-password card is not shown, because there is no password for this account
    And if the endpoint is called directly it refuses with not_available, never attempting an update

  @audience:administrator @usecase:edit-own-display-name @category:happy @quality:functional @severity:medium
  Scenario: Editing your display name updates only your own profile
    Given an administrator on the Profile tab in edit mode
    When they save a new display name between 1 and 120 characters
    Then only the caller's own profiles.display_name is updated, under the profiles_update_own_name policy
    And the profile.display_name_changed audit event is recorded by the database trigger
    And the new name is shown and a confirmation is announced

  @audience:administrator @usecase:edit-display-name-invalid @category:boundary @quality:functional @severity:low
  Scenario: An empty or over-long display name is rejected without a write
    Given an administrator editing their display name
    When they submit a whitespace-only name or a name longer than 120 characters
    Then the change is refused as invalid and no update is attempted
    And a field error explains the 1 to 120 character rule

  @audience:administrator @usecase:settings-self-only @category:permission @security @owasp:authorization @severity:high
  Scenario: The settings writes only ever touch your own account
    Given any signed-in administrator
    When they change their display name or password from Settings
    Then the endpoints act on the caller resolved from the session, never on an id supplied by the client
    And RLS confines the display-name write to the caller's own row, so one account can never edit another

  @audience:administrator-manager @usecase:settings-workspace-tab-role-aware @category:permission @quality:functional @severity:low
  Scenario: The Workspace rules tab is shown only to an Administrator Manager
    Given the Settings page
    When a plain administrator opens it
    Then the Workspace rules tab is not rendered, while an Administrator Manager does see it
    And this is rendering only — the data behind those controls is still guarded by RLS, not by the tab's presence

  @audience:assistive-tech @usecase:settings-tabs-a11y @category:happy @quality:accessibility @severity:medium
  Scenario: The Settings tabs and the not-yet-active controls are operable and honest
    Given a keyboard or screen-reader user on the Settings page
    When they move through the tablist and into a layout-only tab
    Then the Radix tablist exposes the tab/tabpanel roles, arrow-key movement and the selected tab
    And the Notifications and Preferences controls are disabled rather than live-but-ignored, so a change is never silently discarded

  @audience:administrator @usecase:settings-security-redirect @category:edge @quality:functional @severity:low
  Scenario: The old Security URL and the Google re-auth return both land on the Security tab
    Given a request to the former /settings/security URL, with or without a reauth return parameter
    When the page loads
    Then it redirects to the Security tab of the unified Settings page
    And any reauth parameter is preserved so the Google device-replacement wizard resumes where it left off
