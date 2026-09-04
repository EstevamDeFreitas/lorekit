export const MOODBOARD_FILL_PALETTE = [
  '#020617', '#030712', '#09090b', '#0a0a0a', '#0c0a09', '#450a0a', '#431407', '#451a03',
  '#422006', '#1a2e05', '#052e16', '#022c22', '#042f2e', '#083344', '#082f49', '#172554',
  '#1e1b4b', '#2e1065', '#3b0764', '#4a044e', '#500724', '#4c0519',
] as const;

export const MOODBOARD_ACCENT_PALETTE = [
  '#71717a', '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#e879f9',
  '#ec4899', '#f43f5e',
] as const;

export const MOODBOARD_COLOR_PALETTE = [
  ...MOODBOARD_FILL_PALETTE,
  ...MOODBOARD_ACCENT_PALETTE,
] as const;
