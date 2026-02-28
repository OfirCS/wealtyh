export const COLORS = {
  bg: '#0D0D0C',
  surface: '#1A1A19',
  card: '#161615',
  border: '#2D2D2C',
  textPrimary: '#FCFCFC',
  textSecondary: '#9B9B9A',
  textTertiary: '#6B6B6A',
  accentGreen: '#3EC97A',
  accentRed: '#E05252',
  accentYellow: '#F5A623',
};

export const FONTS = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export const SCENE_DURATIONS = {
  intro: 330,      // 11s
  appDemo: 2040,   // 68s — captured app video with overlays
  arch: 420,       // 14s
  outro: 390,      // 13s
} as const;

export const TOTAL_DURATION = Object.values(SCENE_DURATIONS).reduce(
  (a, b) => a + b,
  0,
); // 3180 frames = 106s
