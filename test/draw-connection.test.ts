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

  it('L-shaped corner is not overwritten by label on source segment', () => {
    // Label placed on the source-side horizontal segment should not overwrite the corner
    const boxes: NodeDef[] = [
      { id: 'a', x: 0, y: 0, width: 5, height: 3 },
      { id: 'b', x: 15, y: 6, width: 5, height: 3 },
    ];
    const c = new Canvas(25, 12);
    drawBox(c, boxes[0] as any);
    drawBox(c, boxes[1] as any);
    drawConnection(c, { from: 'a', to: 'b', label: 'data' }, boxes);
    // src anchor: right of a = (5, 1), dst anchor: left of b = (14, 7)
    // midX = floor((5+14)/2) = 9
    const midX = 9;
    const srcY = 1;
    const dstY = 7;
    // First corner must be a box-drawing corner, not overwritten by label text
    const firstCorner = c.get(midX, srcY);
    assert.ok('┐┘┌└'.includes(firstCorner), `first corner should be a corner char, got "${firstCorner}"`);
    // Second corner
    const secondCorner = c.get(midX, dstY);
    assert.ok('┐┘┌└'.includes(secondCorner), `second corner should be a corner char, got "${secondCorner}"`);
    // Arrowhead must still be present
    assert.equal(c.get(14, dstY), '▶');
  });

  it('L-shaped corner preserved when label is longer than source segment', () => {
    // When label is too long for source segment, it goes on dst segment.
    // Corner and arrowhead must still be intact.
    const boxes: NodeDef[] = [
      { id: 'a', x: 0, y: 0, width: 5, height: 3 },
      { id: 'b', x: 15, y: 6, width: 5, height: 3 },
    ];
    const c = new Canvas(25, 12);
    drawBox(c, boxes[0] as any);
    drawBox(c, boxes[1] as any);
    drawConnection(c, { from: 'a', to: 'b', label: 'VERY_LONG_LABEL' }, boxes);
    const midX = 9;
    const srcY = 1;
    const dstY = 7;
    const firstCorner = c.get(midX, srcY);
    assert.ok('┐┘┌└'.includes(firstCorner), `first corner should be a corner char, got "${firstCorner}"`);
    const secondCorner = c.get(midX, dstY);
    assert.ok('┐┘┌└'.includes(secondCorner), `second corner should be a corner char, got "${secondCorner}"`);
    assert.equal(c.get(14, dstY), '▶');
  });

  it('L-shaped corner preserved with short label that fits exactly', () => {
    // Edge case: label barely fits on the segment
    const boxes: NodeDef[] = [
      { id: 'a', x: 0, y: 0, width: 3, height: 3 },
      { id: 'b', x: 10, y: 5, width: 3, height: 3 },
    ];
    const c = new Canvas(18, 10);
    drawBox(c, boxes[0] as any);
    drawBox(c, boxes[1] as any);
    drawConnection(c, { from: 'a', to: 'b', label: 'AB' }, boxes);
    // src anchor: right of a = (3, 1), dst anchor: left of b = (9, 6)
    // midX = floor((3+9)/2) = 6
    const midX = 6;
    const srcY = 1;
    const dstY = 6;
    const firstCorner = c.get(midX, srcY);
    assert.ok('┐┘┌└'.includes(firstCorner), `first corner should be a corner char, got "${firstCorner}"`);
    const secondCorner = c.get(midX, dstY);
    assert.ok('┐┘┌└'.includes(secondCorner), `second corner should be a corner char, got "${secondCorner}"`);
  });

  it('sibling L-shaped connections share midX and form tee junction', () => {
    // Two connections from the same source to targets above and below
    // should share the same vertical line and create a tee junction
    const boxes: NodeDef[] = [
      { id: 'src', x: 0, y: 5, width: 5, height: 3 },
      { id: 'up', x: 20, y: 0, width: 5, height: 3 },
      { id: 'down', x: 20, y: 10, width: 5, height: 3 },
    ];
    const allConns = [
      { from: 'src', to: 'up', label: 'A' },
      { from: 'src', to: 'down', label: 'B' },
    ];
    const c = new Canvas(30, 15);
    drawBox(c, boxes[0] as any);
    drawBox(c, boxes[1] as any);
    drawBox(c, boxes[2] as any);
    for (const conn of allConns) {
      drawConnection(c, conn, boxes, allConns);
    }
    // Both connections exit right from src (x=5, y=6)
    // The midX column should have a tee junction ┤ at the source row
    const srcY = 6; // center of src box
    // Find the midX by scanning for the junction character
    let junctionX = -1;
    for (let x = 6; x < 20; x++) {
      const ch = c.get(x, srcY);
      if ('┤├'.includes(ch)) {
        junctionX = x;
        break;
      }
    }
    assert.ok(junctionX >= 0, 'should have a tee junction (┤ or ├) at the source row');
    // Vertical pipe should be continuous from up-corner to down-corner
    const upY = 1; // center of up box
    const downY = 11; // center of down box
    for (let y = upY + 1; y < downY; y++) {
      if (y === srcY) continue; // junction char, not │
      const ch = c.get(junctionX, y);
      assert.ok(ch === '│' || '┌┐└┘'.includes(ch),
        `vertical pipe at (${junctionX}, ${y}) should be │ or corner, got "${ch}"`);
    }
  });

  it('sibling L-shaped connections balance segment lengths', () => {
    // When one connection has a long label, the midX should shift
    // so both siblings use the same vertical line
    const boxes: NodeDef[] = [
      { id: 'src', x: 0, y: 4, width: 5, height: 3 },
      { id: 'a', x: 20, y: 0, width: 5, height: 3 },
      { id: 'b', x: 20, y: 8, width: 5, height: 3 },
    ];
    const allConns = [
      { from: 'src', to: 'a' },
      { from: 'src', to: 'b', label: 'LONGISH' },
    ];
    const c = new Canvas(30, 13);
    for (const conn of allConns) {
      drawConnection(c, conn, boxes, allConns);
    }
    const srcY = 5;
    // Find the junction or corner column
    let midCol = -1;
    for (let x = 6; x < 20; x++) {
      const ch = c.get(x, srcY);
      if ('┤├┐┘┌└'.includes(ch)) {
        midCol = x;
        break;
      }
    }
    assert.ok(midCol >= 0, 'should find junction/corner at source row');
    // The label 'LONGISH' should appear on the destination row
    const dstY = 9; // center of box b
    const row = c.grid[dstY].join('');
    assert.ok(row.includes('LONGISH'), `label should be visible, got: ${row}`);
  });

  it('L-shape corner becomes tee when crossing a straight sibling connection', () => {
    // Simulates the microservices scenario: gateway→auth (straight) and
    // gateway→orders (L-shape going down). The L-shape corner on the same
    // row as the straight line should merge into a ┬ tee junction.
    const boxes: NodeDef[] = [
      { id: 'gateway', x: 0, y: 2, width: 10, height: 5 },
      { id: 'auth',    x: 20, y: 2, width: 10, height: 5 },
      { id: 'orders',  x: 20, y: 10, width: 10, height: 5 },
    ];
    const allConns = [
      { from: 'gateway', to: 'auth' },
      { from: 'gateway', to: 'orders' },
    ];
    const c = new Canvas(35, 18);
    drawBox(c, boxes[0] as any);
    drawBox(c, boxes[1] as any);
    drawBox(c, boxes[2] as any);
    for (const conn of allConns) {
      drawConnection(c, conn, boxes, allConns);
    }
    const srcY = 4; // center of gateway (y=2, height=5)
    // The straight line gateway→auth runs across row 4.
    // The L-shape gateway→orders turns down at some midX on row 4.
    // That midX should have a ┬ (tee down), not a plain ┐ (corner).
    let foundTee = false;
    for (let x = 11; x < 19; x++) {
      const ch = c.get(x, srcY);
      if (ch === '┬') {
        foundTee = true;
        // Verify vertical segment continues down from the tee
        assert.equal(c.get(x, srcY + 1), '│', 'vertical segment below tee');
        break;
      }
    }
    assert.ok(foundTee, 'should have a ┬ tee junction where L-shape branches off the straight line');
    // Verify both arrows reach their targets
    assert.equal(c.get(19, srcY), '▶', 'straight arrow reaches auth');
    assert.equal(c.get(19, 12), '▶', 'L-shape arrow reaches orders');
  });

  it('straight line preserves existing L-shape corner as tee', () => {
    // When the L-shape is drawn first and the straight line second,
    // the straight should merge the corner into a tee, not overwrite it.
    const boxes: NodeDef[] = [
      { id: 'src',    x: 0, y: 2, width: 5, height: 3 },
      { id: 'lower',  x: 20, y: 8, width: 5, height: 3 },
      { id: 'right',  x: 20, y: 2, width: 5, height: 3 },
    ];
    const c = new Canvas(30, 14);
    drawBox(c, boxes[0] as any);
    drawBox(c, boxes[1] as any);
    drawBox(c, boxes[2] as any);
    // Draw L-shape first (to lower), then straight (to right)
    drawConnection(c, { from: 'src', to: 'lower' }, boxes);
    drawConnection(c, { from: 'src', to: 'right' }, boxes);
    const srcY = 3; // center of src
    // Find the tee
    let foundTee = false;
    for (let x = 6; x < 19; x++) {
      if (c.get(x, srcY) === '┬') {
        foundTee = true;
        break;
      }
    }
    assert.ok(foundTee, 'straight line should merge L-shape corner ┐ into ┬');
  });

  it('L-shape merges into tee when drawn over existing straight line', () => {
    // When the straight line is drawn first and the L-shape second,
    // the L-shape corner should detect the existing ─ and produce a tee.
    const boxes: NodeDef[] = [
      { id: 'src',    x: 0, y: 2, width: 5, height: 3 },
      { id: 'right',  x: 20, y: 2, width: 5, height: 3 },
      { id: 'lower',  x: 20, y: 8, width: 5, height: 3 },
    ];
    const c = new Canvas(30, 14);
    drawBox(c, boxes[0] as any);
    drawBox(c, boxes[1] as any);
    drawBox(c, boxes[2] as any);
    // Draw straight first, then L-shape
    drawConnection(c, { from: 'src', to: 'right' }, boxes);
    drawConnection(c, { from: 'src', to: 'lower' }, boxes);
    const srcY = 3;
    let foundTee = false;
    for (let x = 6; x < 19; x++) {
      if (c.get(x, srcY) === '┬') {
        foundTee = true;
        break;
      }
    }
    assert.ok(foundTee, 'L-shape corner should merge with existing ─ into ┬');
  });

  it('straight connection overwrites box borders with dash, not cross', () => {
    // A connection line passing through a box border should overwrite │ with ─,
    // NOT merge it into ┼
    const boxes: NodeDef[] = [
      { id: 'a', x: 0, y: 0, width: 5, height: 3 },
      { id: 'mid', x: 10, y: 0, width: 5, height: 3 },
      { id: 'b', x: 20, y: 0, width: 5, height: 3 },
    ];
    const c = new Canvas(30, 5);
    drawBox(c, boxes[0] as any);
    drawBox(c, boxes[1] as any);
    drawBox(c, boxes[2] as any);
    drawConnection(c, { from: 'a', to: 'b' }, boxes);
    // The mid box borders should be overwritten with ─, NOT turned into ┼
    assert.notEqual(c.get(10, 1), '┼', 'box left border should not become ┼');
    assert.notEqual(c.get(14, 1), '┼', 'box right border should not become ┼');
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
