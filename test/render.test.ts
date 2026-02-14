import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../src/render.js';
import type { NodeDef } from '../src/schema.js';

describe('render integration', () => {
  it('renders a single box', () => {
    const output = render({
      children: [{ id: 'a', children: ['Hello'], border: 'single' }],
    });
    assert.ok(output.includes('┌'));
    assert.ok(output.includes('Hello'));
    assert.ok(output.includes('┘'));
  });

  it('renders connected boxes with arrow', () => {
    const output = render({
      children: [
        { id: 'a', children: ['From'], border: 'single' },
        { id: 'b', children: ['To'], border: 'single' },
      ],
      connections: [{ from: 'a', to: 'b' }],
    });
    assert.ok(output.includes('▶'), 'should have arrow head');
    assert.ok(output.includes('─'), 'should have arrow line');
  });

  it('renders built-in example without error', () => {
    const output = render({
      children: [
        { id: 'fe', children: ['Frontend'], border: 'rounded' },
        { id: 'api', children: ['API Server'], border: 'bold', shadow: true },
        { id: 'db', children: ['Database'], border: 'double' },
        { id: 'cache', children: ['Cache'], border: 'rounded' },
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
      children: [
        { id: 'a', children: ['S'], border: 'single' },
        { id: 'b', children: ['D'], border: 'double' },
        { id: 'c', children: ['B'], border: 'bold' },
        { id: 'd', children: ['R'], border: 'rounded' },
      ],
    });
    assert.ok(output.includes('┌'), 'single');
    assert.ok(output.includes('╔'), 'double');
    assert.ok(output.includes('┏'), 'bold');
    assert.ok(output.includes('╭'), 'rounded');
  });

  it('renders nested boxes with cross-level connections', () => {
    const output = render({
      children: [
        {
          id: 'outer', border: 'double', title: 'Outer',
          children: [{ id: 'inner', children: ['Inside'], border: 'single' }],
        },
        { id: 'standalone', children: ['Outside'], border: 'rounded' },
      ],
      connections: [{ from: 'standalone', to: 'inner' }],
    });
    assert.ok(output.includes('Outer'), 'parent title');
    assert.ok(output.includes('Inside'), 'nested content');
    assert.ok(output.includes('Outside'), 'standalone content');
    assert.ok(output.includes('▶'), 'cross-level arrow');
  });

  it('produces deterministic output', () => {
    const diagram: NodeDef = {
      children: [
        { id: 'a', children: ['X'] },
        { id: 'b', children: ['Y'] },
      ],
      connections: [{ from: 'a', to: 'b' }],
    };
    const out1 = render(diagram);
    const out2 = render(diagram);
    assert.equal(out1, out2);
  });

  it('renders microservices-style example', () => {
    const diagram: NodeDef = {
      children: [
        { id: 'user', children: ['User'], border: 'rounded' },
        {
          id: 'cloud', border: 'double', shadow: true, title: 'Cloud Platform',
          children: [
            { id: 'gateway', children: ['API', 'Gateway'], border: 'bold' },
            { id: 'auth', children: ['Auth', 'Service'] },
            { id: 'orders', children: ['Orders', 'Service'] },
            { id: 'db', children: ['Database'], border: 'bold' },
          ],
          connections: [
            { from: 'gateway', to: 'auth' },
            { from: 'gateway', to: 'orders' },
            { from: 'orders', to: 'db' },
          ],
        },
      ],
      connections: [
        { from: 'user', to: 'cloud', label: 'HTTPS' },
      ],
    };
    const output = render(diagram);
    assert.ok(output.includes('User'));
    assert.ok(output.includes('Cloud Platform'));
    assert.ok(output.includes('API'));
    assert.ok(output.includes('Gateway'));
    assert.ok(output.includes('Database'));
  });

  it('renders pipeline-style example', () => {
    const diagram: NodeDef = {
      children: [
        { id: 'repo', children: ['GitHub', 'Repo'], border: 'rounded' },
        {
          id: 'ci', title: 'CI Pipeline', border: 'double', shadow: true,
          childDirection: 'vertical',
          children: [
            { id: 'build', children: ['Build'], border: 'bold' },
            { id: 'test', children: ['Test'] },
            { id: 'deploy', children: ['Deploy'] },
          ],
          connections: [
            { from: 'build', to: 'test' },
            { from: 'test', to: 'deploy' },
          ],
        },
        { id: 'prod', children: ['Production'], border: 'double' },
      ],
      connections: [
        { from: 'repo', to: 'ci', label: 'push' },
        { from: 'ci', to: 'prod', label: 'ship' },
      ],
    };
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

  it('renders children as text string', () => {
    const output = render({
      children: [{ id: 'a', children: 'Hello World' }],
    });
    assert.ok(output.includes('Hello World'));
  });

  it('validates input with Zod', () => {
    assert.throws(() => {
      render({ border: 'nonexistent' as any });
    });
  });
});
