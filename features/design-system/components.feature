Feature: Design-system variant components render and stay accessible

  # ADR-0019 adds the Card, Toast, Hover Card and Table primitives with the Figma colour variants, plus the
  # button disabled-at-every-size guarantee. These scenarios pin the contract; they are executed as unit
  # tests with React Testing Library + Vitest (src/components/ui/design-system-variants.test.tsx). Rendered
  # appearance/contrast is a human/Figma pass (a11y-conformance.json records contrast for the brand colour).

  @audience:administrator @usecase:card-colour-variant @category:happy @quality:functional @severity:medium
  Scenario: A Card renders in a brand colour with the correct text colour
    Given a Card with the "pine" colour variant
    When it renders
    Then its surface uses the Pine palette and its text uses Mist

  @audience:assistive-tech @usecase:toast-a11y @category:happy @quality:accessibility @severity:high
  Scenario: A Toast announces itself and shows its icon before the header
    Given a Toast with an icon and a title
    When it renders
    Then it has an accessible status role for assistive tech
    And the icon appears to the left of the header

  @audience:assistive-tech @usecase:hover-card-content @category:happy @quality:functional @severity:medium
  Scenario: A Hover Card exposes its content when open
    Given an open Hover Card with the "slate" colour variant
    When it renders
    Then the content is present with Slate surface and Mist text

  @audience:assistive-tech @usecase:table-actions @category:happy @quality:accessibility @severity:high
  Scenario: A data table keeps semantic roles and offers a row-actions control
    Given a Table with a Name column and an Actions column
    When a row renders with a ghost icon action button
    Then the table, the Actions column header and the labelled action button are exposed to assistive tech

  @audience:assistive-tech @usecase:button-disabled-all-sizes @category:negative @quality:accessibility @severity:medium
  Scenario: The button is disabled consistently at every size
    Given a disabled Button
    When it is rendered at the small, default, icon or inline size
    Then it is reported as disabled and shows the disabled styling
