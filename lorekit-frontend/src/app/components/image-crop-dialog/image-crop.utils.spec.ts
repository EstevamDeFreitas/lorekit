import {
  clampCropOffset,
  getCoverScale,
  getCropSourceRect,
  getZoomedOffset,
} from './image-crop.utils';

describe('image crop utilities', () => {
  it('covers the viewport while preserving the image proportions', () => {
    expect(getCoverScale(
      { width: 1600, height: 900 },
      { width: 500, height: 500 }
    )).toBeCloseTo(500 / 900);
  });

  it('keeps the image covering the crop viewport while it is moved', () => {
    const clamped = clampCropOffset(
      { x: 900, y: -900 },
      { width: 1600, height: 900 },
      { width: 500, height: 500 },
      500 / 900
    );

    expect(clamped.x).toBeCloseTo((1600 * (500 / 900) - 500) / 2);
    expect(clamped.y).toBe(0);
  });

  it('keeps the image point under the pointer stable while zooming', () => {
    expect(getZoomedOffset(
      { x: 0, y: 0 },
      { x: 100, y: 40 },
      1,
      2
    )).toEqual({ x: -100, y: -40 });
  });

  it('calculates the source rectangle represented by the viewport', () => {
    const scale = getCoverScale(
      { width: 1000, height: 500 },
      { width: 400, height: 400 }
    );
    const rect = getCropSourceRect(
      { width: 1000, height: 500 },
      { width: 400, height: 400 },
      scale,
      { x: 0, y: 0 }
    );

    expect(rect).toEqual({
      x: 250,
      y: 0,
      width: 500,
      height: 500,
    });
  });
});
