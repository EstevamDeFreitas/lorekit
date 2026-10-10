## Purpose

Permitir que fichas de entidades representem escalas numericas, colecoes estruturadas e pequenas analises visuais diretamente por meio de campos dinamicos configuraveis.

## ADDED Requirements

### Requirement: Dynamic field types are configurable
The system SHALL expose Slider, Listagem, and Grafico as dynamic field types, persist their type-specific configuration, and preserve existing dynamic field types and values when a field is edited.

#### Scenario: Create a Slider field
- **WHEN** a user creates a dynamic field with type Slider and defines minimum, maximum, step, and optional unit
- **THEN** the field definition is saved and the field is available in the entity layout catalog

#### Scenario: Create a Listagem field
- **WHEN** a user creates a Listagem and selects table or headless mode
- **THEN** the selected mode and its column configuration are persisted with the field definition

#### Scenario: Create a Grafico field
- **WHEN** a user creates a Grafico and selects Radar, Barra, or Linha
- **THEN** the chart type and visual configuration are persisted with the field definition

### Requirement: Slider values are bounded numeric values
The system SHALL render Slider fields as numeric controls that honor the configured minimum, maximum, and step, and SHALL persist the resulting value as a numeric-compatible value.

#### Scenario: Set a valid Slider value
- **WHEN** a user moves the slider to a value within the configured range
- **THEN** the value is displayed and saved for the current entity

#### Scenario: Normalize an invalid Slider value
- **WHEN** an existing Slider value is outside the configured range or cannot be parsed as a number
- **THEN** the system displays a safe value within the configured range without throwing or corrupting the record

### Requirement: Listagem supports table and headless data
The system SHALL allow users to add, edit, remove, and reorder Listagem items. Table mode SHALL support Text, Number, Boolean, and Date columns, while headless mode SHALL support ordered text items without column headers.

#### Scenario: Edit a table row
- **WHEN** a user adds or edits a row in table mode
- **THEN** the row is validated according to its column types and the complete ordered collection is saved for the current entity

#### Scenario: Edit a headless list
- **WHEN** a user adds, edits, removes, or reorders an item in headless mode
- **THEN** the ordered text collection is saved and rendered without a table header

#### Scenario: Render an empty Listagem
- **WHEN** an entity has no saved Listagem value
- **THEN** the field shows an empty state and an action to add the first item

### Requirement: Charts render configured manual data
The system SHALL support Radar, Barra, and Linha charts with a title, optional legend, configurable color, and one manually maintained series of category labels and numeric values per entity.

#### Scenario: Enter chart data
- **WHEN** a user adds categories and numeric values to a chart field
- **THEN** the chart renders the corresponding series and saves the data for the current entity

#### Scenario: Render a Radar chart
- **WHEN** a chart is configured as Radar and has matching category and value entries
- **THEN** the system renders a radar visualization with one spoke per category and the configured series color

#### Scenario: Render Barra or Linha chart
- **WHEN** a chart is configured as Barra or Linha and has valid entries
- **THEN** the system renders the selected visualization with category labels and numeric values

#### Scenario: Handle inconsistent chart data
- **WHEN** category and value counts differ, or a value is not numeric
- **THEN** the system ignores invalid entries or shows an empty-state validation message and remains usable

### Requirement: Dynamic fields remain portable
The system SHALL include the new dynamic field types and their definitions in layout export/import, and SHALL continue to read existing layout documents and dynamic field definitions.

#### Scenario: Export new dynamic field definitions
- **WHEN** a layout containing Slider, Listagem, or Grafico fields is exported
- **THEN** the exported document includes each field type and its type-specific configuration

#### Scenario: Import a compatible layout
- **WHEN** a previously exported layout containing the new field types is imported
- **THEN** the fields and layout references are recreated or reused with equivalent behavior

#### Scenario: Read a legacy layout
- **WHEN** a layout document contains only existing field types or an older supported document version
- **THEN** the import succeeds with the existing behavior unchanged
