import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Canvas } from '../src/canvas.js';

describe('Canvas', () => {
  it('has correct dimensions', () => {
    const c = new Canvas(10, 5);
    assert.equal(c.width, 10);
    assert.equal(c.height, 5);
  });

  it('initializes grid with spaces', () => {
    const c = new Canvas(3, 2);
    assert.equal(c.get(0, 0), ' ');
    assert.equal(c.get(2, 1), ' ');
  });

  it('set/get round-trip', () => {
    const c = new Canvas(5, 5);
    c.set(2, 3, 'X');
    assert.equal(c.get(2, 3), 'X');
  });

  it('out-of-bounds set is a no-op', () => {
    const c = new Canvas(5, 5);
    c.set(-1, 0, 'X');
    c.set(0, -1, 'X');
    c.set(5, 0, 'X');
    c.set(0, 5, 'X');
    assert.equal(c.get(0, 0), ' ');
  });

  it('out-of-bounds get returns space', () => {
    const c = new Canvas(5, 5);
    assert.equal(c.get(-1, 0), ' ');
    assert.equal(c.get(100, 100), ' ');
  });

  it('writeText writes characters sequentially', () => {
    const c = new Canvas(10, 1);
    c.writeText(2, 0, 'Hi!');
    assert.equal(c.get(2, 0), 'H');
    assert.equal(c.get(3, 0), 'i');
    assert.equal(c.get(4, 0), '!');
  });

  it('toString trims trailing whitespace per line', () => {
    const c = new Canvas(10, 2);
    c.set(0, 0, 'A');
    c.set(0, 1, 'B');
    const lines = c.toString().split('\n');
    assert.equal(lines[0], 'A');
    assert.equal(lines[1], 'B');
  });

  it('toString left-aligns by stripping common leading whitespace', () => {
    const c = new Canvas(10, 2);
    c.set(3, 0, 'X');
    c.set(3, 1, 'Y');
    const lines = c.toString().split('\n');
    assert.equal(lines[0], 'X');
    assert.equal(lines[1], 'Y');
  });
});
