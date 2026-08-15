/**
 * Shared visual tokens for the M2 UI foundation, derived from the
 * interaction prototype (`m2-codex-prototype.html`). Status meaning is never
 * carried by these colors alone — components always pair color with text and
 * a non-color cue (icon or explicit label).
 */
export const colors = {
  ink: '#18312b',
  muted: '#697873',
  paper: '#f7f5ee',
  canvas: '#e9eee9',
  card: '#fffdf8',
  line: '#dbe1dc',
  brand: '#16735c',
  brandSoft: '#d9eee5',
  lime: '#dff16b',
  amber: '#a56313',
  amberSoft: '#fff2d9',
  red: '#a63d35',
  redSoft: '#fbe8e5',
  blue: '#376aa0',
  blueSoft: '#e7f0fb',
  white: '#ffffff',
} as const;

/**
 * Typography tokens. The prototype pairs a serif display face (Georgia) for
 * hero headings, detail titles, sheet titles, and the progress figure with a
 * system sans for body copy; body text keeps the React Native default.
 */
export const fonts = {
  display: 'Georgia',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  card: 18,
  sheet: 22,
  badge: 999,
} as const;
