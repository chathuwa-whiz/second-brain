import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { mongoConfigured } from "@/lib/mongo";
import { oracleConfigured } from "@/lib/db";
import PageHeader from "@/components/PageHeader";
import { Badge, Card, ConfidenceMeter, SectionHeader } from "@/components/ui";
import AppearancePicker from "./AppearancePicker";
import EmailSettingsCard from "./EmailSettingsCard";
import DangerZoneCard from "./DangerZoneCard";

export const dynamic = "force-dynamic";

const THRESHOLD = Number(
  process.env.NEXT_PUBLIC_AUTO_EXECUTE_CONFIDENCE_THRESHOLD ?? "0.75"
);

function ConnectionRow({
  name,
  detail,
  connected,
}: {
  name: string;
  detail: string;
  connected: boolean;
}) {
  return (
    <div className="flex flex-col justify-between gap-2.5 p-3.5 xs:flex-row xs:items-center xs:gap-4 sm:p-4">
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium text-primary">{name}</p>
        <p className="mt-0.5 break-words text-xs text-muted">{detail}</p>
      </div>
      <div className="shrink-0 self-start xs:self-center">
        <Badge tone={connected ? "ok" : "warn"}>
          {connected ? "Configured" : "Not set"}
        </Badge>
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="How the control panel looks, Google SMTP delivery credentials, and what it's currently wired up to."
      />

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-2">
        <section>
          <SectionHeader eyebrow="Display" title="Appearance" />
          <AppearancePicker />
        </section>

        <section>
          <SectionHeader eyebrow="Applications" title="Email & Google SMTP Delivery" />
          <EmailSettingsCard />
        </section>

        <section>
          <SectionHeader eyebrow="Safety" title="When the agent asks first" />
          <Card className="p-4 sm:p-5">
            <p className="text-xs leading-relaxed text-secondary sm:text-sm">
              The planner scores its own confidence in every action. At or above{" "}
              <span className="tnum font-semibold text-primary">
                {THRESHOLD.toFixed(2)}
              </span>{" "}
              the action runs immediately. Below it, the action waits in
              Approvals for your decision.
            </p>

            <div className="mt-4 rounded-xl bg-primary/[0.04] p-3.5 sm:p-4">
              <p className="mb-2.5 text-2xs font-semibold uppercase tracking-widest text-muted">
                The bar
              </p>
              <ConfidenceMeter value={THRESHOLD} threshold={THRESHOLD} />
            </div>

            <p className="mt-4 text-xs leading-relaxed text-secondary sm:text-sm">
              Anything that deletes, removes, sends, or pays is capped below the
              bar in code, so it always waits for you no matter how confident
              the model claims to be. Change the threshold with{" "}
              <code className="break-all rounded bg-primary/[0.06] px-1.5 py-0.5 text-2xs sm:text-xs">
                AUTO_EXECUTE_CONFIDENCE_THRESHOLD
              </code>{" "}
              in the orchestrator&apos;s environment.
            </p>
          </Card>
        </section>

        <section className="lg:col-span-2">
          <SectionHeader eyebrow="Infrastructure" title="Connections" />
          <Card className="divide-y overflow-hidden">
            <ConnectionRow
              name="Action log & Trust layer"
              detail="Oracle Autonomous AI Database (23ai) — every decision, approval, and execution result"
              connected={oracleConfigured() || Boolean(process.env.LOG_DATABASE_URL)}
            />
            <ConnectionRow
              name="Job database"
              detail="MongoDB — job matches and applications"
              connected={mongoConfigured()}
            />
            <ConnectionRow
              name="Resume storage"
              detail="Shared directory the agent reads resumes from"
              connected={Boolean(process.env.RESUME_DIR)}
            />
          </Card>
        </section>

        <section className="lg:col-span-2">
          <SectionHeader eyebrow="Danger Zone" title="Reset & Maintenance" />
          <DangerZoneCard />
        </section>
      </div>
    </>
  );
}
