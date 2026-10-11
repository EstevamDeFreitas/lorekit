# Entity portability v2

## Why

The legacy entity exporter traverses Relationship in both directions. Selecting one character can include its world, unrelated characters, and other values using the same DynamicField. The legacy importer also upserts rows using source IDs. Hidden buttons alone do not prevent direct calls to these unsafe methods.

## What Changes

- Define a closed v2 manifest with package-local identities, supported payloads, structural/owned edges, terminal dynamic definitions, layouts, references and asset metadata.
- Plan Character exports using explicit ownership and hierarchy, with same-world/read checks and bounded traversal.
- Prepare imports as copies into an explicit destination world. Reserve fresh IDs, reuse only equivalent dynamic definitions, report conflicts and remap internal references/layout tokens.
- Keep plans immutable and preparation free of database/file mutations.
- Reject legacy entry points at service level and keep all entity transfer UI disabled until full v2 execution is verified.

## Scope of This Initial Commit

Contract, manifest validation, export-scope preview, copy-import preview, Angular service boundary and regression tests. These APIs do not create an archive or apply an import. Rich content, personalization JSON, binary assets, Ironpaw and unknown attachments fail closed or appear as blocking issues rather than being silently omitted.

## Remaining Delivery

ZIP codec, verified asset extraction/staging, rich text and gallery codecs, external-reference/conflict resolution, transactional executor/recovery, UI and two-device sync validation. This change remains open until those milestones pass.

## Capabilities

- entity-portability-v2: new bounded entity export and copy import contract.

## Impact

Frontend portability models, pure planners and EntityPortabilityService. EntityTransferService becomes a rejecting compatibility facade. No database migration, new production dependency or server API is introduced by the foundation.
