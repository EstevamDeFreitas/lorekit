export interface CropSize {
  width: number;
  height: number;
}

export interface CropOffset {
  x: number;
  y: number;
}

export interface CropSourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getCoverScale(image: CropSize, viewport: CropSize): number {
  if (image.width <= 0 || image.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return 1;
  }

  return Math.max(viewport.width / image.width, viewport.height / image.height);
}

export function clampCropOffset(
  offset: CropOffset,
  image: CropSize,
  viewport: CropSize,
  scale: number
): CropOffset {
  const maxX = Math.max(0, (image.width * scale - viewport.width) / 2);
  const maxY = Math.max(0, (image.height * scale - viewport.height) / 2);

  return {
    x: Math.max(-maxX, Math.min(offset.x, maxX)),
    y: Math.max(-maxY, Math.min(offset.y, maxY)),
  };
}

export function getZoomedOffset(
  offset: CropOffset,
  pointerFromCenter: CropOffset,
  previousZoom: number,
  nextZoom: number
): CropOffset {
  const zoomRatio = nextZoom / previousZoom;

  return {
    x: pointerFromCenter.x - (pointerFromCenter.x - offset.x) * zoomRatio,
    y: pointerFromCenter.y - (pointerFromCenter.y - offset.y) * zoomRatio,
  };
}

export function getCropSourceRect(
  image: CropSize,
  viewport: CropSize,
  scale: number,
  offset: CropOffset
): CropSourceRect {
  const renderedWidth = image.width * scale;
  const renderedHeight = image.height * scale;
  const renderedLeft = (viewport.width - renderedWidth) / 2 + offset.x;
  const renderedTop = (viewport.height - renderedHeight) / 2 + offset.y;

  return {
    x: Math.max(0, -renderedLeft / scale),
    y: Math.max(0, -renderedTop / scale),
    width: Math.min(image.width, viewport.width / scale),
    height: Math.min(image.height, viewport.height / scale),
  };
}
