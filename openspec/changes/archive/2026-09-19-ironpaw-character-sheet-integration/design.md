## Context

The Ironpaw data is stored in the existing `IRPWVocation`, `IRPWSpecie` and `IRPWCharacterSheet` records. Vocation skill settings are serialized in JSON under `attributes`, species configuration is keyed by the normal species id, and sheet values such as skills, perceptions and life are serialized independently. The current sheet only reads inherited passives; it does not derive skill minimums, perceptions or life from the selected records.

The workspace already supports entity tabs through `TabManagerService`, the species editor already opens `IrpwSpecieConfigComponent` in a CDK modal, and the vocation editor currently renders as a full-page component. There are no existing main OpenSpec requirements for Ironpaw.

## Goals / Non-Goals

**Goals:**

- Keep vocation data focused on skill levels and make legacy vocation attribute values inert.
- Apply assignment changes as explicit reset/rebase events with different semantics for vocation and species.
- Preserve manual increases while enforcing current vocation skill and species perception minimums.
- Centralize life recalculation at assignment changes and avoid background recalculation from configuration edits.
- Expose inherited sources accessibly and reuse the existing workspace/modal patterns.

**Non-Goals:**

- Adding skill grants to species; the supplied Ironpaw rules define species perceptions, life and passives, not skill minimums.
- Recalculating existing sheets when an already-selected vocation or species definition is edited.
- Reworking the generic character, species or relationship data model.
- Implementing Ironpaw resource systems, passives, weaknesses, inventory or combat features not required for this integration.

## Decisions

### 1. Treat assignment changes as explicit rebase events

`onVocationSelect` and `onSpecieSelect` remain the boundary where derived data is applied. The vocation path resets all skill levels before applying the new vocation levels. The species path preserves skills, replaces species perception bases, ensures the species configuration exists, and recalculates life. Selecting the same id again MUST NOT trigger another reset.

This is preferable to continuously deriving values during every change-detection pass because it preserves manual edits and matches the user's rule that recalculation happens only when the assignment changes.

The resulting flow is:

```text
assignment id changed
        |
        +--> vocation changed --> clear skills --> apply vocation minimums
        |
        +--> species changed  --> preserve skills --> apply species perceptions
        |
        +--> either change    --> recalculate life minimum
```

### 2. Keep sheet values as the editable layer and derive minimums from current assignments

The sheet continues to store the player's current values. The selected vocation and species provide minimums used by the editor and save normalization. A skill value is effective only after applying `max(sheet skill, vocation minimum)`, and a perception is effective only after applying `max(sheet perception, species base)` when a species base exists.

On a vocation change, the stored sheet skills are intentionally reset before the new baseline is applied. On a species change, stored skills are untouched. This avoids introducing a second provenance payload while still implementing the significant-change rule.

### 3. Recalculate life only at relationship changes

The life minimum is calculated as:

```text
1 + normalized vocation.basehealth + normalized species.basehealth
```

Missing or invalid contributions resolve to zero. The calculated minimum is applied to the sheet when either relationship id changes. Existing current life is clamped to the resulting maximum rather than discarded. Manual increases to the maximum remain valid until another assignment change.

Configuration saves emit normal entity-change notifications for editors and indicators, but they do not invoke the assignment rebase operation.

### 4. Normalize legacy vocation JSON without a schema migration

The vocation editor stops rendering numeric attribute inputs and writes only skill levels for newly saved data. Readers tolerate legacy `value` properties and ignore them. A database migration is unnecessary because the values are inert and the existing JSON column remains compatible.

### 5. Use a focused vocation modal rather than embedding the full page editor

Add a modal-oriented vocation configuration component patterned after the existing species configuration modal. It receives the selected vocation id, exposes the same vocation fields relevant to the new behavior, and shares normalization/serialization logic with the full vocation editor where practical.

Embedding the full page editor directly would couple dialog lifecycle, sidebar state and page navigation to the character sheet. A focused modal keeps the existing vocation tab stable and makes close/save behavior explicit.

### 6. Make source indicators semantic, not just decorative

Skill indicators appear when the current level equals a positive vocation minimum and identify the vocation through tooltip and accessible text. Perception indicators appear whenever a species base exists and expose the base value even after a manual increase. The indicator state is computed from the current selected records and sheet values, so it does not create additional persisted provenance fields.

### 7. Reuse workspace tab semantics for opening the sheet

The character editor uses the existing `TabManagerService` with entity type `CharacterSheet` and the character id. The component registry already maps that entity type to the Ironpaw sheet. This preserves current duplicate-tab focusing behavior and avoids introducing a separate route or browser window.

## Risks / Trade-offs

- **[Risk]** Resetting all skills on vocation change can discard manual progression. **Mitigation:** make the behavior explicit in the UI flow and only execute it when the vocation id actually changes.
- **[Risk]** Legacy vocation JSON may contain attribute values that appear valid. **Mitigation:** ignore them consistently and remove them from newly serialized editor output.
- **[Risk]** An empty auto-created species configuration may initially provide no perception or life values. **Mitigation:** create the record with nullable fields and keep the existing species editor's Ironpaw button as the configuration path.
- **[Risk]** Editing a vocation/species definition will not immediately update assigned sheets. **Mitigation:** show source indicators from the currently loaded assignment and document that reassignment is the recalculation trigger.
- **[Risk]** Manual life or perception values could be lower than the active source minimum after loading old data. **Mitigation:** normalize effective values against the active minimum when parsing and saving.

## Migration Plan

1. Deploy the UI and service changes without changing the SQLite table definitions.
2. Continue reading existing vocation JSON, ignoring legacy attribute values.
3. Normalize vocation JSON to the skill-only shape whenever the vocation is saved.
4. Do not rewrite existing character sheets automatically; apply new derived baselines when the user changes vocation or species.
5. If rollback is required, the unchanged tables and backward-tolerant JSON readers allow the previous UI to continue reading the stored records.

## Open Questions

None that block the selected behavior. The remaining presentation details, such as the exact icon and tooltip wording, can be chosen during implementation without changing the requirements.
