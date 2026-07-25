import {
  decodeDynamicImageValue,
  encodeDynamicImageValue,
  resolveDynamicImageAspectRatio,
} from './dynamic-image-field.utils';

describe('dynamic image field utilities', () => {
  it('keeps legacy single-image values compatible', () => {
    expect(decodeDynamicImageValue('C:/images/legacy.jpg'))
      .toEqual(['C:/images/legacy.jpg']);
  });

  it('reads and writes ordered image collections', () => {
    const paths = ['C:/images/first.jpg', 'C:/images/second.jpg'];
    expect(decodeDynamicImageValue(encodeDynamicImageValue(paths))).toEqual(paths);
  });

  it('ignores invalid entries in a stored collection', () => {
    expect(decodeDynamicImageValue('["valid.jpg", null, "", 42]'))
      .toEqual(['valid.jpg']);
  });

  it('uses a square crop when the stored aspect ratio is invalid', () => {
    expect(resolveDynamicImageAspectRatio('16')).toBe(16);
    expect(resolveDynamicImageAspectRatio('invalid')).toBe(1);
  });
});
