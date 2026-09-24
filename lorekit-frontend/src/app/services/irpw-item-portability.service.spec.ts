import { createEmptyItemDefinition } from '../models/irpw-item.model';
import { IrpwItemPortabilityService } from './irpw-item-portability.service';

describe('IrpwItemPortabilityService', () => {
  function packageWithAssets(assets: unknown[]) {
    return {
      format: 'lorekit-ironpaw-items', version: 1, system: 'ironpaw',
      package: { id: 'package-1', name: 'Teste' },
      items: [{ portableId: 'portable-1', revision: 1, name: 'Poção', description: '', definition: createEmptyItemDefinition('common') }],
      assets,
    };
  }

  it('validates raster assets by hash, encoding and dimensions', () => {
    const catalog = { getItems: () => [] };
    const db = { runInTransaction: async (operation: () => Promise<void>) => operation() };
    const service = new IrpwItemPortabilityService(db as never, catalog as never);
    const plan = service.prepareImport(JSON.stringify(packageWithAssets([{
      sha256: 'a'.repeat(64), mimeType: 'image/png', base64: 'iVBORw==', width: 32, height: 32,
    }])));
    expect(plan.document.assets[0].sha256).toBe('a'.repeat(64));
  });

  it('rejects paths and remote URLs in image resources', () => {
    const service = new IrpwItemPortabilityService({} as never, { getItems: () => [] } as never);
    expect(() => service.prepareImport(JSON.stringify(packageWithAssets([{
      sha256: 'b'.repeat(64), mimeType: 'image/png', base64: 'file:///tmp/image.png',
    }])))).toThrowError(/base64/);
  });

  it('requires a fresh conflict plan before writing', async () => {
    const local = {
      id: 'local-1', portableId: 'portable-1', revision: 1, name: 'Local', description: '',
      definition: createEmptyItemDefinition('common'), archived: 0,
    };
    const catalog = { getItems: jasmine.createSpy().and.returnValues([], [local]), saveItem: jasmine.createSpy() };
    const db = { runInTransaction: jasmine.createSpy().and.callFake(async (operation: () => Promise<void>) => operation()) };
    const service = new IrpwItemPortabilityService(db as never, catalog as never);
    const plan = service.prepareImport(JSON.stringify(packageWithAssets([])));
    await expectAsync(service.applyImport(plan)).toBeRejectedWithError(/mudou desde a prévia/);
    expect(db.runInTransaction).not.toHaveBeenCalled();
  });
});