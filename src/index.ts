// Public API
export { render, renderSvg } from './render.js';
export { autoLayout } from './layout.js';
export { Canvas } from './canvas.js';
export { drawBox } from './draw-box.js';
export { drawConnection } from './draw-connection.js';
export { resolveBox, getAnchor } from './geometry.js';
export { BORDERS, SHADOW_CHAR, ARROW_HEADS } from './constants.js';
export { DiagramSchema, NodeSchema, ConnectionSchema } from './schema.js';
export type {
  NodeDef,
  ConnectionDef,
  Side,
  BorderStyle,
  BorderChars,
  Point,
  ResolvedBox,
  SvgOptions,
  LayoutOptions,
} from './schema.js';
