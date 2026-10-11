import { EntityTransferService } from './entity-transfer.service';

describe('EntityTransferService legacy safety', () => {
  it('rejects direct legacy export calls even when the UI is bypassed', async () => {
    await expectAsync(new EntityTransferService().exportEntityBundle('Character', 'a')).toBeRejectedWithError(/exportação antiga está desabilitada/);
  });
  it('rejects legacy imports before accessing the file or any database', async () => {
    const text = jasmine.createSpy('text').and.throwError('must not read');
    await expectAsync(new EntityTransferService().importBundleFromFile({ text } as unknown as File)).toBeRejectedWithError(/importação antiga está desabilitada/);
    expect(text).not.toHaveBeenCalled();
  });
});
