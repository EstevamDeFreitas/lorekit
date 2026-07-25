export function decodeDynamicImageValue(value: string | null | undefined): string[] {
  const normalized = value?.trim();
  if (!normalized) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(normalized);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (path): path is string => typeof path === 'string' && path.trim().length > 0
      );
    }
  } catch {
    // Legacy image fields stored a single raw path instead of JSON.
  }

  return [normalized];
}

export function encodeDynamicImageValue(paths: string[]): string {
  return paths.length ? JSON.stringify(paths) : '';
}

export function resolveDynamicImageAspectRatio(
  value: string | number | null | undefined
): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
