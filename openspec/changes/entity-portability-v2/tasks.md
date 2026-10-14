## 1. Foundation

- [x] 1.1 Define versioned manifest, closed payload registry and bounded validation
- [x] 1.2 Implement immutable export-scope planner for Character, descendants and own values/terminal definitions
- [x] 1.3 Capture effective layouts and detect unsupported/weak dependencies explicitly
- [x] 1.4 Implement mutation-free copy-import preparation with new IDs and dynamic-field/layout remapping
- [x] 1.5 Add Angular preparation facade and reject direct legacy transfer calls
- [x] 1.6 Add repeatable scope/manifest/import/legacy safety regression tests

## 2. Complete content and archive support

- [x] 2.1 Audit and implement typed rich-document/mention, personalization and gallery codecs
- [x] 2.2 Resolve the first-launch coverage of Ironpaw, documents, links and moodboards
- [x] 2.3 Implement bounded ZIP STORE codec, compressed-input rejection and binary/hash/MIME verification
- [x] 2.4 Implement web/desktop asset capture with fresh destination blob IDs
- [x] 2.5 Generate manifest/archive from the reviewed snapshot without source identities or paths

## 3. Import execution

- [x] 3.1 Add explicit field conflict and external reference resolution
- [x] 3.2 Revalidate destination fingerprint, authorization and identity collisions immediately before writes
- [x] 3.3 Add serialized/idempotent application with DbProvider transaction and asset journal/recovery
- [x] 3.4 Integrate persistence, UI notifications and sync queues without importing source metadata
- [x] 3.5 Test rollback, interruption, retries and intentional reimport

## 4. Launch

- [x] 4.1 Add export/import dialogs and explicit destination selection
- [ ] 4.2 Verify full round trips on desktop/web, offline/online and two devices
- [ ] 4.3 Measure limits and memory on representative entity/resource packages
- [x] 4.4 Enable UI only for types with complete adapters and publish format documentation

## Delivery validation

- [x] V1 Run portability regression suite and app/spec typechecks
- [x] V2 Run desktop and web production builds
- [x] V3 Review diff and publish foundation commit to feature/new-entity-import-export

Evidence: 63/63 regression specs, complete spec/app typechecks and production web/desktop builds passed. Results are recorded in docs/entity-portability-v2.md. A production-browser flow passed with two synthetic desktop-mode workspaces and mocked Electron IPC: export with child/image/document/sheet, explicit removal of an external reference, field-conflict rename, copy import and persisted-row checks. SQLite tests verify rollback, durable receipts, retry after persistence failure and transfer of sync payloads to a second isolated database.

A second complete browser flow passed in web mode with real IndexedDB and mocked auth/sync HTTP, including database and image persistence. 4.2 remains pending for real Electron, real authenticated web services, offline/online service behavior and live two-device sync. 4.3 remains pending for representative large-resource memory profiling; configured bounds and adversarial small-package tests are implemented, not a measured maximum-capacity guarantee.

Strict OpenSpec CLI validation remains pending: automatic approval review previously blocked the CLI action due to possible disclosure of repository contents/metadata to an external service. No alternate external validation was attempted.
