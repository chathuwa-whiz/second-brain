import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { fetchActions, fetchStats } from "@/lib/db";
import { MODULES, MODULE_STATE_LABEL, MODULE_STATE_TONE } from "@/lib/modules";
import PageHeader from "@/components/PageHeader";
import ActionCard from "@/components/ActionCard";
import {
  Badge,
  Card,
  EmptyState,
  ErrorNote,
  SectionHeader,
  StatTile,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const THRESHOLD = Number(
  process.env.NEXT_PUBLIC_AUTO_EXECUTE_CONFIDENCE_THRESHOLD ?? "0.75"
);

export default async function OverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [{ stats, error: statsError }, { actions, error: actionsError }] =
    await Promise.all([fetchStats(), fetchActions({ limit: 6 })]);

  const error = statsError ?? actionsError;
  const liveCount = MODULES.filter((m) => m.state === "live").length;

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={`Good to see you, ${session.user?.name ?? "there"}`}
        description="What the agent has been doing, and anything waiting on your call."
      />

      {error && (
        <div className="mb-6">
          <ErrorNote>
            Can&apos;t reach the action log right now. {error}
          </ErrorNote>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Waiting on you"
          value={stats.pending}
          hint={stats.pending === 1 ? "1 decision queued" : "decisions queued"}
          tone={stats.pending > 0 ? "warn" : "neutral"}
          href="/approvals"
        />
        <StatTile
          label="Ran on its own"
          value={stats.autoExecuted}
          hint="cleared the confidence bar"
          tone="accent"
          href="/activity"
        />
        <StatTile
          label="Last 24 hours"
          value={stats.last24h}
          hint="actions logged"
          tone="violet"
          href="/activity"
        />
        <StatTile
          label="Modules live"
          value={`${liveCount}/${MODULES.length}`}
          hint="the rest are on the roadmap"
          tone="ok"
          href="/modules"
        />
      </div>

      <div className="mt-9 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <SectionHeader
            eyebrow="Latest"
            title="Recent activity"
            action={
              <a
                href="/activity"
                className="text-sm font-medium text-accent hover:underline"
              >
                See all
              </a>
            }
          />
          {actions.length === 0 ? (
            <EmptyState
              title="Nothing logged yet"
              body="Run a request through the orchestrator and every decision it makes will land here, with the reasoning behind it."
            />
          ) : (
            <div className="space-y-3">
              {actions.map((a, i) => (
                <ActionCard
                  key={a.id}
                  action={a}
                  threshold={THRESHOLD}
                  index={i}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section>
            <SectionHeader eyebrow="System" title="Modules" />
            <Card className="divide-y overflow-hidden">
              {MODULES.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    {m.href ? (
                      <a
                        href={m.href}
                        className="text-sm font-medium text-primary hover:text-accent"
                      >
                        {m.name}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-primary">
                        {m.name}
                      </p>
                    )}
                    <p className="truncate text-xs text-muted">
                      {m.server ?? "not built yet"}
                    </p>
                  </div>
                  <Badge tone={MODULE_STATE_TONE[m.state]}>
                    {MODULE_STATE_LABEL[m.state]}
                  </Badge>
                </div>
              ))}
            </Card>
          </section>

          {stats.byModule.length > 0 && (
            <section>
              <SectionHeader eyebrow="Distribution" title="Actions by module" />
              <Card className="space-y-3 p-4">
                {stats.byModule.map((row) => {
                  const pct = stats.total
                    ? Math.round((row.count / stats.total) * 100)
                    : 0;
                  return (
                    <div key={row.module}>
                      <div className="mb-1.5 flex items-baseline justify-between text-xs">
                        <span className="font-medium capitalize text-secondary">
                          {row.module.replace(/_/g, " ")}
                        </span>
                        <span className="tnum text-muted">{row.count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-primary/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-accent to-violet"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </Card>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
