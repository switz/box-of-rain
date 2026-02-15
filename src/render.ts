import type { NodeDef, SvgOptions, LayoutOptions } from './schema.js';
import { DiagramSchema, getChildBoxes, collectConnections } from './schema.js';
import { DEFAULT_SVG_OPTIONS } from './constants.js';
import { Canvas } from './canvas.js';
import { drawBox } from './draw-box.js';
import { drawConnection } from './draw-connection.js';
import { autoLayout } from './layout.js';

export function render(input: NodeDef, options?: LayoutOptions): string {
  const parsed = DiagramSchema.parse(input);
  const diagram = autoLayout(parsed, options);
  const { width = 80, height = 20 } = diagram;
  const canvas = new Canvas(width, height);

  const boxes = getChildBoxes(diagram) || [];
  const connections = collectConnections(diagram);

  for (const box of boxes) {
    drawBox(canvas, box as Parameters<typeof drawBox>[1]);
  }

  for (const conn of connections) {
    drawConnection(canvas, conn, boxes, connections);
  }

  return canvas.toString();
}

export function renderSvg(text: string, options?: SvgOptions): string {
  const opts = { ...DEFAULT_SVG_OPTIONS, ...options };
  const lines = text.split('\n');
  const maxLen = Math.max(...lines.map(l => l.length));

  const width = Math.ceil(maxLen * opts.charWidth) + opts.padding * 2;
  const height = lines.length * opts.lineHeight + opts.padding * 2;

  const textEls = lines.map((line, i) => {
    const escaped = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const y = opts.padding + (i + 1) * opts.lineHeight;
    return `  <text x="${opts.padding}" y="${y}" xml:space="preserve">${escaped}</text>`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <style>
    text {
      font-family: ${opts.fontFamily};
      font-size: ${opts.fontSize}px;
      line-height: 1;
      fill: ${opts.lightFg};
    }
    @media (prefers-color-scheme: dark) {
      text { fill: ${opts.darkFg}; }
      .bg { fill: ${opts.darkBg}; }
    }
  </style>
  <rect class="bg" width="100%" height="100%" fill="${opts.lightBg}" rx="${opts.borderRadius}" />
${textEls}
</svg>`;
}
