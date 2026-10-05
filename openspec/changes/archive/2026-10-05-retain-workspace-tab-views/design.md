## Context

See `proposal.md` for motivation and `specs/workspace-tabs/spec.md` for the behavior contract.

The workspace stores tab metadata and a lazily resolved component type. `WorkspacePaneComponent` currently renders an outlet only for the active tab, so Angular destroys that view when selection changes. Tab IDs remain stable across normal activation and pane moves; replacing a tab intentionally gives it a new ID.

The moodboard editor owns autosave timers and registers window-level mouse, keyboard, copy, paste, flush, and discard listeners. Its destruction flushes pending saves and removes these listeners. A retained view will not receive destruction when detached. The rich text editor also has asynchronous serialization during save and destruction.

All mutations reach a shared `DbProvider` and one `DatabasePersistenceCoordinator`, which coalesces dirty notifications and serializes database writes. This protects disk persistence; component-level pending saves still need lifecycle coordination. Internal refresh and remote synchronization already have workspace-level flush/discard flows.

## Goals / Non-Goals

**Goals:**

- Preserve each open tab's runtime view state across tab selection and pane movement.
- Make only the active view in the focused pane handle global keyboard and clipboard actions.
- Finish a departing tab's pending editor saves before detaching or destroying it, while allowing other tabs to save independently.
- Invalidate retained views after component refresh or remote database reconciliation.
- Keep the runtime cache out of persisted tab layout data and release it when tabs close.

**Non-Goals:**

- Persisting component instances or transient view state across application restarts.
- Changing the database schema, serialized workspace layout, or database writer architecture.
- Introducing a cache eviction policy in the first iteration; every open tab remains cached until it closes.

## Decisions

### Own cached views above individual panes

Add a workspace-level tab view host or manager that owns one runtime view record per stable `tab.id`. On first activation it creates the registered component and supplies that tab's inputs. On deactivation it detaches the host view without destroying the component. On activation it inserts the existing view into the target pane. This owner must survive pane removal so moving tabs or merging a closed pane does not recreate their views.

Closing a tab destroys its retained view and removes its record. Replacing a tab with a different entity destroys the old record because the replacement has a new tab ID. Existing duplicate-tab lookup continues to focus the existing tab, preserving the one-view-per-tab invariant.

Keeping every tab rendered with CSS visibility was considered and rejected: hidden moodboards would retain window listeners and could process global events. A page-state snapshot cache would use less runtime memory but would require each page and rich editor to serialize and restore its own transient state, then rebuild the view. Detached component views preserve that state with one shared lifecycle model.

### Separate runtime view records from saved layout

Store component references and detached views only in the runtime workspace host, keyed by tab ID. Keep them out of `WorkspaceTab` serialization and `saveLayout()`. On application restart, restore tab metadata as today and create views from the current database when activated. This keeps the persisted layout format compatible.

### Make tab transitions an awaited save boundary

Before detaching or closing a tab, ask that tab's editors to serialize and apply pending edits to the shared database. Use a tab-scoped flush contract so a switch in one pane does not force unrelated active panes to flush. Preserve the existing workspace-wide flush for operations such as shutdown, history restoration, and synchronization. If a tab-scoped flush fails, keep the outgoing view attached and surface the error so the transition does not imply that data was saved.

After a successful flush, suspend the outgoing view's timers and global listeners. On activation, restore its global interaction registration and refresh layout-dependent UI after its host view is inserted. Window-level actions must route through the focused pane's active tab; visible tabs in other panes and detached views do not handle the same event.

The shared database remains the source of persistence. Each component applies its own pending edits to that database; the existing coordinator continues to serialize and coalesce disk writes. No per-component database writer or overlapping copy of the database is introduced.

### Invalidate cached views on refresh and remote reconciliation

Treat a component refresh as a new runtime view generation. After the existing flush path for an internal refresh completes, destroy retained views so their next activation reads current database state. For remote content, preserve the current ordering: flush pending local components and database writes before reconciliation; honor the existing discard notification; then invalidate retained views after the transaction and rebuild from the reconciled database. Cached component memory must never be allowed to write over the refreshed state.

### Retain all open tabs in the first iteration

The cache lifetime follows the user's open tabs: inactive views stay retained until the user closes their tab. This gives consistent return behavior across view types without guessing which transient state can be reconstructed. Detached views are removed from the visible document and change detection while inactive; closing a tab releases the component and its child editor resources.

The trade-off is memory proportional to the number and weight of open views, especially moodboards and rich editors. If profiling shows this is too high, a later bounded LRU policy must define how to preserve transient state on eviction before it is introduced.

The lifecycle profile covers 20 simultaneously open runtime views: the host retained exactly 20 instantiated views and returned to zero after all tabs were closed. Moodboard and rich-editor save/activation behavior is covered by focused integration specs. This confirms that closed tabs release their views; it does not measure heap bytes in a production-sized workspace, so an LRU policy remains a future response if real-user profiling shows excessive memory use.

## Risks / Trade-offs

- **Retained editors continue background work** -> Give tabs explicit activation and deactivation callbacks; suspend global listeners, timers, and expensive subscriptions while detached.
- **An asynchronous save finishes after a newer edit** -> Await tab-scoped editor serialization before reactivation or destruction, and keep save callbacks associated with their originating tab and entity.
- **Global keyboard events affect multiple panes** -> Route window-level actions to the active tab in the focused pane, rather than leaving independent global handlers registered on every cached view.
- **Memory grows with open tabs** -> Detach inactive views from the document, release all resources on close, and profile representative workspaces with several moodboards before considering LRU eviction.
- **A remote update leaves stale component state alive** -> Invalidate all retained views after the existing synchronization flush/discard and database reconciliation sequence.

## Migration Plan

1. Add the runtime tab view host and explicit activation, deactivation, and scoped-save contracts while leaving saved workspace layout data unchanged.
2. Integrate dynamic page components and their child editors with those lifecycle contracts, starting with the moodboard's window listeners and pending item saves.
3. Connect internal refresh, remote reconciliation, tab close, and pane movement to the cache's invalidate, destroy, or reattach operations.
4. If the new host needs rollback, restore active-only outlet rendering. No data or layout migration is required because the cache is session-only and saves still flow through the existing database.
