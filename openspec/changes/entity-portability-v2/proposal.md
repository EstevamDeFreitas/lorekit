# Entity portability v2

## Why

The legacy exporter followed bidirectional Relationship connectivity, which could include unrelated characters and other consumers of shared dynamic fields. The importer reused source identities and upserted existing rows. V2 exports an explicit ownership scope and imports new copies.

## What Changes

- Character export with optional descendants, owned dynamic values and terminal definitions, layouts, personalization, document trees, raster assets and stored Ironpaw state.
- Closed versioned `.lorekit` ZIP STORE archive, typed content/reference remapping, bounded validation, CRC32/SHA-256 and raster signature checks.
- Explicit destination world, dynamic-definition reuse or conflict rename, and external-reference selection/removal.
- Serialized copy execution with new identities, workspace/write/freshness guards, transaction, durable receipts, staged asset journal, compensation and sync capture.
- Character-header export and search-toolbar import dialogs. Legacy v1 methods remain rejecting facades.

## Scope

Character is the only supported root. Links, moodboards and unknown attachments require explicit omission; opaque editor content is rejected. Ironpaw item snapshots are detached from source catalogs, own actions are remapped, inherited species/vocation favorites are omitted with acknowledgment, and used wallet currency definitions are copied as terminal records.

## Validation and Remaining Work

Automated SQLite round trips, isolated browser UI workspaces and production web/desktop builds cover this delivery. Real Electron file-system tests, real authenticated web service tests and live two-device/server sync remain release qualification work. See tasks and docs/entity-portability-v2.md for precise evidence.

## Impact

Frontend codecs, planners, executor, dialogs, image staging, sync pause and local schema migration 10 for import receipts. No new production dependency or server API.
