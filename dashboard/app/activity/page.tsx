import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { fetchActions } from "@/lib/db";
import PageHeader from "@/components/PageHeader";
import { EmptyState, ErrorNote } from "@/components/ui";
import ActivityFeed from "./ActivityFeed";

export const dynamic = "force-dynamic";

const THRESHOLD = Number(
  process.env.NEXT_PUBLIC_AUTO_EXECUTE_CONFIDENCE_THRESHOLD ?? "0.75"
);

export default async function ActivityPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { actions, error } = await fetchActions({ limit: 200 });

  return (
    <>
      <PageHeader
        eyebrow="Activity"
        title="Everything the agent has done"
        description="Every decision, the reasoning behind it, and how confident the planner was. Newest first."
      />
      {error ? (
        <ErrorNote>Can&apos;t reach the action log right now. {error}</ErrorNote>
      ) : actions.length === 0 ? (
        <EmptyState
          title="The log is empty"
          body="Every tool call the orchestrator makes gets written here before it runs. Send it a request to see the first entry."
        />
      ) : (
        <ActivityFeed initial={actions} threshold={THRESHOLD} />
      )}
    </>
  );
}
