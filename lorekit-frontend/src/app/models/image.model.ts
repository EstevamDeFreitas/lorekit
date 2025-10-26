export class Image {
  id: string;
  usageKey: string;
  filePath: string;

  constructor(id: string = '', usageKey: string = '', filePath: string = '') {
    this.id = id;
    this.usageKey = usageKey;
    this.filePath = filePath;
  }

  buildImageUrl(): string {
    if (!this.filePath) return '';

    if (/^(https?|file|data|blob):/i.test(this.filePath)) return this.filePath;
    const normalized = this.filePath.replace(/\\/g, '/');

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
}
