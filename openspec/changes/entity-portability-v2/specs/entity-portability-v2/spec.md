# Entity Portability V2

## ADDED Requirements

### Requirement: Explicit export boundaries
The system SHALL prepare a Character export from a unique world binding, structural descendants selected by the user, and explicitly owned dependencies. It SHALL NOT traverse ancestors, the world's other children or other consumers of shared dynamic definitions.

#### Scenario: A field is used by two characters
- **WHEN** character A and character B share a DynamicField
- **THEN** A's preview includes A's value and the terminal definition
- **AND** B and its value are never fetched as a consequence

#### Scenario: Descendant belongs to another world
- **WHEN** a selected descendant has a different world binding
- **THEN** preparation fails rather than including cross-world data

#### Scenario: Dependency has no complete codec
- **WHEN** a dependency is unsupported or requires an unfinished asset/rich-content codec
- **THEN** the preview contains a blocking issue or rejects the unsupported manifest
- **AND** it does not report a complete portable export

### Requirement: Closed and bounded manifest
The system SHALL accept only entity bundle v2, registered entity/schema types, explicitly permitted columns, declared references and resources within configured limits. Package identities SHALL be independent from database identities.

#### Scenario: Import requests an internal table
- **WHEN** a manifest declares GlobalParameter, a sync table or an unknown payload column
- **THEN** validation fails before any mutation

#### Scenario: Resource path escapes the package
- **WHEN** an asset path does not equal assets/<declared-key>
- **THEN** manifest validation fails
- **AND** no filesystem access is performed

### Requirement: Import preparation as a copy
The system SHALL prepare creation of copies into an explicit writable destination world, reserve new identities, remap internal relations/dynamic tokens and preserve entity-specific layouts. Preparation SHALL NOT mutate database rows or files.

#### Scenario: An equivalent field exists
- **WHEN** the destination contains exactly one semantically equivalent dynamic definition
- **THEN** the plan reuses its identity
- **AND** it creates no replacement or duplicate definition

#### Scenario: The field name has an incompatible definition
- **WHEN** a destination definition uses the incoming name with different semantics
- **THEN** the plan has a blocking conflict requiring explicit resolution
- **AND** the existing definition is not overwritten

#### Scenario: An entity reference is external
- **WHEN** the manifest declares an external entity reference
- **THEN** preparation reports unresolved references
- **AND** no target is guessed from a source ID or name

### Requirement: Legacy methods fail closed
Legacy entity export/import entry points SHALL reject direct calls while v2 execution remains incomplete. UI visibility alone SHALL NOT be the protection.

#### Scenario: A caller invokes the hidden v1 importer
- **WHEN** importBundleFromFile is called directly
- **THEN** it rejects before reading the file or writing a database

### Requirement: Full execution remains gated
The feature SHALL NOT be enabled for users until archive integrity, typed content/asset codecs, conflict/reference resolution, transactional execution/recovery and platform/sync validations are complete.

#### Scenario: Foundation APIs are available
- **WHEN** only preview and manifest-validation APIs are implemented
- **THEN** export/import UI stays disabled
- **AND** no preview is treated as an executable import or final archive
