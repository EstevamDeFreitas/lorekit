## 1. Normalize Ironpaw vocation data

- [x] 1.1 Remove editable numeric attribute controls from the vocation editor and serialize only vocation skill levels while continuing to tolerate legacy `value` properties; verify the rendered editor has no attribute-value inputs and existing vocation JSON still loads.
- [x] 1.2 Update the vocation model/parsing boundaries and add focused tests for skill-level normalization, legacy attribute-value ignoring, and vocation minimum extraction; verify the new tests pass.

## 2. Apply vocation and species rules to the character sheet

- [x] 2.1 Make every species in the character's current world selectable in the Ironpaw sheet and add an idempotent ensure-configuration operation that creates an empty species Ironpaw record when missing; verify selecting an unconfigured species creates the record exactly once.
- [x] 2.2 Implement assignment-change rebasing so vocation changes reset all sheet skills and apply the new vocation minimums, while species changes preserve skills and replace only species-derived perception values; verify both transitions and removal of each assignment.
- [x] 2.3 Implement minimum enforcement for vocation skills and species perceptions during manual edits, including clamping legacy below-minimum values on load/save; verify manual increases persist and decreases below the active minimum do not.
- [x] 2.4 Implement life recalculation on actual vocation/species id changes using `1 + vocation life + species life`, treating missing values as zero and clamping current life to the new maximum; verify configuration-only edits do not recalculate the sheet and manual life increases remain valid.
- [x] 2.5 Add compact, accessible source indicators for skills at vocation minimum and perceptions with a species base, including the species base in the perception tooltip after a manual increase; verify indicators update when assignments and manual values change.

## 3. Add Ironpaw configuration entry points

- [x] 3.1 Create a focused vocation configuration modal that reuses the vocation normalization and persistence rules, supports the selected vocation only, and does not trigger character-sheet rebasing when saved; verify open, save, close and no-vocation states.
- [x] 3.2 Add the vocation configuration action beside the vocation selector in the character sheet and refresh the visible vocation metadata after modal saves without recalculating derived character values; verify the action is unavailable when no vocation is selected.
- [x] 3.3 Preserve and verify the existing species editor Ironpaw configuration button as the configuration path for automatically created species records; verify the button opens the selected species configuration.

## 4. Open the sheet from the character editor

- [x] 4.1 Add an Ironpaw sheet action to the character editing header using the existing workspace tab semantics and `CharacterSheet` entity registration; verify it opens the matching sheet tab and focuses an already-open tab instead of duplicating it.

## 5. Verify integration and compatibility

- [x] 5.1 Add integration coverage for vocation changes, species changes, formula recalculation, manual overrides, and legacy data loading using the project's Angular test setup; verify the relevant test suite passes.
- [x] 5.2 Run the frontend build and OpenSpec strict validation, then manually smoke-test the vocation editor, character sheet selectors/modal, species auto-configuration, source indicators, and character-editor sheet button; verify there are no build errors or validation failures.
