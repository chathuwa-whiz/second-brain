import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import ResumesManager from "./ResumesManager";

export const dynamic = "force-dynamic";

export default async function ResumesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <>
      <PageHeader
        eyebrow="Job finding"
        title="Resumes"
        description="The agent picks between these when it scores a posting, so keep the tailored versions here rather than one general one."
      />
      <ResumesManager />
    </>
  );
}
