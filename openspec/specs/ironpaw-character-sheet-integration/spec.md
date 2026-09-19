## Purpose

Define how Ironpaw vocations and species affect character sheets while preserving explicit player adjustments and making the source of inherited values visible.

## Requirements

### Requirement: Vocation configuration contains only skills

The vocation configuration experience MUST allow users to configure skill levels and MUST NOT expose numeric attribute values as vocation settings. Legacy attribute values stored in existing vocation data MUST NOT affect a character sheet.

#### Scenario: Vocation editor shows skill configuration only
- **WHEN** a user opens a vocation for editing
- **THEN** the editor shows vocation skill levels and does not show editable numeric values for Corpo, Mente, Presença or Técnica

#### Scenario: Legacy vocation attribute values are ignored
- **WHEN** a vocation contains previously stored numeric attribute values
- **THEN** those values do not change the character sheet's attribute values or skill rolls

### Requirement: Changing vocation resets and reapplies skill minimums

When the vocation assigned to a character changes, the system MUST clear the character's current skill levels and apply the skill levels defined by the new vocation as the new minimums. The character MUST be able to increase skills manually, but MUST NOT be able to reduce a skill below the current vocation minimum. Removing the vocation MUST clear vocation-provided minimums and leave all skills at the untrained level.

#### Scenario: Character changes vocation
- **WHEN** a character changes from one vocation to another
- **THEN** all sheet skill levels are reset and the new vocation's configured skill levels are applied

#### Scenario: Character increases a vocation skill manually
- **WHEN** a character manually raises a skill above the vocation minimum
- **THEN** the higher skill level is saved and remains available on the sheet

#### Scenario: Character attempts to lower a vocation skill below its minimum
- **WHEN** a character tries to set a skill below the minimum supplied by the current vocation
- **THEN** the sheet keeps the skill at the vocation minimum

#### Scenario: Character removes vocation
- **WHEN** a character removes the assigned vocation
- **THEN** vocation minimums are removed and the sheet skill levels are reset to untrained

### Requirement: Changing species updates species-derived values without resetting skills

When the species assigned to a character changes, the system MUST preserve the character's current skill levels. It MUST replace the species-derived perception bases with the values from the new species and MUST ensure that the selected species has an Ironpaw configuration record, creating an empty one when necessary. A perception MAY be increased manually, but MUST NOT be reduced below the current species base when that base is defined.

#### Scenario: Character changes species
- **WHEN** a character changes from one species to another
- **THEN** existing skill levels remain unchanged and the new species perception values become the sheet's perception bases

#### Scenario: Character selects species without Ironpaw configuration
- **WHEN** a character selects a species that has no Ironpaw configuration
- **THEN** the system creates an empty Ironpaw configuration for that species and completes the selection without requiring a separate setup step

#### Scenario: Character increases a species perception manually
- **WHEN** a character manually increases a perception above the species base
- **THEN** the higher value is saved and the species base remains available as the inherited reference

#### Scenario: Character attempts to lower a species perception below its base
- **WHEN** a character tries to set a perception below the current species base
- **THEN** the sheet keeps the perception at the species base

#### Scenario: Character removes species
- **WHEN** a character removes the assigned species
- **THEN** species-derived perception bases are cleared while the character's skill levels remain unchanged

### Requirement: Life maximum follows the Ironpaw formula on selection changes

When a character's vocation or species assignment changes, the system MUST recalculate the minimum life maximum using `1 + vocation life + species life`, treating an absent contribution as zero. The calculated value MUST be applied only when the assignment changes, not when a vocation or species configuration is edited independently. The player MUST be able to increase the life maximum manually afterward, while the current minimum remains enforced.

#### Scenario: Vocation or species changes with configured life values
- **WHEN** either assignment changes and both configured life contributions are available
- **THEN** the sheet recalculates the life minimum as `1 + vocation life + species life`

#### Scenario: One or both contributions are absent
- **WHEN** an assignment has no Ironpaw life value
- **THEN** the missing contribution is treated as zero and the remaining values are still recalculated

#### Scenario: Player manually increases life maximum
- **WHEN** the player changes the life maximum to a value above the calculated minimum
- **THEN** the manual value is saved and remains available until a later assignment change

#### Scenario: Configuration is edited without changing assignment
- **WHEN** a vocation or species configuration is edited while the character remains assigned to the same records
- **THEN** the existing sheet life maximum is not automatically recalculated

### Requirement: Inherited values expose their source

The sheet MUST show a compact source indicator for a skill that is exactly at its vocation minimum and for a perception that has a defined species base. The perception indicator MUST continue to expose the species base when the player has manually increased the perception.

#### Scenario: Skill is at vocation minimum
- **WHEN** a skill level equals the level supplied by the current vocation
- **THEN** the sheet displays a compact indicator with a vocation tooltip or accessible label

#### Scenario: Skill is above vocation minimum
- **WHEN** a skill level is higher than the current vocation minimum
- **THEN** the sheet does not present the skill as being exactly at the vocation minimum

#### Scenario: Perception has species origin
- **WHEN** the current species defines a perception base
- **THEN** the sheet displays a compact species indicator and identifies the inherited base value

### Requirement: Vocation can be configured from the character sheet

The character sheet MUST provide an action to open the selected vocation's Ironpaw configuration in a modal. The action MUST be unavailable or visibly inapplicable when no vocation is selected. Saving the modal MUST update the vocation configuration without automatically recalculating the assigned character's derived values.

#### Scenario: Open selected vocation configuration
- **WHEN** a character has a vocation selected and the user activates the vocation configuration action
- **THEN** the selected vocation opens in a modal editor

#### Scenario: No vocation selected
- **WHEN** a character has no vocation selected
- **THEN** the vocation configuration action cannot open a non-existent vocation

#### Scenario: Save vocation configuration from modal
- **WHEN** the user saves changes in the vocation modal
- **THEN** the vocation configuration is persisted and the character sheet remains unchanged until a vocation or species assignment changes

### Requirement: Character editor can open the Ironpaw sheet in a new workspace tab

The character editing screen MUST provide a button that opens the corresponding Ironpaw character sheet in a new workspace tab. If that sheet tab is already open, activating the button MUST focus the existing tab according to workspace tab behavior.

#### Scenario: Open sheet from character editor
- **WHEN** the user activates the Ironpaw sheet action for a character
- **THEN** the workspace opens or focuses that character's Ironpaw sheet in a separate tab

### Requirement: Manual adjustments persist after derived values are applied

After an assignment change applies vocation, species and formula-derived values, subsequent manual edits to attributes, skills, perceptions or life MUST be persisted in the character sheet. Reloading the sheet without another assignment change MUST restore those manual values.

#### Scenario: Reload after manual adjustments
- **WHEN** the player manually adjusts sheet values and later reloads the character sheet without changing vocation or species
- **THEN** the adjusted values are restored exactly, subject to the active vocation and species minimums
