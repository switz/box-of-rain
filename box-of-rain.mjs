#!/usr/bin/env node

/**
 * box-of-rain - A CLI tool for generating beautiful ASCII box diagrams
 *
 * Supports:
 *   - Multiple border styles: single, double, bold, rounded
 *   - Arrow connections between boxes with labels
 *   - Shadow effects (░)
 *   - Nested boxes (boxes inside boxes)
 *   - Titled borders
 */

// ─── Box-drawing character sets ───────────────────────────────────────────────

const BORDERS = {
  single: {
    tl: '┌', tr: '┐', bl: '└', br: '┘',
    h: '─', v: '│',
  },
  double: {
    tl: '╔', tr: '╗', bl: '╚', br: '╝',
    h: '═', v: '║',
  },
  bold: {
    tl: '┏', tr: '┓', bl: '┗', br: '┛',
    h: '━', v: '┃',
  },
  rounded: {
    tl: '╭', tr: '╮', bl: '╰', br: '╯',
    h: '─', v: '│',
  },
};

const SHADOW_CHAR = '░';

// ─── Canvas: a 2D character grid ──────────────────────────────────────────────

class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.grid = Array.from({ length: height }, () => Array(width).fill(' '));
  }

  set(x, y, ch) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.grid[y][x] = ch;
    }
  }

  get(x, y) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      return this.grid[y][x];
    }
    return ' ';
  }

  writeText(x, y, text) {
    for (let i = 0; i < text.length; i++) {
      this.set(x + i, y, text[i]);
    }
  }

  toString() {
    const lines = this.grid.map(row => row.join('').replace(/\s+$/, ''));
    // Left-align: strip common leading whitespace
    const minIndent = lines.reduce((min, line) => {
      if (line.length === 0) return min;
      const leading = line.match(/^ */)[0].length;
      return Math.min(min, leading);
    }, Infinity);
    if (minIndent > 0 && minIndent < Infinity) {
      return lines.map(line => line.slice(minIndent)).join('\n');
    }
    return lines.join('\n');
  }
}

// ─── Drawing functions ────────────────────────────────────────────────────────

function drawBox(canvas, box) {
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
    // Fill interior with spaces (clear for nesting)
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
    // Replace horizontal border chars with title text, keeping style
    canvas.set(titleX, y, b.h);
    canvas.writeText(titleX + 1, y, titleStr);
    // Restore border char after title
    const afterTitle = titleX + 1 + titleStr.length;
    if (afterTitle < x + width - 1) {
      // fill the rest with h
      for (let i = afterTitle; i < x + width - 1; i++) {
        canvas.set(i, y, b.h);
      }
    }
  }

  // Content lines (centered)
  if (box.content) {
    const lines = Array.isArray(box.content) ? box.content : [box.content];
    const innerWidth = width - 4; // 2 border + 2 padding
    const startRow = y + Math.floor((height - lines.length) / 2);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const padded = centerText(line, innerWidth);
      canvas.writeText(x + 2, startRow + i, padded);
    }
  }

  // Draw children (nested boxes)
  if (box.children) {
    for (const child of box.children) {
      // Child coords are relative to parent interior
      const absChild = {
        ...child,
        x: x + 1 + (child.x || 0),
        y: y + 1 + (child.y || 0),
      };
      drawBox(canvas, absChild);
    }
  }
}

function centerText(text, width) {
  if (text.length >= width) return text.slice(0, width);
  const leftPad = Math.floor((width - text.length) / 2);
  return ' '.repeat(leftPad) + text + ' '.repeat(width - text.length - leftPad);
}

// ─── Connection / Arrow drawing ───────────────────────────────────────────────

/**
 * Resolve a box by ID, searching top-level and nested children.
 * Returns { box, absX, absY } with absolute coordinates.
 */
function resolveBox(id, boxes) {
  for (const box of boxes) {
    if (box.id === id) return { box, absX: box.x, absY: box.y };
    if (box.children) {
      for (const child of box.children) {
        if (child.id === id) {
          return {
            box: child,
            absX: box.x + 1 + (child.x || 0),
            absY: box.y + 1 + (child.y || 0),
          };
        }
      }
    }
  }
  return null;
}

function getAnchor(resolved, side) {
  const { box, absX, absY } = resolved;
  // Anchors are placed just OUTSIDE the box border
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

function drawConnection(canvas, conn, boxes) {
  const { from, to, label, fromSide = 'right', toSide = 'left' } = conn;

  const fromResolved = resolveBox(from, boxes);
  const toResolved = resolveBox(to, boxes);
  if (!fromResolved || !toResolved) return;

  const src = getAnchor(fromResolved, fromSide);
  const dst = getAnchor(toResolved, toSide);

  // Pick arrow head based on direction entering target
  const arrowHeads = { left: '▶', right: '◀', top: '▼', bottom: '▲' };
  const arrowHead = arrowHeads[toSide] || '▶';

  if (fromSide === toSide && (fromSide === 'right' || fromSide === 'left') && src.y !== dst.y) {
    // U-shaped routing (same-side exit and entry)
    const isRight = fromSide === 'right';
    const dir = isRight ? 1 : -1;

    // Place vertical segment outside all top-level boxes
    let extendX = Math.max(src.x, dst.x);
    for (const box of boxes) {
      const right = (box.x || 0) + (box.width || 0) + (box.shadow ? 2 : 0);
      if (isRight) extendX = Math.max(extendX, right);
      else extendX = Math.min(extendX, box.x || 0);
    }
    extendX += dir; // one char past the outermost box edge

    // Horizontal from source to extend point
    for (let col = src.x + dir; col !== extendX; col += dir) {
      canvas.set(col, src.y, '─');
    }

    // First corner
    const yDir = dst.y > src.y ? 1 : -1;
    if (isRight) canvas.set(extendX, src.y, yDir > 0 ? '┐' : '┘');
    else canvas.set(extendX, src.y, yDir > 0 ? '┌' : '└');

    // Vertical segment
    for (let row = src.y + yDir; row !== dst.y; row += yDir) {
      canvas.set(extendX, row, '│');
    }

    // Second corner
    if (isRight) canvas.set(extendX, dst.y, yDir > 0 ? '┘' : '┐');
    else canvas.set(extendX, dst.y, yDir > 0 ? '└' : '┌');

    // Horizontal from extend point back to destination
    for (let col = extendX - dir; col !== dst.x; col -= dir) {
      canvas.set(col, dst.y, '─');
    }
    canvas.set(dst.x, dst.y, arrowHead);

    if (label) {
      // Place label above the widest horizontal segment
      const srcLen = Math.abs(extendX - src.x);
      const dstLen = Math.abs(extendX - dst.x);
      const padded = ' ' + label + ' ';
      if (srcLen >= dstLen) {
        const labelX = Math.floor((src.x + extendX) / 2) - Math.floor(padded.length / 2);
        canvas.writeText(labelX, src.y, padded);
      } else {
        const labelX = Math.floor((dst.x + extendX) / 2) - Math.floor(padded.length / 2);
        canvas.writeText(labelX, dst.y, padded);
      }
    }
  } else if (src.y === dst.y) {
    // Straight horizontal arrow
    const minX = Math.min(src.x, dst.x);
    const maxX = Math.max(src.x, dst.x);
    for (let col = minX + 1; col < maxX; col++) {
      canvas.set(col, src.y, '─');
    }
    canvas.set(maxX, dst.y, arrowHead);

    if (label) {
      const padded = ' ' + label + ' ';
      const midX = Math.floor((minX + 1 + maxX) / 2) - Math.floor(padded.length / 2);
      canvas.writeText(midX, src.y, padded);
    }
  } else {
    // L-shaped routing
    const midX = Math.floor((src.x + dst.x) / 2);

    // Horizontal from source
    const hDir = dst.x > src.x ? 1 : -1;
    for (let col = src.x + hDir; col !== midX; col += hDir) {
      canvas.set(col, src.y, '─');
    }

    // Corner
    const yDir = dst.y > src.y ? 1 : -1;
    if (hDir > 0 && yDir > 0) canvas.set(midX, src.y, '┐');
    else if (hDir > 0 && yDir < 0) canvas.set(midX, src.y, '┘');
    else if (hDir < 0 && yDir > 0) canvas.set(midX, src.y, '┌');
    else canvas.set(midX, src.y, '└');

    // Vertical segment
    for (let row = src.y + yDir; row !== dst.y; row += yDir) {
      canvas.set(midX, row, '│');
    }

    // Corner at target row
    if (hDir > 0 && yDir > 0) canvas.set(midX, dst.y, '└');
    else if (hDir > 0 && yDir < 0) canvas.set(midX, dst.y, '┌');
    else if (hDir < 0 && yDir > 0) canvas.set(midX, dst.y, '┘');
    else canvas.set(midX, dst.y, '┐');

    // Horizontal to target
    for (let col = midX + hDir; col !== dst.x; col += hDir) {
      canvas.set(col, dst.y, '─');
    }
    canvas.set(dst.x, dst.y, arrowHead);

    if (label) {
      const padded = ' ' + label + ' ';
      // Place on whichever horizontal segment is longer
      const srcLen = Math.abs(midX - src.x);
      const dstLen = Math.abs(dst.x - midX);
      if (srcLen >= dstLen) {
        const labelX = Math.floor((src.x + midX) / 2) - Math.floor(padded.length / 2);
        canvas.writeText(labelX, src.y, padded);
      } else {
        const labelX = Math.floor((midX + dst.x) / 2) - Math.floor(padded.length / 2);
        canvas.writeText(labelX, dst.y, padded);
      }
    }
  }
}

// ─── Auto-layout engine ──────────────────────────────────────────────────────

function autoSizeBox(box) {
  const lines = Array.isArray(box.content) ? box.content : box.content ? [box.content] : [];
  const longestLine = lines.reduce((max, l) => Math.max(max, l.length), 0);
  const titleLen = box.title ? box.title.length : 0;

  if (box.width == null) {
    box.width = Math.max(longestLine + 4, titleLen + 6, 12);
  }
  if (box.height == null) {
    box.height = Math.max(lines.length + 2, 5);
  }
}

function layoutChildren(parent, connections) {
  const children = parent.children;
  if (!children || children.length === 0) return;

  // Auto-size each child first
  for (const child of children) {
    if (child.children) {
      layoutChildren(child, connections);
    }
    autoSizeBox(child);
  }

  // Build intra-parent connection graph for layer assignment
  const childIds = new Set(children.map(c => c.id));
  const intraConns = (connections || []).filter(
    c => childIds.has(c.from) && childIds.has(c.to)
  );

  // Assign layers using longest-path
  const childMap = new Map(children.map(c => [c.id, c]));
  const adj = new Map();
  const inDeg = new Map();
  for (const c of children) {
    adj.set(c.id, []);
    inDeg.set(c.id, 0);
  }
  for (const conn of intraConns) {
    adj.get(conn.from).push(conn.to);
    inDeg.set(conn.to, inDeg.get(conn.to) + 1);
  }

  const layer = new Map();
  const queue = children.filter(c => inDeg.get(c.id) === 0).map(c => c.id);
  for (const id of queue) layer.set(id, 0);
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    for (const next of adj.get(cur)) {
      const newLayer = layer.get(cur) + 1;
      layer.set(next, Math.max(layer.get(next) || 0, newLayer));
      inDeg.set(next, inDeg.get(next) - 1);
      if (inDeg.get(next) === 0) queue.push(next);
    }
  }
  // Disconnected children go to layer 0
  for (const c of children) {
    if (!layer.has(c.id)) layer.set(c.id, 0);
  }

  // Group by layer
  const layers = [];
  for (const c of children) {
    const l = layer.get(c.id);
    if (!layers[l]) layers[l] = [];
    layers[l].push(c);
  }

  // Position children left-to-right by layer, top-to-bottom within layer
  const hGap = 5;
  const vGap = 1;
  const padLeft = 2;
  const padTop = 1;

  let curX = padLeft;
  for (const group of layers) {
    if (!group) { curX += hGap; continue; }
    let curY = padTop;
    let maxW = 0;
    for (const child of group) {
      if (child.x == null) child.x = curX;
      if (child.y == null) child.y = curY;
      curY += child.height + vGap;
      maxW = Math.max(maxW, child.width);
    }
    curX += maxW + hGap;
  }

  // Auto-size parent to wrap children
  if (parent.width == null) {
    let maxRight = 0;
    for (const c of children) {
      const extra = c.shadow ? 2 : 0;
      maxRight = Math.max(maxRight, c.x + c.width + extra);
    }
    let minWidth = maxRight + 4; // right padding + borders
    // Ensure title fits
    if (parent.title) {
      minWidth = Math.max(minWidth, parent.title.length + 6);
    }
    parent.width = minWidth;
  }
  if (parent.height == null) {
    let maxBottom = 0;
    for (const c of children) {
      const extra = c.shadow ? 1 : 0;
      maxBottom = Math.max(maxBottom, c.y + c.height + extra);
    }
    parent.height = maxBottom + 2; // bottom border + padding
  }
}

function autoLayout(diagram) {
  const boxes = diagram.boxes || [];
  const connections = diagram.connections || [];

  // Check if all top-level boxes already have explicit positions
  const allExplicit = boxes.every(b => b.x != null && b.y != null && b.width != null && b.height != null);
  if (allExplicit && diagram.width != null && diagram.height != null) return diagram;

  // Clone to avoid mutating input
  diagram = JSON.parse(JSON.stringify(diagram));
  const clonedBoxes = diagram.boxes || [];
  const clonedConns = diagram.connections || [];

  // Step 1: Auto-size leaf boxes and layout children
  for (const box of clonedBoxes) {
    if (box.children && box.children.length > 0) {
      layoutChildren(box, clonedConns);
    }
    autoSizeBox(box);
  }

  // If all boxes already have x/y, just auto-size canvas
  if (clonedBoxes.every(b => b.x != null && b.y != null)) {
    autoSizeCanvas(diagram);
    return diagram;
  }

  // Step 2: Assign layers to top-level boxes
  const topIds = new Set(clonedBoxes.map(b => b.id));
  // Map child IDs to their parent's top-level ID
  const childToParent = new Map();
  for (const box of clonedBoxes) {
    if (box.children) {
      for (const child of box.children) {
        childToParent.set(child.id, box.id);
      }
    }
  }

  // Build top-level adjacency from connections
  const topAdj = new Map();
  const topInDeg = new Map();
  for (const b of clonedBoxes) {
    topAdj.set(b.id, new Set());
    topInDeg.set(b.id, 0);
  }
  for (const conn of clonedConns) {
    let fromTop = topIds.has(conn.from) ? conn.from : childToParent.get(conn.from);
    let toTop = topIds.has(conn.to) ? conn.to : childToParent.get(conn.to);
    if (fromTop && toTop && fromTop !== toTop) {
      if (!topAdj.get(fromTop).has(toTop)) {
        topAdj.get(fromTop).add(toTop);
        topInDeg.set(toTop, topInDeg.get(toTop) + 1);
      }
    }
  }

  // Longest-path layering
  const layer = new Map();
  const queue = clonedBoxes.filter(b => topInDeg.get(b.id) === 0).map(b => b.id);
  for (const id of queue) layer.set(id, 0);
  let qi = 0;
  while (qi < queue.length || layer.size < clonedBoxes.length) {
    // Cycle-breaking: if queue is exhausted but nodes remain, pick one
    if (qi >= queue.length && layer.size < clonedBoxes.length) {
      let best = null, bestDeg = Infinity;
      for (const b of clonedBoxes) {
        if (!layer.has(b.id) && topInDeg.get(b.id) < bestDeg) {
          best = b.id;
          bestDeg = topInDeg.get(b.id);
        }
      }
      if (!best) break;
      layer.set(best, 0);
      queue.push(best);
    }
    const cur = queue[qi++];
    for (const next of topAdj.get(cur)) {
      const newLayer = layer.get(cur) + 1;
      layer.set(next, Math.max(layer.get(next) || 0, newLayer));
      topInDeg.set(next, topInDeg.get(next) - 1);
      if (topInDeg.get(next) === 0) queue.push(next);
    }
  }

  // Group into layers
  const layers = [];
  for (const b of clonedBoxes) {
    const l = layer.get(b.id);
    if (!layers[l]) layers[l] = [];
    layers[l].push(b);
  }

  // Step 3: Order within layers by median connection position
  for (let i = 1; i < layers.length; i++) {
    if (!layers[i] || layers[i].length <= 1) continue;
    const prevLayer = layers[i - 1] || [];
    const prevOrder = new Map(prevLayer.map((b, idx) => [b.id, idx]));
    layers[i].sort((a, b) => {
      const aMedian = getMedianPosition(a.id, clonedConns, prevOrder, childToParent);
      const bMedian = getMedianPosition(b.id, clonedConns, prevOrder, childToParent);
      return aMedian - bMedian;
    });
  }

  // Step 4: Assign coordinates
  const hGap = 10;
  const vGap = 2;
  let curX = 0;
  const columnHeights = [];

  for (const group of layers) {
    if (!group) { curX += hGap; continue; }
    let curY = 1; // leave room for labels at top
    let maxW = 0;
    for (const box of group) {
      if (box.x == null) box.x = curX;
      if (box.y == null) box.y = curY;
      const shadowH = box.shadow ? 1 : 0;
      curY += box.height + shadowH + vGap;
      const shadowW = box.shadow ? 2 : 0;
      maxW = Math.max(maxW, box.width + shadowW);
    }
    columnHeights.push(curY - vGap);
    curX += maxW + hGap;
  }

  // Vertically center columns relative to tallest
  const maxHeight = Math.max(...columnHeights);
  let layerIdx = 0;
  for (const group of layers) {
    if (!group) { layerIdx++; continue; }
    const offset = Math.floor((maxHeight - columnHeights[layerIdx]) / 2);
    if (offset > 0) {
      for (const box of group) {
        box.y += offset;
      }
    }
    layerIdx++;
  }

  // Step 5: Auto-size canvas
  autoSizeCanvas(diagram);

  return diagram;
}

function getMedianPosition(id, connections, prevOrder, childToParent) {
  const positions = [];
  for (const conn of connections) {
    let fromTop = prevOrder.has(conn.from) ? conn.from : childToParent.get(conn.from);
    let toTop = prevOrder.has(conn.to) ? conn.to : childToParent.get(conn.to);
    if (toTop === id && fromTop && prevOrder.has(fromTop)) {
      positions.push(prevOrder.get(fromTop));
    }
  }
  if (positions.length === 0) return Infinity;
  positions.sort((a, b) => a - b);
  return positions[Math.floor(positions.length / 2)];
}

function autoSizeCanvas(diagram) {
  const boxes = diagram.boxes || [];
  let maxX = 0;
  let maxY = 0;
  for (const box of boxes) {
    const shadowW = box.shadow ? 2 : 0;
    const shadowH = box.shadow ? 1 : 0;
    maxX = Math.max(maxX, (box.x || 0) + (box.width || 0) + shadowW);
    maxY = Math.max(maxY, (box.y || 0) + (box.height || 0) + shadowH);
  }
  if (diagram.width == null) diagram.width = maxX + 2;
  if (diagram.height == null) diagram.height = maxY + 1;
}

// ─── Diagram renderer ─────────────────────────────────────────────────────────

function render(diagram) {
  diagram = autoLayout(diagram);
  const { width = 80, height = 20, boxes = [], connections = [] } = diagram;
  const canvas = new Canvas(width, height);

  // Draw boxes (order matters for layering: parent first, then children are drawn inside)
  for (const box of boxes) {
    drawBox(canvas, box);
  }

  // Draw connections
  for (const conn of connections) {
    drawConnection(canvas, conn, boxes);
  }

  return canvas.toString();
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

import { readFileSync } from 'fs';
import { resolve, extname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

function printUsage() {
  console.log(`
box-of-rain - Generate beautiful ASCII box diagrams

Usage:
  node box-of-rain.mjs <diagram.json|diagram.yaml>
  node box-of-rain.mjs --example

Diagram JSON format (positions and sizes are optional — auto-layout fills them in):
{
  "boxes": [
    {
      "id": "mybox",
      "content": ["Line 1", "Line 2"],
      "border": "double",       // single | double | bold | rounded
      "shadow": true,           // shadow effect
      "title": "My Title",     // title on top border
      "children": [ ... ]      // nested boxes (coords relative to parent)
    }
  ],
  "connections": [
    { "from": "box1", "to": "box2", "label": "API" }
  ]
}

You can also specify explicit positions: x, y, width, height on each box,
and width/height on the top-level diagram. If omitted, auto-layout computes them.
`);
}

function runExample() {
  const diagram = {
    boxes: [
      {
        id: 'fe',
        content: ['Frontend'],
        border: 'rounded',
      },
      {
        id: 'api',
        content: ['API Server'],
        border: 'bold',
        shadow: true,
      },
      {
        id: 'db',
        content: ['Database'],
        border: 'double',
      },
      {
        id: 'cache',
        content: ['Cache'],
        border: 'rounded',
      },
    ],
    connections: [
      { from: 'fe', to: 'api', label: 'HTTPS' },
      { from: 'api', to: 'db', label: 'SQL' },
      { from: 'api', to: 'cache', label: 'GET/SET' },
    ],
  };

  console.log(render(diagram));
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  if (args.includes('--example')) {
    runExample();
    process.exit(0);
  }

  const filePath = resolve(args[0]);
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const ext = extname(filePath).toLowerCase();
    const diagram = (ext === '.yaml' || ext === '.yml')
      ? yaml.load(raw)
      : JSON.parse(raw);
    console.log(render(diagram));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

export { render, autoLayout, Canvas, drawBox, drawConnection, resolveBox, getAnchor, BORDERS, SHADOW_CHAR };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
