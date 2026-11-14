Feature: Observability — error reporting and alerting (P1-15)
  The app is observable without leaking personal data: browser and server errors reach Sentry only when a DSN
  is configured, and every report is scrubbed (no email, JWT/bearer token or password) and tagged with a
  request id, a release and — when known — a user id, never the email. Server failures are written to BOTH the
  durable operational log and Sentry. Symptom-based alert rules (availability and error rate page; the two
  security/delivery signals are tickets) link to the runbook. All of this is inert until the DSN and the
  metric exporters are wired on the deployed stack (Q-1-21); the scrubbing and the envelope building are
  proven by unit tests now (ADR-0024).

  @audience:maintainer @usecase:observability-scrubbed-reports @category:happy @quality:compliance @severity:high
  Scenario: Errors reach Sentry scrubbed, with a request id and user id but never an email
    Given a front-end error and an Edge Function error, with a DSN configured
    When each is reported
    Then the event carries the release, the environment and the request id
    And it carries the user id when known, but never the email, a token or a password
    And any email, JWT or bearer token in the message, exception or context is redacted before it is sent

  @audience:maintainer @usecase:observability-dual-sink @category:happy @quality:reliability @severity:medium
  Scenario: A server failure is recorded in both the operational log and Sentry
    Given an Edge Function hits an unexpected (internal) failure
    When it reports the failure
    Then one row is written to operational_events with the request id, release and environment
    And the same failure is forwarded to Sentry, so the durable record and the alertable sink agree
    And neither record contains an email, name, token or request body

  @audience:administrator-manager @usecase:observability-failed-sign-ins-alert @category:adverse @quality:security @severity:high
  Scenario: Ten failed sign-ins in five minutes raise an alert
    Given the failed-sign-in metric is being collected
    When ten or more sign-ins fail within five minutes
    Then the FailedSignInsSpike rule fires as a ticket (not a page) with a runbook link
    And a responder can review the source IPs and the targeted account from the operational log

  @audience:maintainer @usecase:observability-inert-until-configured @category:edge @quality:reliability @severity:low
  Scenario: With no DSN configured nothing is sent and the app is unaffected
    Given no SENTRY_DSN is set
    When an error is reported on the server, the browser or an Edge Function
    Then no event is sent and the Sentry SDK and the edge mailer are never loaded
    And the failure still reaches the operational log and the structured console line
