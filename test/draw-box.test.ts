import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Canvas } from '../src/canvas.js';
import { drawBox } from '../src/draw-box.js';
import { SHADOW_CHAR } from '../src/constants.js';

describe('drawBox', () => {
  it('draws correct corner characters for single border', () => {
    const c = new Canvas(12, 5);
    drawBox(c, { x: 0, y: 0, width: 12, height: 5, border: 'single' });
    assert.equal(c.get(0, 0), '┌');
    assert.equal(c.get(11, 0), '┐');
    assert.equal(c.get(0, 4), '└');
    assert.equal(c.get(11, 4), '┘');
  });

  it('draws correct corner characters for double border', () => {
    const c = new Canvas(12, 5);
    drawBox(c, { x: 0, y: 0, width: 12, height: 5, border: 'double' });
    assert.equal(c.get(0, 0), '╔');
    assert.equal(c.get(11, 0), '╗');
    assert.equal(c.get(0, 4), '╚');
    assert.equal(c.get(11, 4), '╝');
  });

  it('draws correct corner characters for bold border', () => {
    const c = new Canvas(12, 5);
    drawBox(c, { x: 0, y: 0, width: 12, height: 5, border: 'bold' });
    assert.equal(c.get(0, 0), '┏');
    assert.equal(c.get(11, 0), '┓');
  });

  it('draws correct corner characters for rounded border', () => {
    const c = new Canvas(12, 5);
    drawBox(c, { x: 0, y: 0, width: 12, height: 5, border: 'rounded' });
    assert.equal(c.get(0, 0), '╭');
    assert.equal(c.get(11, 0), '╮');
  });

  it('draws horizontal border segments', () => {
    const c = new Canvas(12, 5);
    drawBox(c, { x: 0, y: 0, width: 12, height: 5, border: 'single' });
    for (let i = 1; i < 11; i++) {
      assert.equal(c.get(i, 0), '─', `top border at col ${i}`);
      assert.equal(c.get(i, 4), '─', `bottom border at col ${i}`);
    }
  });

  it('draws vertical border segments', () => {
    const c = new Canvas(12, 5);
    drawBox(c, { x: 0, y: 0, width: 12, height: 5, border: 'single' });
    for (let row = 1; row < 4; row++) {
      assert.equal(c.get(0, row), '│', `left border at row ${row}`);
      assert.equal(c.get(11, row), '│', `right border at row ${row}`);
    }
  });

  it('renders content centered (children as string)', () => {
    const c = new Canvas(14, 5);
    drawBox(c, { x: 0, y: 0, width: 14, height: 5, border: 'single', children: 'Hello' });
    const row = c.grid[2].join('');
    assert.ok(row.includes('Hello'), 'content should appear in the box');
  });

  it('renders multi-line content (children as string array)', () => {
    const c = new Canvas(14, 6);
    drawBox(c, { x: 0, y: 0, width: 14, height: 6, border: 'single', children: ['Line1', 'Line2'] });
    const text = c.grid.map(r => r.join('')).join('\n');
    assert.ok(text.includes('Line1'));
    assert.ok(text.includes('Line2'));
  });

  it('draws title on top border', () => {
    const c = new Canvas(20, 5);
    drawBox(c, { x: 0, y: 0, width: 20, height: 5, border: 'single', title: 'Title' });
    const topRow = c.grid[0].join('');
    assert.ok(topRow.includes('Title'), 'title should appear on top border');
  });

  it('draws shadow characters when shadow is true', () => {
    const c = new Canvas(16, 7);
    drawBox(c, { x: 0, y: 0, width: 12, height: 5, border: 'single', shadow: true });
    assert.equal(c.get(12, 1), SHADOW_CHAR);
    assert.equal(c.get(13, 1), SHADOW_CHAR);
    assert.equal(c.get(1, 5), SHADOW_CHAR);
  });

  it('does not draw shadow when shadow is false/omitted', () => {
    const c = new Canvas(16, 7);
    drawBox(c, { x: 0, y: 0, width: 12, height: 5, border: 'single' });
    assert.equal(c.get(12, 1), ' ');
    assert.equal(c.get(1, 5), ' ');
  });

  it('draws nested children (children as box array)', () => {
    const c = new Canvas(30, 12);
    drawBox(c, {
      x: 0, y: 0, width: 30, height: 12, border: 'double',
      children: [
        { x: 2, y: 1, width: 12, height: 5, border: 'single', children: 'Inner' },
      ],
    });
    assert.equal(c.get(0, 0), '╔');
    assert.equal(c.get(3, 2), '┌');
  });

  it('defaults to single border for unknown style', () => {
    const c = new Canvas(12, 5);
    drawBox(c, { x: 0, y: 0, width: 12, height: 5, border: 'nonexistent' as any });
    assert.equal(c.get(0, 0), '┌');
  });
});
