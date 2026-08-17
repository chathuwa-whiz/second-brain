import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { fetchActions } from "@/lib/db";
import PageHeader from "@/components/PageHeader";
import { ErrorNote } from "@/components/ui";
import ApprovalQueue from "./ApprovalQueue";

export const dynamic = "force-dynamic";

const THRESHOLD = Number(
  process.env.NEXT_PUBLIC_AUTO_EXECUTE_CONFIDENCE_THRESHOLD ?? "0.75"
);

export default async function ApprovalsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session.user as any)?.id;
  const userRole = (session.user as any)?.role;

  const { actions, error } = await fetchActions({
    status: "pending",
    limit: 100,
    userId: userRole === "admin" ? undefined : userId,
  });

  return (
    <>
      <PageHeader
        eyebrow="Approvals"
        title="Waiting on you"
        description={`The agent runs an action itself when its confidence clears ${THRESHOLD.toFixed(2)}. Everything below that bar — plus anything that deletes or sends — stops here first.`}
      />
      {error ? (
        <ErrorNote>Can&apos;t reach the action log right now. {error}</ErrorNote>
      ) : (
        <ApprovalQueue initial={actions} threshold={THRESHOLD} />
      )}
    </>
  );
}
