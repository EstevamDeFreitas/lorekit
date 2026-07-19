import { TabManagerService } from './tab-manager.service';

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
      service: new TabManagerService(globalParameter as any, registry as any),
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

    service.openTab('Document', 'document-1', 'Document', 'fa-file');
    expect(globalParameter.setParameter).toHaveBeenCalledTimes(1);

    await Promise.resolve();
    await Promise.resolve();

    expect(globalParameter.setParameter).toHaveBeenCalledTimes(1);
    expect(service.snapshot.panes[0].tabs[0].resolvedComponent).toBeDefined();
  });
});