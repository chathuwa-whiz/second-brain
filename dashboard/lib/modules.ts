/*
  The module registry.

  This is the seam the whole control panel is designed around: every phase of
  the second-brain adds a module, and each one needs a nav entry, a status, and
  somewhere to live. Declaring them here - including the ones that don't exist
  yet - means adding Phase 3's research module is a one-line change plus a page,
  not a navigation redesign.

  `state` is honest on purpose. A module marked "planned" renders as planned in
  the UI rather than looking broken or pretending to work.
*/

export type ModuleState = "live" | "building" | "planned";

export type ModuleDef = {
  id: string;
  name: string;
  /** Matches the `module` column in agent_actions, when the module logs there. */
  logKey: string | null;
  state: ModuleState;
  href: string | null;
  /** Where this module's own settings live, if it has any yet. */
  settingsHref: string | null;
  summary: string;
  /** MCP server backing it, if any - shown on the modules page. */
  server: string | null;
  capabilities: string[];
};

export const MODULES: ModuleDef[] = [
  {
    id: "job-finding",
    name: "Jobs",
    logKey: "job_finding",
    state: "live",
    href: "/jobs",
    settingsHref: "/jobs/settings",
    summary:
      "Finds openings daily, scores them against your resumes, and tracks every application through to an offer or a no.",
    server: "job-tracker-mcp",
    capabilities: [
      "Daily search across four job boards",
      "Fit scoring and best-resume selection",
      "Application tracking and follow-up reminders",
      "Cover letter drafts, never sent automatically",
    ],
  },
  {
    id: "tasks",
    name: "Daily Tasks",
    logKey: "tasks",
    state: "live",
    href: "/tasks",
    settingsHref: null,
    summary:
      "Captures what needs doing and when, so routines and one-offs live in the same place the agent can act on.",
    server: "task-mcp",
    capabilities: ["Add and complete tasks", "Due dates and recurrence"],
  },
  {
    id: "research",
    name: "Research",
    logKey: "research",
    state: "live",
    href: "/research",
    settingsHref: null,
    summary:
      "Saves what you read and answers questions from it later, with vector search and citations back to the source.",
    server: "research-mcp",
    capabilities: [
      "URL article & document ingestion",
      "Vector chunking and hybrid semantic search",
      "Grounded RAG synthesis with source citations",
    ],
  },
  {
    id: "lectures",
    name: "Lectures",
    logKey: "lectures",
    state: "planned",
    href: null,
    settingsHref: null,
    summary:
      "Turns recorded lectures and slides into searchable notes tied to the module they belong to.",
    server: null,
    capabilities: ["Transcription", "Summaries per module", "Exam-prep recall"],
  },
  {
    id: "business",
    name: "Business",
    logKey: "business",
    state: "planned",
    href: null,
    settingsHref: null,
    summary:
      "Tracks the VPN bot and other side projects: customers, revenue, and what needs attention.",
    server: null,
    capabilities: ["Customer and subscription state", "Revenue overview"],
  },
];

export const LIVE_MODULES = MODULES.filter((m) => m.state === "live");

export function moduleByLogKey(key: string): ModuleDef | undefined {
  return MODULES.find((m) => m.logKey === key);
}

export function moduleLabel(key: string): string {
  return moduleByLogKey(key)?.name ?? key.replace(/_/g, " ");
}

export const MODULE_STATE_TONE = {
  live: "ok",
  building: "warn",
  planned: "neutral",
} as const;

export const MODULE_STATE_LABEL = {
  live: "Live",
  building: "In progress",
  planned: "Planned",
} as const;
