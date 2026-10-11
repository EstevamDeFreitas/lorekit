# Design

## Ownership instead of connectivity

Character is the only root supported by the foundation. A direct, unique World → Character binding is required. Ancestor bindings are checked for structural consistency without collecting ancestor payloads. Children use only Character → Character edges and must remain in the same world. Owned DynamicFieldValue, Image and Personalization records require a single owner. DynamicField definitions are terminal: other values using the definition are never visited. A required canRead source seam is consulted before fetching content; the current Angular adapter uses the already-readable local workspace, not a new server ACL.

Unknown outgoing dependency types yield a blocking issue without fetching their payloads. An Ironpaw sheet is detected by its character ID and blocked pending a dedicated adapter. External relationships record only owner/type/classification in the local preview; they neither fetch nor disclose the referenced record ID or name.

## Contract and validation

The manifest uses format lorekit-entity-bundle, version 2, supported schema version 1 and package-local keys. Portable columns are defined independently from the database schema so new database columns cannot leak automatically. Validation checks keys, types, scalar fields, structural reachability, unique owners/field slots, terminal definitions, layout tokens and bounded asset metadata. Assets use assets/<key>; source paths and sync metadata are not permitted fields. Manifest validation is not binary/archive validation.

Structured editor content, personalization JSON and nonempty galleries are intentionally not executable in this milestone. Their codecs must preserve semantics, remap references and package binaries before enabling export/import. The preview may capture local source references and rich payloads: it is explicitly not a user-facing serializable bundle. No archive-generation endpoint exists yet.

## Copy import preparation

The destination world must exist and be writable. A fresh UUID v4 is reserved per new entity, definition, relation, layout and blob. The planner checks generated row IDs against destination records. It has no write capability and emits planned creation rows only; it never emits updates or an upsert instruction.

Equivalent definitions match normalized name/table/type/target/editor flag and canonical options. Object property order is ignored; array order is retained. Ambiguous names or incompatible definitions become blocking conflicts. Layouts are remapped and scoped to the new entity, not global. External references and binary assets remain blocking until their resolvers/executors are implemented. The plan captures a destination fingerprint for future executor revalidation. It does not currently implement retries, application idempotency or atomic file/database commit.

## Integration and legacy containment

EntityPortabilityService prepares previews from the active database and effective layout service. It does not download archives or persist imports. Old signatures remain in EntityTransferService for disabled UI callers, but reject before reading files or databases. Full backups and other existing portability features are untouched.

## Subsequent milestones

1. Audit rich documents, galleries, personalization and Ironpaw catalog references; add typed codecs and supported/omitted dependency decisions.
2. Implement bounded ZIP and binary verification with browser/desktop assets, without arbitrary filesystem paths or automatic remote URL fetches.
3. Resolve field conflicts/external references explicitly; add executor with serialized operations, freshness checks, ID collision rechecks, staging journal, rollback/compensation, persistence and sync.
4. Integrate dialogs, enable only covered entity types and validate desktop/web round trips and two devices.

## Validation

Pure planners and legacy service guards run through npm run test:entity-portability in Node using the existing TypeScript and Jasmine dependencies. Angular app/spec typechecks and production builds check integration. Browser/UI and live sync checks remain required for the launch milestone.
