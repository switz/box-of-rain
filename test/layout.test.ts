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
});
