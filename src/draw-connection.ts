import type { ConnectionDef, NodeDef, Side } from './schema.js';
import { Canvas } from './canvas.js';
import { ARROW_HEADS } from './constants.js';
import { resolveBox, getAnchor } from './geometry.js';

// DRY helpers for corner selection and label placement

function pickCorner(hDir: number, yDir: number): string {
  if (hDir > 0 && yDir > 0) return '┐';
  if (hDir > 0 && yDir < 0) return '┘';
  if (hDir < 0 && yDir > 0) return '┌';
  return '└';
}

function pickOppositeCorner(hDir: number, yDir: number): string {
  if (hDir > 0 && yDir > 0) return '└';
  if (hDir > 0 && yDir < 0) return '┌';
  if (hDir < 0 && yDir > 0) return '┘';
  return '┐';
}

function placeLabel(canvas: Canvas, label: string, segStart: number, segEnd: number, y: number): void {
  const padded = ` ${label} `;
  const lo = Math.min(segStart, segEnd);
  const hi = Math.max(segStart, segEnd);
  const segLen = hi - lo;
  let midX = Math.floor((lo + hi) / 2) - Math.floor(padded.length / 2);
  // Clamp so at least 1 dash remains on each side when there's room
  if (segLen >= padded.length + 2) {
    midX = Math.max(midX, lo + 1);
    midX = Math.min(midX, hi - padded.length - 1);
  }
  canvas.writeText(midX, y, padded);
}

export function drawConnection(canvas: Canvas, conn: ConnectionDef, boxes: NodeDef[]): void {
  const { from, to, label } = conn;

  const fromResolved = resolveBox(from, boxes);
  const toResolved = resolveBox(to, boxes);
  if (!fromResolved || !toResolved) return;

  // Auto-detect sides based on relative box positions if not specified
  let fromSide: Side = conn.fromSide || 'right';
  let toSide: Side = conn.toSide || 'left';
  if (conn.fromSide == null && conn.toSide == null) {
    const { box: fBox, absX: fX, absY: fY } = fromResolved;
    const { box: tBox, absX: tX, absY: tY } = toResolved;
    const dx = (tX + tBox.width / 2) - (fX + fBox.width / 2);
    const dy = (tY + tBox.height / 2) - (fY + fBox.height / 2);
    if (Math.abs(dy) > Math.abs(dx)) {
      fromSide = dy > 0 ? 'bottom' : 'top';
      toSide = dy > 0 ? 'top' : 'bottom';
    } else {
      fromSide = dx > 0 ? 'right' : 'left';
      toSide = dx > 0 ? 'left' : 'right';
    }
  }

  const src = getAnchor(fromResolved, fromSide);
  const dst = getAnchor(toResolved, toSide);
  const arrowHead = ARROW_HEADS[toSide] || '▶';

  // Vertical connections (bottom→top or top→bottom)
  const isVertical = (fromSide === 'bottom' || fromSide === 'top') &&
                     (toSide === 'top' || toSide === 'bottom');

  if (isVertical) {
    const avgX = Math.round((src.x + dst.x) / 2);
    const minY = Math.min(src.y, dst.y);
    const maxY = Math.max(src.y, dst.y);
    for (let row = minY; row <= maxY; row++) {
      canvas.set(avgX, row, '│');
    }
    canvas.set(avgX, dst.y, arrowHead);
    if (label) {
      const midY = Math.floor((minY + maxY) / 2);
      canvas.writeText(avgX + 2, midY, label);
    }
  } else if (fromSide === toSide && (fromSide === 'right' || fromSide === 'left') && src.y !== dst.y) {
    // U-shaped routing (same-side exit and entry)
    drawUShape(canvas, src, dst, fromSide, arrowHead, label, boxes);
  } else if (src.y === dst.y) {
    // Straight horizontal arrow
    drawStraight(canvas, src, dst, arrowHead, label);
  } else {
    // L-shaped routing
    drawLShape(canvas, src, dst, arrowHead, label);
  }
}

function drawUShape(
  canvas: Canvas,
  src: { x: number; y: number },
  dst: { x: number; y: number },
  fromSide: Side,
  arrowHead: string,
  label: string | undefined,
  boxes: NodeDef[],
): void {
  const isRight = fromSide === 'right';
  const dir = isRight ? 1 : -1;

  let extendX = Math.max(src.x, dst.x);
  for (const box of boxes) {
    const right = (box.x || 0) + (box.width || 0) + (box.shadow ? 2 : 0);
    if (isRight) extendX = Math.max(extendX, right);
    else extendX = Math.min(extendX, box.x || 0);
  }
  extendX += dir;

  // Horizontal from source
  for (let col = src.x + dir; col !== extendX; col += dir) {
    canvas.set(col, src.y, '─');
  }

  const yDir = dst.y > src.y ? 1 : -1;

  // First corner
  if (isRight) canvas.set(extendX, src.y, pickCorner(1, yDir));
  else canvas.set(extendX, src.y, pickCorner(-1, yDir));

  // Vertical segment
  for (let row = src.y + yDir; row !== dst.y; row += yDir) {
    canvas.set(extendX, row, '│');
  }

  // Second corner — vertical arrives, horizontal exits back the way it came
  // Right U down: ┘   Right U up: ┐   Left U down: └   Left U up: ┌
  const secondCorner = isRight
    ? (yDir > 0 ? '┘' : '┐')
    : (yDir > 0 ? '└' : '┌');
  canvas.set(extendX, dst.y, secondCorner);

  // Horizontal from extend point back to destination
  for (let col = extendX - dir; col !== dst.x; col -= dir) {
    canvas.set(col, dst.y, '─');
  }
  canvas.set(dst.x, dst.y, arrowHead);

  if (label) {
    const srcLen = Math.abs(extendX - src.x);
    const dstLen = Math.abs(extendX - dst.x);
    if (srcLen >= dstLen) {
      placeLabel(canvas, label, src.x, extendX, src.y);
    } else {
      placeLabel(canvas, label, dst.x, extendX, dst.y);
    }
  }
}

function drawStraight(
  canvas: Canvas,
  src: { x: number; y: number },
  dst: { x: number; y: number },
  arrowHead: string,
  label: string | undefined,
): void {
  const minX = Math.min(src.x, dst.x);
  const maxX = Math.max(src.x, dst.x);
  for (let col = minX + 1; col < maxX; col++) {
    canvas.set(col, src.y, '─');
  }
  canvas.set(maxX, dst.y, arrowHead);

  if (label) {
    placeLabel(canvas, label, minX + 1, maxX, src.y);
  }
}

function drawLShape(
  canvas: Canvas,
  src: { x: number; y: number },
  dst: { x: number; y: number },
  arrowHead: string,
  label: string | undefined,
): void {
  const midX = Math.floor((src.x + dst.x) / 2);
  const hDir = dst.x > src.x ? 1 : -1;
  const yDir = dst.y > src.y ? 1 : -1;

  // Horizontal from source
  for (let col = src.x + hDir; col !== midX; col += hDir) {
    canvas.set(col, src.y, '─');
  }

  // First corner
  canvas.set(midX, src.y, pickCorner(hDir, yDir));

  // Vertical segment
  for (let row = src.y + yDir; row !== dst.y; row += yDir) {
    canvas.set(midX, row, '│');
  }

  // Second corner
  canvas.set(midX, dst.y, pickOppositeCorner(hDir, yDir));

  // Horizontal to target
  for (let col = midX + hDir; col !== dst.x; col += hDir) {
    canvas.set(col, dst.y, '─');
  }
  canvas.set(dst.x, dst.y, arrowHead);

  if (label) {
    const padded = ` ${label} `;
    const srcLen = Math.abs(midX - src.x);
    const dstLen = Math.abs(dst.x - midX);
    // Prefer longer segment, fall back to other if label doesn't fit
    if (srcLen >= dstLen) {
      if (srcLen >= padded.length) {
        placeLabel(canvas, label, src.x, midX, src.y);
      } else {
        placeLabel(canvas, label, midX, dst.x, dst.y);
      }
    } else {
      if (dstLen >= padded.length) {
        placeLabel(canvas, label, midX, dst.x, dst.y);
      } else {
        placeLabel(canvas, label, src.x, midX, src.y);
      }
    }
  }
}
