import type { NodeDef, ConnectionDef, LayoutOptions } from './schema.js';
import { getTextContent, getChildBoxes, collectConnections } from './schema.js';
import { DEFAULT_LAYOUT_OPTIONS } from './constants.js';

function autoSizeBox(box: NodeDef, opts: Required<LayoutOptions>): void {
  const lines = getTextContent(box) || [];
  const longestLine = lines.reduce((max, l) => Math.max(max, l.length), 0);
  const titleLen = box.title ? box.title.length : 0;

  if (box.width == null) {
    box.width = Math.max(longestLine + 4, titleLen + 6, opts.minBoxWidth);
  }
  if (box.height == null) {
    box.height = Math.max(lines.length + 2, opts.minBoxHeight);
  }
}

/** If sibling boxes have auto-sized widths within 30% of the widest, equalize them all. */
function equalizeWidths(children: NodeDef[]): void {
  // Only equalize children whose widths were auto-computed (not explicitly set)
  const autoSized = children.filter(c => c.width != null);
  if (autoSized.length < 2) return;
  const maxW = Math.max(...autoSized.map(c => c.width!));
  const minW = Math.min(...autoSized.map(c => c.width!));
  if (minW >= maxW * 0.7) {
    for (const c of autoSized) {
      c.width = maxW;
    }
  }
}

function computeLayerGaps(layers: NodeDef[][], connections: ConnectionDef[], defaultGap: number): number[] {
  const gaps: number[] = [];
  const idToLayer = new Map<string, number>();
  for (let i = 0; i < layers.length; i++) {
    if (!layers[i]) continue;
    for (const box of layers[i]) {
      if (box.id) idToLayer.set(box.id, i);
    }
  }
  const pairMax = new Map<number, number>();
  for (const conn of connections) {
    if (!conn.label) continue;
    const fromLayer = idToLayer.get(conn.from);
    const toLayer = idToLayer.get(conn.to);
    if (fromLayer == null || toLayer == null) continue;
    // Only inflate gap for forward connections (label sits in the inter-layer gap)
    // Backward or U-shaped connections route around, not through the gap
    if (fromLayer >= toLayer) continue;
    if (conn.fromSide && conn.toSide && conn.fromSide === conn.toSide) continue;
    if (toLayer - fromLayer === 1) {
      pairMax.set(fromLayer, Math.max(pairMax.get(fromLayer) || 0, conn.label.length));
    }
  }
  for (let i = 0; i < layers.length; i++) {
    const maxLabel = pairMax.get(i) || 0;
    gaps.push(Math.max(defaultGap, maxLabel + 4));
  }
  return gaps;
}

function layoutChildren(parent: NodeDef, allConnections: ConnectionDef[], opts: Required<LayoutOptions>): void {
  const children = getChildBoxes(parent);
  if (!children || children.length === 0) return;

  // Recursively layout grandchildren first
  for (const child of children) {
    if (getChildBoxes(child)) {
      layoutChildren(child, allConnections, opts);
    }
    autoSizeBox(child, opts);
  }

  // Equalize widths of siblings that are close in size
  equalizeWidths(children);

  // Build intra-parent connection graph
  const childIds = new Set(children.map(c => c.id).filter(Boolean) as string[]);
  const intraConns = allConnections.filter(
    c => childIds.has(c.from) && childIds.has(c.to)
  );

  if (parent.childDirection === 'vertical') {
    layoutVertical(children, intraConns, opts);
  } else {
    layoutHorizontal(children, intraConns, opts);
  }

  // Auto-size parent to wrap children
  if (parent.width == null) {
    let maxRight = 0;
    let maxChildW = 0;
    for (const c of children) {
      const extra = c.shadow ? 2 : 0;
      maxRight = Math.max(maxRight, (c.x ?? 0) + (c.width ?? 0) + extra);
      maxChildW = Math.max(maxChildW, c.width ?? 0);
    }
    let minWidth = maxRight + 4;
    if (parent.childDirection === 'vertical') {
      for (const conn of intraConns) {
        if (conn.label) {
          const needed = Math.ceil(maxChildW / 2) + conn.label.length + 8;
          minWidth = Math.max(minWidth, needed);
        }
      }
    }
    if (parent.title) {
      minWidth = Math.max(minWidth, parent.title.length + 6);
    }
    parent.width = minWidth;
  }
  if (parent.height == null) {
    let maxBottom = 0;
    for (const c of children) {
      const extra = c.shadow ? 1 : 0;
      maxBottom = Math.max(maxBottom, (c.y ?? 0) + (c.height ?? 0) + extra);
    }
    parent.height = maxBottom + 2;
  }
}

function layoutVertical(children: NodeDef[], intraConns: ConnectionDef[], opts: Required<LayoutOptions>): void {
  const hasLabeledConn = intraConns.some(c => c.label);
  const hasConn = intraConns.length > 0;
  const vGap = hasLabeledConn ? 3 : hasConn ? 2 : 1;
  let curY = opts.padTop;
  for (const child of children) {
    if (child.x == null) child.x = opts.padLeft;
    if (child.y == null) child.y = curY;
    curY += (child.height ?? 0) + vGap;
  }
}

function layoutHorizontal(children: NodeDef[], intraConns: ConnectionDef[], opts: Required<LayoutOptions>): void {
  // Assign layers using longest-path
  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  for (const c of children) {
    if (c.id) {
      adj.set(c.id, []);
      inDeg.set(c.id, 0);
    }
  }
  for (const conn of intraConns) {
    adj.get(conn.from)?.push(conn.to);
    inDeg.set(conn.to, (inDeg.get(conn.to) || 0) + 1);
  }

  const layer = new Map<string, number>();
  const queue = children.filter(c => c.id && inDeg.get(c.id) === 0).map(c => c.id!);
  for (const id of queue) layer.set(id, 0);
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    for (const next of (adj.get(cur) || [])) {
      const newLayer = (layer.get(cur) ?? 0) + 1;
      layer.set(next, Math.max(layer.get(next) || 0, newLayer));
      inDeg.set(next, (inDeg.get(next) || 0) - 1);
      if (inDeg.get(next) === 0) queue.push(next);
    }
  }
  for (const c of children) {
    if (c.id && !layer.has(c.id)) layer.set(c.id, 0);
  }

  // Group by layer
  const layers: NodeDef[][] = [];
  for (const c of children) {
    const l = c.id ? (layer.get(c.id) ?? 0) : 0;
    if (!layers[l]) layers[l] = [];
    layers[l].push(c);
  }

  const childHGap = 5;
  const childVGap = 1;
  const layerGaps = computeLayerGaps(layers, intraConns, childHGap);

  let curX = opts.padLeft;
  for (let i = 0; i < layers.length; i++) {
    const group = layers[i];
    const gap = layerGaps[i] || childHGap;
    if (!group) { curX += gap; continue; }
    let curY = opts.padTop;
    let maxW = 0;
    for (const child of group) {
      if (child.x == null) child.x = curX;
      if (child.y == null) child.y = curY;
      curY += (child.height ?? 0) + childVGap;
      maxW = Math.max(maxW, child.width ?? 0);
    }
    curX += maxW + gap;
  }
}

function autoSizeCanvas(diagram: NodeDef): void {
  const children = getChildBoxes(diagram) || [];
  let maxX = 0;
  let maxY = 0;
  for (const box of children) {
    const shadowW = box.shadow ? 2 : 0;
    const shadowH = box.shadow ? 1 : 0;
    maxX = Math.max(maxX, (box.x || 0) + (box.width || 0) + shadowW);
    maxY = Math.max(maxY, (box.y || 0) + (box.height || 0) + shadowH);
  }
  if (diagram.width == null) diagram.width = maxX + 2;
  if (diagram.height == null) diagram.height = maxY + 1;
}

function getMedianPosition(
  id: string,
  connections: ConnectionDef[],
  prevOrder: Map<string, number>,
  childToParent: Map<string, string>,
): number {
  const positions: number[] = [];
  for (const conn of connections) {
    const fromTop = prevOrder.has(conn.from) ? conn.from : childToParent.get(conn.from);
    const toTop = prevOrder.has(conn.to) ? conn.to : childToParent.get(conn.to);
    if (toTop === id && fromTop && prevOrder.has(fromTop)) {
      positions.push(prevOrder.get(fromTop)!);
    }
  }
  if (positions.length === 0) return Infinity;
  positions.sort((a, b) => a - b);
  return positions[Math.floor(positions.length / 2)];
}

export function autoLayout(diagram: NodeDef, options?: LayoutOptions): NodeDef {
  const opts = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
  const children = getChildBoxes(diagram) || [];
  const allConnections = collectConnections(diagram);

  // Check if all top-level boxes already have explicit positions
  const allExplicit = children.every(b => b.x != null && b.y != null && b.width != null && b.height != null);
  if (allExplicit && diagram.width != null && diagram.height != null) return diagram;

  // Clone to avoid mutating input
  const cloned: NodeDef = JSON.parse(JSON.stringify(diagram));
  const clonedChildren = getChildBoxes(cloned) || [];
  const clonedConns = collectConnections(cloned);

  // Step 1: Auto-size leaf boxes and layout children
  for (const box of clonedChildren) {
    if (getChildBoxes(box)) {
      layoutChildren(box, clonedConns, opts);
    }
    autoSizeBox(box, opts);
  }

  // If all boxes already have x/y, just auto-size canvas
  if (clonedChildren.every(b => b.x != null && b.y != null)) {
    autoSizeCanvas(cloned);
    return cloned;
  }

  // Step 2: Assign layers to top-level boxes
  const topIds = new Set(clonedChildren.map(b => b.id).filter(Boolean) as string[]);
  const childToParent = new Map<string, string>();
  for (const box of clonedChildren) {
    const grandchildren = getChildBoxes(box);
    if (grandchildren && box.id) {
      for (const child of grandchildren) {
        if (child.id) childToParent.set(child.id, box.id);
      }
    }
  }

  // Build top-level adjacency from connections
  const topAdj = new Map<string, Set<string>>();
  const topInDeg = new Map<string, number>();
  for (const b of clonedChildren) {
    if (b.id) {
      topAdj.set(b.id, new Set());
      topInDeg.set(b.id, 0);
    }
  }
  for (const conn of clonedConns) {
    const fromTop = topIds.has(conn.from) ? conn.from : childToParent.get(conn.from);
    const toTop = topIds.has(conn.to) ? conn.to : childToParent.get(conn.to);
    if (fromTop && toTop && fromTop !== toTop) {
      if (!topAdj.get(fromTop)?.has(toTop)) {
        topAdj.get(fromTop)?.add(toTop);
        topInDeg.set(toTop, (topInDeg.get(toTop) || 0) + 1);
      }
    }
  }

  // Longest-path layering
  const layer = new Map<string, number>();
  const queue = clonedChildren.filter(b => b.id && topInDeg.get(b.id) === 0).map(b => b.id!);
  for (const id of queue) layer.set(id, 0);
  let qi = 0;
  while (qi < queue.length || layer.size < clonedChildren.length) {
    if (qi >= queue.length && layer.size < clonedChildren.length) {
      let best: string | null = null;
      let bestDeg = Infinity;
      for (const b of clonedChildren) {
        if (b.id && !layer.has(b.id) && (topInDeg.get(b.id) ?? 0) < bestDeg) {
          best = b.id;
          bestDeg = topInDeg.get(b.id) ?? 0;
        }
      }
      if (!best) break;
      layer.set(best, 0);
      queue.push(best);
    }
    const cur = queue[qi++];
    for (const next of (topAdj.get(cur) || [])) {
      const newLayer = (layer.get(cur) ?? 0) + 1;
      layer.set(next, Math.max(layer.get(next) || 0, newLayer));
      topInDeg.set(next, (topInDeg.get(next) || 0) - 1);
      if (topInDeg.get(next) === 0) queue.push(next);
    }
  }

  // Group into layers
  const layers: NodeDef[][] = [];
  for (const b of clonedChildren) {
    const l = b.id ? (layer.get(b.id) ?? 0) : 0;
    if (!layers[l]) layers[l] = [];
    layers[l].push(b);
  }

  // Spread disconnected boxes into separate layers
  const hasTopEdges = [...topAdj.values()].some(s => s.size > 0);
  if (!hasTopEdges && layers.length === 1 && layers[0] && layers[0].length > 1) {
    const allBoxes = layers[0];
    layers.length = 0;
    for (const box of allBoxes) {
      layers.push([box]);
    }
  }

  // Step 3: Order within layers by median connection position
  for (let i = 1; i < layers.length; i++) {
    if (!layers[i] || layers[i].length <= 1) continue;
    const prevLayer = layers[i - 1] || [];
    const prevOrder = new Map(prevLayer.map((b, idx) => [b.id!, idx]));
    layers[i].sort((a, b) => {
      const aMedian = getMedianPosition(a.id!, clonedConns, prevOrder, childToParent);
      const bMedian = getMedianPosition(b.id!, clonedConns, prevOrder, childToParent);
      return aMedian - bMedian;
    });
  }

  // Step 4: Assign coordinates
  let curX = 0;
  const columnHeights: number[] = [];

  // Build top-level connection list for gap computation
  const topConns = clonedConns.map(conn => {
    const fromTop = topIds.has(conn.from) ? conn.from : childToParent.get(conn.from);
    const toTop = topIds.has(conn.to) ? conn.to : childToParent.get(conn.to);
    return { from: fromTop!, to: toTop!, label: conn.label, fromSide: conn.fromSide, toSide: conn.toSide };
  }).filter(c => c.from && c.to && c.from !== c.to);

  const layerGaps = computeLayerGaps(layers, topConns, opts.defaultHGap);

  for (let i = 0; i < layers.length; i++) {
    const group = layers[i];
    const gap = layerGaps[i] || opts.defaultHGap;
    if (!group) { curX += gap; continue; }
    let curY = 1; // leave room for labels at top
    let maxW = 0;
    for (const box of group) {
      if (box.x == null) box.x = curX;
      if (box.y == null) box.y = curY;
      const shadowH = box.shadow ? 1 : 0;
      curY += (box.height ?? 0) + shadowH + opts.vGap;
      const shadowW = box.shadow ? 2 : 0;
      maxW = Math.max(maxW, (box.width ?? 0) + shadowW);
    }
    columnHeights.push(curY - opts.vGap);
    curX += maxW + gap;
  }

  // Vertically center columns relative to tallest
  const maxHeight = Math.max(...columnHeights);
  let layerIdx = 0;
  for (const group of layers) {
    if (!group) { layerIdx++; continue; }
    const offset = Math.floor((maxHeight - columnHeights[layerIdx]) / 2);
    if (offset > 0) {
      for (const box of group) {
        box.y = (box.y ?? 0) + offset;
      }
    }
    layerIdx++;
  }

  // Step 5: Auto-size canvas
  autoSizeCanvas(cloned);

  return cloned;
}
