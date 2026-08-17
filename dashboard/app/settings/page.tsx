import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import { SectionHeader } from "@/components/ui";
import AppearancePicker from "./AppearancePicker";
import BillingCard from "./BillingCard";
import AiJobSearchCard from "./AiJobSearchCard";
import AiAutonomyCard from "./AiAutonomyCard";
import WorkspaceSetupCard from "./WorkspaceSetupCard";
import AdvancedDeveloperCard from "./AdvancedDeveloperCard";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <>
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Manage your target job search roles, AI autonomy level, workspace plan, and appearance."
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

        {/* Section 3: Workspace Plan */}
        <section>
          <SectionHeader eyebrow="Plan" title="Workspace Access" />
          <BillingCard />
        </section>

        {/* Section 4: Appearance */}
        <section>
          <SectionHeader eyebrow="Display" title="Theme & Appearance" />
          <AppearancePicker />
        </section>

        {/* Section 5: Advanced & Developer Tools (Collapsible) */}
        <section className="lg:col-span-2">
          <SectionHeader eyebrow="Power Users" title="External Automations" />
          <AdvancedDeveloperCard />
        </section>
      </div>
    </>
  );
}
