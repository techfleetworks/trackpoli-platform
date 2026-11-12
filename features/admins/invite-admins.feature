Feature: Invite and onboard administrators (P1-08)
  Invite-only onboarding (NFR-S1). An Administrator Manager invites a new administrator by email and can
  resend or revoke a pending invitation; the invited person accepts the current terms (TP1-08), sets a
  password or continues with Google using the invited address (Q-1-23), activates via complete-invite, and
  enrols two-factor (TP1-04) before reaching the dashboard. Four edge functions carry the privileged work
  (invite-admin, resend-invite, revoke-invite — Administrator Manager + aal2; complete-invite — the invited
  user at aal1), each deciding access from the profile, not a token claim, and writing one audit event in the
  same unit of work. The invite email links to the token-hash /auth/confirm Continue page so an email scanner
  cannot consume the one-time link, and the links are single-use and expire in 24 hours (NFR-S8). A middleware
  invite gate funnels an invited session to /accept-invite after terms and before two-factor, reading the live
  profile status so a just-activated user is never bounced back (ADR-0020). RLS is the authorization boundary.

  @audience:administrator @usecase:E2E-03 @category:happy @security @owasp:authorization @severity:critical
  Scenario: A manager invites an administrator who accepts, sets a password and enrols two-factor
    Given an Administrator Manager signed in with a verified two-factor session
    When they invite a new administrator by email
    Then an invited profile and an admin.invited event are recorded
    And the invited person opens the emailed link and clicks Continue
    Then they accept the current terms, set a password and their account becomes active
    And they are sent to forced two-factor enrolment and reach the dashboard after the first code

  @audience:administrator @usecase:E2E-04 @category:adverse @security @owasp:session-management @severity:high
  Scenario: An expired or already-used invite link creates no session
    Given an invitation link that has expired or has already been used
    When the invited person opens the link and clicks Continue
    Then the link-expired screen is shown with no session created
    And they are told to ask an Administrator Manager for a new invitation

  @audience:administrator @usecase:invite-manager-only @category:permission @security @owasp:authorization @severity:high
  Scenario: Only an Administrator Manager can invite, resend or revoke
    Given a plain Administrator signed in with a verified two-factor session
    When they call invite-admin, resend-invite or revoke-invite
    Then each call is refused as forbidden
    And no profile, invitation or event is changed

  @audience:administrator-manager @usecase:invite-duplicate-email @category:adverse @security @severity:medium
  Scenario: Inviting an email already in use is rejected
    Given an email already held by an active or invited administrator
    When an Administrator Manager invites that email
    Then the call is rejected as email_in_use and nothing is created
    But the same email is invitable again once that administrator is deactivated

  @audience:maintainer @usecase:invite-rollback @category:adverse @quality:reliability @severity:high
  Scenario: A failed profile insert rolls back the created auth user
    Given invite-admin has created the auth user and sent the invite email
    When inserting the invited profile fails
    Then the just-created auth user is deleted so no orphaned account remains
    And the failure is reported as internal with no personal data in the operational log

  @audience:administrator-manager @usecase:resend-rate-limited @category:boundary @security @severity:medium
  Scenario: Resending an invitation is throttled per invited administrator
    Given a pending invitation that has already been resent three times within the hour
    When the Administrator Manager resends it again
    Then the call is refused as rate_limited with a Retry-After
    And only a profile still in the invited status can be resent at all

  @audience:administrator-manager @usecase:invite-revoked @category:happy @quality:functional @severity:medium
  Scenario: Revoking a pending invitation deletes the account and kills the link
    Given a pending invitation for an administrator who has not accepted
    When an Administrator Manager revokes it
    Then the profile row and the auth user are deleted and an admin.invite_revoked event is recorded
    And the invitation link no longer works

  @audience:administrator @usecase:invite-gate @category:permission @security @owasp:authorization @severity:high
  Scenario: An invited session is funnelled to accept-invite and its data stays blocked
    Given a signed-in administrator whose account is still invited
    When they request any admin screen after accepting the terms
    Then they are redirected to the accept-invite screen before two-factor
    And the protected tables return no rows until the account is active, however they reached the route

  @audience:administrator @usecase:activate-idempotent @category:edge @quality:reliability @severity:medium
  Scenario: Submitting the activation twice activates the account exactly once
    Given an invited administrator who has set a password
    When complete-invite is called again, for example by a retry or a double submit
    Then the account is activated exactly once and no duplicate invite_accepted event is written
    And the repeat call still succeeds rather than failing
