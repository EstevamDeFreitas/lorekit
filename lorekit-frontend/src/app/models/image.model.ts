const ASSET_PREFIX = 'lorekit-asset://';
const LOCAL_ASSET_URL = 'lorekit-local://image';
export const ASSET_URL_READY_EVENT = 'lorekit-asset-url-ready';
const assetUrls = new Map<string, string>();
let assetUrlRequestHandler: ((blobId: string) => void) | null = null;

export type AssetUrlReadyDetail = { blobId: string; url: string };

export class Image {
  id: string;
  usageKey: string;
  filePath: string;
  blobId: string | null;
  originalName: string | null;
  mimeType: string | null;
  sha256: string | null;

  constructor(
    id: string = '',
    usageKey: string = '',
    filePath: string = '',
    blobId: string | null = null,
    originalName: string | null = null,
    mimeType: string | null = null,
    sha256: string | null = null,
  ) {
    this.id = id;
    this.usageKey = usageKey;
    this.filePath = filePath;
    this.blobId = blobId;
    this.originalName = originalName;
    this.mimeType = mimeType;
    this.sha256 = sha256;
  }
}

export function canonicalAssetReference(blobId: string): string {
  return `${ASSET_PREFIX}${blobId}`;
}

export function registerAssetUrl(blobId: string, url: string): void {
  if (assetUrls.get(blobId) === url) return;
  assetUrls.set(blobId, url);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<AssetUrlReadyDetail>(ASSET_URL_READY_EVENT, {
      detail: { blobId, url },
    }));
  }
}

export function setAssetUrlRequestHandler(handler: ((blobId: string) => void) | null): void {
  assetUrlRequestHandler = handler;
}

export function clearAssetUrl(blobId: string): void {
  assetUrls.delete(blobId);
}

export function assetIdFromReference(value: string): string | null {
  return value.startsWith(ASSET_PREFIX) ? value.slice(ASSET_PREFIX.length) : null;
}

export function buildImageUrl(reference: string | undefined | null): string {
  if (!reference) return '';
  const assetId = assetIdFromReference(reference);
  if (assetId) {
    const resolved = assetUrls.get(assetId);
    if (resolved) return resolved;
    assetUrlRequestHandler?.(assetId);
    return '';
  }

  if (/^(https?|data|blob|lorekit-local):/i.test(reference)) return reference;
  const normalized = reference.replace(/\\/g, '/');
  const isLocalPath = /^file:/i.test(reference)
    || normalized.startsWith('//')
    || normalized.startsWith('/')
    || /^[a-zA-Z]:\//.test(normalized);
  if (isLocalPath) {
    return isElectronRenderer()
      ? `${LOCAL_ASSET_URL}?path=${encodeURIComponent(reference)}`
      : '';
  }

  return normalized;
}

export function buildImageRecordUrl(image: Pick<Image, 'filePath' | 'blobId'> | null | undefined): string {
  if (!image) return '';
  if (image.blobId) {
    const remoteUrl = buildImageUrl(canonicalAssetReference(image.blobId));
    if (remoteUrl) return remoteUrl;
  }
  return buildImageUrl(image.filePath);
}

export function getImageByUsageKey(images: Image[] | undefined | null, usageKey: string): Image | null {
  if (!images) return null;
  const image = images.find(img => img.usageKey === usageKey);
  return image || null;
}

function isElectronRenderer(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI);
}
