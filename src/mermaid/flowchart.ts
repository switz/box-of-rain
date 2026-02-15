import { Lexer, CstParser, type IToken, type CstNode } from 'chevrotain';
import {
  flowchartTokens,
  FlowchartKeyword, Direction, SubgraphKeyword, EndKeyword,
  Arrow, DottedArrow, ThickArrow, Line, DottedLine, ThickLine,
  PipeLabel, InlineLabel,
  DoubleSquareOpen, DoubleSquareClose,
  StadiumOpen, StadiumClose,
  CylinderOpen, CylinderClose,
  DoubleCircleOpen, DoubleCircleClose,
  HexOpen, HexClose,
  DiamondOpen, DiamondClose,
  SquareOpen, SquareClose,
  RoundOpen, RoundClose,
  QuotedString, Identifier,
  Newline, Semicolon,
} from './tokens.js';

// ── AST types ──────────────────────────────────────────────────────────────

export type FlowchartDirection = 'LR' | 'RL' | 'TD' | 'TB' | 'BT';
export type NodeShape = 'rect' | 'rounded' | 'stadium' | 'subroutine' | 'cylinder' | 'circle' | 'diamond' | 'hexagon';
export type EdgeStyle = 'solid' | 'dotted' | 'thick';

export interface FlowchartNode {
  id: string;
  text: string;
  shape: NodeShape;
  classes?: string[];
}

export interface FlowchartEdge {
  from: string;
  to: string;
  label?: string;
  style: EdgeStyle;
  hasArrow: boolean;
  fromSide?: string;
  toSide?: string;
}

export interface FlowchartSubgraph {
  id: string;
  title?: string;
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
  subgraphs: FlowchartSubgraph[];
  classes?: string[];
}

export interface FlowchartAST {
  direction: FlowchartDirection;
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
  subgraphs: FlowchartSubgraph[];
}

// ── Lexer ──────────────────────────────────────────────────────────────────

const flowchartLexer = new Lexer(flowchartTokens);

// ── Parser (regex-based for reliability) ───────────────────────────────────

function stripQuotes(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  return s;
}

function parseBrContent(text: string): string {
  return text.replace(/<br\s*\/?>/gi, '\n');
}

interface ParseContext {
  nodes: Map<string, FlowchartNode>;
  edges: FlowchartEdge[];
  subgraphs: FlowchartSubgraph[];
  subgraphStack: FlowchartSubgraph[];
  routeDirectives: Array<{ from: string; to: string; fromSide?: string; toSide?: string }>;
}

/** Strip :::class1:::class2 from end of string, return [stripped, classes] */
function stripClasses(s: string): [string, string[]] {
  const classes: string[] = [];
  let rest = s;
  while (true) {
    const match = rest.match(/:::([a-zA-Z_][a-zA-Z0-9_]*)\s*$/);
    if (!match) break;
    classes.unshift(match[1]);
    rest = rest.slice(0, rest.length - match[0].length);
  }
  return [rest, classes];
}

// Shape patterns: order matters (longest delimiters first)
const shapePatterns: Array<{ open: string; close: string; shape: NodeShape }> = [
  { open: '[[', close: ']]', shape: 'subroutine' },
  { open: '([', close: '])', shape: 'stadium' },
  { open: '[(', close: ')]', shape: 'cylinder' },
  { open: '((', close: '))', shape: 'circle' },
  { open: '{{', close: '}}', shape: 'hexagon' },
  { open: '{', close: '}', shape: 'diamond' },
  { open: '[', close: ']', shape: 'rect' },
  { open: '(', close: ')', shape: 'rounded' },
];

// Edge patterns: order matters (longest first)
const edgePatterns: Array<{ pattern: string; style: EdgeStyle; hasArrow: boolean }> = [
  { pattern: '==>', style: 'thick', hasArrow: true },
  { pattern: '-.->',style: 'dotted', hasArrow: true },
  { pattern: '-->', style: 'solid', hasArrow: true },
  { pattern: '===', style: 'thick', hasArrow: false },
  { pattern: '-.-', style: 'dotted', hasArrow: false },
  { pattern: '---', style: 'solid', hasArrow: false },
];

function parseNodeDef(segment: string, ctx: ParseContext): string | null {
  const [stripped, classes] = stripClasses(segment.trim());
  const trimmed = stripped.trim();
  if (!trimmed) return null;

  // Try to match a node definition: ID + optional shape
  for (const sp of shapePatterns) {
    const shapeStart = trimmed.indexOf(sp.open);
    if (shapeStart < 0) continue;
    // Find matching close
    const afterOpen = shapeStart + sp.open.length;
    const closeIdx = trimmed.indexOf(sp.close, afterOpen);
    if (closeIdx < 0) continue;

    const id = trimmed.slice(0, shapeStart).trim();
    if (!id) continue;
    const text = parseBrContent(stripQuotes(trimmed.slice(afterOpen, closeIdx).trim()));

    const node: FlowchartNode = { id, text, shape: sp.shape, ...(classes.length > 0 ? { classes } : {}) };
    ctx.nodes.set(id, node);
    const target = ctx.subgraphStack.length > 0
      ? ctx.subgraphStack[ctx.subgraphStack.length - 1]
      : null;
    if (target) target.nodes.push(node);
    return id;
  }

  // Plain identifier (no shape) — just a node reference
  const id = trimmed;
  if (/^[a-zA-Z_][a-zA-Z0-9_ ]*$/.test(id)) {
    if (!ctx.nodes.has(id)) {
      const node: FlowchartNode = { id, text: id, shape: 'rect', ...(classes.length > 0 ? { classes } : {}) };
      ctx.nodes.set(id, node);
      const target = ctx.subgraphStack.length > 0
        ? ctx.subgraphStack[ctx.subgraphStack.length - 1]
        : null;
      if (target) target.nodes.push(node);
    }
    return id;
  }

  return null;
}

function findEdge(line: string): { idx: number; len: number; style: EdgeStyle; hasArrow: boolean } | null {
  for (const ep of edgePatterns) {
    // Look for edge not inside brackets/parens
    let searchFrom = 0;
    while (true) {
      const idx = line.indexOf(ep.pattern, searchFrom);
      if (idx < 0) break;
      // Make sure it's not part of an InlineLabel pattern "-- text -->"
      // Check if preceded by "-- " which would be inline label start
      return { idx, len: ep.pattern.length, style: ep.style, hasArrow: ep.hasArrow };
    }
  }
  return null;
}

function parseEdgeWithLabel(
  line: string,
  edgeStart: number,
  edgeLen: number,
  style: EdgeStyle,
  hasArrow: boolean,
): { label?: string; afterEdge: number } {
  const afterEdge = edgeStart + edgeLen;
  const rest = line.slice(afterEdge);

  // Check for |label| right after edge
  const pipeMatch = rest.match(/^\s*\|([^|]+)\|/);
  if (pipeMatch) {
    return { label: pipeMatch[1].trim(), afterEdge: afterEdge + pipeMatch[0].length };
  }

  // Check for inline label before edge: "-- label -->" pattern
  // The part before the edge token might contain "-- label "
  const before = line.slice(0, edgeStart);
  const inlineMatch = before.match(/--\s+(.+?)\s*$/);
  if (inlineMatch) {
    // Adjust: the left side is everything before the "--"
    return { label: inlineMatch[1].trim(), afterEdge };
  }

  return { afterEdge };
}

function parseLine(rawLine: string, ctx: ParseContext): void {
  // Parse %% @route directives before stripping comments
  const routeMatch = rawLine.match(/%%\s*@route\s+(\S+)\s*(?:-->|---)\s*(\S+)\s+(.*)/);
  if (routeMatch) {
    const from = routeMatch[1];
    const to = routeMatch[2];
    const props = routeMatch[3];
    const directive: { from: string; to: string; fromSide?: string; toSide?: string } = { from, to };
    const fromSideMatch = props.match(/fromSide=(\S+)/);
    if (fromSideMatch) directive.fromSide = fromSideMatch[1];
    const toSideMatch = props.match(/toSide=(\S+)/);
    if (toSideMatch) directive.toSide = toSideMatch[1];
    ctx.routeDirectives.push(directive);
    return;
  }

  const line = rawLine.replace(/%%.*$/, '').trim();
  if (!line) return;

  // Handle subgraph
  if (line.startsWith('subgraph')) {
    const [restRaw, classes] = stripClasses(line.slice('subgraph'.length).trim());
    const rest = restRaw.trim();
    // subgraph ID [title] or subgraph title
    let id: string;
    let title: string | undefined;

    const bracketMatch = rest.match(/^(\S+)\s*\[(.+)\]$/);
    if (bracketMatch) {
      id = bracketMatch[1];
      title = stripQuotes(bracketMatch[2].trim());
    } else if (rest) {
      // Use the rest as both id and title
      id = rest.replace(/\s+/g, '_');
      title = stripQuotes(rest);
    } else {
      id = `subgraph_${ctx.subgraphs.length}`;
    }

    const sg: FlowchartSubgraph = { id, title, nodes: [], edges: [], subgraphs: [], ...(classes.length > 0 ? { classes } : {}) };
    if (ctx.subgraphStack.length > 0) {
      ctx.subgraphStack[ctx.subgraphStack.length - 1].subgraphs.push(sg);
    } else {
      ctx.subgraphs.push(sg);
    }
    ctx.subgraphStack.push(sg);
    return;
  }

  if (line === 'end') {
    ctx.subgraphStack.pop();
    return;
  }

  // Split by semicolons for multiple statements on one line
  const statements = line.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    parseStatement(stmt, ctx);
  }
}

function parseStatement(stmt: string, ctx: ParseContext): void {
  // Try to parse edges (possibly chained: A --> B --> C)
  const parts: string[] = [];
  const edgeInfos: Array<{ style: EdgeStyle; hasArrow: boolean; label?: string }> = [];

  let remaining = stmt;
  while (true) {
    const edgeMatch = findEdge(remaining);
    if (!edgeMatch) {
      parts.push(remaining.trim());
      break;
    }

    // Check for inline label: "-- text -->" before the edge
    const beforeEdge = remaining.slice(0, edgeMatch.idx);
    let leftPart = beforeEdge;
    let label: string | undefined;

    // Check for inline label pattern: "-- text" right before edge marker
    const inlineMatch = beforeEdge.match(/^(.*?)--\s+(.+?)\s*$/);
    if (inlineMatch) {
      leftPart = inlineMatch[1];
      label = inlineMatch[2].trim();
    }

    parts.push(leftPart.trim());

    const afterEdge = edgeMatch.idx + edgeMatch.len;
    const afterStr = remaining.slice(afterEdge);

    // Check for pipe label after edge
    if (!label) {
      const pipeMatch = afterStr.match(/^\s*\|([^|]+)\|\s*/);
      if (pipeMatch) {
        label = pipeMatch[1].trim();
        remaining = afterStr.slice(pipeMatch[0].length);
        edgeInfos.push({ style: edgeMatch.style, hasArrow: edgeMatch.hasArrow, label });
        continue;
      }
    }

    edgeInfos.push({ style: edgeMatch.style, hasArrow: edgeMatch.hasArrow, label });
    remaining = afterStr;
  }

  if (edgeInfos.length === 0) {
    // No edges — just a node definition
    parseNodeDef(stmt, ctx);
    return;
  }

  // Parse node from each part, create edges
  const nodeIds: (string | null)[] = parts.map(p => parseNodeDef(p, ctx));
  for (let i = 0; i < edgeInfos.length; i++) {
    const fromId = nodeIds[i];
    const toId = nodeIds[i + 1];
    if (fromId && toId) {
      const edge: FlowchartEdge = {
        from: fromId,
        to: toId,
        style: edgeInfos[i].style,
        hasArrow: edgeInfos[i].hasArrow,
        ...(edgeInfos[i].label ? { label: edgeInfos[i].label } : {}),
      };
      const target = ctx.subgraphStack.length > 0
        ? ctx.subgraphStack[ctx.subgraphStack.length - 1]
        : null;
      if (target) {
        target.edges.push(edge);
      }
      ctx.edges.push(edge);
    }
  }
}

export function parseFlowchart(text: string): FlowchartAST {
  const lines = text.split('\n');
  let direction: FlowchartDirection = 'TD';

  // Find the flowchart/graph declaration line
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].replace(/%%.*$/, '').trim();
    const match = trimmed.match(/^(?:flowchart|graph)\s+(LR|RL|TD|TB|BT)\s*$/);
    if (match) {
      direction = match[1] as FlowchartDirection;
      startIdx = i + 1;
      break;
    }
    // flowchart/graph without direction defaults to TD
    if (/^(?:flowchart|graph)\s*$/.test(trimmed)) {
      startIdx = i + 1;
      break;
    }
  }

  const ctx: ParseContext = {
    nodes: new Map(),
    edges: [],
    subgraphs: [],
    subgraphStack: [],
    routeDirectives: [],
  };

  for (let i = startIdx; i < lines.length; i++) {
    parseLine(lines[i], ctx);
  }

  // Apply @route directives to matching edges
  for (const dir of ctx.routeDirectives) {
    for (const edge of ctx.edges) {
      if (edge.from === dir.from && edge.to === dir.to) {
        if (dir.fromSide) edge.fromSide = dir.fromSide;
        if (dir.toSide) edge.toSide = dir.toSide;
      }
    }
  }

  return {
    direction,
    nodes: Array.from(ctx.nodes.values()),
    edges: ctx.edges,
    subgraphs: ctx.subgraphs,
  };
}
