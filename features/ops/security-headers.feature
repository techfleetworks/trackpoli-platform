Feature: Browser security headers and CSP nonce (P1-16)
  Every response from the admin app carries the browser security headers and a per-request Content-Security-
  Policy nonce (TP1-13 PR B, ADR-0025). The headers are set in middleware so they apply to the pass-through
  response and to every redirect (sign-in, terms, accept-invite, MFA, forbidden, session-expired). The CSP
  nonces the app's scripts (no unsafe-inline, no unsafe-eval), denies framing, and allowlists only the origins
  the app calls. It ships report-only by default so staging can surface violations before it is enforced.

  @audience:anonymous @usecase:security-headers-present @category:happy @security @severity:high
  Scenario: Every response carries the browser security headers
    Given any request to the admin app
    When middleware responds, whether it passes through or redirects
    Then the response carries HSTS, X-Content-Type-Options, X-Frame-Options, a Referrer-Policy, a Permissions-Policy and X-Robots-Tag
    And it carries a Content-Security-Policy with frame-ancestors 'none'

  @audience:anonymous @usecase:csp-nonce @category:happy @security @severity:high
  Scenario: Scripts are governed by a per-request nonce, not an inline escape hatch
    Given a response's Content-Security-Policy
    When its script-src is read
    Then it contains a fresh per-request nonce and 'strict-dynamic'
    And it contains neither 'unsafe-inline' nor 'unsafe-eval' in script-src
    And the same nonce rides the forwarded request header so Next applies it to its own scripts

  @audience:maintainer @usecase:csp-report-only-default @category:happy @quality:release-safety @severity:medium
  Scenario: The CSP ships report-only until staging is confirmed, then enforces by toggle
    Given no CSP_ENFORCE is set
    When the policy header is chosen
    Then it is sent as Content-Security-Policy-Report-Only, so a wrong directive cannot break the deploy
    And setting CSP_ENFORCE to a truthy value sends the enforcing Content-Security-Policy instead

  @audience:anonymous @usecase:csp-allowlist @category:boundary @security @severity:medium
  Scenario: Only the origins the app actually calls are allowed
    Given the Content-Security-Policy connect-src and frame-src
    When they are read
    Then they allow self plus Supabase, Sentry, Turnstile and Google OAuth, and nothing else
    And default-src is 'self' and object-src is 'none'
