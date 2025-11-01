import { Image } from "./image.model";

export class Personalization {
  id: string;
  contentJson: string;

  image?: Image;

  constructor(id: string = '', contentJson: string = '') {
    this.id = id;
    this.contentJson = contentJson;
  }
}

export interface WeakRelationship {
  entityTable: string;
  entityId: string;
}

export function getPersonalizationValue(entity:any, key: string): string | null {
  let personalization = <Personalization>entity.Personalization;

  if (personalization && personalization.contentJson != null && personalization.contentJson != '') {
    return JSON.parse(personalization.contentJson)[key] || null;
  }

  return null;
}

export function getTextClass(colorHex?: string | null): string {
    const rgb = hexToRgb(colorHex ?? '');
    if (!rgb) return 'text-white';
    const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000; // brilho perceptual
    return yiq >= 186 ? 'text-zinc-900' : 'text-white';
  }

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    if (!hex) return null;
    let v = hex.trim();
    if (!v.startsWith('#')) v = `#${v}`;
    const short = /^#([0-9a-fA-F]{3})$/;
    const long = /^#([0-9a-fA-F]{6})$/;
    if (short.test(v)) {
      v = v.replace(short, (_m, g: string) => {
        const [r, g1, b] = g;
        return `#${r}${r}${g1}${g1}${b}${b}`;
      });
    }
    if (!long.test(v)) return null;
    return {
      r: parseInt(v.slice(1, 3), 16),
      g: parseInt(v.slice(3, 5), 16),
      b: parseInt(v.slice(5, 7), 16),
    };
  }
