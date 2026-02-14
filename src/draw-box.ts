import type { NodeDef } from './schema.js';
import { getTextContent, getChildBoxes } from './schema.js';
import { Canvas } from './canvas.js';
import { BORDERS, SHADOW_CHAR } from './constants.js';
import { centerText } from './geometry.js';

export function drawBox(canvas: Canvas, box: NodeDef & { x: number; y: number; width: number; height: number }): void {
  const { x, y, width, height, border = 'single', title, shadow = false } = box;
  const b = BORDERS[border] || BORDERS.single;

  // Draw shadow first (so box draws over it)
  if (shadow) {
    for (let row = y + 1; row <= y + height; row++) {
      canvas.set(x + width, row, SHADOW_CHAR);
      canvas.set(x + width + 1, row, SHADOW_CHAR);
    }
    for (let col = x + 1; col <= x + width + 1; col++) {
      canvas.set(col, y + height, SHADOW_CHAR);
    }
  }

  // Top border
  canvas.set(x, y, b.tl);
  for (let i = 1; i < width - 1; i++) canvas.set(x + i, y, b.h);
  canvas.set(x + width - 1, y, b.tr);

  // Bottom border
  canvas.set(x, y + height - 1, b.bl);
  for (let i = 1; i < width - 1; i++) canvas.set(x + i, y + height - 1, b.h);
  canvas.set(x + width - 1, y + height - 1, b.br);

  // Side borders
  for (let row = y + 1; row < y + height - 1; row++) {
    canvas.set(x, row, b.v);
    canvas.set(x + width - 1, row, b.v);
    // Clear interior (for nesting over shadows)
    for (let col = x + 1; col < x + width - 1; col++) {
      if (canvas.get(col, row) === SHADOW_CHAR) {
        canvas.set(col, row, ' ');
      }
    }
  }

  // Title on top border
  if (title) {
    const titleStr = ` ${title} `;
    const titleX = x + 2;
    canvas.set(titleX, y, b.h);
    canvas.writeText(titleX + 1, y, titleStr);
    const afterTitle = titleX + 1 + titleStr.length;
    if (afterTitle < x + width - 1) {
      for (let i = afterTitle; i < x + width - 1; i++) {
        canvas.set(i, y, b.h);
      }
    }
  }

  // Text content (centered)
  const textLines = getTextContent(box);
  if (textLines) {
    const innerWidth = width - 4; // 2 border + 2 padding
    const startRow = y + Math.floor((height - textLines.length) / 2);
    for (let i = 0; i < textLines.length; i++) {
      const padded = centerText(textLines[i], innerWidth);
      canvas.writeText(x + 2, startRow + i, padded);
    }
  }

  // Draw child boxes (nested) — before disabled overlay so it applies to children too
  const childBoxes = getChildBoxes(box);
  if (childBoxes) {
    for (const child of childBoxes) {
      const absChild = {
        ...child,
        x: x + 1 + (child.x || 0),
        y: y + 1 + (child.y || 0),
        width: child.width!,
        height: child.height!,
      };
      drawBox(canvas, absChild);
    }
  }

  // Disabled overlay: shade background (░) and strikethrough title
  if (box.disabled) {
    const structureChars = new Set('┌┐└┘─│╔╗╚╝═║┏┓┗┛━┃╭╮╰╯░');
    for (let col = x + 1; col < x + width - 1; col++) {
      const ch = canvas.get(col, y);
      if (ch !== ' ' && !structureChars.has(ch)) {
        canvas.set(col, y, ch + '\u0336');
      }
    }
    for (let row = y + 1; row < y + height - 1; row++) {
      for (let col = x + 1; col < x + width - 1; col++) {
        if (canvas.get(col, row) === ' ') {
          canvas.set(col, row, '░');
        }
      }
    }
  }
}
