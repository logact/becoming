import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '../shared/theme';

/**
 * Line-icon set ported from the prototype's `P` object
 * (docs/design/prototype/index.html). All glyphs live on a 24×24 viewBox,
 * drawn with a 1.7px stroke and round caps/joins.
 */

type El =
  | { t: 'path'; d: string; filled?: boolean }
  | { t: 'circle'; cx: number; cy: number; r: number; filled?: boolean }
  | {
      t: 'rect';
      x: number;
      y: number;
      width: number;
      height: number;
      rx?: number;
      /** Degrees, rotated around the viewBox center (12, 12). */
      rotate?: number;
    };

const GLYPHS = {
  grid: [
    { t: 'rect', x: 3.5, y: 3.5, width: 7, height: 7, rx: 2 },
    { t: 'rect', x: 13.5, y: 3.5, width: 7, height: 7, rx: 2 },
    { t: 'rect', x: 3.5, y: 13.5, width: 7, height: 7, rx: 2 },
    { t: 'rect', x: 13.5, y: 13.5, width: 7, height: 7, rx: 2 },
  ],
  folder: [
    {
      t: 'path',
      d: 'M3.5 7.2c0-1 .8-1.9 1.9-1.9h3.4l1.9 2.1h8.4c1 0 1.9.8 1.9 1.9v7.4c0 1-.8 1.9-1.9 1.9H5.4c-1 0-1.9-.8-1.9-1.9Z',
    },
  ],
  target: [
    { t: 'circle', cx: 12, cy: 12, r: 8.5 },
    { t: 'circle', cx: 12, cy: 12, r: 4.8 },
    { t: 'circle', cx: 12, cy: 12, r: 1.4, filled: true },
  ],
  checkCircle: [
    { t: 'circle', cx: 12, cy: 12, r: 8.5 },
    { t: 'path', d: 'M8.2 12.4l2.5 2.5 5.1-5.6' },
  ],
  check: [{ t: 'path', d: 'M5.5 12.5l4.3 4.3L18.5 7.5' }],
  box: [
    { t: 'path', d: 'M12 3.2 20.6 7.4v9.2L12 20.8 3.4 16.6V7.4Z' },
    { t: 'path', d: 'M3.4 7.4 12 11.6l8.6-4.2M12 11.6v9.2' },
  ],
  bulb: [
    {
      t: 'path',
      d: 'M12 3.5a5.8 5.8 0 0 1 3.4 10.5c-.6.5-.9 1.2-.9 2h-5c0-.8-.3-1.5-.9-2A5.8 5.8 0 0 1 12 3.5Z',
    },
    { t: 'path', d: 'M9.8 19.2h4.4M10.6 21.4h2.8' },
  ],
  doc: [
    { t: 'path', d: 'M6.5 3.5h7l4 4v13h-11Z' },
    { t: 'path', d: 'M13.2 3.8V7.8h4' },
    { t: 'path', d: 'M9.3 12.4h5.4M9.3 15.6h5.4' },
  ],
  banknote: [
    { t: 'rect', x: 3, y: 7, width: 18, height: 10, rx: 2.2 },
    { t: 'circle', cx: 12, cy: 12, r: 2.4 },
    { t: 'path', d: 'M6.5 10v4M17.5 10v4' },
  ],
  tag: [
    { t: 'path', d: 'M3.5 3.5h7l10 10-7 7-10-10Z' },
    { t: 'circle', cx: 8, cy: 8, r: 1.3, filled: true },
  ],
  clock: [
    { t: 'circle', cx: 12, cy: 12, r: 8.5 },
    { t: 'path', d: 'M12 7v5.2l3.4 2' },
  ],
  sparkle: [
    {
      t: 'path',
      d: 'M12 3.5c.7 4.3 2.2 5.8 6.5 6.5-4.3.7-5.8 2.2-6.5 6.5-.7-4.3-2.2-5.8-6.5-6.5 4.3-.7 5.8-2.2 6.5-6.5Z',
    },
  ],
  chevron: [{ t: 'path', d: 'M9.2 5.2 16 12l-6.8 6.8' }],
  back: [{ t: 'path', d: 'M14.8 5.2 8 12l6.8 6.8' }],
  plus: [{ t: 'path', d: 'M12 5v14M5 12h14' }],
  minus: [{ t: 'path', d: 'M5 12h14' }],
  pencil: [
    { t: 'path', d: 'M4.5 19.5h4L19.8 8.2a2.2 2.2 0 0 0-4-4L4.5 15.5Z' },
    { t: 'path', d: 'M13.5 6.5l4 4' },
  ],
  pin: [
    { t: 'path', d: 'M8 4h8l-1.5 5 2.5 2.5v1.5H7v-1.5L9.5 9Z' },
    { t: 'path', d: 'M12 13v8' },
  ],
  arrowUpRight: [{ t: 'path', d: 'M7 17 17 7M9.5 7H17v7.5' }],
  alert: [
    { t: 'circle', cx: 12, cy: 12, r: 8.5 },
    { t: 'path', d: 'M12 7.4v5.4' },
    { t: 'circle', cx: 12, cy: 16.5, r: 1.05, filled: true },
  ],
  pauseCircle: [
    { t: 'circle', cx: 12, cy: 12, r: 8.5 },
    { t: 'path', d: 'M9.7 8.8v6.4M14.3 8.8v6.4' },
  ],
  pause: [{ t: 'path', d: 'M9.5 7.5v9M14.5 7.5v9' }],
  circle: [{ t: 'circle', cx: 12, cy: 12, r: 8.5 }],
  play: [{ t: 'path', d: 'M8.5 6.8v10.4L17.8 12Z' }],
  search: [
    { t: 'circle', cx: 11, cy: 11, r: 6.2 },
    { t: 'path', d: 'M15.8 15.8 20 20' },
  ],
  list: [
    { t: 'path', d: 'M9.4 6h10.6M9.4 12h10.6M9.4 18h10.6' },
    { t: 'circle', cx: 4.7, cy: 6, r: 1.15, filled: true },
    { t: 'circle', cx: 4.7, cy: 12, r: 1.15, filled: true },
    { t: 'circle', cx: 4.7, cy: 18, r: 1.15, filled: true },
  ],
  person: [
    { t: 'circle', cx: 12, cy: 8, r: 3.6 },
    { t: 'path', d: 'M5 20c.8-3.4 3.6-5.2 7-5.2s6.2 1.8 7 5.2' },
  ],
  moon: [{ t: 'path', d: 'M19.5 14.4A8 8 0 1 1 9.6 4.5a6.6 6.6 0 0 0 9.9 9.9Z' }],
  share: [
    { t: 'path', d: 'M12 15.5V4M8.2 7.6 12 3.8l3.8 3.8' },
    { t: 'path', d: 'M5 12.5v7h14v-7' },
  ],
  archive: [
    { t: 'rect', x: 3.5, y: 4, width: 17, height: 4.4, rx: 1.2 },
    { t: 'path', d: 'M5 8.4v10.1h14V8.4M9.8 12.2h4.4' },
  ],
  bell: [
    {
      t: 'path',
      d: 'M12 4a5.5 5.5 0 0 1 5.5 5.5c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5A5.5 5.5 0 0 1 12 4Z',
    },
    { t: 'path', d: 'M10 18.5a2 2 0 0 0 4 0' },
  ],
  cloud: [
    { t: 'path', d: 'M7 18.5a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18.2 11a3.8 3.8 0 0 1-.7 7.5Z' },
  ],
  gear: [
    { t: 'circle', cx: 12, cy: 12, r: 3.1 },
    ...Array.from({ length: 8 }, (_, i) => ({
      t: 'rect' as const,
      x: 11.15,
      y: 2.5,
      width: 1.7,
      height: 4.4,
      rx: 0.85,
      rotate: i * 45,
    })),
    { t: 'circle', cx: 12, cy: 12, r: 7.4 },
  ],
} as const satisfies Record<string, readonly El[]>;

export type IconName = keyof typeof GLYPHS;

export interface IconProps {
  name: IconName;
  /** Rendered size in px (glyphs are drawn on a 24×24 viewBox). */
  size?: number;
  /** Stroke/fill color; icons are usually drawn in `green`. */
  color?: string;
}

/** Renders a prototype line icon with react-native-svg. */
export function Icon({ name, size = 20, color = colors.green }: IconProps) {
  const glyph = GLYPHS[name];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {glyph.map((el, i) => {
        const paint = el.filled
          ? { fill: color, stroke: 'none' }
          : // Explicit per-element paint keeps rendering independent of
            // SVG prop inheritance (and of the jest mock).
            {
              fill: 'none',
              stroke: color,
              strokeWidth: 1.7,
              strokeLinecap: 'round' as const,
              strokeLinejoin: 'round' as const,
            };
        switch (el.t) {
          case 'path':
            return <Path key={i} d={el.d} {...paint} />;
          case 'circle':
            return <Circle key={i} cx={el.cx} cy={el.cy} r={el.r} {...paint} />;
          case 'rect':
            return (
              <Rect
                key={i}
                x={el.x}
                y={el.y}
                width={el.width}
                height={el.height}
                rx={el.rx}
                transform={el.rotate ? `rotate(${el.rotate} 12 12)` : undefined}
                {...paint}
              />
            );
        }
      })}
    </Svg>
  );
}
