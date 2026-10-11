## 1. Foundation

- [x] 1.1 Define versioned manifest, closed payload registry and bounded validation
- [x] 1.2 Implement immutable export-scope planner for Character, descendants and own values/terminal definitions
- [x] 1.3 Capture effective layouts and detect unsupported/weak dependencies explicitly
- [x] 1.4 Implement mutation-free copy-import preparation with new IDs and dynamic-field/layout remapping
- [x] 1.5 Add Angular preparation facade and reject direct legacy transfer calls
- [x] 1.6 Add repeatable scope/manifest/import/legacy safety regression tests

## 2. Complete content and archive support

- [ ] 2.1 Audit and implement typed rich-document/mention, personalization and gallery codecs
- [ ] 2.2 Resolve the first-launch coverage of Ironpaw, documents, links and moodboards
- [ ] 2.3 Implement bounded ZIP codec, decompression limits and binary/hash/MIME verification
- [ ] 2.4 Implement web/desktop asset capture with fresh destination blob IDs
- [ ] 2.5 Generate manifest/archive from the reviewed snapshot without source identities or paths

## 3. Import execution

- [ ] 3.1 Add explicit field conflict and external reference resolution
- [ ] 3.2 Revalidate destination fingerprint, authorization and identity collisions immediately before writes
- [ ] 3.3 Add serialized/idempotent application with DbProvider transaction and asset journal/recovery
- [ ] 3.4 Integrate persistence, UI notifications and sync queues without importing source metadata
- [ ] 3.5 Test rollback, interruption, retries and intentional reimport

## 4. Launch

- [ ] 4.1 Add export/import dialogs and explicit destination selection
- [ ] 4.2 Verify full round trips on desktop/web, offline/online and two devices
- [ ] 4.3 Measure limits and memory on representative entity/resource packages
- [ ] 4.4 Enable UI only for types with complete adapters and publish format documentation

## Foundation validation

- [x] V1 Run portability regression suite and app/spec typechecks
- [x] V2 Run desktop and web production builds
- [x] V3 Review diff and publish foundation commit to feature/new-entity-import-export

Evidence: 42/42 regression specs passed; app, complete spec and dedicated portability typechecks passed; both production builds passed with warnings in existing styles/budgets and sql.js CommonJS usage. Browser/UI and live two-device sync checks have not been performed for this foundation.

Strict OpenSpec CLI validation remains pending: automatic approval review blocked the CLI action due to possible disclosure of repository contents/metadata to an external service. No alternate external validation was attempted.
