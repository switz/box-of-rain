import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFlowchart } from '../src/mermaid/flowchart.js';
import { parseSequence } from '../src/mermaid/sequence.js';
import { flowchartToNodeDef, sequenceToNodeDef } from '../src/mermaid/convert.js';
import { parseMermaid, renderMermaid } from '../src/mermaid/index.js';
import { render } from '../src/render.js';
import type { NodeDef } from '../src/schema.js';

// ── Flowchart parsing ──────────────────────────────────────────────────────

describe('parseFlowchart', () => {
  it('parses direction', () => {
    const ast = parseFlowchart('flowchart LR\n  A --> B');
    assert.equal(ast.direction, 'LR');
  });

  it('defaults direction to TD', () => {
    const ast = parseFlowchart('flowchart\n  A --> B');
    assert.equal(ast.direction, 'TD');
  });

  it('supports graph keyword', () => {
    const ast = parseFlowchart('graph TD\n  A --> B');
    assert.equal(ast.direction, 'TD');
    assert.equal(ast.edges.length, 1);
  });

  it('parses node shapes', () => {
    const ast = parseFlowchart(`flowchart TD
      A[Rect]
      B(Rounded)
      C([Stadium])
      D[[Subroutine]]
      E((Circle))
      F{Diamond}
      G{{Hexagon}}
    `);
    const nodeMap = new Map(ast.nodes.map(n => [n.id, n]));
    assert.equal(nodeMap.get('A')?.shape, 'rect');
    assert.equal(nodeMap.get('A')?.text, 'Rect');
    assert.equal(nodeMap.get('B')?.shape, 'rounded');
    assert.equal(nodeMap.get('C')?.shape, 'stadium');
    assert.equal(nodeMap.get('D')?.shape, 'subroutine');
    assert.equal(nodeMap.get('E')?.shape, 'circle');
    assert.equal(nodeMap.get('F')?.shape, 'diamond');
    assert.equal(nodeMap.get('G')?.shape, 'hexagon');
  });

  it('parses edges with labels', () => {
    const ast = parseFlowchart(`flowchart TD
      A --> B
      B -->|yes| C
      C -.-> D
      D ==> E
    `);
    assert.equal(ast.edges.length, 4);
    assert.equal(ast.edges[0].from, 'A');
    assert.equal(ast.edges[0].to, 'B');
    assert.equal(ast.edges[0].style, 'solid');
    assert.equal(ast.edges[0].hasArrow, true);

    assert.equal(ast.edges[1].label, 'yes');
    assert.equal(ast.edges[2].style, 'dotted');
    assert.equal(ast.edges[3].style, 'thick');
  });

  it('parses chained edges', () => {
    const ast = parseFlowchart(`flowchart LR
      A --> B --> C
    `);
    assert.equal(ast.edges.length, 2);
    assert.equal(ast.edges[0].from, 'A');
    assert.equal(ast.edges[0].to, 'B');
    assert.equal(ast.edges[1].from, 'B');
    assert.equal(ast.edges[1].to, 'C');
  });

  it('parses edges without arrows', () => {
    const ast = parseFlowchart(`flowchart TD
      A --- B
    `);
    assert.equal(ast.edges[0].hasArrow, false);
    assert.equal(ast.edges[0].style, 'solid');
  });

  it('handles subgraphs', () => {
    const ast = parseFlowchart(`flowchart TD
      subgraph Backend
        A[API]
        B[DB]
        A --> B
      end
      C[Client] --> A
    `);
    assert.equal(ast.subgraphs.length, 1);
    assert.equal(ast.subgraphs[0].title, 'Backend');
    assert.equal(ast.subgraphs[0].nodes.length, 2);
  });

  it('handles nested subgraphs', () => {
    const ast = parseFlowchart(`flowchart TD
      subgraph Outer
        subgraph Inner
          A[Node]
        end
      end
    `);
    assert.equal(ast.subgraphs.length, 1);
    assert.equal(ast.subgraphs[0].subgraphs.length, 1);
    assert.equal(ast.subgraphs[0].subgraphs[0].nodes.length, 1);
  });

  it('handles comments', () => {
    const ast = parseFlowchart(`flowchart TD
      %% This is a comment
      A --> B
    `);
    assert.equal(ast.edges.length, 1);
  });

  it('handles semicolons', () => {
    const ast = parseFlowchart(`flowchart TD
      A[First]; B[Second]
      A --> B
    `);
    assert.equal(ast.nodes.length, 2);
  });

  it('handles quoted text', () => {
    const ast = parseFlowchart(`flowchart TD
      A["Hello World"]
    `);
    assert.equal(ast.nodes[0].text, 'Hello World');
  });

  it('handles <br> line breaks', () => {
    const ast = parseFlowchart(`flowchart TD
      A[Line 1<br>Line 2]
    `);
    assert.equal(ast.nodes[0].text, 'Line 1\nLine 2');
  });

  it('creates implicit nodes from edges', () => {
    const ast = parseFlowchart(`flowchart TD
      A --> B
    `);
    assert.equal(ast.nodes.length, 2);
    assert.equal(ast.nodes[0].id, 'A');
    assert.equal(ast.nodes[0].shape, 'rect'); // default shape
  });
});

// ── Sequence parsing ───────────────────────────────────────────────────────

describe('parseSequence', () => {
  it('parses explicit participants', () => {
    const ast = parseSequence(`sequenceDiagram
      participant A
      participant B
    `);
    assert.equal(ast.participants.length, 2);
    assert.equal(ast.participants[0].id, 'A');
    assert.equal(ast.participants[1].id, 'B');
  });

  it('parses participants with aliases', () => {
    const ast = parseSequence(`sequenceDiagram
      participant A as Alice
      participant B as Bob
    `);
    assert.equal(ast.participants[0].alias, 'Alice');
    assert.equal(ast.participants[1].alias, 'Bob');
  });

  it('parses actors', () => {
    const ast = parseSequence(`sequenceDiagram
      actor U as User
    `);
    assert.equal(ast.participants[0].isActor, true);
    assert.equal(ast.participants[0].alias, 'User');
  });

  it('parses messages', () => {
    const ast = parseSequence(`sequenceDiagram
      A->>B: Hello
      B-->>A: Hi back
    `);
    assert.equal(ast.messages.length, 2);
    assert.equal(ast.messages[0].from, 'A');
    assert.equal(ast.messages[0].to, 'B');
    assert.equal(ast.messages[0].label, 'Hello');
    assert.equal(ast.messages[0].style, 'solid');
    assert.equal(ast.messages[0].arrow, 'head');

    assert.equal(ast.messages[1].style, 'dashed');
    assert.equal(ast.messages[1].label, 'Hi back');
  });

  it('parses cross and open arrows', () => {
    const ast = parseSequence(`sequenceDiagram
      A-xB: Error
      A-)B: Async
    `);
    assert.equal(ast.messages[0].arrow, 'cross');
    assert.equal(ast.messages[1].arrow, 'open');
  });

  it('creates implicit participants from messages', () => {
    const ast = parseSequence(`sequenceDiagram
      Alice->>Bob: Hello
    `);
    assert.equal(ast.participants.length, 2);
    assert.equal(ast.participants[0].id, 'Alice');
    assert.equal(ast.participants[1].id, 'Bob');
  });

  it('handles comments', () => {
    const ast = parseSequence(`sequenceDiagram
      %% comment
      A->>B: Hello
    `);
    assert.equal(ast.messages.length, 1);
  });
});

// ── Flowchart conversion ───────────────────────────────────────────────────

describe('flowchartToNodeDef', () => {
  it('maps shapes to borders', () => {
    const ast = parseFlowchart(`flowchart TD
      A[Rect]
      B(Rounded)
      C[[Sub]]
      D((Circle))
      E{Diamond}
      F{{Hex}}
    `);
    const def = flowchartToNodeDef(ast);
    const children = def.children as NodeDef[];
    assert.equal(children[0].border, 'single');   // rect
    assert.equal(children[1].border, 'rounded');   // rounded
    assert.equal(children[2].border, 'double');    // subroutine
    assert.equal(children[3].border, 'bold');      // circle
    assert.equal(children[4].border, 'dashed');    // diamond
    assert.equal(children[5].border, 'bold');      // hexagon
  });

  it('maps direction to childDirection', () => {
    const lr = flowchartToNodeDef(parseFlowchart('flowchart LR\n  A --> B'));
    assert.equal(lr.childDirection, 'horizontal');

    const td = flowchartToNodeDef(parseFlowchart('flowchart TD\n  A --> B'));
    assert.equal(td.childDirection, 'vertical');
  });

  it('reverses children for RL', () => {
    const def = flowchartToNodeDef(parseFlowchart(`flowchart RL
      A[First]
      B[Second]
    `));
    const children = def.children as NodeDef[];
    assert.equal(children[0].id, 'B');
    assert.equal(children[1].id, 'A');
  });

  it('reverses children for BT', () => {
    const def = flowchartToNodeDef(parseFlowchart(`flowchart BT
      A[First]
      B[Second]
    `));
    const children = def.children as NodeDef[];
    assert.equal(children[0].id, 'B');
    assert.equal(children[1].id, 'A');
  });

  it('creates connections from edges', () => {
    const def = flowchartToNodeDef(parseFlowchart(`flowchart TD
      A -->|label| B
    `));
    assert.equal(def.connections!.length, 1);
    assert.equal(def.connections![0].from, 'A');
    assert.equal(def.connections![0].to, 'B');
    assert.equal(def.connections![0].label, 'label');
  });

  it('converts subgraphs to nested NodeDefs', () => {
    const def = flowchartToNodeDef(parseFlowchart(`flowchart TD
      subgraph Backend
        A[API]
        B[DB]
        A --> B
      end
      C[Client] --> A
    `));
    const children = def.children as NodeDef[];
    // C is top-level, Backend subgraph is also top-level
    assert.ok(children.some(c => c.id === 'C'));
    const sg = children.find(c => c.id === 'Backend');
    assert.ok(sg);
    assert.equal(sg!.border, 'double');
    assert.equal(sg!.title, 'Backend');

    // Intra-subgraph connection (A --> B) should be on subgraph
    assert.ok(sg!.connections);
    assert.equal(sg!.connections!.length, 1);
    assert.equal(sg!.connections![0].from, 'A');
    assert.equal(sg!.connections![0].to, 'B');

    // Cross-subgraph connection (C --> A) should be top-level
    assert.ok(def.connections);
    assert.ok(def.connections!.some(c => c.from === 'C' && c.to === 'A'));
  });

  it('handles multi-line text from <br>', () => {
    const def = flowchartToNodeDef(parseFlowchart(`flowchart TD
      A[Line 1<br>Line 2]
    `));
    const children = def.children as NodeDef[];
    assert.deepEqual(children[0].children, ['Line 1', 'Line 2']);
  });
});

// ── Sequence conversion ────────────────────────────────────────────────────

describe('sequenceToNodeDef', () => {
  it('creates vertical layout with participant boxes', () => {
    const ast = parseSequence(`sequenceDiagram
      participant A as Alice
      participant B as Bob
      A->>B: Hello
    `);
    const def = sequenceToNodeDef(ast);
    assert.equal(def.childDirection, 'vertical');
    const children = def.children as NodeDef[];
    assert.equal(children.length, 2);
    assert.equal(children[0].id, 'A');
    assert.equal(children[0].children, 'Alice');
    assert.equal(children[0].border, 'single');
  });

  it('uses rounded border for actors', () => {
    const ast = parseSequence(`sequenceDiagram
      actor U as User
    `);
    const def = sequenceToNodeDef(ast);
    const children = def.children as NodeDef[];
    assert.equal(children[0].border, 'rounded');
  });

  it('creates connections from messages', () => {
    const ast = parseSequence(`sequenceDiagram
      A->>B: Hello
      B-->>A: World
    `);
    const def = sequenceToNodeDef(ast);
    assert.equal(def.connections!.length, 2);
    assert.equal(def.connections![0].from, 'A');
    assert.equal(def.connections![0].to, 'B');
    assert.equal(def.connections![0].label, 'Hello');
  });
});

// ── parseMermaid auto-detection ────────────────────────────────────────────

describe('parseMermaid', () => {
  it('detects flowchart', () => {
    const def = parseMermaid('flowchart LR\n  A --> B');
    assert.equal(def.childDirection, 'horizontal');
  });

  it('detects graph keyword', () => {
    const def = parseMermaid('graph TD\n  A --> B');
    assert.equal(def.childDirection, 'vertical');
  });

  it('detects sequence diagram', () => {
    const def = parseMermaid('sequenceDiagram\n  A->>B: Hello');
    assert.equal(def.childDirection, 'vertical');
  });

  it('throws on unsupported type', () => {
    assert.throws(() => parseMermaid('pie\n  "A": 50'), /Unsupported diagram type/);
  });

  it('throws on empty input', () => {
    assert.throws(() => parseMermaid(''), /Empty mermaid diagram/);
  });

  it('ignores leading comments', () => {
    const def = parseMermaid('%% comment\nflowchart LR\n  A --> B');
    assert.equal(def.childDirection, 'horizontal');
  });
});

// ── Integration: renderMermaid ─────────────────────────────────────────────

describe('renderMermaid', () => {
  it('renders a flowchart end-to-end', () => {
    const output = renderMermaid(`flowchart LR
      A[Frontend] --> B[Backend]
      B --> C[Database]
    `);
    assert.ok(typeof output === 'string');
    assert.ok(output.length > 0);
    // Should contain the text from nodes
    assert.ok(output.includes('Frontend'));
    assert.ok(output.includes('Backend'));
    assert.ok(output.includes('Database'));
  });

  it('renders a sequence diagram end-to-end', () => {
    const output = renderMermaid(`sequenceDiagram
      participant A as Alice
      participant B as Bob
      A->>B: Hello
      B-->>A: Hi
    `);
    assert.ok(typeof output === 'string');
    assert.ok(output.includes('Alice'));
    assert.ok(output.includes('Bob'));
  });

  it('renders subgraphs', () => {
    const output = renderMermaid(`flowchart TD
      subgraph Cloud
        A[Service]
        B[DB]
        A --> B
      end
      C[Client] --> A
    `);
    assert.ok(output.includes('Service'));
    assert.ok(output.includes('DB'));
    assert.ok(output.includes('Client'));
    assert.ok(output.includes('Cloud'));
  });
});

// ── Parity: same diagram in JSON and Mermaid produce identical output ──────

describe('mermaid/json parity', () => {
  it('simple horizontal flowchart', () => {
    const json: NodeDef = {
      childDirection: 'horizontal',
      children: [
        { id: 'A', children: 'Frontend', border: 'single' },
        { id: 'B', children: 'Backend', border: 'single' },
      ],
      connections: [{ from: 'A', to: 'B' }],
    };
    const mermaid = `flowchart LR
      A[Frontend] --> B[Backend]
    `;
    assert.equal(renderMermaid(mermaid), render(json));
  });

  it('vertical flowchart with three nodes and labels', () => {
    const json: NodeDef = {
      childDirection: 'vertical',
      children: [
        { id: 'A', children: 'Client', border: 'single' },
        { id: 'B', children: 'API', border: 'single' },
        { id: 'C', children: 'DB', border: 'single' },
      ],
      connections: [
        { from: 'A', to: 'B', label: 'HTTP' },
        { from: 'B', to: 'C', label: 'SQL' },
      ],
    };
    const mermaid = `flowchart TD
      A[Client] -->|HTTP| B[API]
      B -->|SQL| C[DB]
    `;
    assert.equal(renderMermaid(mermaid), render(json));
  });

  it('chained edges match equivalent separate edges', () => {
    const json: NodeDef = {
      childDirection: 'horizontal',
      children: [
        { id: 'A', children: 'A', border: 'single' },
        { id: 'B', children: 'B', border: 'single' },
        { id: 'C', children: 'C', border: 'single' },
      ],
      connections: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
      ],
    };
    const mermaid = `flowchart LR
      A[A] --> B[B] --> C[C]
    `;
    assert.equal(renderMermaid(mermaid), render(json));
  });

  it('mixed border styles from shapes', () => {
    const json: NodeDef = {
      childDirection: 'horizontal',
      children: [
        { id: 'A', children: 'Rect', border: 'single' },
        { id: 'B', children: 'Round', border: 'rounded' },
        { id: 'C', children: 'Sub', border: 'double' },
        { id: 'D', children: 'Circ', border: 'bold' },
        { id: 'E', children: 'Dia', border: 'dashed' },
      ],
      connections: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'D' },
        { from: 'D', to: 'E' },
      ],
    };
    const mermaid = `flowchart LR
      A[Rect] --> B(Round) --> C[[Sub]] --> D((Circ)) --> E{Dia}
    `;
    assert.equal(renderMermaid(mermaid), render(json));
  });

  it('subgraph with intra and cross connections', () => {
    const json: NodeDef = {
      childDirection: 'vertical',
      children: [
        {
          id: 'Backend',
          title: 'Backend',
          border: 'double',
          childDirection: 'vertical',
          children: [
            { id: 'API', children: 'API', border: 'single' },
            { id: 'DB', children: 'DB', border: 'single' },
          ],
          connections: [{ from: 'API', to: 'DB' }],
        },
        { id: 'Client', children: 'Client', border: 'single' },
      ],
      connections: [{ from: 'Client', to: 'API' }],
    };
    const mermaid = `flowchart TD
      subgraph Backend
        API[API] --> DB[DB]
      end
      Client[Client] --> API
    `;
    assert.equal(renderMermaid(mermaid), render(json));
  });

  it('reversed (RL) flowchart', () => {
    const json: NodeDef = {
      childDirection: 'horizontal',
      children: [
        { id: 'B', children: 'End', border: 'single' },
        { id: 'A', children: 'Start', border: 'single' },
      ],
      connections: [{ from: 'A', to: 'B' }],
    };
    const mermaid = `flowchart RL
      A[Start] --> B[End]
    `;
    assert.equal(renderMermaid(mermaid), render(json));
  });

  it('sequence diagram with participants and messages', () => {
    const json: NodeDef = {
      childDirection: 'vertical',
      children: [
        { id: 'A', children: 'Alice', border: 'single' },
        { id: 'B', children: 'Bob', border: 'single' },
      ],
      connections: [
        { from: 'A', to: 'B', label: 'Hello' },
        { from: 'B', to: 'A', label: 'Hi' },
      ],
    };
    const mermaid = `sequenceDiagram
      participant A as Alice
      participant B as Bob
      A->>B: Hello
      B-->>A: Hi
    `;
    assert.equal(renderMermaid(mermaid), render(json));
  });

  it('multi-line text via br tags', () => {
    const json: NodeDef = {
      childDirection: 'vertical',
      children: [
        { id: 'A', children: ['Line 1', 'Line 2'], border: 'single' },
      ],
    };
    const mermaid = `flowchart TD
      A[Line 1<br>Line 2]
    `;
    assert.equal(renderMermaid(mermaid), render(json));
  });
});
