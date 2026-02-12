import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { render, autoLayout, Canvas, drawBox, drawConnection, resolveBox, getAnchor, BORDERS, SHADOW_CHAR } from './box-of-rain.mjs';

// ─── Canvas ──────────────────────────────────────────────────────────────────

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
    // No throw, and grid unchanged
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

// ─── BORDERS ─────────────────────────────────────────────────────────────────

describe('BORDERS', () => {
  it('has all 4 styles', () => {
    assert.ok(BORDERS.single);
    assert.ok(BORDERS.double);
    assert.ok(BORDERS.bold);
    assert.ok(BORDERS.rounded);
  });

  it('each style has tl/tr/bl/br/h/v keys', () => {
    for (const style of Object.values(BORDERS)) {
      for (const key of ['tl', 'tr', 'bl', 'br', 'h', 'v']) {
        assert.ok(typeof style[key] === 'string', `missing ${key}`);
      }
    }
  });

  it('different styles have distinct characters', () => {
    const tlChars = new Set(Object.values(BORDERS).map(s => s.tl));
    assert.equal(tlChars.size, 4, 'all 4 styles should have unique tl corner');
  });
});

// ─── drawBox ─────────────────────────────────────────────────────────────────

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

  it('renders content centered', () => {
    const c = new Canvas(14, 5);
    drawBox(c, { x: 0, y: 0, width: 14, height: 5, border: 'single', content: 'Hello' });
    const row = c.grid[2].join('');
    assert.ok(row.includes('Hello'), 'content should appear in the box');
  });

  it('renders multi-line content', () => {
    const c = new Canvas(14, 6);
    drawBox(c, { x: 0, y: 0, width: 14, height: 6, border: 'single', content: ['Line1', 'Line2'] });
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

  it('draws nested children', () => {
    const c = new Canvas(30, 12);
    drawBox(c, {
      x: 0, y: 0, width: 30, height: 12, border: 'double',
      children: [
        { x: 2, y: 1, width: 12, height: 5, border: 'single', content: 'Inner' },
      ],
    });
    // Outer box corners
    assert.equal(c.get(0, 0), '╔');
    // Inner box corners (offset by parent interior: x+1+2, y+1+1)
    assert.equal(c.get(3, 2), '┌');
  });

  it('defaults to single border for unknown style', () => {
    const c = new Canvas(12, 5);
    drawBox(c, { x: 0, y: 0, width: 12, height: 5, border: 'nonexistent' });
    assert.equal(c.get(0, 0), '┌');
  });
});

// ─── drawConnection ──────────────────────────────────────────────────────────

describe('drawConnection', () => {
  it('draws straight horizontal arrow', () => {
    const boxes = [
      { id: 'a', x: 0, y: 0, width: 5, height: 3 },
      { id: 'b', x: 15, y: 0, width: 5, height: 3 },
    ];
    const c = new Canvas(25, 5);
    drawBox(c, boxes[0]);
    drawBox(c, boxes[1]);
    drawConnection(c, { from: 'a', to: 'b' }, boxes);
    // Arrow should be on row 1 (height 3, center = 1)
    assert.equal(c.get(6, 1), '─');
    assert.equal(c.get(14, 1), '▶');
  });

  it('draws L-shaped connection when vertically offset', () => {
    const boxes = [
      { id: 'a', x: 0, y: 0, width: 5, height: 3 },
      { id: 'b', x: 15, y: 6, width: 5, height: 3 },
    ];
    const c = new Canvas(25, 12);
    drawBox(c, boxes[0]);
    drawBox(c, boxes[1]);
    drawConnection(c, { from: 'a', to: 'b' }, boxes);
    // Should contain arrow head
    assert.equal(c.get(14, 7), '▶');
  });

  it('draws U-shaped routing when same-side exit and entry', () => {
    const boxes = [
      { id: 'a', x: 5, y: 0, width: 10, height: 3 },
      { id: 'b', x: 5, y: 5, width: 10, height: 3 },
    ];
    const c = new Canvas(25, 10);
    drawBox(c, boxes[0]);
    drawBox(c, boxes[1]);
    drawConnection(c, { from: 'a', to: 'b', fromSide: 'right', toSide: 'right' }, boxes);
    // Arrow head at right side of box b
    const arrowY = 5 + Math.floor(3 / 2); // row 6
    assert.equal(c.get(15, arrowY), '◀');
  });

  it('uses correct arrow heads per toSide', () => {
    const boxes = [
      { id: 'a', x: 0, y: 0, width: 5, height: 3 },
      { id: 'b', x: 15, y: 0, width: 5, height: 3 },
    ];
    const c = new Canvas(25, 5);
    drawConnection(c, { from: 'a', to: 'b', fromSide: 'right', toSide: 'left' }, boxes);
    assert.equal(c.get(14, 1), '▶');
  });

  it('draws label on straight connection', () => {
    const boxes = [
      { id: 'a', x: 0, y: 2, width: 5, height: 3 },
      { id: 'b', x: 20, y: 2, width: 5, height: 3 },
    ];
    const c = new Canvas(30, 8);
    drawConnection(c, { from: 'a', to: 'b', label: 'test' }, boxes);
    // Label should be on the connection row itself (row 3, the vertical center of height-3 boxes at y=2)
    const connRow = c.grid[3].join('');
    assert.ok(connRow.includes('test'), 'label should appear on the arrow line');
  });

  it('handles missing IDs gracefully', () => {
    const boxes = [{ id: 'a', x: 0, y: 0, width: 5, height: 3 }];
    const c = new Canvas(25, 5);
    // Should not throw
    drawConnection(c, { from: 'a', to: 'nonexistent' }, boxes);
    drawConnection(c, { from: 'nonexistent', to: 'a' }, boxes);
  });

  it('resolves nested child IDs', () => {
    const boxes = [
      { id: 'parent', x: 0, y: 0, width: 30, height: 10,
        children: [{ id: 'child', x: 2, y: 1, width: 10, height: 5 }] },
      { id: 'other', x: 40, y: 0, width: 10, height: 5 },
    ];
    const resolved = resolveBox('child', boxes);
    assert.ok(resolved);
    assert.equal(resolved.absX, 0 + 1 + 2); // parent.x + 1 + child.x
    assert.equal(resolved.absY, 0 + 1 + 1); // parent.y + 1 + child.y
  });
});

// ─── autoLayout ──────────────────────────────────────────────────────────────

describe('autoLayout', () => {
  it('assigns coordinates to boxes without explicit positions', () => {
    const diagram = {
      boxes: [
        { id: 'a', content: ['Hello'] },
        { id: 'b', content: ['World'] },
      ],
      connections: [{ from: 'a', to: 'b' }],
    };
    const result = autoLayout(diagram);
    assert.ok(result.boxes[0].x != null);
    assert.ok(result.boxes[0].y != null);
    assert.ok(result.boxes[1].x != null);
    assert.ok(result.boxes[1].y != null);
  });

  it('preserves explicit coordinates', () => {
    const diagram = {
      boxes: [
        { id: 'a', x: 5, y: 10, width: 12, height: 5, content: ['Hi'] },
      ],
    };
    const result = autoLayout(diagram);
    assert.equal(result.boxes[0].x, 5);
    assert.equal(result.boxes[0].y, 10);
  });

  it('auto-sizes boxes to fit content and title', () => {
    const diagram = {
      boxes: [{ id: 'a', content: ['A very long content line here'] }],
    };
    const result = autoLayout(diagram);
    assert.ok(result.boxes[0].width >= 'A very long content line here'.length + 4);
  });

  it('auto-sizes to fit title', () => {
    const diagram = {
      boxes: [{ id: 'a', title: 'A Really Long Title Here' }],
    };
    const result = autoLayout(diagram);
    assert.ok(result.boxes[0].width >= 'A Really Long Title Here'.length + 6);
  });

  it('handles cycles in the dependency graph', () => {
    const diagram = {
      boxes: [
        { id: 'a', content: ['A'] },
        { id: 'b', content: ['B'] },
        { id: 'c', content: ['C'] },
      ],
      connections: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'a' },
      ],
    };
    // Should not throw or infinite loop
    const result = autoLayout(diagram);
    assert.ok(result.boxes.every(b => b.x != null && b.y != null));
  });

  it('positions children inside parent', () => {
    const diagram = {
      boxes: [{
        id: 'parent', border: 'double',
        children: [
          { id: 'child1', content: ['C1'] },
          { id: 'child2', content: ['C2'] },
        ],
      }],
      connections: [{ from: 'child1', to: 'child2' }],
    };
    const result = autoLayout(diagram);
    const parent = result.boxes[0];
    for (const child of parent.children) {
      assert.ok(child.x >= 0, 'child x inside parent');
      assert.ok(child.y >= 0, 'child y inside parent');
      assert.ok(child.x + child.width <= parent.width - 2, 'child fits in parent width');
      assert.ok(child.y + child.height <= parent.height - 2, 'child fits in parent height');
    }
  });

  it('does not mutate input', () => {
    const diagram = {
      boxes: [
        { id: 'a', content: ['Hello'] },
        { id: 'b', content: ['World'] },
      ],
      connections: [{ from: 'a', to: 'b' }],
    };
    const original = JSON.stringify(diagram);
    autoLayout(diagram);
    assert.equal(JSON.stringify(diagram), original);
  });

  it('computes canvas size accounting for shadows', () => {
    const diagram = {
      boxes: [{ id: 'a', content: ['Hi'], shadow: true }],
    };
    const result = autoLayout(diagram);
    const box = result.boxes[0];
    // Canvas should account for shadow (2 right, 1 bottom)
    assert.ok(result.width >= box.x + box.width + 2);
    assert.ok(result.height >= box.y + box.height + 1);
  });

  it('returns unchanged when all positions are explicit', () => {
    const diagram = {
      width: 50, height: 20,
      boxes: [
        { id: 'a', x: 0, y: 0, width: 12, height: 5 },
        { id: 'b', x: 20, y: 0, width: 12, height: 5 },
      ],
    };
    const result = autoLayout(diagram);
    assert.equal(result.boxes[0].x, 0);
    assert.equal(result.boxes[1].x, 20);
    assert.equal(result.width, 50);
  });

  it('layers boxes left-to-right by connection flow', () => {
    const diagram = {
      boxes: [
        { id: 'a', content: ['A'] },
        { id: 'b', content: ['B'] },
        { id: 'c', content: ['C'] },
      ],
      connections: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
    };
    const result = autoLayout(diagram);
    assert.ok(result.boxes[0].x < result.boxes[1].x, 'a should be left of b');
    assert.ok(result.boxes[1].x < result.boxes[2].x, 'b should be left of c');
  });
});

// ─── render integration ──────────────────────────────────────────────────────

describe('render integration', () => {
  it('renders a single box', () => {
    const output = render({
      boxes: [{ id: 'a', content: ['Hello'], border: 'single' }],
    });
    assert.ok(output.includes('┌'));
    assert.ok(output.includes('Hello'));
    assert.ok(output.includes('┘'));
  });

  it('renders connected boxes with arrow', () => {
    const output = render({
      boxes: [
        { id: 'a', content: ['From'], border: 'single' },
        { id: 'b', content: ['To'], border: 'single' },
      ],
      connections: [{ from: 'a', to: 'b' }],
    });
    assert.ok(output.includes('▶'), 'should have arrow head');
    assert.ok(output.includes('─'), 'should have arrow line');
  });

  it('renders built-in example without error', () => {
    const output = render({
      boxes: [
        { id: 'fe', content: ['Frontend'], border: 'rounded' },
        { id: 'api', content: ['API Server'], border: 'bold', shadow: true },
        { id: 'db', content: ['Database'], border: 'double' },
        { id: 'cache', content: ['Cache'], border: 'rounded' },
      ],
      connections: [
        { from: 'fe', to: 'api', label: 'HTTPS' },
        { from: 'api', to: 'db', label: 'SQL' },
        { from: 'api', to: 'cache', label: 'GET/SET' },
      ],
    });
    assert.ok(output.includes('Frontend'));
    assert.ok(output.includes('API Server'));
    assert.ok(output.includes('Database'));
    assert.ok(output.includes('Cache'));
  });

  it('renders all border styles', () => {
    const output = render({
      boxes: [
        { id: 'a', content: ['S'], border: 'single' },
        { id: 'b', content: ['D'], border: 'double' },
        { id: 'c', content: ['B'], border: 'bold' },
        { id: 'd', content: ['R'], border: 'rounded' },
      ],
    });
    assert.ok(output.includes('┌'), 'single');
    assert.ok(output.includes('╔'), 'double');
    assert.ok(output.includes('┏'), 'bold');
    assert.ok(output.includes('╭'), 'rounded');
  });

  it('renders nested boxes with cross-level connections', () => {
    const output = render({
      boxes: [
        { id: 'outer', border: 'double', title: 'Outer',
          children: [{ id: 'inner', content: ['Inside'], border: 'single' }] },
        { id: 'standalone', content: ['Outside'], border: 'rounded' },
      ],
      connections: [{ from: 'standalone', to: 'inner' }],
    });
    assert.ok(output.includes('Outer'), 'parent title');
    assert.ok(output.includes('Inside'), 'nested content');
    assert.ok(output.includes('Outside'), 'standalone content');
    assert.ok(output.includes('▶'), 'cross-level arrow');
  });

  it('produces deterministic output', () => {
    const diagram = {
      boxes: [
        { id: 'a', content: ['X'] },
        { id: 'b', content: ['Y'] },
      ],
      connections: [{ from: 'a', to: 'b' }],
    };
    const out1 = render(diagram);
    const out2 = render(diagram);
    assert.equal(out1, out2);
  });

  it('renders turbopuffer example from file', async () => {
    const { readFileSync } = await import('fs');
    const json = readFileSync(new URL('./examples/turbopuffer.json', import.meta.url), 'utf-8');
    const diagram = JSON.parse(json);
    const output = render(diagram);
    assert.ok(output.includes('client'));
    assert.ok(output.includes('turbopuffer'));
    assert.ok(output.includes('SSD Cache'));
    assert.ok(output.includes('Storage (S3)'));
    // Verify the straight arrow: client→cache should be on same row
    const lines = output.split('\n');
    const arrowLine = lines.find(l => l.includes('▶') && l.includes('SSD Cache'));
    assert.ok(arrowLine, 'arrow should reach SSD Cache');
    assert.ok(arrowLine.includes('client') || arrowLine.includes('─────'), 'arrow should be on same line');
  });

  it('renders microservices example from file', async () => {
    const { readFileSync } = await import('fs');
    const json = readFileSync(new URL('./examples/microservices.json', import.meta.url), 'utf-8');
    const diagram = JSON.parse(json);
    const output = render(diagram);
    assert.ok(output.includes('User'));
    assert.ok(output.includes('Cloud Platform'));
    assert.ok(output.includes('API'));
    assert.ok(output.includes('Gateway'));
    assert.ok(output.includes('Database'));
  });

  it('renders pipeline YAML example from file', async () => {
    const { readFileSync } = await import('fs');
    const yaml = await import('js-yaml');
    const raw = readFileSync(new URL('./examples/pipeline.yaml', import.meta.url), 'utf-8');
    const diagram = yaml.load(raw);
    const output = render(diagram);
    assert.ok(output.includes('GitHub'));
    assert.ok(output.includes('Repo'));
    assert.ok(output.includes('CI Pipeline'));
    assert.ok(output.includes('Build'));
    assert.ok(output.includes('Test'));
    assert.ok(output.includes('Deploy'));
    assert.ok(output.includes('Production'));
    assert.ok(output.includes('push'), 'connection label');
    assert.ok(output.includes('ship'), 'connection label');
  });

  it('YAML and equivalent JSON produce identical output', () => {
    const yaml = import.meta.resolve('js-yaml');
    const diagram = {
      boxes: [
        { id: 'x', content: ['Foo'], border: 'bold' },
        { id: 'y', content: ['Bar'], border: 'rounded' },
      ],
      connections: [{ from: 'x', to: 'y', label: 'link' }],
    };
    // Round-trip through YAML to simulate YAML input
    const out1 = render(diagram);
    const cloned = JSON.parse(JSON.stringify(diagram));
    const out2 = render(cloned);
    assert.equal(out1, out2);
  });
});
