# Roadmap import and mapping

`content/roadmap.md` is the supplied authoritative source. The importer preserves the full Markdown with normalized newline characters, including tables, links, code and the original dependency diagram. The SQLite, service, workflow and model-serving descriptions are roadmap content for the portfolio tracker.

| Sections | Application use |
|---|---|
| 1–3 | Historical research snapshot, postings, role priorities and compensation assumptions in Career |
| 4 | Every original node and edge in the React Flow graph, with the original Mermaid diagram under Settings |
| 5 | Skill priorities, hours, prerequisites, evidence criteria and interview relevance |
| 6 | Thirteen calendar months, four exact weekly objectives each, capacity allocations, deliverables and gates |
| 7 | December 1–30 source activities, four rest days, flex dates and checkpoints |
| 8 | Five-hour study template, independent learning method and 1/3/7/14/30-day review cadence |
| 9 | Resource titles, original URLs, subjects and recommended scopes |
| 10 | Five projects, architecture, milestones, security, reliability, evaluation and interview requirements |
| 11–13 | Internship strategy, mock prompts and scoring, job strategy and application intervention rules |
| 14 | Demonstration-based mastery criteria, monthly gate targets and corrective guidance |
| 15–16 | Source guidance available in the document reader |

December’s independent exercises are keyed by date. Later weeks retain the source objective as one actionable record, paired with the original month deliverable, mock where explicit, and monthly gate. A Today view for those months calls its daily practice suggestion a suggested allocation. Core and elective project labels, skill-to-block associations, resource matches, date anchors for month-only targets, and visual section labels are explicit presentation mappings in the importer. The original wording remains available next to the derived views.

## Update the roadmap

1. Update `content/roadmap.md` with the revised Markdown.
2. Run `npm run roadmap:import`.
3. Review the generated reconciliation report if the digest changed.
4. Run the tests and rebuild or reopen the development app.

The importer validates entity counts, date fields, identifiers and linked records. IDs for weeks, daily exercises and gates use calendar anchors. Skill and project IDs are explicit. Resource IDs derive from their original titles. A revision that changes content under a shared ID is reported as changed. Removed or renamed IDs are reported as unmatched, and saved progress under those IDs remains in IndexedDB and backups. When a revision reuses a calendar slot for substantially different work, inspect the report before carrying that slot’s completion forward.

The weekly time budgets are 20, 30 and 40 hours. The schedule assumes five study days at 20 hours and six at 30 or 40. Calendar days 7, 14, 21 and 28 remain source rest days, and days 29 onward remain flex dates. The sixth day has no target in the 20-hour mode. Exam mode uses the 20-hour allocations through its end date.

