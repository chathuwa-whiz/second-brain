import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { adminGetPlatformStats, adminListAllActions } from "@/lib/db";
import AdminHeader from "@/components/admin/AdminHeader";
import { Card, SectionHeader, StatTile, Badge } from "@/components/ui";
import {
  IconUsers,
  IconActivity,
  IconCheck,
  IconKey,
  IconShield,
  IconServer,
  IconMail,
  IconJobs,
  IconTasks,
} from "@/components/icons";
import Link from "next/link";
import { formatTimeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== "admin") {
    redirect("/");
  }

  const [platformStats, recentActionsData] = await Promise.all([
    adminGetPlatformStats(),
    adminListAllActions({ limit: 8 }),
  ]);

  const { users, actions, ecosystem } = platformStats;
  const autoRate =
    actions.total > 0
      ? Math.round((actions.autoExecuted / actions.total) * 100)
      : 0;

  return (
    <>
      <AdminHeader
        title="Platform Command Center"
        description="Comprehensive system telemetry, multi-tenant agent execution pipeline, and infrastructure status."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/users"
              className="press inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-accent/25 hover:bg-accent-hover transition-colors"
            >
              <IconUsers className="h-4 w-4" />
              Manage Users
            </Link>
          </div>
        }
      />

      {/* Top Level Telemetry Tiles */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label="Total Users"
          value={users.total}
          hint={`${users.verified} verified • ${users.admins} admin`}
          tone={users.total > 0 ? "accent" : "neutral"}
        />
        <StatTile
          label="Agent Actions (24h)"
          value={actions.last24h}
          hint={`${actions.total} lifetime total`}
          tone={actions.last24h > 0 ? "ok" : "neutral"}
        />
        <StatTile
          label="Autonomous Execution"
          value={`${autoRate}%`}
          hint={`${actions.autoExecuted} auto-run • ${actions.pending} pending`}
          tone={autoRate >= 70 ? "ok" : "accent"}
        />
        <StatTile
          label="Platform API Keys"
          value={ecosystem.apiKeys}
          hint={`${ecosystem.jobMatches} job matches tracked`}
          tone="neutral"
        />
      </section>

      {/* System Infrastructure Health Grid */}
      <section className="mt-8">
        <SectionHeader
          eyebrow="Infrastructure"
          title="Subsystem Health & Relays"
          description="Operational status of backend data stores, mail transports, and external connections."
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-500">
                  <IconServer className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-primary">MongoDB Cluster</p>
                  <p className="text-3xs text-muted">Primary Store</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-3xs font-medium text-emerald-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Healthy
              </span>
            </div>
            <p className="mt-3 text-2xs text-secondary">
              Storing user identities, action logs, system settings, and job matches.
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500/15 text-blue-500">
                  <IconMail className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-primary">Application Dispatch</p>
                  <p className="text-3xs text-muted">Gmail Web / Portal</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-3xs font-medium text-emerald-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            </div>
            <p className="mt-3 text-2xs text-secondary truncate">
              1-Click Gmail Web & Careers Portal
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-500/15 text-indigo-500">
                  <IconJobs className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-primary">FastMCP Fleet</p>
                  <p className="text-3xs text-muted">2 Live Modules</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-3xs font-medium text-emerald-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
            <p className="mt-3 text-2xs text-secondary">
              Job Tracker & Daily Tasks MCP servers active.
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500/15 text-violet-500">
                  <IconKey className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-primary">External Ingress</p>
                  <p className="text-3xs text-muted">Webhooks & Keys</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-3xs font-medium text-emerald-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Listening
              </span>
            </div>
            <p className="mt-3 text-2xs text-secondary">
              Scraper webhooks and API authentication ready.
            </p>
          </Card>
        </div>
      </section>

      {/* Module Breakdown & Live Actions Grid */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Module Distribution Column */}
        <section className="lg:col-span-1">
          <SectionHeader
            eyebrow="Distribution"
            title="Module Activity"
            description="Lifetime execution counts across modules."
          />

          <Card className="divide-y divide-hairline/15 p-0">
            {actions.byModule.length === 0 ? (
              <div className="p-5 text-center text-xs text-muted">
                No module execution logs recorded yet.
              </div>
            ) : (
              actions.byModule.map((m) => {
                const percentage =
                  actions.total > 0
                    ? Math.round((m.count / actions.total) * 100)
                    : 0;
                return (
                  <div key={m.module} className="flex items-center justify-between p-3.5 sm:p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium capitalize text-primary">
                          {m.module.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs font-semibold text-secondary">
                          {m.count} ({percentage}%)
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-primary/[0.06]">
                        <div
                          className="h-full rounded-full bg-accent transition-all duration-500"
                          style={{ width: `${Math.max(4, percentage)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            <div className="p-3 bg-primary/[0.02]">
              <div className="flex items-center justify-between text-2xs text-secondary">
                <span>Action Status Split</span>
                <span>
                  {actions.autoExecuted} auto / {actions.approved} manual / {actions.rejected} rejected
                </span>
              </div>
            </div>
          </Card>
        </section>

        {/* Global Live Action Stream */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <SectionHeader
              eyebrow="Global Audit"
              title="Recent Agent Actions"
              description="Real-time multi-tenant stream of decisions and tool executions."
            />
            <Link
              href="/admin/actions"
              className="text-xs font-medium text-accent hover:underline"
            >
              View all ({actions.total}) →
            </Link>
          </div>

          <Card className="divide-y divide-hairline/15 p-0">
            {recentActionsData.actions.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted">
                No recent agent actions found.
              </div>
            ) : (
              recentActionsData.actions.map((act) => {
                const confNum = Number(act.confidence || 0);
                const confPercent = isNaN(confNum) ? 0 : Math.round(confNum * 100);

                let statusBadgeTone: "ok" | "warn" | "neutral" | "danger" = "neutral";
                if (act.status === "auto_executed" || act.status === "approved") {
                  statusBadgeTone = "ok";
                } else if (act.status === "pending") {
                  statusBadgeTone = "warn";
                } else if (act.status === "rejected" || act.status === "failed") {
                  statusBadgeTone = "danger";
                }

                return (
                  <div
                    key={String(act.id)}
                    className="flex flex-col gap-2 p-3.5 sm:p-4 hover:bg-primary/[0.02] transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-accent/15 px-2 py-0.5 text-3xs font-semibold capitalize text-accent-ink">
                          {act.module.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs font-semibold text-primary">
                          {act.action.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={statusBadgeTone}>
                          {act.status.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-3xs text-muted">
                          {formatTimeAgo(act.created_at)}
                        </span>
                      </div>
                    </div>

                    {act.reasoning && (
                      <p className="text-xs text-secondary line-clamp-2 leading-relaxed">
                        {act.reasoning}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-3xs text-muted pt-1">
                      <span className="truncate max-w-[200px] sm:max-w-xs">
                        User: {act.userEmail || act.user_id || "System"}
                      </span>
                      <span>Confidence: {confPercent}%</span>
                    </div>
                  </div>
                );
              })
            )}
          </Card>
        </section>
      </div>
    </>
  );
}
