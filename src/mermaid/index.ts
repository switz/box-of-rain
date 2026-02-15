import { render } from '../render.js';
import type { NodeDef, LayoutOptions } from '../schema.js';
import { parseFlowchart } from './flowchart.js';
import { parseSequence } from './sequence.js';
import { flowchartToNodeDef, sequenceToNodeDef } from './convert.js';

export type { FlowchartAST, FlowchartNode, FlowchartEdge, FlowchartSubgraph, FlowchartDirection, NodeShape, EdgeStyle } from './flowchart.js';
export type { SequenceAST, SequenceParticipant, SequenceMessage, MessageStyle, MessageArrow } from './sequence.js';
export { parseFlowchart } from './flowchart.js';
export { parseSequence } from './sequence.js';
export { flowchartToNodeDef, sequenceToNodeDef } from './convert.js';

/**
 * Parse a Mermaid diagram string and return an asciibox NodeDef.
 * Auto-detects diagram type from the first non-empty, non-comment line.
 */
export function parseMermaid(text: string): NodeDef {
  const firstLine = text
    .split('\n')
    .map(l => l.replace(/%%.*$/, '').trim())
    .find(l => l.length > 0);

  if (!firstLine) {
    throw new Error('Empty mermaid diagram');
  }

  if (/^(?:flowchart|graph)\b/.test(firstLine)) {
    return flowchartToNodeDef(parseFlowchart(text));
  }

  if (/^sequenceDiagram\b/.test(firstLine)) {
    return sequenceToNodeDef(parseSequence(text));
  }

  throw new Error(`Unsupported diagram type: ${firstLine}`);
}

/**
 * Parse a Mermaid diagram string and render it to ASCII art.
 */
export function renderMermaid(text: string, options?: LayoutOptions): string {
  return render(parseMermaid(text), options);
}
