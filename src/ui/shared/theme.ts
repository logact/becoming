import { Platform } from 'react-native';

/**
 * Design tokens for Becoming, frozen in docs/design/design-style.md
 * (extracted from the HTML prototype, v0.2).
 */
export const colors = {
  /** Screen background (warm cream). */
  bg: '#F4F1E8',
  /** Grouped containers, cards, stat tiles. */
  panel: '#FBFAF4',
  /** Hairlines, container borders. */
  line: '#E4E1D2',
  /** Segmented control track, search field. */
  track: '#EAE7DB',
  /** Primary text (near-black green). */
  ink: '#1B2821',
  /** Secondary text. */
  muted: '#79837A',
  /** Tertiary text, captions, section headers. */
  faint: '#9AA398',
  /** Primary accent: icons, progress, buttons, active tab. */
  green: '#1F3D2D',
  /** Icon chip fill, active tab highlight. */
  mint: '#DAE8DD',
  /** Done / positive states, completed progress. */
  sage: '#3F7A54',

  // State accent colors (status pills, attention cues).
  /** Doing / Exploring / Active. */
  doingBlue: '#3E6FB4',
  /** Todo / Captured. */
  todoGray: '#6E7670',
  /** Done. */
  doneSage: '#3F7A54',
  /** Paused / Planning / Blocked. */
  pausedAmber: '#9A6B1F',
  /** Conflict / errors. */
  conflictRed: '#B4493F',

  /** Tab bar background. */
  tabBarBg: '#F7F5EC',
  /** Row trailing chevron. */
  chevron: '#B7BCAF',
  /** Progress bar track. */
  progressTrack: '#E3E0D1',
  /** Task checkbox outline (todo state). */
  checkOutline: '#C9CDBC',
  /** Text on filled green buttons. */
  primaryTextOnGreen: '#F2F0E6',
} as const;

export type ColorToken = keyof typeof colors;

/**
 * Display serif for screen titles, stat numbers and the slogan.
 * RN has no "New York"; the prototype itself falls back to Georgia.
 */
export const serif = Platform.select({ ios: 'Georgia', default: 'serif' });

/** Sans is the system default: leave fontFamily undefined. */
export const sans = undefined;

export const radii = {
  /** Grouped panels / cards. */
  panel: 22,
  /** Stat tiles. */
  tile: 18,
  /** Icon chips, task checkboxes. */
  chip: 10,
  /** Large icon chips. */
  chipLg: 14,
  /** Pills and buttons. */
  pill: 999,
} as const;

export const spacing = {
  /** Screen side margin for containers. */
  screenMargin: 18,
  /** Side margin for text headers and borderless rows. */
  textMargin: 24,
  /** Space above a section header. */
  sectionTop: 26,
  /** Space below a section header. */
  sectionBottom: 10,
  /** Card/panel stacking gap. */
  stackGap: 12,
} as const;
