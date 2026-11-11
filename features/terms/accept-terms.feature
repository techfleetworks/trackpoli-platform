Feature: Accept terms and privacy (P1-17)
  Every administrator accepts the current terms of use and privacy notice before any other screen or data
  (Q-1-20), and accepts again whenever either document changes. The data layer landed in TP1-01: the
  restrictive RLS terms gate (migration 009) blocks every table from an un-accepted session, and
  has_accepted_current_policies() is the signal. TP1-08 adds the screen (src/app/terms), the record-terms
  edge function, and the live middleware terms gate (src/features/auth/termsGate.ts) that runs before the
  two-factor code. Acceptance is an explicit, affirmative, logged act: the policy_acceptances row is the
  tamper-evident consent record (append-only, attributed, versioned, timestamped — NFR-S12). The documents
  are version "0" placeholders until the approved text lands as version "1" (Q-1-22), which forces
  re-acceptance with no code change.

  @audience:administrator @usecase:E2E-15 @category:happy @security @owasp:authorization @severity:critical
  Scenario: A newly invited administrator is sent to terms first and acceptance is recorded
    Given a newly invited administrator who has signed in but accepted no policies
    When they request any admin screen
    Then they are redirected to the terms screen before the two-factor code
    And after they read both documents and make the explicit acceptance
    Then an acceptance row is stored for each document with its version, the time and the request id
    And they continue on into the app

  @audience:administrator @usecase:E2E-15 @category:happy @security @severity:high
  Scenario: A new version forces an existing administrator to accept again
    Given an administrator who accepted version "0" of both documents
    And the terms of use is republished as version "1"
    When they request any admin screen
    Then they are redirected to the terms screen showing the updated documents
    And their earlier version "0" acceptance still stands unchanged
    And accepting version "1" records a new acceptance row without altering the old one

  @audience:administrator @usecase:terms-data-gate @category:permission @security @owasp:authorization @severity:critical
  Scenario: Until acceptance a signed-in administrator can read only their own profile row
    Given a signed-in administrator who has not accepted the current policies
    When they read from the protected tables
    Then the restrictive terms gate returns only their own profile row
    And every other table returns no rows regardless of how they reached the route

  @audience:administrator @usecase:stale-version-rejected @category:adverse @security @severity:high
  Scenario: Accepting a version that is no longer current is rejected as a conflict
    Given an administrator viewing version "0" of the documents
    And the current version has moved on to "1" while they were reading
    When they submit an acceptance for version "0"
    Then record-terms rejects it as a 409 conflict and records nothing
    And the screen reloads the current version and asks them to accept again

  @audience:maintainer @usecase:immutable-consent-record @category:adverse @compliance @severity:high
  Scenario: A recorded acceptance cannot be changed or deleted
    Given a stored policy acceptance for an administrator
    When any process attempts to update or delete that acceptance row
    Then the append-only trigger rejects the change
    And the record keeps its document, version, time, request id and email snapshot as consent evidence

  @audience:administrator @usecase:idempotent-accept @category:edge @quality:reliability @severity:medium
  Scenario: Submitting the same acceptance twice records it once
    Given an administrator who has already accepted the current versions
    When the acceptance is submitted again, for example by a retry or a double click
    Then record-terms records each document exactly once via the unique constraint
    And the repeat call still succeeds rather than failing on a duplicate

  @audience:assistive-tech @usecase:terms-a11y @category:happy @quality:accessibility @severity:high
  Scenario: The acceptance is reachable and operable by keyboard with an explicit affirmative act
    Given the terms screen is open
    When a keyboard user tabs through it
    Then each document is a labelled, focusable region they can scroll and read
    And the tabs, the agreement checkbox and the buttons are reachable and operable by keyboard
    And the Accept and continue button stays disabled until the agreement checkbox is checked

  @audience:end-user @usecase:decline-signs-out @category:happy @quality:functional @severity:medium
  Scenario: Declining signs the administrator out
    Given the terms screen is open
    When the administrator chooses to decline and sign out
    Then their session is ended and they are returned to the sign-in screen
    And no acceptance is recorded
