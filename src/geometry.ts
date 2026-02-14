import type { NodeDef, ResolvedBox, Side, Point } from './schema.js';
import { getChildBoxes } from './schema.js';

/**
 * Resolve a box by ID, searching the tree recursively.
 * Returns { box, absX, absY } with absolute coordinates.
 */
export function resolveBox(id: string, boxes: NodeDef[], parentAbsX = 0, parentAbsY = 0): ResolvedBox | null {
  for (const box of boxes) {
    if (box.id === id) {
      return {
        box: box as ResolvedBox['box'],
        absX: parentAbsX + (box.x ?? 0),
        absY: parentAbsY + (box.y ?? 0),
      };
    }
    const childBoxes = getChildBoxes(box);
    if (childBoxes) {
      const found = resolveBox(id, childBoxes, parentAbsX + (box.x ?? 0) + 1, parentAbsY + (box.y ?? 0) + 1);
      if (found) return found;
    }
  }
  return null;
}

export function getAnchor(resolved: ResolvedBox, side: Side): Point {
  const { box, absX, absY } = resolved;
  switch (side) {
    case 'right':
      return { x: absX + box.width, y: absY + Math.floor(box.height / 2) };
    case 'left':
      return { x: absX - 1, y: absY + Math.floor(box.height / 2) };
    case 'top':
      return { x: absX + Math.floor(box.width / 2), y: absY - 1 };
    case 'bottom':
      return { x: absX + Math.floor(box.width / 2), y: absY + box.height };
    default:
      return { x: absX - 1, y: absY + Math.floor(box.height / 2) };
  }
}

export function centerText(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  const leftPad = Math.floor((width - text.length) / 2);
  return ' '.repeat(leftPad) + text + ' '.repeat(width - text.length - leftPad);
}
