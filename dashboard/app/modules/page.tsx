import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { fetchStats } from "@/lib/db";
import {
  MODULES,
  MODULE_STATE_LABEL,
  MODULE_STATE_TONE,
} from "@/lib/modules";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ModulesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { stats } = await fetchStats();
  const counts = new Map(stats.byModule.map((r) => [r.module, r.count]));

  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Modules"
        description="Each part of your life the agent can act on. Modules that aren't built yet are listed honestly rather than hidden — this is the roadmap, not a wishlist."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {MODULES.map((m) => {
          const count = m.logKey ? (counts.get(m.logKey) ?? 0) : 0;
          return (
            <Card key={m.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-primary">
                    {m.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted">
                    {m.server ?? "no server yet"}
                  </p>
                </div>
                <Badge tone={MODULE_STATE_TONE[m.state]}>
                  {MODULE_STATE_LABEL[m.state]}
                </Badge>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-secondary">
                {m.summary}
              </p>

              <ul className="mt-4 space-y-1.5">
                {m.capabilities.map((c) => (
                  <li
                    key={c}
                    className="flex items-start gap-2 text-xs text-secondary"
                  >
                    <span
                      className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${
                        m.state === "live" ? "bg-ok" : "bg-muted"
                      }`}
                    />
                    {c}
                  </li>
                ))}
              </ul>

              <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4">
                <span className="tnum text-xs text-muted">
                  {m.state === "live"
                    ? `${count} action${count === 1 ? "" : "s"} logged`
                    : "not logging yet"}
                </span>
                {m.href && (
                  <Link
                    href={m.href}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Open {m.name}
                  </Link>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
