Feature: Security alert emails (P1-18)
  An administrator gets an out-of-band email when a security-relevant change happens on their account: their
  email address is changed (a notice to the OLD and the NEW address), their password is changed, or their
  two-factor device is replaced. The notices say only what happened, when (UTC, day-month-year) and what to do
  if it wasn't them — never a sign-in link or a secret (NFR-P4), so a notice that reaches the wrong inbox leaks
  nothing and cannot be used for phishing. The email-changed notice is sent inline by the manager-only
  change-email edge function (which holds both addresses); the password-changed and two-factor-replaced
  changes run in the Next runtime and hand off to the internal-only send-security-notice edge function, which
  resolves the recipient from the server-supplied user id. Sending is best-effort: during the domain-blocked
  period (Q-1-21) there is no SMTP, so a send is skipped; a skipped or failed send logs exactly one operational
  event and never undoes the change that already happened (ADR-0023).

  @audience:administrator @usecase:E2E-18 @category:happy @security @owasp:authentication @severity:high
  Scenario: Each account-security change sends one out-of-band notice to the right address
    Given a configured email transport
    When an administrator's email is changed
    Then one email-changed notice is sent to the old address and one to the new address
    And when their password is changed, one password-changed notice is sent to the account's address
    And when their two-factor device is replaced, one device-replaced notice is sent to the account's address
    And each change sends exactly one notice per recipient

  @audience:administrator @usecase:notice-no-links-or-secrets @category:adverse @security @owasp:authentication @severity:high
  Scenario: A security notice never carries a sign-in link or a secret
    Given any of the three security notices
    When its body is built
    Then it states what changed, the UTC day-month-year time, and what to do if it wasn't the person
    And it contains no link, token, code or password, so it cannot itself be used to phish the recipient

  @audience:administrator-manager @usecase:notice-internal-only @category:permission @security @owasp:authorization @severity:high
  Scenario: Only the TrackPoli server can trigger the password or two-factor notice
    Given the send-security-notice function
    When it is called without the matching internal-call secret
    Then it is refused as forbidden, so it cannot be used to send mail or to probe who has an account
    And the recipient is always resolved from the server-supplied user id, never from a body-supplied address

  @audience:maintainer @usecase:notice-failed-send-reported @category:edge @quality:reliability @severity:medium
  Scenario: A skipped or failed send logs one operational event and never undoes the change
    Given the email transport is unconfigured, or the send fails
    When a security-relevant change has completed
    Then the change still stands and is not reversed
    And exactly one operational event is logged, carrying no email, name, token or request body

  @audience:administrator @usecase:notice-best-effort-nonblocking @category:edge @quality:reliability @severity:low
  Scenario: A slow or failing notice never blocks or reverses the user's change
    Given a password change or a two-factor replacement has committed in the Next runtime
    When the notice dispatch is slow or throws
    Then the administrator still receives the success outcome
    And the committed change is never reversed because the notice could not be sent
