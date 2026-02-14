import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Canvas } from '../src/canvas.js';
import { drawBox } from '../src/draw-box.js';
import { drawConnection } from '../src/draw-connection.js';
import { resolveBox } from '../src/geometry.js';
import type { NodeDef } from '../src/schema.js';

describe('drawConnection', () => {
  it('draws straight horizontal arrow', () => {
    const boxes: NodeDef[] = [
      { id: 'a', x: 0, y: 0, width: 5, height: 3 },
      { id: 'b', x: 15, y: 0, width: 5, height: 3 },
    ];
    const c = new Canvas(25, 5);
    drawBox(c, boxes[0] as any);
    drawBox(c, boxes[1] as any);
    drawConnection(c, { from: 'a', to: 'b' }, boxes);
    assert.equal(c.get(6, 1), '─');
    assert.equal(c.get(14, 1), '▶');
  });

  it('draws L-shaped connection when vertically offset', () => {
    const boxes: NodeDef[] = [
      { id: 'a', x: 0, y: 0, width: 5, height: 3 },
      { id: 'b', x: 15, y: 6, width: 5, height: 3 },
    ];
    const c = new Canvas(25, 12);
    drawBox(c, boxes[0] as any);
    drawBox(c, boxes[1] as any);
    drawConnection(c, { from: 'a', to: 'b' }, boxes);
    assert.equal(c.get(14, 7), '▶');
  });

  it('draws U-shaped routing when same-side exit and entry', () => {
    const boxes: NodeDef[] = [
      { id: 'a', x: 5, y: 0, width: 10, height: 3 },
      { id: 'b', x: 5, y: 5, width: 10, height: 3 },
    ];
    const c = new Canvas(25, 10);
    drawBox(c, boxes[0] as any);
    drawBox(c, boxes[1] as any);
    drawConnection(c, { from: 'a', to: 'b', fromSide: 'right', toSide: 'right' }, boxes);
    const arrowY = 5 + Math.floor(3 / 2);
    assert.equal(c.get(15, arrowY), '◀');
  });

  it('U-shaped right routing going down has correct corners', () => {
    // a exits right, b enters right, b is below a
    // Expected shape:  ─────┐
    //                       │
    //                  ─────┘
    const boxes: NodeDef[] = [
      { id: 'a', x: 0, y: 0, width: 5, height: 3 },
      { id: 'b', x: 0, y: 5, width: 5, height: 3 },
    ];
    const c = new Canvas(15, 10);
    drawBox(c, boxes[0] as any);
    drawBox(c, boxes[1] as any);
    drawConnection(c, { from: 'a', to: 'b', fromSide: 'right', toSide: 'right' }, boxes);
    // extendX is past rightmost box edge (5) + 1 = 6
    const extendX = 6;
    const srcY = 1;  // center of box a (height 3)
    const dstY = 6;  // center of box b (y=5, height 3)
    assert.equal(c.get(extendX, srcY), '┐', 'first corner: right then down');
    assert.equal(c.get(extendX, dstY), '┘', 'second corner: down then left');
  });

  it('U-shaped right routing going up has correct corners', () => {
    // a exits right, b enters right, b is above a
    // Expected shape:  ─────┘
    //                       │
    //                  ─────┐
    const boxes: NodeDef[] = [
      { id: 'a', x: 0, y: 5, width: 5, height: 3 },
      { id: 'b', x: 0, y: 0, width: 5, height: 3 },
    ];
    const c = new Canvas(15, 10);
    drawBox(c, boxes[0] as any);
    drawBox(c, boxes[1] as any);
    drawConnection(c, { from: 'a', to: 'b', fromSide: 'right', toSide: 'right' }, boxes);
    const extendX = 6;
    const srcY = 6;  // center of box a (y=5, height 3)
    const dstY = 1;  // center of box b (height 3)
    assert.equal(c.get(extendX, srcY), '┘', 'first corner: right then up');
    assert.equal(c.get(extendX, dstY), '┐', 'second corner: up then left');
  });

  it('uses correct arrow heads per toSide', () => {
    const boxes: NodeDef[] = [
      { id: 'a', x: 0, y: 0, width: 5, height: 3 },
      { id: 'b', x: 15, y: 0, width: 5, height: 3 },
    ];
    const c = new Canvas(25, 5);
    drawConnection(c, { from: 'a', to: 'b', fromSide: 'right', toSide: 'left' }, boxes);
    assert.equal(c.get(14, 1), '▶');
  });

  it('draws label on straight connection', () => {
    const boxes: NodeDef[] = [
      { id: 'a', x: 0, y: 2, width: 5, height: 3 },
      { id: 'b', x: 20, y: 2, width: 5, height: 3 },
    ];
    const c = new Canvas(30, 8);
    drawConnection(c, { from: 'a', to: 'b', label: 'test' }, boxes);
    const connRow = c.grid[3].join('');
    assert.ok(connRow.includes('test'), 'label should appear on the arrow line');
  });

  it('label has at least one dash on each side', () => {
    const boxes: NodeDef[] = [
      { id: 'a', x: 0, y: 0, width: 5, height: 3 },
      { id: 'b', x: 20, y: 0, width: 5, height: 3 },
    ];
    const c = new Canvas(30, 5);
    drawConnection(c, { from: 'a', to: 'b', label: 'HTTPS' }, boxes);
    const row = c.grid[1].join('');
    const labelIdx = row.indexOf('HTTPS');
    assert.ok(labelIdx > 0, 'label should be present');
    // At least one dash before the label (after the box edge)
    const beforeLabel = row.substring(5, labelIdx);
    assert.ok(beforeLabel.includes('─'), 'should have at least one dash before label');
    // At least one dash after the label (before the arrow head)
    const afterLabel = row.substring(labelIdx + 'HTTPS'.length, 20);
    assert.ok(afterLabel.includes('─'), 'should have at least one dash after label');
  });

  it('handles missing IDs gracefully', () => {
    const boxes: NodeDef[] = [{ id: 'a', x: 0, y: 0, width: 5, height: 3 }];
    const c = new Canvas(25, 5);
    drawConnection(c, { from: 'a', to: 'nonexistent' }, boxes);
    drawConnection(c, { from: 'nonexistent', to: 'a' }, boxes);
  });

  it('resolves nested child IDs', () => {
    const boxes: NodeDef[] = [
      {
        id: 'parent', x: 0, y: 0, width: 30, height: 10,
        children: [{ id: 'child', x: 2, y: 1, width: 10, height: 5 }],
      },
      { id: 'other', x: 40, y: 0, width: 10, height: 5 },
    ];
    const resolved = resolveBox('child', boxes);
    assert.ok(resolved);
    assert.equal(resolved!.absX, 0 + 1 + 2);
    assert.equal(resolved!.absY, 0 + 1 + 1);
  });
});
