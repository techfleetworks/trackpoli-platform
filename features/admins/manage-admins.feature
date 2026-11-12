Feature: Manage administrators (P1-13)
  An Administrator Manager keeps the team correct: change a role or email, deactivate or reactivate an
  administrator, and recreate the account of someone who lost their authenticator (Q-1-06). Five privileged
  edge functions carry the work (change-role, deactivate-admin, reactivate-admin, change-email, recreate-admin
  — all Administrator Manager + aal2), each deciding access from the profile, not a token claim, and writing
  one audit event in the same unit of work. The last active manager is protected by the database guard
  (migration 002): a demote, deactivate or delete that would remove them is refused as last_manager, so the
  team can never be locked out. Deactivation is authoritative through the profile status (RLS denies every
  non-active session the instant it is written) and revokes the person's sessions immediately; the auth ban is
  defence-in-depth. Changing an email ends the person's sessions, unlinks any Google identity and keeps their
  two-factor (Q-1-24). Recreating an account deletes it and sends a fresh invite, keeping the old name and
  email in the account_deleted audit snapshot so the history survives (NFR-D1, NFR-S11). RLS is the
  authorization boundary (ADR-0012); these functions and their list are routing and workflow only.

  @audience:administrator-manager @usecase:E2E-09 @category:happy @security @owasp:session-management @severity:critical
  Scenario: Deactivating a signed-in administrator ends their access at once
    Given an Administrator Manager signed in with a verified two-factor session
    And a second administrator who is currently signed in
    When the manager deactivates that administrator
    Then the profile status becomes deactivated and an admin.deactivated event is recorded
    And the administrator's sessions are revoked so their next request is sent to sign-in
    And they cannot sign in again because their account is no longer active

  @audience:administrator-manager @usecase:E2E-10 @category:permission @security @owasp:authorization @severity:critical
  Scenario: The last Administrator Manager cannot remove their own access
    Given an Administrator Manager who is the only active manager
    When they try to demote themselves to administrator or to deactivate their own account
    Then the call is refused with the last-manager message
    And deactivating your own account is additionally refused as cannot_target_self
    And the team is never left without an active Administrator Manager

  @audience:administrator-manager @usecase:E2E-17 @category:happy @quality:functional @severity:high
  Scenario: Recreating a lost-authenticator account keeps the audit trail and issues a new invite
    Given an administrator who has lost their authenticator device
    When an Administrator Manager recreates their account
    Then an admin.account_deleted event is recorded first, carrying the old email, name and role snapshot
    And the old profile and auth user are deleted, ending their sessions and two-factor factors
    And a fresh invitation is sent for the same email, name and role, creating a new account id
    And the earlier audit events still name the person through the stored snapshot

  @audience:administrator-manager @usecase:manage-manager-only @category:permission @security @owasp:authorization @severity:high
  Scenario: Only an Administrator Manager can run the management functions
    Given a plain Administrator signed in with a verified two-factor session
    When they call change-role, change-email, deactivate-admin, reactivate-admin or recreate-admin
    Then each call is refused as forbidden
    And no profile, session or event is changed

  @audience:administrator-manager @usecase:manage-requires-aal2 @category:permission @security @owasp:multifactor-authentication @severity:high
  Scenario: A management function without a verified two-factor session is refused
    Given an Administrator Manager whose session is only aal1
    When they call any of the five management functions
    Then the call is refused as mfa_required
    And nothing is changed

  @audience:administrator-manager @usecase:change-role-last-manager @category:adverse @security @owasp:authorization @severity:high
  Scenario: Demoting the last active manager is blocked by the database guard
    Given an administrator who is the only other active Administrator Manager
    When a manager changes that person's role to administrator and it would leave no active manager
    Then the database guard refuses it and the call returns last_manager
    And a demotion that still leaves an active manager succeeds and revokes the target's sessions

  @audience:administrator-manager @usecase:change-email @category:happy @security @owasp:session-management @severity:high
  Scenario: Changing an email ends sessions, unlinks Google and keeps two-factor
    Given an administrator with a linked Google identity and enrolled two-factor
    When an Administrator Manager changes their email to a free address
    Then the auth and profile emails are both updated and an admin.email_changed event is recorded
    And the person's sessions are revoked and their Google identity is unlinked
    And their two-factor enrolment is unchanged, so they sign in again with the new address

  @audience:administrator-manager @usecase:change-email-duplicate @category:adverse @security @severity:medium
  Scenario: Changing to an address already in use, or to your own account, is rejected
    Given an address already held by an active or invited administrator
    When an Administrator Manager changes a different administrator's email to that address
    Then the call is refused as email_in_use and nothing is changed
    And changing your own email through this function is refused as cannot_target_self

  @audience:administrator-manager @usecase:reactivate @category:happy @quality:functional @severity:medium
  Scenario: Only a deactivated administrator can be reactivated
    Given a deactivated administrator
    When an Administrator Manager reactivates them
    Then the auth ban is lifted, the status returns to active and the deactivation fields are cleared
    And an admin.reactivated event is recorded
    But reactivating an administrator who is not deactivated is refused as conflict

  @audience:administrator-manager @usecase:recreate-guard @category:permission @security @severity:high
  Scenario: Recreating your own account or the last manager is refused
    Given an Administrator Manager
    When they call recreate-admin for their own account
    Then it is refused as cannot_target_self
    And recreating the last active manager is refused as last_manager with nothing deleted

  @audience:maintainer @usecase:change-email-rollback @category:adverse @quality:reliability @severity:high
  Scenario: A failed profile write restores the auth email so the two stores never diverge
    Given change-email has updated the auth email
    When writing the new email to the profile fails
    Then the auth email is restored to the old address and the call returns internal
    And a failed audit write afterwards rolls both emails back to the old address

  @audience:maintainer @usecase:manage-defence-in-depth @category:edge @quality:reliability @severity:medium
  Scenario: Best-effort side-effects are reported, never silently swallowed, and never widen access
    Given a deactivation whose authoritative status change has already stuck
    When the auth ban or the session revoke then fails
    Then the failure is written to the operational log as a warning with no personal data
    And the deactivation still succeeds because the status change alone locks the account out through RLS

  @audience:administrator-manager @usecase:recreate-audit @category:edge @security @severity:high
  Scenario: The account_deleted snapshot carries the identity, and the operational log never does
    Given recreate-admin is deleting an administrator
    When the account_deleted audit event is written before the delete
    Then that event carries the person's email, name and role so the history survives the deletion
    And any later operational-event on failure holds only the role, never a name or email
