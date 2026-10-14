# Design

## Ownership instead of connectivity

Character is the supported root. A unique direct World binding is required. Selected descendants follow only Character hierarchy and must belong to the same readable world. Own values, images, personalization and document trees have unique ownership; document World bindings do not grant ownership. Dynamic definitions and wallet currency definitions are terminal: no other consumers are collected. Unknown dependencies and Link connections block until explicit omission is selected. Every fetch goes through the source read-policy seam; the current adapter uses the readable local workspace, not a newly introduced server ACL.

## Contract and content

Format `lorekit-entity-bundle`, version 2, schemaVersion 1 uses package-local keys and a closed column registry. Source row IDs, workspace paths, sync metadata and ancestor payloads are absent from the final archive. The immutable local snapshot may contain source IDs/paths only for conversion. Typed codecs convert supported legacy editor forms, validate native rich blocks, remap mentions/images and reject opaque blocks or active HTML. Dynamic widget envelopes, image galleries and personalization are bounded JSON. Stored Ironpaw inventory preserves snapshots, quantities, equipment and instance links; source catalog identifiers are detached. Species/vocation-derived favorites are omitted with acknowledgment. Used wallet currency/unit identities are remapped.

The archive is a deliberately narrow ZIP STORE dialect: manifest.json plus declared assets/<key>, no compression, encryption, extras, comments, duplicate paths, symlinks or traversal. Central and local headers, CRC32, SHA-256, byte sizes, MIME and raster signatures are checked. Signature checking is not complete image decoding. Limit: 100 MiB archive, 8 MiB manifest, 5,000 records, depth 64, 2,000 assets, 25 MiB each. The archive limit bounds aggregate bytes despite the separate 256 MiB asset metadata limit.

## Copy import

Preparation reserves fresh row/blob/layout identities and produces creation rows only. Equivalent dynamic definitions are reused; incompatible names require explicit rename. External references require removal or an eligible target in the explicit writable destination. Internal documents, mentions, fields, layouts, sheet-owner IDs, inventory/action IDs and wallet units are remapped. Currency definitions are always copied; destination definitions are not updated.

Application re-verifies archive, authorization, workspace identity, selected targets, destination fingerprint and ID collisions. Imports serialize per host. Receipts bind operation ID to plan digest; retry resumes the same operation and intentional reimport reserves a different operation. Asset IDs are journaled before staging; blob outbox/cache records persist before IO. Database creation and receipt commit in one transaction. Precommit failures compensate staged resources; committed resources are retained if durable persistence fails, allowing retry. Existing asset-operation recovery handles interrupted journals. Sync pauses during local application and resumes with normal dirty-row/outbox capture. SQLite and filesystem writes are coordinated with journal/recovery rather than claimed to be one atomic filesystem transaction.

## UI and legacy

Reviewed snapshots expire after 30 minutes and bind database/user/vault. Download uses the reviewed snapshot. Import rejects readonly/viewer workspaces. Export starts from Character header, import from search toolbar, and success opens the new Character tab. Legacy entity APIs and v1/full-backup inputs remain blocked.

## Validation

Run `npm run test:entity-portability`, app/spec typechecks and web/desktop production builds. Tests include isolated SQLite databases, sync payload contracts, rollback, concurrency/retries, stale destination and persistence failure. Browser UI was exercised with synthetic source/destination workspaces, mocked Electron IPC, and a separate web flow using real IndexedDB and mocked auth/sync HTTP; this is not live Electron, real authenticated web services or live cloud sync. Those release checks remain listed in tasks.
