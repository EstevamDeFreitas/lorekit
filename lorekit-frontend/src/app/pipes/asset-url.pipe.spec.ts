import { AssetUrlPipe } from './asset-url.pipe';

describe('AssetUrlPipe', () => {
  let originalElectronApi: Window['electronAPI'];

  beforeEach(() => {
    originalElectronApi = window.electronAPI;
  });

  afterEach(() => {
    if (originalElectronApi) window.electronAPI = originalElectronApi;
    else delete window.electronAPI;
  });

  it('accepts image records and plain canonical references', () => {
    const pipe = new AssetUrlPipe();
    window.electronAPI = {};

    expect(pipe.transform({ blobId: null, filePath: 'C:\\images\\local.png' }))
      .toContain('lorekit-local://image');
    expect(pipe.transform('data:image/png;base64,AA=='))
      .toBe('data:image/png;base64,AA==');
  });
});
