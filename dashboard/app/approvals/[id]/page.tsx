import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { fetchActionById, getEmailSettings } from "@/lib/db";
import PageHeader from "@/components/PageHeader";
import { ErrorNote } from "@/components/ui";
import ApprovalEditor from "./ApprovalEditor";

export const dynamic = "force-dynamic";

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { id } = await params;
  const actionId = Number(id);
  if (!Number.isInteger(actionId)) {
    notFound();
  }

  const [{ action, error }, emailSettings] = await Promise.all([
    fetchActionById(actionId),
    getEmailSettings(),
  ]);

  if (error || !action) {
    return (
      <>
        <PageHeader
          eyebrow="Approvals"
          title="Approval Not Found"
          description="Could not load the requested action."
        />
        <ErrorNote>{error || "This action does not exist or has been deleted."}</ErrorNote>
      </>
    );
  }

  const meta = action.metadata || {};

  return (
    <>
      <PageHeader
        eyebrow="Job Application Approval"
        title={meta.job_title ? `${meta.job_title} at ${meta.company}` : action.action.replace(/_/g, " ")}
        description="Review candidate match details, customize your email and resume selection, then approve to send."
      />
      <ApprovalEditor
        action={action}
        defaultSender={emailSettings.default_sender_email}
      />
    </>
  );
}
