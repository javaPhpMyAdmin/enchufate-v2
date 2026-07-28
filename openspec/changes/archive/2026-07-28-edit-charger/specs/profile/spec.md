# Delta for Profile

## MODIFIED Requirements

### Requirement: Mis Cargadores Section

The system SHALL render a "Mis cargadores" section header with an orange "Publicar nuevo" pill that navigates to `/publish/1-name`. Below, a list of owned chargers each showing photo, title, address, power, connector, price, and a status pill. A 3-dot menu is shown next to each charger. The menu MUST navigate to `/edit-charger/{id}` when tapped. (Previously: the 3-dot menu was disabled in MVP)

#### Scenario: User taps Publicar nuevo

- GIVEN the user is on the Perfil tab
- WHEN the user taps "Publicar nuevo"
- THEN the wizard step 1 is opened

#### Scenario: User with 0 chargers sees an empty hint

- GIVEN the user owns no chargers
- WHEN the Mis cargadores section renders
- THEN a hint "Todavía no publicaste cargadores" is shown above the list area

#### Scenario: User taps 3-dot menu to edit charger

- GIVEN the user owns chargers
- WHEN the user taps the 3-dot menu next to a charger
- THEN the user navigates to `/edit-charger/{id}`

## Non-functional notes

- The 3-dot menu MUST only be visible for chargers owned by the current user.
- All copy is Rioplatense Spanish voseo (e.g. "Iniciá sesión", "Publicá tu cargador").
