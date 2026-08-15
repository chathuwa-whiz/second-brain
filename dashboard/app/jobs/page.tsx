import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { fetchApplications, fetchJobMatches, mongoConfigured } from "@/lib/mongo";
import { fetchActions } from "@/lib/db";
import PageHeader from "@/components/PageHeader";
import JobsBoard from "./JobsBoard";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [
    { actions: jobActions, error: actionsError },
    mongoMatchesResult,
    mongoAppsResult,
  ] = await Promise.all([
    fetchActions({ module: "job_finding", limit: 150 }),
    mongoConfigured()
      ? fetchJobMatches(undefined, 150)
      : Promise.resolve({ matches: [], error: null }),
    mongoConfigured()
      ? fetchApplications(150)
      : Promise.resolve({ applications: [], error: null }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Job finding & Matching"
        title="Jobs"
        description="Autonomous daily search matches, AI resume recommendations, and applications sent through Second Brain."
      />
      <JobsBoard
        jobActions={jobActions}
        initialMatches={mongoMatchesResult.matches}
        applications={mongoAppsResult.applications}
        matchesError={mongoMatchesResult.error}
        applicationsError={mongoAppsResult.error}
        actionsError={actionsError}
      />
    </>
  );
}
