"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconJobs,
  IconApprovals,
  IconResumes,
  IconSettings,
} from "@/components/icons";

const JOBS_TABS = [
  { href: "/jobs", label: "Board", Icon: IconJobs },
  { href: "/jobs/approvals", label: "Approvals", Icon: IconApprovals },
  { href: "/jobs/resumes", label: "Resumes", Icon: IconResumes },
  { href: "/jobs/settings", label: "Settings", Icon: IconSettings },
];

export default function JobsNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex overflow-x-auto no-scrollbar gap-1 rounded-2xl border border-hairline/20 bg-raised/60 p-1.5 backdrop-blur-md">
      {JOBS_TABS.map((tab) => {
        const isActive =
          tab.href === "/jobs"
            ? pathname === "/jobs"
            : pathname.startsWith(tab.href);
        const { Icon } = tab;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`press flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
              isActive
                ? "bg-accent text-white shadow-md shadow-accent/25"
                : "text-secondary hover:bg-primary/[0.06] hover:text-primary"
            }`}
          >
            <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-muted"}`} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
