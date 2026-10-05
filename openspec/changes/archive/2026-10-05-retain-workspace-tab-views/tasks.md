## 1. Runtime tab view hosting

- [x] 1.1 Add a workspace-level runtime view host keyed by stable tab ID that creates a page on first activation and detaches or reattaches it on selection changes; verify a tab's view is created once and its state returns intact after switching away and back.
- [x] 1.2 Preserve cached views when tabs move between panes or panes merge, and destroy the matching view when a tab is closed or replaced; verify movement preserves state and closing releases the view and its child resources.
- [x] 1.3 Keep runtime view references out of serialized workspace layout data; verify saved layout remains compatible and restored tabs can create their views from the current database.

## 2. Tab lifecycle, interactions, and saves

- [x] 2.1 Add an asynchronous, tab-scoped pending-save flush contract with a recoverable error path; verify a failed flush leaves the outgoing tab available and does not report the transition as saved.
- [x] 2.2 Integrate page components and rich text editors with activation and deactivation, including cancellation or suspension of inactive timers and window listeners; verify a retained moodboard does not process keyboard or clipboard actions while inactive and resumes correctly when activated.
- [x] 2.3 Route global keyboard and clipboard actions to the active tab in the focused pane; verify multiple open moodboards do not apply one Delete, copy, or paste event to more than the focused target.
- [x] 2.4 Keep saves from separate tabs flowing through the shared database persistence coordinator while flushing only the transitioning tab; verify pending edits in two panes both persist without one transition cancelling or overwriting the other.

## 3. Refresh and remote reconciliation

- [x] 3.1 Invalidate retained views after internal refresh and after remote synchronization completes its existing flush, discard, and database reconciliation order; verify reactivated tabs show the current database state and cannot replay stale values.
- [x] 3.2 Preserve workspace-wide pending-save flushing for shutdown, history operations, and synchronization; verify those operations still settle the appropriate editors when multiple views are retained.

## 4. Lifecycle verification and memory

- [x] 4.1 Update workspace pane lifecycle coverage for retained instances, activation, pane movement, close, and refresh; verify the former active-only remount expectation is replaced by the new behavior contract.
- [x] 4.2 Exercise moodboard and rich editor transitions with pending saves and multiple open tabs; verify values and transient canvas state survive the required transitions.
- [x] 4.3 Profile a workspace with several moodboards and rich editors, confirming closed tabs release their views and recording whether a later bounded eviction policy is needed.
