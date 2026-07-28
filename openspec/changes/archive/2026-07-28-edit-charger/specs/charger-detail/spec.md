# Delta for Charger Detail

## ADDED Requirements

### Requirement: Owner Edit CTA

The system SHALL display an "Editar" button on the charger detail screen when the logged-in user is the charger owner. The button navigates to `/edit-charger/{id}`. Non-owners MUST NOT see this button.

#### Scenario: Owner sees Editar button

- GIVEN the logged-in user owns the charger
- WHEN the charger detail screen renders
- THEN an "Editar" button is visible and navigates to the edit screen on tap

#### Scenario: Non-owner does not see Editar

- GIVEN the logged-in user does not own the charger
- WHEN the charger detail screen renders
- THEN no "Editar" button is shown
