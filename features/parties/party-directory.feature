Feature: Public Party Directory (Phase 3)
  Any visitor can browse Nigeria's registered political parties without signing in (ADR-0032). The
  directory reads the published party projection (fixtures standing in for the Supabase published view),
  supports live text search and an All/Registered quick filter, reports the result count, and links each
  party to its profile. The screens are keyboard-operable with a visible focus and announce state to
  assistive technology. Facets that belong to the not-yet-built Filter & sort sheet are shown but disabled
  and announced as coming soon, never as dead links.

  @audience:end-user @usecase:directory-list @category:happy @quality:functional @severity:high
  Scenario: The directory lists every registered party on first load
    Given a visitor opens the public Party Directory
    Then every party in the published register is listed
    And the result count reads the number of parties shown

  @audience:end-user @usecase:directory-search @category:happy @quality:functional @severity:high
  Scenario: Live search narrows the list by name, abbreviation or symbol
    Given a visitor is on the public Party Directory
    When they type a name, abbreviation or symbol into the search field
    Then only the matching parties remain in the list
    And the result count updates to the number shown

  @audience:end-user @usecase:directory-search-empty @category:negative @quality:functional @severity:medium
  Scenario: A search that matches nothing shows a helpful empty state, not an error
    Given a visitor is on the public Party Directory
    When they search for text that matches no party
    Then the list is empty
    And a message explains that no parties match and suggests trying another term

  @audience:end-user @usecase:directory-quick-filter @category:happy @quality:functional @severity:medium
  Scenario: The Registered quick filter keeps only registered parties
    Given a visitor is on the public Party Directory
    When they press the "Registered" quick filter
    Then the filter is shown as pressed
    And only parties whose registration status is registered remain

  @audience:assistive-tech @usecase:directory-pending-facets @category:boundary @quality:accessibility @severity:medium
  Scenario: Not-yet-built facets are disabled and announced as coming soon
    Given a visitor is on the public Party Directory
    Then the "By state", "By level" and "Filters" controls are disabled
    And each is announced to assistive technology as coming soon

  @audience:assistive-tech @usecase:directory-a11y @category:happy @quality:accessibility @severity:high
  Scenario: The directory is keyboard-operable with one page heading and a current nav item
    Given a visitor opens the public Party Directory
    Then a "Skip to main content" link is the first focusable element
    And the page has exactly one first-level heading
    And the "Parties" item in the primary navigation is marked as the current page

  @audience:end-user @usecase:directory-open-profile @category:happy @quality:functional @severity:medium
  Scenario: Selecting a party opens its profile
    Given a visitor is on the public Party Directory
    When they select a party row
    Then they are taken to that party's profile

  @audience:end-user @usecase:directory-unknown-party @category:negative @quality:functional @severity:low
  Scenario: An unknown party slug returns not-found, never a broken page
    Given a visitor requests a party profile for a slug that is not in the register
    Then the app responds with a not-found page
