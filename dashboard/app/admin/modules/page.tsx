import { MODULES, MODULE_STATE_LABEL, MODULE_STATE_TONE } from "@/lib/modules";
import AdminHeader from "@/components/admin/AdminHeader";
import { Card, SectionHeader, Badge } from "@/components/ui";
import { IconServer, IconCheck, IconJobs, IconTasks } from "@/components/icons";

export const dynamic = "force-dynamic";

export default function AdminModulesPage() {
  const liveModules = MODULES.filter((m) => m.state === "live");
  const plannedModules = MODULES.filter((m) => m.state !== "live");

  return (
    <>
      <AdminHeader
        title="MCP Server Fleet & Modules"
        description="Monitor FastMCP servers, registered tool surfaces, and agent orchestration pipelines."
      />

      <div className="space-y-8">
        {/* Live Active Modules */}
        <section>
          <SectionHeader
            eyebrow="Active Pipeline"
            title="Live FastMCP Servers"
            description="Servers currently connected and processing autonomous agent tasks."
          />

          <div className="grid gap-4 md:grid-cols-2">
            {liveModules.map((m) => (
              <Card key={m.id} className="p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-accent-ink">
                        <IconServer className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-primary">{m.name}</h3>
                        <p className="font-mono text-3xs text-muted">{m.server || "In-process MCP"}</p>
                      </div>
                    </div>

                    <Badge tone={MODULE_STATE_TONE[m.state]}>
                      {MODULE_STATE_LABEL[m.state]}
                    </Badge>
                  </div>

                  <p className="mt-3 text-xs text-secondary leading-relaxed">
                    {m.summary}
                  </p>

                  <div className="mt-4 border-t border-hairline/15 pt-3">
                    <p className="text-3xs font-semibold uppercase tracking-wider text-muted mb-2">
                      Registered Tool Capabilities
                    </p>
                    <ul className="space-y-1">
                      {m.capabilities.map((c) => (
                        <li key={c} className="flex items-center gap-2 text-2xs text-secondary">
                          <IconCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-hairline/15 pt-3 text-3xs text-muted">
                  <span>Log Key: <code className="text-primary">{m.logKey}</code></span>
                  <span>FastMCP • Python</span>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Planned / Upcoming Modules */}
        <section>
          <SectionHeader
            eyebrow="Roadmap"
            title="Registered Architecture (Phases 3 - 6)"
            description="Standardized MCP endpoints declared in the central system registry."
          />

          <div className="grid gap-4 md:grid-cols-3">
            {plannedModules.map((m) => (
              <Card key={m.id} className="p-4 flex flex-col justify-between opacity-85">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-primary">{m.name}</h4>
                    <Badge tone="neutral">{MODULE_STATE_LABEL[m.state]}</Badge>
                  </div>
                  <p className="mt-2 text-2xs text-secondary leading-relaxed">
                    {m.summary}
                  </p>
                </div>

                <div className="mt-3 border-t border-hairline/15 pt-2 text-3xs text-muted font-mono">
                  Module ID: {m.id}
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
