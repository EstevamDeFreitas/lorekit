import { TabManagerService } from './tab-manager.service';
import { TestBed } from '@angular/core/testing';

describe('TabManagerService persistence', () => {
  function createService() {
    const globalParameter = {
      getParameter: jasmine.createSpy('getParameter').and.returnValue(null),
      setParameter: jasmine.createSpy('setParameter'),
    };
    const registry = {
      getComponent: jasmine.createSpy('getComponent').and.resolveTo(class TestComponent {}),
    };

    return {
      service: TestBed.runInInjectionContext(() => new TabManagerService(globalParameter as any, registry as any)),
      globalParameter,
      registry,
    };
  }

  it('does not persist resize previews and persists the committed ratios once', () => {
    const { service, globalParameter } = createService();

    service.previewPaneRatios([35, 65]);
    service.previewPaneRatios([40, 60]);

    expect(globalParameter.setParameter).not.toHaveBeenCalled();

    service.commitPaneRatios([40, 60]);

    expect(globalParameter.setParameter).toHaveBeenCalledTimes(1);
  });

  it('does not persist again when an asynchronously loaded component is attached', async () => {
    const { service, globalParameter } = createService();

    await service.openTab('Document', 'document-1', 'Document', 'fa-file');
    expect(globalParameter.setParameter).toHaveBeenCalledTimes(1);

    await Promise.resolve();
    await Promise.resolve();

    expect(globalParameter.setParameter).toHaveBeenCalledTimes(1);
    expect(service.snapshot.panes[0].tabs[0].resolvedComponent).toBeDefined();
    const savedLayout = JSON.parse(globalParameter.setParameter.calls.mostRecent().args[1]);
    expect('resolvedComponent' in savedLayout.panes[0].tabs[0]).toBeFalse();
  });
  it('reorders a tab in the same pane without removing it', async () => {
    const { service } = createService();
    await service.openTab('Document', 'document-1', 'Primeiro', 'fa-file');
    await service.openTab('Document', 'document-2', 'Segundo', 'fa-file');
    await service.openTab('Document', 'document-3', 'Terceiro', 'fa-file');
    const pane = service.snapshot.panes[0];
    await service.moveTab(pane.tabs[0].id, pane.id, pane.id, 2);
    expect(service.snapshot.panes[0].tabs.map(tab => tab.title))
      .toEqual(['Segundo', 'Terceiro', 'Primeiro']);
  });

  it('keeps the outgoing tab active when its scoped save flush fails, then retries successfully', async () => {
    const { service } = createService();
    await service.openTab('Document', 'document-1', 'Primeiro', 'fa-file');
    await service.openTab('Document', 'document-2', 'Segundo', 'fa-file');
    const pane = service.snapshot.panes[0];
    const outgoingId = pane.activeTabId!;
    const incomingId = pane.tabs.find(tab => tab.id !== outgoingId)!.id;
    const rejectFlush = (event: Event) => {
      const detail = (event as CustomEvent<{ tabId?: string; flushes: Promise<unknown>[] }>).detail;
      if (detail?.tabId === outgoingId) detail.flushes.push(Promise.reject(new Error('save failed')));
    };
    window.addEventListener('lorekit:flush-pending-saves', rejectFlush);

    const failed = await service.setActiveTab(pane.id, incomingId);

    expect(failed).toBeFalse();
    expect(service.snapshot.panes[0].activeTabId).toBe(outgoingId);
    expect(service.transitionError()).toBeTrue();

    window.removeEventListener('lorekit:flush-pending-saves', rejectFlush);
    const retried = await service.setActiveTab(pane.id, incomingId);

    expect(retried).toBeTrue();
    expect(service.snapshot.panes[0].activeTabId).toBe(incomingId);
    expect(service.transitionError()).toBeFalse();
  });
});
