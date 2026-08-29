import {
  buildImageRecordUrl,
  buildImageUrl,
  canonicalAssetReference,
  clearAssetUrl,
  registerAssetUrl,
  setAssetUrlRequestHandler,
} from './image.model';

describe('image URL resolution', () => {
  let originalElectronApi: Window['electronAPI'];

  beforeEach(() => {
    originalElectronApi = window.electronAPI;
  });

  afterEach(() => {
    setAssetUrlRequestHandler(null);
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
  it('requests an unresolved canonical asset only when it is rendered', () => {
    const blobId = '6ecce62c-49c2-4eb4-bede-5dbad18cf280';
    const requested: string[] = [];
    setAssetUrlRequestHandler(id => requested.push(id));

    expect(buildImageUrl(canonicalAssetReference(blobId))).toBe('');
    expect(requested).toEqual([blobId]);

    registerAssetUrl(blobId, 'blob:on-demand');
    expect(buildImageUrl(canonicalAssetReference(blobId))).toBe('blob:on-demand');
    expect(requested).toEqual([blobId]);
  });
});
