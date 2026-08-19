import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import { SectionHeader } from "@/components/ui";
import AppearancePicker from "./AppearancePicker";
import BillingCard from "./BillingCard";
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
        description="Manage your workspace plan, appearance, and developer integrations. Module-specific settings live inside each module."
      />

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-2">
        {/* Section 0: Workspace Plan */}
        <section>
          <SectionHeader eyebrow="Plan" title="Workspace Access" />
          <BillingCard />
        </section>

        {/* Section 1: Appearance */}
        <section>
          <SectionHeader eyebrow="Display" title="Theme & Appearance" />
          <AppearancePicker />
        </section>

        {/* Section 2: Advanced & Developer Tools (Collapsible) */}
        <section className="lg:col-span-2">
          <SectionHeader eyebrow="Power Users" title="External Automations" />
          <AdvancedDeveloperCard />
        </section>
      </div>
    </>
  );
}
