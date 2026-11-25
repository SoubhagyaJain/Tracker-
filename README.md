# AI Career OS — 2027

A local-first career workspace for the supplied Applied AI and ML roadmap. The first launch starts with zero study time, unassessed competencies, empty trackers and the complete December 2026–December 2027 plan.

## Run locally

Use Node.js 20.9 or newer and npm. In this directory, run:

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). On Windows, use `npm.cmd` when your PowerShell execution policy blocks the npm shim.

`npm run build` produces a static site in `out/`. Run `npm start` to serve the export locally. Stop the development server first if it is using port 3000, or set `PORT` for the preview.

```sh
npm run roadmap:import
npm run lint
npm run typecheck
npm test
npm run test:browser
npm run build
```

The browser suite uses installed Google Chrome through Playwright and will reuse the dev server when it is already running. It writes desktop and mobile captures into `docs/screenshots/`.

## Workspaces

- **Overview and Today** show task priorities, study hours, milestone dates, weekly calendar, energy logs, and a timestamp-based focus timer.
- **My Learning** tracks Udemy courses, curriculum, roadmap mappings and linked study. See the [integration and Chrome companion guide](docs/udemy-learning.md).
- **Roadmap and Skills** show 52 weekly blocks, December’s day-by-day plan, task states, dependencies, evidence-based assessments and monthly competency gates.
- **Projects and Analytics** track releases, milestones, reproducible measurements, study pace forecasts for the June and December goals, consistency and time by activity.
- **Interviews and Career** track the five-part mock rubric, internship requirements, a nine-stage application board and dated market notes.
- **Resources, Journal and Settings** handle bookmarks, independent-learning notes, spaced reviews, study capacity, backups and the original source.

Use Ctrl+K or Cmd+K to search or open common actions. Calendar sessions can be rescheduled with drag-and-drop or their date editor. Applications can move between stages with drag-and-drop or the stage editor.

The browser origin determines where IndexedDB records are saved. Keep using the same host and port for an existing workspace. Export a JSON backup from Settings to move progress to another browser or origin.

[Architecture](docs/architecture.md) · [Roadmap import and mapping](docs/roadmap-mapping.md)

