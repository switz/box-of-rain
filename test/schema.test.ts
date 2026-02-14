import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DiagramSchema, NodeSchema, ConnectionSchema } from '../src/schema.js';
import { BORDERS, SHADOW_CHAR } from '../src/constants.js';

describe('BORDERS', () => {
  it('has all 4 styles', () => {
    assert.ok(BORDERS.single);
    assert.ok(BORDERS.double);
    assert.ok(BORDERS.bold);
    assert.ok(BORDERS.rounded);
  });

  it('each style has tl/tr/bl/br/h/v keys', () => {
    for (const style of Object.values(BORDERS)) {
      for (const key of ['tl', 'tr', 'bl', 'br', 'h', 'v'] as const) {
        assert.ok(typeof style[key] === 'string', `missing ${key}`);
      }
    }
  });

  it('different styles have distinct characters', () => {
    const tlChars = new Set(Object.values(BORDERS).map(s => s.tl));
    assert.equal(tlChars.size, 4, 'all 4 styles should have unique tl corner');
  });
});

describe('DiagramSchema', () => {
  it('accepts minimal diagram', () => {
    const result = DiagramSchema.parse({});
    assert.ok(result);
  });

  it('accepts children as string (single line text)', () => {
    const result = DiagramSchema.parse({ id: 'a', children: 'hello' });
    assert.equal(result.children, 'hello');
  });

  it('accepts children as string array (multi-line text)', () => {
    const result = DiagramSchema.parse({ id: 'a', children: ['line1', 'line2'] });
    assert.deepEqual(result.children, ['line1', 'line2']);
  });

  it('accepts children as nested boxes', () => {
    const result = DiagramSchema.parse({
      children: [
        { id: 'a', children: 'hello' },
        { id: 'b', children: ['world'] },
      ],
    });
    assert.ok(Array.isArray(result.children));
    assert.equal(result.children!.length, 2);
  });

  it('accepts deeply nested recursive structure', () => {
    const result = DiagramSchema.parse({
      children: [
        {
          id: 'outer',
          children: [
            {
              id: 'inner',
              children: [
                { id: 'leaf', children: 'text' },
              ],
            },
          ],
        },
      ],
    });
    assert.ok(result);
  });

  it('accepts connections at any level', () => {
    const result = DiagramSchema.parse({
      children: [
        { id: 'a', children: 'A' },
        { id: 'b', children: 'B' },
      ],
      connections: [{ from: 'a', to: 'b' }],
    });
    assert.equal(result.connections!.length, 1);
  });

  it('rejects invalid border style', () => {
    assert.throws(() => {
      DiagramSchema.parse({ border: 'invalid' });
    });
  });

  it('rejects invalid connection (missing from)', () => {
    assert.throws(() => {
      ConnectionSchema.parse({ to: 'b' });
    });
  });
});
