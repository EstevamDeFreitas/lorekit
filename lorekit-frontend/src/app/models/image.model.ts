export class Image {
  id: string;
  usageKey: string;
  filePath: string;

  constructor(id: string = '', usageKey: string = '', filePath: string = '') {
    this.id = id;
    this.usageKey = usageKey;
    this.filePath = filePath;
  }
}

export function buildImageUrl(filePath : string | undefined | null): string {
  if (!filePath) return '';
  if (/^(https?|file|data|blob):/i.test(filePath)) return filePath;
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.startsWith('//')) {
    const rest = normalized.slice(2).split('/').map(encodeURIComponent).join('/');
    return `file://${rest}`;
  }
  if (/^[a-zA-Z]:\//.test(normalized)) {
    const drive = normalized.slice(0, 2);
    const rest = normalized.slice(2).split('/').map(encodeURIComponent).join('/');
    return `file:///${drive}${rest}`;
  }
  const encoded = normalized.split('/').map(encodeURIComponent).join('/');
  return `file:///${encoded}`;
}

export function getImageByUsageKey(images: Image[] | undefined | null, usageKey: string): Image | null {
  if (!images) return null;
  const image = images.find(img => img.usageKey === usageKey);
  return image || null;
}
