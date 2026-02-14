import type { BorderChars, BorderStyle, Side, SvgOptions, LayoutOptions } from './schema.js';

export const BORDERS: Record<BorderStyle, BorderChars> = {
  single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
  double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
  bold: { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' },
  rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
  dashed: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '┄', v: '┆' },
};

export const SHADOW_CHAR = '░';

// Arrow head points INTO the target box — entering from the left side means arrow points right (▶)
export const ARROW_HEADS: Record<Side, string> = {
  left: '▶',
  right: '◀',
  top: '▼',
  bottom: '▲',
};

export const DEFAULT_SVG_OPTIONS: Required<SvgOptions> = {
  fontSize: 14,
  charWidth: 8.41,
  lineHeight: 14,
  padding: 16,
  lightBg: '#f6f8fa',
  lightFg: '#24292f',
  darkBg: '#161b22',
  darkFg: '#e6edf3',
  fontFamily: "'SFMono-Regular', Menlo, Monaco, 'Courier New', monospace",
  borderRadius: 6,
};

export const DEFAULT_LAYOUT_OPTIONS: Required<LayoutOptions> = {
  defaultHGap: 3,
  vGap: 2,
  padLeft: 2,
  padTop: 1,
  minBoxWidth: 12,
  minBoxHeight: 5,
};
