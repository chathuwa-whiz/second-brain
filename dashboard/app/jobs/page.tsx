import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { fetchApplications, fetchJobMatches, mongoConfigured } from "@/lib/mongo";
import PageHeader from "@/components/PageHeader";
import { EmptyState } from "@/components/ui";
import JobsBoard from "./JobsBoard";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  if (!mongoConfigured()) {
    return (
      <>
        <PageHeader
          eyebrow="Job finding"
          title="Jobs"
          description="Matches from the daily search, and the applications you've logged."
        />
        <EmptyState
          title="Not connected to the job database yet"
          body="Add MONGO_URL to dashboard/.env.local, using the same connection string as mcp-servers/job-tracker-mcp/.env so both read the same data."
        />
      </>
    );
  }

  const [{ matches, error: matchesError }, { applications, error: appsError }] =
    await Promise.all([fetchJobMatches(undefined, 150), fetchApplications(150)]);

  return (
    <>
      <PageHeader
        eyebrow="Job finding"
        title="Jobs"
        description="Matches the daily search found, and the applications you've logged. A match becomes an application only when you say so."
      />
      <JobsBoard
        initialMatches={matches}
        applications={applications}
        matchesError={matchesError}
        applicationsError={appsError}
      />
    </>
  );
}
