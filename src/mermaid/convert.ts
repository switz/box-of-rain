import type { NodeDef, ConnectionDef, BorderStyle, Side } from '../schema.js';
import type { FlowchartAST, FlowchartSubgraph, FlowchartNode, FlowchartEdge, NodeShape, FlowchartDirection } from './flowchart.js';
import type { SequenceAST } from './sequence.js';

const validSides = new Set<string>(['left', 'right', 'top', 'bottom']);

// ── Shape → Border mapping ─────────────────────────────────────────────────

const shapeToBorder: Record<NodeShape, BorderStyle> = {
  rect: 'single',
  rounded: 'rounded',
  stadium: 'rounded',
  subroutine: 'double',
  cylinder: 'double',
  circle: 'bold',
  hexagon: 'bold',
  diamond: 'dashed',
};

// ── Direction → childDirection mapping ─────────────────────────────────────

function directionToChildDirection(dir: FlowchartDirection): 'horizontal' | 'vertical' {
  if (dir === 'LR' || dir === 'RL') return 'horizontal';
  return 'vertical';
}

function isReversed(dir: FlowchartDirection): boolean {
  return dir === 'RL' || dir === 'BT';
}

// ── Flowchart → NodeDef ────────────────────────────────────────────────────

function flowchartNodeToNodeDef(node: FlowchartNode): NodeDef {
  const lines = node.text.split('\n');
  const hasShadow = node.classes?.includes('shadow') ?? false;
  return {
    id: node.id,
    children: lines.length === 1 ? lines[0] : lines,
    border: shapeToBorder[node.shape],
    ...(hasShadow ? { shadow: true } : {}),
  };
}

function getSubgraphNodeIds(sg: FlowchartSubgraph): Set<string> {
  const ids = new Set<string>();
  for (const n of sg.nodes) ids.add(n.id);
  for (const child of sg.subgraphs) {
    for (const id of getSubgraphNodeIds(child)) ids.add(id);
  }
  return ids;
}

function edgeToConnection(edge: FlowchartEdge): ConnectionDef {
  const conn: ConnectionDef = { from: edge.from, to: edge.to };
  if (edge.label) conn.label = edge.label;
  if (edge.fromSide && validSides.has(edge.fromSide)) conn.fromSide = edge.fromSide as Side;
  if (edge.toSide && validSides.has(edge.toSide)) conn.toSide = edge.toSide as Side;
  return conn;
}

function convertSubgraph(
  sg: FlowchartSubgraph,
  direction: FlowchartDirection,
  allEdges: FlowchartEdge[],
): NodeDef {
  const nodeIds = getSubgraphNodeIds(sg);
  const hasShadow = sg.classes?.includes('shadow') ?? false;

  // Convert child nodes
  const children: NodeDef[] = sg.nodes.map(flowchartNodeToNodeDef);

  // Convert nested subgraphs
  for (const childSg of sg.subgraphs) {
    children.push(convertSubgraph(childSg, direction, allEdges));
  }

  // Find intra-subgraph connections (both endpoints in this subgraph)
  const connections: ConnectionDef[] = [];
  for (const edge of allEdges) {
    if (nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
      connections.push(edgeToConnection(edge));
    }
  }

  const reversed = isReversed(direction);

  return {
    id: sg.id,
    title: sg.title,
    border: 'double',
    ...(hasShadow ? { shadow: true } : {}),
    childDirection: directionToChildDirection(direction),
    children: reversed ? children.reverse() : children,
    ...(connections.length > 0 ? { connections } : {}),
  };
}

export function flowchartToNodeDef(ast: FlowchartAST): NodeDef {
  const childDirection = directionToChildDirection(ast.direction);
  const reversed = isReversed(ast.direction);

  // Collect IDs of nodes that belong to subgraphs
  const subgraphNodeIds = new Set<string>();
  for (const sg of ast.subgraphs) {
    for (const id of getSubgraphNodeIds(sg)) {
      subgraphNodeIds.add(id);
    }
  }

  // Collect IDs of nodes in subgraph connections
  const subgraphEdgeSet = new Set<string>();
  function collectSubgraphEdges(sg: FlowchartSubgraph): void {
    const nodeIds = getSubgraphNodeIds(sg);
    for (const edge of ast.edges) {
      if (nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
        subgraphEdgeSet.add(`${edge.from}->${edge.to}`);
      }
    }
    for (const child of sg.subgraphs) collectSubgraphEdges(child);
  }
  for (const sg of ast.subgraphs) collectSubgraphEdges(sg);

  // Top-level nodes (not in any subgraph)
  const topLevelNodes = ast.nodes
    .filter(n => !subgraphNodeIds.has(n.id))
    .map(flowchartNodeToNodeDef);

  // Convert subgraphs
  const subgraphDefs = ast.subgraphs.map(sg =>
    convertSubgraph(sg, ast.direction, ast.edges)
  );

  const children = [...topLevelNodes, ...subgraphDefs];

  // Top-level connections (not fully within any subgraph)
  const connections: ConnectionDef[] = ast.edges
    .filter(e => !subgraphEdgeSet.has(`${e.from}->${e.to}`))
    .map(edgeToConnection);

  return {
    childDirection,
    children: reversed ? children.reverse() : children,
    ...(connections.length > 0 ? { connections } : {}),
  };
}

// ── Sequence → NodeDef ─────────────────────────────────────────────────────

export function sequenceToNodeDef(ast: SequenceAST): NodeDef {
  const children: NodeDef[] = ast.participants.map(p => ({
    id: p.id,
    children: p.alias || p.id,
    border: (p.isActor ? 'rounded' : 'single') as BorderStyle,
  }));

  const connections: ConnectionDef[] = ast.messages.map(m => ({
    from: m.from,
    to: m.to,
    ...(m.label ? { label: m.label } : {}),
  }));

  return {
    childDirection: 'vertical',
    children,
    ...(connections.length > 0 ? { connections } : {}),
  };
}
