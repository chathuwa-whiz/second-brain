"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, useEffect, type ReactNode } from "react";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { withBasePath } from "@/lib/basePath";
import { MODULES, LIVE_MODULES } from "@/lib/modules";
import {
  IconOverview,
  IconActivity,
  IconJobs,
  IconApprovals,
  IconResumes,
  IconTasks,
  IconResearch,
  IconModules,
  IconSettings,
  IconSignOut,
  IconMenu,
  IconShield,
  IconUsers,
  IconAudit,
  IconKey,
  IconServer,
} from "./icons";

type NavItem = {
  href: string;
  label: string;
  Icon: (p: { className?: string }) => JSX.Element;
  /** Shown in the mobile tab bar - the rest live behind the menu. */
  primary?: boolean;
  adminOnly?: boolean;
  /** Only "/" and "/admin" needed this before Board - see isActive(). */
  exact?: boolean;
  /** Rendered indented under this item in the desktop rail; Jobs is the only
      module with sub-pages mature enough to need this today. */
  children?: NavItem[];
};

/*
  Icons live here, not in lib/modules.ts - the registry is plain data (a
  future mobile client reads it too), and icons are React components. Keying
  off module id keeps this in sync automatically when a module's state flips
  to "live"; only genuinely new modules need an entry added here.
*/
const MODULE_ICONS: Record<string, NavItem["Icon"]> = {
  tasks: IconTasks,
  research: IconResearch,
};

/* Which live modules earn a slot in the mobile bottom tab bar - that's
   precious real estate, so this is a deliberate curation, not "all of them".
   Jobs always gets a slot (set directly on JOBS_NAV_ITEM below). */
const MOBILE_PRIMARY_MODULE_IDS = new Set(["tasks"]);

const JOBS_MODULE = MODULES.find((m) => m.id === "job-finding")!;

const JOBS_NAV_ITEM: NavItem = {
  href: JOBS_MODULE.href!,
  label: JOBS_MODULE.name,
  Icon: IconJobs,
  primary: true,
  children: [
    { href: "/jobs", label: "Board", Icon: IconJobs, exact: true },
    { href: "/jobs/approvals", label: "Approvals", Icon: IconApprovals },
    { href: "/jobs/resumes", label: "Resumes", Icon: IconResumes },
    { href: JOBS_MODULE.settingsHref!, label: "Preferences", Icon: IconSettings },
  ],
};

const MODULE_NAV_ITEMS: NavItem[] = [
  JOBS_NAV_ITEM,
  ...LIVE_MODULES.filter(
    (m) => m.id !== "job-finding" && m.href && MODULE_ICONS[m.id]
  ).map((m) => ({
    href: m.href as string,
    label: m.name,
    Icon: MODULE_ICONS[m.id],
    primary: MOBILE_PRIMARY_MODULE_IDS.has(m.id),
  })),
];

const BASE_NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Oversight",
    items: [
      { href: "/", label: "Overview", Icon: IconOverview, primary: true },
      { href: "/activity", label: "Activity", Icon: IconActivity, primary: true },
    ],
  },
  {
    group: "Modules",
    items: MODULE_NAV_ITEMS,
  },
  {
    group: "System",
    items: [
      { href: "/modules", label: "Modules", Icon: IconModules },
      { href: "/settings", label: "Settings", Icon: IconSettings },
    ],
  },
];

const ADMIN_GROUP: { group: string; items: NavItem[] } = {
  group: "Admin Console",
  items: [
    { href: "/admin", label: "Platform Overview", Icon: IconShield, adminOnly: true },
    { href: "/admin/users", label: "User Accounts", Icon: IconUsers, adminOnly: true },
    { href: "/admin/actions", label: "Audit Logs", Icon: IconAudit, adminOnly: true },
    { href: "/admin/api-keys", label: "API Keys", Icon: IconKey, adminOnly: true },
    { href: "/admin/modules", label: "MCP Servers", Icon: IconServer, adminOnly: true },
    { href: "/admin/settings", label: "Platform Settings", Icon: IconSettings, adminOnly: true },
  ],
};

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/admin") return pathname === "/admin";
  if (exact) return pathname === href;
  return pathname.startsWith(href);
}

function NavLink({
  item,
  onNavigate,
  nested,
}: {
  item: NavItem;
  onNavigate?: () => void;
  nested?: boolean;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href, item.exact);
  const { Icon } = item;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`press group relative flex items-center font-medium ${
        nested ? "gap-2.5 rounded-lg px-2.5 py-1.5 text-xs" : "gap-3 rounded-xl px-3 py-2 text-sm"
      } ${
        active
          ? "bg-accent/12 text-primary font-semibold"
          : "text-secondary hover:bg-primary/[0.05] hover:text-primary"
      }`}
    >
      {/* Active marker reads as an iOS selection pill edge rather than a border */}
      {!nested && (
        <span
          className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent transition-opacity ${
            active ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      <Icon className={`shrink-0 ${nested ? "h-4 w-4" : "h-[18px] w-[18px]"} ${active ? "text-accent-ink" : ""}`} />
      {item.label}
    </Link>
  );
}

function Brand({ isAdminRoute }: { isAdminRoute?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-3">
      <div className={`relative grid h-9 w-9 place-items-center rounded-xl shadow-lg ${
        isAdminRoute
          ? "bg-amber-600 shadow-amber-500/25"
          : "bg-accent-solid shadow-accent/25"
      }`}>
        {isAdminRoute ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[18px] w-[18px]"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[18px] w-[18px]"
            aria-hidden="true"
          >
            <path d="M12 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 6 0v-9a3 3 0 0 0-3-3z" />
            <path d="M9 8.5H6.5a2.5 2.5 0 0 0 0 5H9M15 8.5h2.5a2.5 2.5 0 0 1 0 5H15" />
          </svg>
        )}
      </div>
      <div className="leading-tight">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold tracking-tight text-primary">
            Second Brain
          </p>
          {isAdminRoute && (
            <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-3xs font-bold uppercase tracking-wider text-amber-500">
              Admin
            </span>
          )}
        </div>
        <p className="text-2xs uppercase tracking-wider text-muted">
          {isAdminRoute ? "System Administration" : "Control panel"}
        </p>
      </div>
    </div>
  );
}

type UserInfo =
  | string
  | {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string | null;
    }
  | null;

export default function AppShell({
  children,
  user,
}: {
  children: ReactNode;
  user?: UserInfo;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const userRole = typeof user === "object" ? user?.role : null;
  const isAdmin = userRole === "admin";
  const isOnAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  const navGroups = isAdmin ? [...BASE_NAV, ADMIN_GROUP] : BASE_NAV;
  // Parents only - drives the mobile bottom tab bar, which has room for one
  // "Jobs" slot, not four.
  const topLevelItems = navGroups.flatMap((g) => g.items);
  // Every actually-reachable destination: a parent with children is replaced
  // by its children (Board stands in for Jobs) so nothing needs two rows for
  // the same page, and every sub-page still gets its own mobile menu tile.
  const allReachableItems = navGroups.flatMap((g) =>
    g.items.flatMap((i) => (i.children && i.children.length > 0 ? i.children : [i]))
  );
  const current = allReachableItems.find((i) => isActive(pathname, i.href, i.exact));

  const userName = typeof user === "string" ? user : user?.name || user?.email?.split("@")[0] || "User";
  const userEmail = typeof user === "object" ? user?.email : null;
  const userImage = typeof user === "object" ? user?.image : null;
  const userInitials = (userName || "U").slice(0, 2).toUpperCase();

  // Close menu on Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    if (menuOpen) {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, [menuOpen]);

  // Lock body scroll when mobile dropdown menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen w-full">
      {/* ---------- Desktop fixed sidebar rail ---------- */}
      <aside className="glass-chrome fixed inset-y-0 left-0 z-30 hidden h-screen w-[248px] flex-col border-r py-5 lg:flex">
        <Brand isAdminRoute={isOnAdminRoute} />

        <nav className="mt-7 flex-1 space-y-6 overflow-y-auto px-3">
          {navGroups.map((group) => (
            <div key={group.group}>
              <p className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-wider text-muted">
                {group.group}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) =>
                  item.children ? (
                    <div key={item.href}>
                      <NavLink item={item} />
                      <div className="ml-[18px] mt-0.5 space-y-0.5 border-l border-hairline/15 pl-3">
                        {item.children.map((child) => (
                          <NavLink key={child.href} item={child} nested />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <NavLink key={item.href} item={item} />
                  )
                )}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto space-y-1 border-t px-3 pt-3">
          {/* User identity - flat, not a boxed card inside the boxed rail */}
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userImage}
                alt={userName}
                className="h-8 w-8 rounded-lg object-cover ring-1 ring-hairline/20"
              />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent-ink text-2xs font-semibold ring-1 ring-accent/25">
                {userInitials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-xs font-medium text-primary">
                  {userName}
                </p>
                {isAdmin && (
                  <span className="rounded bg-amber-500/15 px-1 py-0.2 text-3xs font-semibold uppercase text-amber-500">
                    Admin
                  </span>
                )}
              </div>
              {userEmail && (
                <p className="truncate text-2xs text-muted">{userEmail}</p>
              )}
            </div>
          </div>

          <ThemeSwitcher placement="top" showLabel />

          <button
            onClick={() => signOut({ callbackUrl: withBasePath("/login") })}
            className="press flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-secondary hover:bg-danger/10 hover:text-danger-ink transition-colors"
          >
            <IconSignOut className="h-[18px] w-[18px] shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ---------- Main column ---------- */}
      <div className="flex min-w-0 max-w-full flex-1 flex-col lg:pl-[248px]">
        {/* Backdrop scrim - sits under the header so the panel can anchor to it */}
        {menuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sticky Mobile Top Bar */}
        <header className="glass-chrome sticky top-0 z-50 border-b px-3.5 py-2.5 backdrop-blur-2xl sm:px-4 sm:py-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-label="Toggle navigation menu"
                className={`press flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  menuOpen
                    ? "bg-accent/15 text-accent-ink"
                    : "text-secondary hover:bg-primary/[0.06] hover:text-primary"
                }`}
              >
                <IconMenu />
              </button>
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="truncate text-sm font-medium tracking-tight text-primary">
                  {current?.label ?? (isOnAdminRoute ? "Admin Console" : "Second Brain")}
                </p>
                {isOnAdminRoute && (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-3xs font-bold uppercase text-amber-500">
                    Admin
                  </span>
                )}
              </div>
            </div>

            {/* Appearance stays reachable in one tap, not buried in the menu */}
            <div className="flex shrink-0 items-center gap-1">
              <ThemeSwitcher placement="bottom" />
              {userImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userImage}
                  alt={userName}
                  className="h-7 w-7 rounded-lg object-cover ring-1 ring-hairline/20"
                />
              ) : (
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-accent-ink text-3xs font-semibold ring-1 ring-accent/25">
                  {userInitials}
                </div>
              )}
            </div>
          </div>

          {/* Mobile slideout menu */}
          {menuOpen && (
            <div className="animate-rise absolute inset-x-3.5 top-full mt-2 rounded-2xl border border-hairline/15 bg-raised p-3 shadow-2xl sm:inset-x-4">
              <div className="flex items-center justify-between gap-2 pb-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent/15 text-3xs font-semibold text-accent-ink">
                    {userInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-primary">
                      {userName}
                    </p>
                    {userEmail && (
                      <p className="truncate text-2xs text-muted">{userEmail}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                  className="press grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-primary/[0.06] hover:text-primary"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 gap-0.5 border-t pt-2 xs:grid-cols-2">
                {allReachableItems.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    onNavigate={() => setMenuOpen(false)}
                  />
                ))}
              </div>

              <div className="mt-2 border-t pt-2">
                <button
                  onClick={() => signOut({ callbackUrl: withBasePath("/login") })}
                  className="press flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-secondary hover:bg-danger/10 hover:text-danger-ink"
                >
                  <IconSignOut className="h-[18px] w-[18px]" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 min-w-0 max-w-full px-3.5 pb-24 pt-4 sm:px-6 sm:pb-24 sm:pt-6 lg:px-10 lg:pb-12 lg:pt-9">
          <div className="mx-auto w-full max-w-6xl min-w-0">{children}</div>
        </main>

        {/* Mobile tab bar - floats over content, iOS-style with safe area support */}
        <nav
          aria-label="Mobile navigation"
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] z-30 flex items-center justify-around rounded-2xl border border-hairline/15 bg-chrome/85 px-1.5 py-1.5 shadow-2xl backdrop-blur-2xl lg:hidden"
        >
          {topLevelItems.filter((i) => i.primary).map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            const { Icon } = item;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`press relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-lg py-1 transition-colors ${
                  active ? "text-accent-ink" : "text-secondary hover:text-primary"
                }`}
              >
                {active && (
                  <span className="absolute inset-0 -z-10 rounded-lg bg-accent/12" />
                )}
                <Icon className={`h-5 w-5 shrink-0 ${active ? "text-accent-ink" : "text-secondary"}`} />
                <span className="mt-0.5 max-w-full truncate text-center text-3xs tracking-tight">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
