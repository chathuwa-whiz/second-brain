import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import JobsNav from "@/components/JobsNav";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function JobsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <JobsNav />
      {children}
    </div>
  );
}
