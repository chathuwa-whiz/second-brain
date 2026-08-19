import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import { SectionHeader } from "@/components/ui";
import WorkspaceSetupCard from "./WorkspaceSetupCard";
import AiJobSearchCard from "./AiJobSearchCard";
import AiAutonomyCard from "./AiAutonomyCard";

export const dynamic = "force-dynamic";

export default async function JobsPreferencesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <>
      <PageHeader
        eyebrow="Jobs"
        title="Preferences"
        description="Manage your target job search roles, AI autonomy level, and the onboarding wizard."
      />

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-2">
        {/* Section 0: Interactive Workspace Setup Wizard */}
        <section className="lg:col-span-2">
          <SectionHeader eyebrow="Quick Setup" title="Workspace Onboarding Wizard" />
          <WorkspaceSetupCard />
        </section>

        {/* Section 1: AI Job Search & Matching Targets */}
        <section className="lg:col-span-2">
          <SectionHeader eyebrow="AI Agent" title="Job Discovery & Targets" />
          <AiJobSearchCard />
        </section>

        {/* Section 2: Application Autonomy Mode */}
        <section className="lg:col-span-2">
          <SectionHeader eyebrow="Control" title="Application Review Mode" />
          <AiAutonomyCard />
        </section>
      </div>
    </>
  );
}
