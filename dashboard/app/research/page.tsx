import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { fetchResearchSources } from "@/lib/research";
import ResearchClient from "./ResearchClient";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session.user as any)?.id || (session.user as any)?.email;
  const { sources, error } = await fetchResearchSources({ userId, limit: 100 });

  return (
    <ResearchClient
      initialSources={sources}
      initialError={error}
      currentUser={{
        id: userId,
        name: session.user?.name ?? null,
        email: session.user?.email ?? null,
      }}
    />
  );
}
