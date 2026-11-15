Feature: The app renders the Bold Pines design-system theme

  # ADR-0018 ports the Figma "Bold Pines" design system into the token layer: the palette primitives, the
  # Light/Dark semantic mapping, the flat radius scale, and the Mulish/Figtree/Geist Mono 20px-EM type
  # scale. The token swap re-themes the shadcn primitives and the hand-built screens with no component
  # rewrite (ADR-0006 / ADR-0011 architecture). The contract and its WCAG contrast are executed as a unit
  # test (src/styles/theme-contract.test.ts); rendered appearance is a human/Figma pass (a11y-conformance
  # records 1.4.3/1.4.6/1.4.11 for the brand colour).

  @audience:administrator @usecase:brand-theme @category:happy @quality:functional @severity:medium
  Scenario: The application uses the Bold Pines brand colours in light mode
    Given the token layer is loaded
    When a screen renders in the default (light) theme
    Then the background is Mist and the foreground is Dark Pine
    And a primary action is Pine with Mist text

  @audience:administrator @usecase:brand-theme-dark @category:happy @quality:functional @severity:low
  Scenario: Dark mode flips the semantic roles without changing components
    Given the token layer is loaded
    When an ancestor carries the "dark" class
    Then the background is Dark Pine and the foreground is Mist
    And no component markup changes to achieve it

  @audience:assistive-tech @usecase:brand-contrast @category:happy @quality:accessibility @severity:high
  Scenario: Brand colour text pairs meet WCAG AAA contrast
    Given the Bold Pines semantic colour pairs
    When the contrast ratio of each text-on-surface pair is computed
    Then foreground on background is at least 7 to 1 in both themes
    And primary, destructive, secondary and muted text pairs are at least 7 to 1
