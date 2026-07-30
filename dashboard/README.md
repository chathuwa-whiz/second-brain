# Dashboard — the second brain's control panel

Not just a log viewer. This is the human side of the system: where you see what
the agent decided, approve what it can't decide alone, and manage the modules
feeding it.

```bash
npm install
cp .env.example .env.local   # fill in the real values
npm run dev                  # http://localhost:3000
```

## Pages

| Route | What it's for |
|---|---|
| `/` | Overview — pending count, what ran on its own, recent activity, module status |
| `/approvals` | The queue: actions the planner wasn't confident enough to run itself |
| `/activity` | Full action log, filterable by status and module |
| `/jobs` | Job matches from the daily search, and applications you've logged |
| `/resumes` | Add/remove the resumes `select_best_resume` chooses between |
| `/modules` | Every module, live or planned, with what each one can do |
| `/settings` | Appearance, the auto-run threshold, and connection status |

## Design system

Everything visual comes from CSS custom properties in `app/globals.css`, read by
`tailwind.config.ts` through Tailwind's `<alpha-value>` placeholder. That means
**no `dark:` variants anywhere in the markup** — switching themes is one
`data-theme` attribute on `<html>`, and a token change lands everywhere at once.

**Light theme is deliberately not `#FFFFFF`.** The canvas is `#F4F7FC` cool
paper with `#EAEFF7` chrome. A pure-white panel beside a saturated accent is the
main source of eye strain in a tool you stare at while working, so the light
theme trades a little contrast for comfort. Dark is `#0B1020` deep navy rather
than black, because frosted glass over a flat black fill reads grey and dead.

Accents are identical in both themes (`#5B8DEF` blue, `#7C6BF5` violet,
`#30C88F` / `#F5A524` / `#F2545B` for approve / pending / reject), so status
colors stay learnable — only the surfaces around them change.

The glass effect is `backdrop-filter: blur() saturate(180%)` over the ambient
mesh in `components/Mesh.tsx`: three blurred color orbs fixed behind the whole
app. The saturate boost plus real color behind the panels is what makes it read
as glass rather than as translucent grey boxes.

### The confidence meter

`ConfidenceMeter` in `components/ui.tsx` is the one element carrying the design's
weight. Every action shows its planner confidence as a bar with a tick marking
`AUTO_EXECUTE_CONFIDENCE_THRESHOLD`. That tick is the point: it answers "did this
clear the bar, or is it sitting in my queue because it didn't?" at a glance,
which is the actual question the architecture raises. It encodes how the system
works rather than decorating a number.

### Theme switching

`components/theme.tsx` holds the provider plus `themeBootstrapScript`, an inline
script that runs in `<head>` before first paint. Without it the page flashes the
wrong theme on every hard navigation. Preference is `light` / `dark` / `system`,
persisted to `localStorage`; `system` follows the OS live.

## Adding a module

`lib/modules.ts` is the registry the whole shell is built around. Adding Phase 3's
research module is one entry there plus a page — navigation, the overview
sidebar, and the modules page all pick it up automatically. Modules that aren't
built yet are listed with `state: "planned"` and render honestly as planned,
rather than being hidden or looking broken.

## Where the data comes from

- **Postgres** (`LOG_DATABASE_URL`, Neon) — `agent_actions`, written by the
  orchestrator's trust layer. Read via `lib/db.ts`, which returns empty results
  and an error string rather than throwing, so a database blip renders a message
  instead of an error page.
- **MongoDB** (`MONGO_URL`) — `job_matches` and `job_applications`, the same
  collections `job-tracker-mcp` uses. `lib/mongo.ts` is the human's read path;
  the MCP tools are the agent's. Same collections, one source of truth. Leave
  `MONGO_URL` unset and the Jobs page explains what's missing instead of failing.
- **Filesystem** (`RESUME_DIR`) — must match `RESUME_DIR` in
  `mcp-servers/job-tracker-mcp/.env`, since the Resumes page writes to the same
  directory `select_best_resume` reads from.

## A boundary worth keeping

`/api/jobs/[id]` only ever sets the `status` label on a job match. There is
deliberately no endpoint that creates a `job_applications` row from a match —
marking one "applied" is bookkeeping, and logging a real application stays an
explicit separate step. That's the same boundary the n8n webhook respects on the
ingestion side, and it's what keeps "the automation found this" and "I applied to
this" from ever quietly becoming the same claim.
