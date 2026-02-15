import { createToken, Lexer } from 'chevrotain';

// ── Shared tokens ──────────────────────────────────────────────────────────

export const WhiteSpace = createToken({ name: 'WhiteSpace', pattern: /[ \t]+/, group: Lexer.SKIPPED });
export const Newline = createToken({ name: 'Newline', pattern: /\r?\n/ });
export const Comment = createToken({ name: 'Comment', pattern: /%%[^\n]*/, group: Lexer.SKIPPED });
export const Semicolon = createToken({ name: 'Semicolon', pattern: /;/ });

// ── Flowchart tokens ───────────────────────────────────────────────────────

export const FlowchartKeyword = createToken({ name: 'FlowchartKeyword', pattern: /(?:flowchart|graph)/, longer_alt: undefined });
export const Direction = createToken({ name: 'Direction', pattern: /LR|RL|TD|TB|BT/ });
export const SubgraphKeyword = createToken({ name: 'SubgraphKeyword', pattern: /subgraph/ });
export const EndKeyword = createToken({ name: 'EndKeyword', pattern: /end/ });

// Edge tokens (order matters — longest match first)
export const ThickArrow = createToken({ name: 'ThickArrow', pattern: /==>/ });
export const DottedArrow = createToken({ name: 'DottedArrow', pattern: /-.->/ });
export const Arrow = createToken({ name: 'Arrow', pattern: /-->/ });
export const ThickLine = createToken({ name: 'ThickLine', pattern: /===/ });
export const DottedLine = createToken({ name: 'DottedLine', pattern: /-\.-/ });
export const Line = createToken({ name: 'Line', pattern: /---/ });

// Label on edge: |text|
export const PipeLabel = createToken({ name: 'PipeLabel', pattern: /\|[^|]+\|/ });
// Inline label: -- text -->  or -- text ---
export const InlineLabel = createToken({ name: 'InlineLabel', pattern: /--\s+[^-\n][^\n]*?(?=-->|---|-\.->|===>|===)/ });

// Node shape delimiters (order: longest first)
export const DoubleSquareOpen = createToken({ name: 'DoubleSquareOpen', pattern: /\[\[/ });
export const DoubleSquareClose = createToken({ name: 'DoubleSquareClose', pattern: /\]\]/ });
export const StadiumOpen = createToken({ name: 'StadiumOpen', pattern: /\(\[/ });
export const StadiumClose = createToken({ name: 'StadiumClose', pattern: /\]\)/ });
export const CylinderOpen = createToken({ name: 'CylinderOpen', pattern: /\[\(/ });
export const CylinderClose = createToken({ name: 'CylinderClose', pattern: /\)\]/ });
export const DoubleCircleOpen = createToken({ name: 'DoubleCircleOpen', pattern: /\(\(/ });
export const DoubleCircleClose = createToken({ name: 'DoubleCircleClose', pattern: /\)\)/ });
export const HexOpen = createToken({ name: 'HexOpen', pattern: /\{\{/ });
export const HexClose = createToken({ name: 'HexClose', pattern: /\}\}/ });
export const DiamondOpen = createToken({ name: 'DiamondOpen', pattern: /\{/ });
export const DiamondClose = createToken({ name: 'DiamondClose', pattern: /\}/ });
export const SquareOpen = createToken({ name: 'SquareOpen', pattern: /\[/ });
export const SquareClose = createToken({ name: 'SquareClose', pattern: /\]/ });
export const RoundOpen = createToken({ name: 'RoundOpen', pattern: /\(/ });
export const RoundClose = createToken({ name: 'RoundClose', pattern: /\)/ });

// Quoted string: "text"
export const QuotedString = createToken({ name: 'QuotedString', pattern: /"[^"]*"/ });

// Identifier (node IDs, text content) — must be last
export const Identifier = createToken({ name: 'Identifier', pattern: /[a-zA-Z_][a-zA-Z0-9_ ]*[a-zA-Z0-9_]|[a-zA-Z_]/ });

// ── Flowchart lexer ────────────────────────────────────────────────────────

export const flowchartTokens = [
  WhiteSpace,
  Comment,
  Newline,
  Semicolon,
  // Keywords before Identifier
  FlowchartKeyword,
  SubgraphKeyword,
  EndKeyword,
  Direction,
  // Edge labels
  PipeLabel,
  InlineLabel,
  // Edges (longest first)
  ThickArrow,
  DottedArrow,
  Arrow,
  ThickLine,
  DottedLine,
  Line,
  // Shape delimiters (longest first)
  DoubleSquareOpen,
  DoubleSquareClose,
  StadiumOpen,
  StadiumClose,
  CylinderOpen,
  CylinderClose,
  DoubleCircleOpen,
  DoubleCircleClose,
  HexOpen,
  HexClose,
  DiamondOpen,
  DiamondClose,
  SquareOpen,
  SquareClose,
  RoundOpen,
  RoundClose,
  QuotedString,
  Identifier,
];

// ── Sequence diagram tokens ────────────────────────────────────────────────

export const SequenceDiagramKeyword = createToken({ name: 'SequenceDiagramKeyword', pattern: /sequenceDiagram/ });
export const ParticipantKeyword = createToken({ name: 'ParticipantKeyword', pattern: /participant/ });
export const ActorKeyword = createToken({ name: 'ActorKeyword', pattern: /actor/ });
export const AsKeyword = createToken({ name: 'AsKeyword', pattern: /as/ });

// Message arrows (longest first)
export const SolidArrowCross = createToken({ name: 'SolidArrowCross', pattern: /-x/ });
export const DashedArrowCross = createToken({ name: 'DashedArrowCross', pattern: /--x/ });
export const SolidArrowOpen = createToken({ name: 'SolidArrowOpen', pattern: /-\)/ });
export const DashedArrowOpen = createToken({ name: 'DashedArrowOpen', pattern: /--\)/ });
export const SolidArrowHead = createToken({ name: 'SolidArrowHead', pattern: /->>/ });
export const DashedArrowHead = createToken({ name: 'DashedArrowHead', pattern: /-->>/ });
export const Colon = createToken({ name: 'Colon', pattern: /:/ });
export const MessageText = createToken({ name: 'MessageText', pattern: /:[^\n]+/ });

// Sequence identifier — allows spaces in names only when not ambiguous
export const SeqIdentifier = createToken({ name: 'SeqIdentifier', pattern: /[a-zA-Z_][a-zA-Z0-9_]*/ });

export const sequenceTokens = [
  WhiteSpace,
  Comment,
  Newline,
  Semicolon,
  SequenceDiagramKeyword,
  ParticipantKeyword,
  ActorKeyword,
  AsKeyword,
  // Arrows (longest first)
  DashedArrowHead,
  DashedArrowCross,
  DashedArrowOpen,
  SolidArrowHead,
  SolidArrowCross,
  SolidArrowOpen,
  MessageText,
  Colon,
  QuotedString,
  SeqIdentifier,
];
