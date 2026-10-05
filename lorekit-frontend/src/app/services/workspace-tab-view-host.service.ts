import {
  ComponentRef,
  DestroyableInjector,
  Injectable,
  Injector,
  signal,
  Type,
  ViewContainerRef,
} from '@angular/core';
import { WorkspaceLayout, WorkspaceTab } from '../models/workspace.model';
import { WORKSPACE_TAB_CONTEXT, WorkspaceTabContext } from '../models/workspace-tab-context';

interface RuntimeTabView {
  componentType: Type<unknown>;
  componentRef: ComponentRef<unknown>;
  injector: DestroyableInjector;
  context: WorkspaceTabContext;
  container: ViewContainerRef | null;
}

/** Owns dynamic tab views independently from pane components and saved layout data. */
@Injectable({ providedIn: 'root' })
export class WorkspaceTabViewHostService {
  private readonly views = new Map<string, RuntimeTabView>();
  private readonly outlets = new Map<string, ViewContainerRef>();
  readonly generation = signal(0);

  get retainedViewCount(): number {
    return this.views.size;
  }

  registerOutlet(paneId: string, container: ViewContainerRef): void {
    this.outlets.set(paneId, container);
  }

  unregisterOutlet(paneId: string, container: ViewContainerRef): void {
    if (this.outlets.get(paneId) === container) this.outlets.delete(paneId);
  }

  activate(
    tab: WorkspaceTab | undefined,
    container: ViewContainerRef,
    focused: boolean,
    inputs: Record<string, unknown>
  ): void {
    for (const [tabId, view] of this.views) {
      if (view.container === container && tabId !== tab?.id) {
        this.detach(view);
      }
    }

    if (!tab?.resolvedComponent) return;

    let view = this.views.get(tab.id);
    if (view && view.componentType !== tab.resolvedComponent) {
      this.destroy(tab.id);
      view = undefined;
    }

    if (!view) {
      const context = new WorkspaceTabContext(tab.id);
      const injector = Injector.create({
        providers: [{ provide: WORKSPACE_TAB_CONTEXT, useValue: context }],
        parent: container.injector,
      });
      const componentRef = container.createComponent(tab.resolvedComponent, { injector });
      view = {
        componentType: tab.resolvedComponent,
        componentRef,
        injector,
        context,
        container,
      };
      this.views.set(tab.id, view);
    } else if (view.container !== container) {
      this.detach(view);
      container.insert(view.componentRef.hostView);
      view.container = container;
    }

    view.context.setFocused(focused);
    view.context.setActive(true);
    Object.entries(inputs).forEach(([name, value]) => view!.componentRef.setInput(name, value));
    view.componentRef.changeDetectorRef.detectChanges();
  }

  setFocused(tabId: string | null, focused: boolean): void {
    for (const [id, view] of this.views) {
      view.context.setFocused(id === tabId && focused && view.context.active());
    }
  }

  detachContainer(container: ViewContainerRef): void {
    for (const view of this.views.values()) {
      if (view.container === container) this.detach(view);
    }
  }

  destroy(tabId: string): void {
    const view = this.views.get(tabId);
    if (!view) return;

    view.context.release();
    view.componentRef.destroy();
    view.injector.destroy();
    this.views.delete(tabId);
  }

  reconcile(layout: WorkspaceLayout): void {
    const paneIds = new Set(layout.panes.map(pane => pane.id));
    for (const [paneId, outlet] of this.outlets) {
      if (paneIds.has(paneId)) continue;
      this.detachContainer(outlet);
      this.outlets.delete(paneId);
    }

    const retainedTabIds = new Set(layout.panes.flatMap(pane => pane.tabs.map(tab => tab.id)));
    for (const tabId of this.views.keys()) {
      if (!retainedTabIds.has(tabId)) this.destroy(tabId);
    }
  }

  invalidateAll(): void {
    for (const tabId of [...this.views.keys()]) this.destroy(tabId);
    this.generation.update(value => value + 1);
  }

  private detach(view: RuntimeTabView): void {
    view.context.setActive(false);
    view.context.setFocused(false);
    if (!view.container) return;

    const index = view.container.indexOf(view.componentRef.hostView);
    if (index >= 0) view.container.detach(index);
    view.container = null;
  }
}
