# Architecture

## Application

The Next.js App Router exports the dashboard, ten workspace routes, and five deep-linkable project pages. A shared shell owns navigation, command search, visual preferences, drawers and notifications. Client components in `components/` subscribe to the records they display. Shared panels, forms and dialogs use custom styles and Radix Dialog accessibility primitives. Tailwind provides the baseline and utility layer, with glass, typography, responsive grids and visual states in `app/globals.css`.

The build prepares route-prefetch aliases for Windows static exports that emit segments as nested files. The local production preview serves the same `out/` directory.

Motion animates the progress rings. Recharts displays stored activity, planned targets and competency scores. React Flow renders the extracted dependency edges. The source viewer uses React Markdown and GFM tables, with Mermaid loaded only when a source section contains a diagram.

## Data flow

```text
content/roadmap.md
  → scripts/import-roadmap.mts
  → Zod-validated content/roadmap.generated.json
  → lookup maps and selectors in lib/
  → read-only source displays and planned targets

User interaction
  → validated editor or domain update
  → Zustand progress record
  → IndexedDB through idb-keyval
  → derived counts and status across subscribed workspaces
```

`lib/roadmap-schema.ts` validates planned entities. `lib/progress-schema.ts` validates personal records and backups. `lib/logic.ts` contains date mapping, capacity, readiness, status, aggregation, interview scoring and backup calculations. Calculations consume the progress entities without depending on React or storage. User edits are stored by stable source IDs so source updates and future synchronization can preserve references.

The focus timer persists its start timestamp and accumulated elapsed time. Pausing updates the accumulated duration and clears the start timestamp. Stopping stores a whole-minute session, rounded down with a one-minute minimum for a saved block. Sessions are attributed to the date the timer stops in the selected time zone.

## Persistence and portability

Zustand hydrates from IndexedDB before enabling the record-based workspaces. JSON backups contain a schema version and source digest. Restore validates the file before replacing records and offers an undo. CSV exports quote data and neutralize formula-like text. Version zero migrates by adding the current default state and settings to the saved values.

The app is designed for one active editing tab per browser origin. Multiple devices and simultaneous editing would need a record-level repository with conflict resolution. A future synchronization layer can use the typed entities and stable identifiers without changing roadmap parsing.

## Design assets

The built-in image generator produced two local images, optimized as WebP for the app.

| Asset | Generation brief |
|---|---|
| `public/assets/studio.webp` | Wide photographic modern loft, floor-to-ceiling windows, limestone and warm gray neutrals, quiet center, long soft shadows and no interface or text. |
| `public/assets/chrome.webp` | Isolated polished silver Möbius knot, crisp window reflections, transparent background and no text. |

The solid-background preference replaces the architectural environment. The foreground uses warm glass and charcoal panels, with green, amber and red tied to status. Geist is bundled locally.

### Image generation prompts

**Studio**  
Create an ultra-wide horizontal photoreal architectural interior photograph for the background of a spatial productivity dashboard. 16:9. Ultra refined modern high-rise loft, neutral light warm gray limestone, warm white concrete walls, one wall of tall floor-to-ceiling windows with slim steel mullions on the left and right, quiet central plaster wall, hazy city outside, sun casting long pale shadows across the lower floor. Shot from across the room, centered symmetrical architectural composition. Architecture and visible window highlights at outer edges, very calm empty center for overlay, subtle foreground warm gray rug and one low minimalist chair at far right. Clean warm monochrome palette with faint silver-blue window light. Premium boutique architectural magazine photography, no people, no typography, no dashboard, no UI, no logos, no graphics.

**Chrome**  
High end product photography, isolated centered compact sculptural closed loop, a twisting inflated molten-chrome Möbius knot with a visually interesting hole. Mirror-polished silver, deep black reflections and crisp white specular highlights as though reflecting tall architectural windows, subtle smooth transitions between the positive and negative shapes, sharp carefully sculpted silhouette. Viewed slightly from above on a three-quarter angle. No ground, no shadow outside object, genuine clear transparent background, no pedestal, no typography, no other objects. Subject fills 80 percent of a square canvas.

