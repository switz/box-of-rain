import { z } from 'zod';

export const ConnectionSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
  fromSide: z.enum(['left', 'right', 'top', 'bottom']).optional(),
  toSide: z.enum(['left', 'right', 'top', 'bottom']).optional(),
});

export type ConnectionDef = z.infer<typeof ConnectionSchema>;

export type Side = 'left' | 'right' | 'top' | 'bottom';
export type BorderStyle = 'single' | 'double' | 'bold' | 'rounded' | 'dashed';

// children is polymorphic:
//   - string        → single line of text content
//   - string[]      → multi-line text content (each string = new line)
//   - NodeDef[]     → nested child boxes
export type NodeDef = {
  id?: string;
  children?: string | (string | NodeDef)[];
  border?: BorderStyle;
  title?: string;
  shadow?: boolean;
  disabled?: boolean;
  childDirection?: 'horizontal' | 'vertical';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  connections?: ConnectionDef[];
};

const NodeSchema: z.ZodType<NodeDef> = z.lazy(() =>
  z.object({
    id: z.string().optional(),
    children: z.union([
      z.string(),
      z.array(z.union([z.string(), NodeSchema])),
    ]).optional(),
    border: z.enum(['single', 'double', 'bold', 'rounded', 'dashed']).optional(),
    title: z.string().optional(),
    shadow: z.boolean().optional(),
    disabled: z.boolean().optional(),
    childDirection: z.enum(['horizontal', 'vertical']).optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    connections: z.array(ConnectionSchema).optional(),
  })
);

export { NodeSchema };

// The root diagram is just a node
export const DiagramSchema = NodeSchema;

export interface Point {
  x: number;
  y: number;
}

export interface ResolvedBox {
  box: NodeDef & { x: number; y: number; width: number; height: number };
  absX: number;
  absY: number;
}

export interface BorderChars {
  tl: string;
  tr: string;
  bl: string;
  br: string;
  h: string;
  v: string;
}

export interface SvgOptions {
  fontSize?: number;
  charWidth?: number;
  lineHeight?: number;
  padding?: number;
  lightBg?: string;
  lightFg?: string;
  darkBg?: string;
  darkFg?: string;
  fontFamily?: string;
  borderRadius?: number;
}

export interface LayoutOptions {
  defaultHGap?: number;
  vGap?: number;
  padLeft?: number;
  padTop?: number;
  minBoxWidth?: number;
  minBoxHeight?: number;
}

/** Get the text content lines from a node's children (if children is text) */
export function getTextContent(node: NodeDef): string[] | null {
  if (node.children == null) return null;
  if (typeof node.children === 'string') return [node.children];
  if (node.children.length === 0) return null;
  if (typeof node.children[0] === 'string' && node.children.every(c => typeof c === 'string')) {
    return node.children as string[];
  }
  return null;
}

/** Get the child boxes from a node's children (if children is boxes) */
export function getChildBoxes(node: NodeDef): NodeDef[] | null {
  if (!Array.isArray(node.children)) return null;
  if (node.children.length === 0) return null;
  // If any element is an object, treat the whole array as boxes
  if (node.children.some(c => typeof c === 'object' && c !== null)) {
    return node.children.filter(c => typeof c === 'object' && c !== null) as NodeDef[];
  }
  return null;
}

/** Collect all connections from a node tree recursively */
export function collectConnections(node: NodeDef): ConnectionDef[] {
  const conns: ConnectionDef[] = [...(node.connections || [])];
  const childBoxes = getChildBoxes(node);
  if (childBoxes) {
    for (const child of childBoxes) {
      conns.push(...collectConnections(child));
    }
  }
  return conns;
}
