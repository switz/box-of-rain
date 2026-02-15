// ── AST types ──────────────────────────────────────────────────────────────

export type MessageStyle = 'solid' | 'dashed';
export type MessageArrow = 'head' | 'cross' | 'open';

export interface SequenceParticipant {
  id: string;
  alias?: string;
  isActor: boolean;
}

export interface SequenceMessage {
  from: string;
  to: string;
  label: string;
  style: MessageStyle;
  arrow: MessageArrow;
}

export interface SequenceAST {
  participants: SequenceParticipant[];
  messages: SequenceMessage[];
}

// ── Arrow patterns ─────────────────────────────────────────────────────────

const arrowPatterns: Array<{ pattern: string; style: MessageStyle; arrow: MessageArrow }> = [
  { pattern: '-->>',style: 'dashed', arrow: 'head' },
  { pattern: '-->>', style: 'solid', arrow: 'head' },  // won't match, -->> already caught
  { pattern: '->>',  style: 'solid', arrow: 'head' },
  { pattern: '--x',  style: 'dashed', arrow: 'cross' },
  { pattern: '-x',   style: 'solid', arrow: 'cross' },
  { pattern: '--)',  style: 'dashed', arrow: 'open' },
  { pattern: '-)',   style: 'solid', arrow: 'open' },
];

// ── Parser ─────────────────────────────────────────────────────────────────

function stripQuotes(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  return s;
}

export function parseSequence(text: string): SequenceAST {
  const lines = text.split('\n');
  const participants: SequenceParticipant[] = [];
  const participantIds = new Set<string>();
  const messages: SequenceMessage[] = [];

  let started = false;

  function ensureParticipant(id: string): void {
    if (!participantIds.has(id)) {
      participantIds.add(id);
      participants.push({ id, isActor: false });
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/%%.*$/, '').trim();
    if (!line) continue;

    // Detect diagram start
    if (line === 'sequenceDiagram') {
      started = true;
      continue;
    }
    if (!started) continue;

    // participant/actor declarations
    const partMatch = line.match(/^(participant|actor)\s+(.+)$/);
    if (partMatch) {
      const isActor = partMatch[1] === 'actor';
      const rest = partMatch[2].trim();

      // Check for "as" alias: participant A as Alice
      const asMatch = rest.match(/^(\S+)\s+as\s+(.+)$/);
      if (asMatch) {
        const id = asMatch[1];
        const alias = stripQuotes(asMatch[2].trim());
        if (!participantIds.has(id)) {
          participantIds.add(id);
          participants.push({ id, alias, isActor });
        }
      } else {
        const id = stripQuotes(rest);
        if (!participantIds.has(id)) {
          participantIds.add(id);
          participants.push({ id, isActor });
        }
      }
      continue;
    }

    // Try to match a message line: From ->> To : Label
    let matched = false;
    for (const ap of arrowPatterns) {
      const idx = line.indexOf(ap.pattern);
      if (idx < 0) continue;

      const from = line.slice(0, idx).trim();
      const afterArrow = line.slice(idx + ap.pattern.length).trim();

      // After arrow should be ": label" or just a colon
      const colonIdx = afterArrow.indexOf(':');
      let to: string;
      let label = '';

      if (colonIdx >= 0) {
        to = afterArrow.slice(0, colonIdx).trim();
        label = afterArrow.slice(colonIdx + 1).trim();
      } else {
        to = afterArrow;
      }

      if (from && to) {
        ensureParticipant(from);
        ensureParticipant(to);
        messages.push({ from, to, label, style: ap.style, arrow: ap.arrow });
        matched = true;
        break;
      }
    }
  }

  return { participants, messages };
}
