import { Personalization } from "./personalization.model";
import { World } from "./world.model";

export class Moodboard {
  id: string;
  name?: string;

  MoodboardItems?: MoodboardItem[] = [];
  Personalization?: Personalization
  ParentWorld?: World | null;
  ParentMoodboard?: Moodboard | null;

  constructor(id: string = '', name: string = '') {
    this.id = id;
    this.name = name;
  }
}

export type MoodboardShapeType = 'rectangle' | 'circle' | 'line' | 'arrow';
export type MoodboardItemKind = 'shape' | 'text' | 'image' | 'entity' | 'drawing';
export type MoodboardTextAlign = 'left' | 'center' | 'right';
export type MoodboardVerticalAlign = 'top' | 'middle' | 'bottom';
export type MoodboardTextSize = 'small' | 'medium' | 'large' | 'xlarge';
export type MoodboardAnchorSide = 'top' | 'right' | 'bottom' | 'left';

export interface MoodboardPoint {
  x: number;
  y: number;
}

export interface MoodboardLineAnchor {
  itemId: string;
  side: MoodboardAnchorSide;
  offset: number;
}

export interface MoodboardItemConfig {
  kind: MoodboardItemKind;
  shapeType?: MoodboardShapeType;
  width?: number;
  height?: number;
  rotation?: number;
  text?: string;
  textAlign?: MoodboardTextAlign;
  verticalAlign?: MoodboardVerticalAlign;
  textSize?: MoodboardTextSize;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  waypoints?: MoodboardPoint[];
  startAnchor?: MoodboardLineAnchor;
  endAnchor?: MoodboardLineAnchor;
  imageId?: string;
  imagePath?: string;
  entityTable?: string;
  entityId?: string;
  renderMode?: 'card' | 'document';
  path?: string;
  viewBox?: string;
}

export class MoodboardItem {
  id: string;
  configJson?: string;
  posX?: number;
  posY?: number;
  index?: number;

  constructor(id: string = '', configJson?: string, posX?: number, posY?: number, index?: number) {
    this.id = id;
    this.configJson = configJson;
    this.posX = posX;
    this.posY = posY;
    this.index = index;
  }
}
