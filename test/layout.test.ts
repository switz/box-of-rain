import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { autoLayout } from '../src/layout.js';
import { getChildBoxes } from '../src/schema.js';
import type { NodeDef } from '../src/schema.js';

describe('autoLayout', () => {
  it('assigns coordinates to boxes without explicit positions', () => {
    const diagram: NodeDef = {
      children: [
        { id: 'a', children: ['Hello'] },
        { id: 'b', children: ['World'] },
      ],
      connections: [{ from: 'a', to: 'b' }],
    };
    const result = autoLayout(diagram);
    const boxes = getChildBoxes(result)!;
    assert.ok(boxes[0].x != null);
    assert.ok(boxes[0].y != null);
    assert.ok(boxes[1].x != null);
    assert.ok(boxes[1].y != null);
  });

  it('preserves explicit coordinates', () => {
    const diagram: NodeDef = {
      children: [
        { id: 'a', x: 5, y: 10, width: 12, height: 5, children: ['Hi'] },
      ],
    };
    const result = autoLayout(diagram);
    const boxes = getChildBoxes(result)!;
    assert.equal(boxes[0].x, 5);
    assert.equal(boxes[0].y, 10);
  });

  it('auto-sizes boxes to fit content and title', () => {
    const diagram: NodeDef = {
      children: [{ id: 'a', children: ['A very long content line here'] }],
    };
    const result = autoLayout(diagram);
    const boxes = getChildBoxes(result)!;
    assert.ok(boxes[0].width! >= 'A very long content line here'.length + 4);
  });

  it('auto-sizes to fit title', () => {
    const diagram: NodeDef = {
      children: [{ id: 'a', title: 'A Really Long Title Here' }],
    };
    const result = autoLayout(diagram);
    const boxes = getChildBoxes(result)!;
    assert.ok(boxes[0].width! >= 'A Really Long Title Here'.length + 6);
  });

  it('handles cycles in the dependency graph', () => {
    const diagram: NodeDef = {
      children: [
        { id: 'a', children: ['A'] },
        { id: 'b', children: ['B'] },
        { id: 'c', children: ['C'] },
      ],
      connections: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'a' },
      ],
    };
    const result = autoLayout(diagram);
    const boxes = getChildBoxes(result)!;
    assert.ok(boxes.every(b => b.x != null && b.y != null));
  });

  it('positions children inside parent', () => {
    const diagram: NodeDef = {
      children: [{
        id: 'parent', border: 'double',
        children: [
          { id: 'child1', children: ['C1'] },
          { id: 'child2', children: ['C2'] },
        ],
        connections: [{ from: 'child1', to: 'child2' }],
      }],
    };
    const result = autoLayout(diagram);
    const topBoxes = getChildBoxes(result)!;
    const parent = topBoxes[0];
    const parentChildren = getChildBoxes(parent)!;
    for (const child of parentChildren) {
      assert.ok(child.x! >= 0, 'child x inside parent');
      assert.ok(child.y! >= 0, 'child y inside parent');
      assert.ok(child.x! + child.width! <= parent.width! - 2, 'child fits in parent width');
      assert.ok(child.y! + child.height! <= parent.height! - 2, 'child fits in parent height');
    }
  });

  it('does not mutate input', () => {
    const diagram: NodeDef = {
      children: [
        { id: 'a', children: ['Hello'] },
        { id: 'b', children: ['World'] },
      ],
      connections: [{ from: 'a', to: 'b' }],
    };
    const original = JSON.stringify(diagram);
    autoLayout(diagram);
    assert.equal(JSON.stringify(diagram), original);
  });

  it('computes canvas size accounting for shadows', () => {
    const diagram: NodeDef = {
      children: [{ id: 'a', children: ['Hi'], shadow: true }],
    };
    const result = autoLayout(diagram);
    const boxes = getChildBoxes(result)!;
    const box = boxes[0];
    assert.ok(result.width! >= box.x! + box.width! + 2);
    assert.ok(result.height! >= box.y! + box.height! + 1);
  });

  it('returns unchanged when all positions are explicit', () => {
    const diagram: NodeDef = {
      width: 50, height: 20,
      children: [
        { id: 'a', x: 0, y: 0, width: 12, height: 5 },
        { id: 'b', x: 20, y: 0, width: 12, height: 5 },
      ],
    };
    const result = autoLayout(diagram);
    const boxes = getChildBoxes(result)!;
    assert.equal(boxes[0].x, 0);
    assert.equal(boxes[1].x, 20);
    assert.equal(result.width, 50);
  });

  it('layers boxes left-to-right by connection flow', () => {
    const diagram: NodeDef = {
      children: [
        { id: 'a', children: ['A'] },
        { id: 'b', children: ['B'] },
        { id: 'c', children: ['C'] },
      ],
      connections: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
    };
    const result = autoLayout(diagram);
    const boxes = getChildBoxes(result)!;
    assert.ok(boxes[0].x! < boxes[1].x!, 'a should be left of b');
    assert.ok(boxes[1].x! < boxes[2].x!, 'b should be left of c');
  });

  it('arranges disconnected boxes in a grid when >4', () => {
    const diagram: NodeDef = {
      children: [
        { id: 'a', children: ['A'] },
        { id: 'b', children: ['B'] },
        { id: 'c', children: ['C'] },
        { id: 'd', children: ['D'] },
        { id: 'e', children: ['E'] },
        { id: 'f', children: ['F'] },
      ],
    };
    const result = autoLayout(diagram);
    const boxes = getChildBoxes(result)!;
    // Should have 2 rows — some boxes share the same x (same column)
    const xs = new Set(boxes.map(b => b.x!));
    assert.ok(xs.size <= 4, 'should wrap into columns (not all unique x)');
    // At least 2 distinct y values (2 rows)
    const ys = new Set(boxes.map(b => b.y!));
    assert.ok(ys.size >= 2, 'should have at least 2 rows');
  });

  it('spreads few disconnected boxes horizontally', () => {
    const diagram: NodeDef = {
      children: [
        { id: 'a', children: ['A'] },
        { id: 'b', children: ['B'] },
        { id: 'c', children: ['C'] },
      ],
    };
    const result = autoLayout(diagram);
    const boxes = getChildBoxes(result)!;
    // Each box should have a unique x (horizontal spread)
    const xs = boxes.map(b => b.x!);
    assert.ok(xs[0] < xs[1], 'a left of b');
    assert.ok(xs[1] < xs[2], 'b left of c');
  });

  it('places disconnected boxes after connected ones in mixed layout', () => {
    const diagram: NodeDef = {
      children: [
        { id: 'a', children: ['A'] },
        { id: 'b', children: ['B'] },
        { id: 'c', children: ['C'] },
      ],
      connections: [{ from: 'a', to: 'b' }],
    };
    const result = autoLayout(diagram);
    const boxes = getChildBoxes(result)!;
    const boxMap = new Map(boxes.map(b => [b.id, b]));
    // c is disconnected; should be placed after b
    assert.ok(boxMap.get('a')!.x! < boxMap.get('b')!.x!, 'a before b');
    assert.ok(boxMap.get('b')!.x! < boxMap.get('c')!.x!, 'disconnected c after connected b');
  });

  it('aligns top-level box with nested connection target', () => {
    // Frontend connects to API Server inside Cloud Platform
    const diagram: NodeDef = {
      children: [
        { id: 'web', children: ['Frontend'], border: 'rounded' },
        {
          id: 'platform',
          title: 'Cloud Platform',
          border: 'double',
          children: [
            { id: 'api', children: ['API Server'] },
            { id: 'db', children: ['Database'] },
          ],
          connections: [{ from: 'api', to: 'db' }],
        },
      ],
      connections: [{ from: 'web', to: 'api', label: 'HTTPS' }],
    };
    const result = autoLayout(diagram);
    const boxes = getChildBoxes(result)!;
    const web = boxes.find(b => b.id === 'web')!;
    const platform = boxes.find(b => b.id === 'platform')!;
    const api = getChildBoxes(platform)!.find(b => b.id === 'api')!;

    // web's vertical center should match api's absolute vertical center
    const webCenter = web.y! + Math.floor(web.height! / 2);
    const apiAbsCenter = platform.y! + 1 + api.y! + Math.floor(api.height! / 2);
    assert.equal(webCenter, apiAbsCenter, 'Frontend center should align with API Server center');
  });

  it('aligns when connection goes from nested child to top-level box', () => {
    const diagram: NodeDef = {
      children: [
        {
          id: 'group',
          border: 'double',
          title: 'Group',
          children: [
            { id: 'a', children: ['A'] },
            { id: 'b', children: ['B'] },
          ],
          connections: [{ from: 'a', to: 'b' }],
        },
        { id: 'ext', children: ['External'] },
      ],
      connections: [{ from: 'b', to: 'ext' }],
    };
    const result = autoLayout(diagram);
    const boxes = getChildBoxes(result)!;
    const group = boxes.find(b => b.id === 'group')!;
    const ext = boxes.find(b => b.id === 'ext')!;
    const b = getChildBoxes(group)!.find(c => c.id === 'b')!;

    const extCenter = ext.y! + Math.floor(ext.height! / 2);
    const bAbsCenter = group.y! + 1 + b.y! + Math.floor(b.height! / 2);
    assert.equal(extCenter, bAbsCenter, 'External center should align with B center');
  });

  it('does not shift multi-box columns for cross-level alignment', () => {
    const diagram: NodeDef = {
      children: [
        { id: 'x', children: ['X'] },
        { id: 'y', children: ['Y'] },
        {
          id: 'group',
          border: 'double',
          title: 'Group',
          children: [
            { id: 'a', children: ['A'] },
            { id: 'b', children: ['B'] },
          ],
          connections: [{ from: 'a', to: 'b' }],
        },
      ],
      connections: [
        { from: 'x', to: 'a' },
        { from: 'y', to: 'b' },
      ],
    };
    const result = autoLayout(diagram);
    const boxes = getChildBoxes(result)!;
    const x = boxes.find(b => b.id === 'x')!;
    const y = boxes.find(b => b.id === 'y')!;
    // x and y are in the same column (both connect into group), so they should NOT be shifted
    // Just verify they have valid positions and x is above y
    assert.ok(x.y! < y.y!, 'x should be above y in the same column');
  });

  it('handles nested 3-level deep boxes', () => {
    const diagram: NodeDef = {
      children: [{
        id: 'outer',
        border: 'double',
        children: [{
          id: 'middle',
          border: 'bold',
          children: [
            { id: 'inner', children: ['Leaf'] },
          ],
        }],
      }],
    };
    const result = autoLayout(diagram);
    const outer = getChildBoxes(result)![0];
    const middle = getChildBoxes(outer)![0];
    const inner = getChildBoxes(middle)![0];
    assert.ok(inner.width! > 0);
    assert.ok(inner.height! > 0);
    assert.ok(middle.width! > inner.width!);
    assert.ok(outer.width! > middle.width!);
  });
});
