import {
  buildImageRecordUrl,
  buildImageUrl,
  canonicalAssetReference,
  clearAssetUrl,
  registerAssetUrl,
} from './image.model';

describe('image URL resolution', () => {
  let originalElectronApi: Window['electronAPI'];

  beforeEach(() => {
    originalElectronApi = window.electronAPI;
  });

  afterEach(() => {
    if (originalElectronApi) window.electronAPI = originalElectronApi;
    else delete window.electronAPI;
    clearAssetUrl('6ecce62c-49c2-4eb4-bede-5dbad18cf280');
  });

  it('uses the restricted Electron protocol for local files', () => {
    window.electronAPI = {};
    const path = 'C:\\Users\\Author\\AppData\\Roaming\\lorekitapp\\images\\portrait.png';

    expect(buildImageUrl(path)).toBe(
      `lorekit-local://image?path=${encodeURIComponent(path)}`,
    );
  });

  it('does not expose desktop paths to the web runtime', () => {
    delete window.electronAPI;
    expect(buildImageUrl('C:\\Users\\Author\\images\\portrait.png')).toBe('');
  });

  it('prefers a resolved blob and falls back to the local file', () => {
    window.electronAPI = {};
    const blobId = '6ecce62c-49c2-4eb4-bede-5dbad18cf280';
    const image = { blobId, filePath: 'C:\\images\\portrait.png' };

    expect(buildImageRecordUrl(image)).toContain('lorekit-local://image');
    registerAssetUrl(blobId, 'blob:resolved-image');
    expect(buildImageRecordUrl(image)).toBe('blob:resolved-image');
    expect(canonicalAssetReference(blobId)).toBe(`lorekit-asset://${blobId}`);
  });
});
