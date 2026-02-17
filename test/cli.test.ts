import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CLI = resolve('src/cli.ts');
const FIXTURES = resolve('fixtures');

function run(args: string[], stdin?: string): string {
  return execFileSync('node', ['--import', 'tsx', CLI, ...args], {
    input: stdin,
    encoding: 'utf-8',
    timeout: 10_000,
  });
}

describe('CLI', () => {
  describe('file argument', () => {
    it('renders JSON file', () => {
      const out = run([`${FIXTURES}/example.json`]);
      assert.ok(out.includes('Frontend'));
      assert.ok(out.includes('API Server'));
    });

    it('renders YAML file', () => {
      const out = run([`${FIXTURES}/pipeline.yaml`]);
      assert.ok(out.includes('Build'));
    });

    it('renders Mermaid file', () => {
      const out = run([`${FIXTURES}/example.mmd`]);
      assert.ok(out.includes('─'));
    });
  });

  describe('stdin', () => {
    it('reads JSON from stdin', () => {
      const json = readFileSync(`${FIXTURES}/example.json`, 'utf-8');
      const out = run([], json);
      assert.ok(out.includes('Frontend'));
      assert.ok(out.includes('API Server'));
    });

    it('reads Mermaid from stdin with --mermaid flag', () => {
      const mmd = readFileSync(`${FIXTURES}/example.mmd`, 'utf-8');
      const out = run(['--mermaid'], mmd);
      assert.ok(out.includes('─'));
    });

    it('reads YAML from stdin with --yaml flag', () => {
      const yaml = readFileSync(`${FIXTURES}/pipeline.yaml`, 'utf-8');
      const out = run(['--yaml'], yaml);
      assert.ok(out.includes('Build'));
    });

    it('works with inline echo-style JSON', () => {
      const json = JSON.stringify({
        children: [
          { id: 'a', children: ['Hello'] },
          { id: 'b', children: ['World'] },
        ],
        connections: [{ from: 'a', to: 'b' }],
      });
      const out = run([], json);
      assert.ok(out.includes('Hello'));
      assert.ok(out.includes('World'));
      assert.ok(out.includes('▶'), 'should have arrow');
    });

    it('works with inline Mermaid via stdin', () => {
      const mmd = `flowchart LR
    web([Frontend])
    subgraph platform [Cloud Platform]
      api([API Server])
      db[(Database)]
      api --> db
    end
    web -->|HTTPS| api`;
      const out = run(['--mermaid'], mmd);
      assert.ok(out.includes('Frontend'));
      assert.ok(out.includes('Cloud Platform'));
      assert.ok(out.includes('API Server'));
      assert.ok(out.includes('Database'));
    });
  });

  describe('flags', () => {
    it('--help shows usage', () => {
      const out = run(['--help']);
      assert.ok(out.includes('Usage:'));
      assert.ok(out.includes('Stdin:'));
    });

    it('--example runs without error', () => {
      const out = run(['--example']);
      assert.ok(out.includes('Frontend'));
    });

    it('--svg produces SVG output', () => {
      const json = readFileSync(`${FIXTURES}/example.json`, 'utf-8');
      const out = run(['--svg'], json);
      assert.ok(out.includes('<svg'));
    });
  });
});
