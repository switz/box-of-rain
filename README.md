# box-of-rain

Generate ASCII box diagrams from JSON or YAML. Supports nested boxes, arrow connections, auto-layout, multiple border styles, and shadows.

This code is entirely AI generated. Be warned, take it for what you will. No promises.

It's inspired by turbopuffer, planetscale, and oxide computing's ascii diagrams. It's meant to be a simple and effective way to generate diagrams through a rote interface, largely self-layouting.

Of course, it's named as an homage to the inimitable Robert Hunter. Though he'd likely be disgusted, everything written below here is AI generated as well. But tiny, useful, isolated, and non-hosted libraries are probably the best use-case for AI.

```
╔══ Your Home WiFi ═╗          ╔══ China Cloud ═════╗
║                   ║          ║                    ║░░
║  ┏━━━━━━━━━━━━━┓  ║          ║  ┏━━━━━━━━━━━━━━┓  ║░░
║  ┃             ┃  ║          ║  ┃ Vacuum Cloud ┃  ║░░
║  ┃ Your iPhone ┃ ──────────────▶┃   Servers    ┃ ─────┐
║  ┃             ┃  ║          ║  ┃              ┃  ║░░ │
║  ┗━━━━━━━━━━━━━┛  ║          ║  ┗━━━━━━━━━━━━━━┛  ║░░ │
║                   ║          ╚════════════════════╝░░ │
║  ┏━━━━━━━━━━━━┓   ║           ░░░░░░░░░░░░░░░░░░░░░░░ │
║  ┃            ┃   ║                                   │
║  ┃ Your Robot ┃◀───────────── commands ───────────────┘
║  ┃            ┃   ║
║  ┗━━━━━━━━━━━━┛   ║
╚═══════════════════╝
```

## Usage

```bash
node box-of-rain.mjs diagram.json      # render a diagram from JSON
node box-of-rain.mjs diagram.yaml     # render a diagram from YAML
node box-of-rain.mjs --example         # run the built-in example
```

## JSON format

A diagram has `boxes` and `connections`. Positions and sizes are optional — the auto-layout engine computes them if omitted.

```json
{
  "boxes": [
    {
      "id": "web",
      "content": ["Frontend"],
      "border": "rounded"
    },
    {
      "id": "platform",
      "title": "Cloud Platform",
      "border": "double",
      "shadow": true,
      "children": [
        { "id": "api", "content": ["API Server"], "border": "bold" },
        { "id": "db", "content": ["Database"] }
      ]
    }
  ],
  "connections": [
    { "from": "web", "to": "api", "label": "HTTPS" },
    { "from": "api", "to": "db" }
  ]
}
```

### Box properties

| Property   | Type     | Default    | Description                                    |
|------------|----------|------------|------------------------------------------------|
| `id`       | string   | —          | Unique identifier (required for connections)   |
| `content`  | string[] | —          | Text lines, centered inside the box            |
| `border`   | string   | `"single"` | `single`, `double`, `bold`, or `rounded`       |
| `title`    | string   | —          | Text on the top border                         |
| `shadow`   | boolean  | `false`    | Adds a `░` shadow on the right and bottom      |
| `children` | Box[]    | —          | Nested boxes (coordinates relative to parent)  |
| `x`, `y`   | number   | auto       | Position (top-left corner)                     |
| `width`    | number   | auto       | Box width in characters                        |
| `height`   | number   | auto       | Box height in characters                       |

### Connection properties

| Property   | Type   | Default   | Description                            |
|------------|--------|-----------|----------------------------------------|
| `from`     | string | —         | Source box `id`                        |
| `to`       | string | —         | Target box `id`                        |
| `label`    | string | —         | Text label on the arrow                |
| `fromSide` | string | `"right"` | Which side the arrow exits from        |
| `toSide`   | string | `"left"`  | Which side the arrow enters            |

Sides are `right`, `left`, `top`, or `bottom`.

## Arrow routing

Arrows are routed automatically based on the anchor positions:

- **Straight** — when source and target are on the same row
- **L-shaped** — horizontal, corner, vertical, corner, horizontal
- **U-shaped** — when `fromSide` and `toSide` are the same (e.g. both `"right"`), the arrow extends past all boxes, turns vertical, and comes back

## Border styles

```
single:  ┌──────┐    double:  ╔══════╗    bold:  ┏━━━━━━┓    rounded: ╭──────╮
         │      │             ║      ║           ┃      ┃             │      │
         └──────┘             ╚══════╝           ┗━━━━━━┛             ╰──────╯
```

## Auto-layout

When boxes don't have explicit `x`/`y` positions, the layout engine:

1. Sizes each box to fit its content
2. Lays out children inside their parent containers
3. Assigns top-level boxes to horizontal layers based on connection flow
4. Orders boxes within each layer to minimize edge crossings
5. Handles cycles in the dependency graph

You can mix auto and manual positioning — set `x`/`y`/`width`/`height` on specific boxes and leave the rest to auto-layout.

## More examples

```bash
node box-of-rain.mjs examples/turbopuffer.json
```
```
                        ╔══ turbopuffer ═══════════════════════╗
╔══════════╗            ║  ┏━━━━━━━━━━━┓     ┏━━━━━━━━━━━━━━┓  ║░░
║          ║░░          ║  ┃  Memory/  ┃     ┃    Object    ┃  ║░░
║  client  ║░──── API ────▶┃ SSD Cache ┃ ───▶┃ Storage (S3) ┃  ║░░
║          ║░░          ║  ┃           ┃     ┃              ┃  ║░░
╚══════════╝░░          ║  ┗━━━━━━━━━━━┛     ┗━━━━━━━━━━━━━━┛  ║░░
 ░░░░░░░░░░░░░          ╚══════════════════════════════════════╝░░
                         ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

```bash
node box-of-rain.mjs examples/microservices.json
```
```
                      ╔══ Cloud Platform ════════════════════════════════╗
                      ║                                                  ║░░
                      ║  ┏━━━━━━━━━━┓     ┌──────────┐     ┏━━━━━━━━━━┓  ║░░
                      ║  ┃   API    ┃     │   Auth   │     ┃          ┃  ║░░
                      ║  ┃ Gateway  ┃ ─┐─▶│ Service  │  ┌─▶┃ Database ┃  ║░░
╭──────────╮          ║  ┃          ┃  │  │          │  │  ┃          ┃  ║░░
│          │          ║  ┗━━━━━━━━━━┛  │  └──────────┘  │  ┗━━━━━━━━━━┛  ║░░
│   User   │ ─ HTTPS ▶║                │                │                ║░░
│          │          ║                │  ┌──────────┐  │                ║░░
╰──────────╯          ║                │  │  Orders  │  │                ║░░
                      ║                └─▶│ Service  │ ─┘                ║░░
                      ║                   │          │                   ║░░
                      ║                   └──────────┘                   ║░░
                      ╚══════════════════════════════════════════════════╝░░
                       ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

## Programmatic usage

```javascript
import { render } from './box-of-rain.mjs';

const diagram = {
  boxes: [
    { id: 'a', content: ['Hello'], border: 'double' },
    { id: 'b', content: ['World'], border: 'bold' },
  ],
  connections: [
    { from: 'a', to: 'b' },
  ],
};

console.log(render(diagram));
```

## License

MIT
