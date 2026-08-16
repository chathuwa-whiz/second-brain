"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconShield,
  IconUsers,
  IconAudit,
  IconKey,
  IconServer,
  IconSettings,
} from "@/components/icons";

const ADMIN_TABS = [
  { href: "/admin", label: "Overview", Icon: IconShield },
  { href: "/admin/users", label: "Users", Icon: IconUsers },
  { href: "/admin/actions", label: "Audit Logs", Icon: IconAudit },
  { href: "/admin/api-keys", label: "API Keys", Icon: IconKey },
  { href: "/admin/modules", label: "MCP Fleet", Icon: IconServer },
  { href: "/admin/settings", label: "Platform Settings", Icon: IconSettings },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex overflow-x-auto no-scrollbar gap-1 rounded-2xl border border-hairline/20 bg-raised/60 p-1.5 backdrop-blur-md">
      {ADMIN_TABS.map((tab) => {
        const isActive =
          tab.href === "/admin"
            ? pathname === "/admin"
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
