Feature: Public home page
  As a political newbie
  I want to see what TrackPoli is and who it is for
  So that I can decide whether it helps me, without signing up.

  @audience:newbie @usecase:view-home @category:happy @quality:functional @severity:high
  Scenario: A newbie sees the platform identity and who it serves
    Given the TrackPoli home page
    When a visitor opens it
    Then they see the name "TrackPoli"
    And they see the list of audiences it serves

  @audience:newbie @usecase:view-home @category:happy @quality:accessibility @severity:high
  Scenario: The home page is reachable without a mouse
    Given the TrackPoli home page
    When a keyboard user tabs to the first interactive element
    Then a visible "Skip to main content" link moves focus to the main region
