import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import yaml from 'js-yaml';
import { render, renderSvg } from './render.js';
import type { NodeDef } from './schema.js';
import { parseMermaid } from './mermaid/index.js';

function printUsage(): void {
  console.log(`
box-of-rain - Generate beautiful ASCII box diagrams

Usage:
  box-of-rain <diagram.json|diagram.yaml>
  box-of-rain <diagram.mmd|diagram.mermaid>        # Mermaid input
  box-of-rain --mermaid <file>                      # Force mermaid parsing
  box-of-rain --svg <diagram.json|diagram.yaml>    # SVG output
  box-of-rain --example

Diagram JSON format (positions and sizes are optional — auto-layout fills them in):
{
  "children": [
    {
      "id": "mybox",
      "children": ["Line 1", "Line 2"],
      "border": "double",
      "shadow": true,
      "title": "My Title"
    }
  ],
  "connections": [
    { "from": "box1", "to": "box2", "label": "API" }
  ]
}

children can be:
  - a string: single line of text
  - an array of strings: multi-line text
  - an array of objects: nested child boxes (recursive)

You can also specify explicit positions: x, y, width, height on each box,
and width/height on the top-level diagram. If omitted, auto-layout computes them.
`);
}

function runExample(): void {
  const diagram: NodeDef = {
    children: [
      {
        id: 'fe',
        children: ['Frontend'],
        border: 'rounded',
      },
      {
        id: 'api',
        children: ['API Server'],
        border: 'bold',
        shadow: true,
      },
      {
        id: 'db',
        children: ['Database'],
        border: 'double',
      },
      {
        id: 'cache',
        children: ['Cache'],
        border: 'rounded',
      },
    ],
    connections: [
      { from: 'fe', to: 'api', label: 'HTTPS' },
      { from: 'api', to: 'db', label: 'SQL' },
      { from: 'api', to: 'cache', label: 'GET/SET' },
    ],
  };

  console.log(render(diagram));
}

function migrate(input: Record<string, unknown>): NodeDef {
  // Support old format: { boxes: [...], connections: [...] }
  if ('boxes' in input && !('children' in input)) {
    const { boxes, ...rest } = input;
    return { ...rest, children: boxes } as NodeDef;
  }
  // Support old format: { content: [...] } on nodes
  return migrateNode(input as NodeDef);
}

function migrateNode(node: NodeDef): NodeDef {
  const result = { ...node };
  // Migrate content → children (if children not already set)
  if ('content' in (result as Record<string, unknown>) && result.children == null) {
    (result as NodeDef).children = (result as Record<string, unknown>).content as string | string[];
    delete (result as Record<string, unknown>).content;
  }
  // Migrate boxes → children in nested nodes
  if ('boxes' in (result as Record<string, unknown>) && result.children == null) {
    (result as NodeDef).children = (result as Record<string, unknown>).boxes as NodeDef[];
    delete (result as Record<string, unknown>).boxes;
  }
  // Recursively migrate child boxes
  if (Array.isArray(result.children)) {
    result.children = result.children.map(child => {
      if (typeof child === 'object' && child !== null) {
        return migrateNode(child);
      }
      return child;
    });
  }
  return result;
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
    console.log(pkg.version);
    process.exit(0);
  }

  if (args.includes('--example')) {
    runExample();
    process.exit(0);
  }

  const svg = args.includes('--svg');
  const mermaidFlag = args.includes('--mermaid');
  const fileArgs = args.filter(a => !a.startsWith('--'));
  const filePath = resolve(fileArgs[0]);
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const ext = extname(filePath).toLowerCase();
    const isMermaid = mermaidFlag || ext === '.mmd' || ext === '.mermaid';
    let diagram: NodeDef;
    if (isMermaid) {
      diagram = parseMermaid(raw);
    } else {
      const parsed = (ext === '.yaml' || ext === '.yml')
        ? yaml.load(raw)
        : JSON.parse(raw);
      diagram = migrate(parsed as Record<string, unknown>);
    }
    const text = render(diagram);
    console.log(svg ? renderSvg(text) : text);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
