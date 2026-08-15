"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, type ReactNode } from "react";
import { useTheme } from "./theme";
import { withBasePath } from "@/lib/basePath";
import {
  IconOverview,
  IconApprovals,
  IconActivity,
  IconJobs,
  IconResumes,
  IconModules,
  IconSettings,
  IconSun,
  IconMoon,
  IconAuto,
  IconSignOut,
  IconMenu,
} from "./icons";

type NavItem = {
  href: string;
  label: string;
  Icon: (p: { className?: string }) => JSX.Element;
  /** Shown in the mobile tab bar - the rest live behind the menu. */
  primary?: boolean;
};

/* Grouped so the rail reads as "what the agent did" / "what it manages"
   / "how it's set up" rather than one flat list that grows unreadable as
   modules land. */
const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Oversight",
    items: [
      { href: "/", label: "Overview", Icon: IconOverview, primary: true },
      {
        href: "/approvals",
        label: "Approvals",
        Icon: IconApprovals,
        primary: true,
      },
      { href: "/activity", label: "Activity", Icon: IconActivity, primary: true },
    ],
  },
  {
    group: "Modules",
    items: [
      { href: "/jobs", label: "Jobs", Icon: IconJobs, primary: true },
      { href: "/resumes", label: "Resumes", Icon: IconResumes },
    ],
  },
  {
    group: "System",
    items: [
      { href: "/modules", label: "Modules", Icon: IconModules },
      { href: "/settings", label: "Settings", Icon: IconSettings },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items);

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const options = [
    { key: "light" as const, Icon: IconSun, label: "Light" },
    { key: "dark" as const, Icon: IconMoon, label: "Dark" },
    { key: "system" as const, Icon: IconAuto, label: "Match system" },
  ];

  return (
    <div
      className="glass flex items-center gap-0.5 rounded-full p-1"
      role="radiogroup"
      aria-label="Appearance"
    >
      {options.map(({ key, Icon, label }) => (
        <button
          key={key}
          role="radio"
          aria-checked={preference === key}
          aria-label={label}
          title={label}
          onClick={() => setPreference(key)}
          className={`press rounded-full p-1.5 ${
            preference === key
              ? "bg-accent text-white shadow-sm shadow-accent/30"
              : "text-muted hover:text-primary"
          }`}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

function NavLink({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const { Icon } = item;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`press group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${
        active
          ? "bg-accent/12 text-primary"
          : "text-secondary hover:bg-primary/[0.05] hover:text-primary"
      }`}
    >
      {/* Active marker reads as an iOS selection pill edge rather than a border */}
      <span
        className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent transition-opacity ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />
      <Icon className={`h-[18px] w-[18px] ${active ? "text-accent" : ""}`} />
      {item.label}
    </Link>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-3">
      <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-violet shadow-lg shadow-accent/25">
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
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight text-primary">
          Second Brain
        </p>
        <p className="text-2xs uppercase tracking-widest text-muted">
          Control panel
        </p>
      </div>
    </div>
  );
}

export default function AppShell({
  children,
  user,
}: {
  children: ReactNode;
  user?: string | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const current = ALL_ITEMS.find((i) => isActive(pathname, i.href));

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden">
      {/* ---------- Desktop rail ---------- */}
      <aside className="glass-chrome sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r py-5 lg:flex">
        <Brand />

        <nav className="mt-7 flex-1 space-y-6 overflow-y-auto px-3">
          {NAV.map((group) => (
            <div key={group.group}>
              <p className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-widest text-muted">
                {group.group}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-4 space-y-3 border-t px-3 pt-4">
          <ThemeToggle />
          <button
            onClick={() => signOut({ callbackUrl: withBasePath("/login") })}
            className="press flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-secondary hover:bg-primary/[0.05] hover:text-primary"
          >
            <IconSignOut className="h-[18px] w-[18px]" />
            Sign out
            {user && (
              <span className="ml-auto truncate text-xs text-muted">{user}</span>
            )}
          </button>
        </div>
      </aside>

      {/* ---------- Main column ---------- */}
      <div className="flex min-w-0 max-w-full flex-1 flex-col overflow-x-hidden">
        {/* Mobile top bar */}
        <header className="glass-chrome sticky top-0 z-30 flex items-center gap-3 border-b px-3.5 py-2.5 sm:px-4 sm:py-3 lg:hidden">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="More sections"
            className="press flex h-9 w-9 items-center justify-center rounded-xl text-secondary hover:text-primary focus:outline-none"
          >
            <IconMenu />
          </button>
          <p className="truncate text-sm font-semibold tracking-tight text-primary">
            {current?.label ?? "Second Brain"}
          </p>
          <div className="ml-auto shrink-0">
            <ThemeToggle />
          </div>
        </header>

        {menuOpen && (
          <div className="glass-chrome animate-rise border-b px-3.5 py-3 lg:hidden">
            <div className="grid grid-cols-1 gap-1 xs:grid-cols-2">
              {ALL_ITEMS.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  onNavigate={() => setMenuOpen(false)}
                />
              ))}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: withBasePath("/login") })}
              className="press mt-2 flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-secondary hover:bg-primary/[0.05] hover:text-primary"
            >
              <IconSignOut className="h-[18px] w-[18px]" />
              Sign out
              {user && (
                <span className="ml-auto truncate text-xs text-muted">{user}</span>
              )}
            </button>
          </div>
        )}

        <main className="flex-1 min-w-0 max-w-full px-3.5 pb-44 pt-4 sm:px-6 sm:pb-32 sm:pt-6 lg:px-10 lg:pb-12 lg:pt-9">
          <div className="mx-auto w-full max-w-6xl min-w-0">{children}</div>
        </main>

        {/* Mobile tab bar - floats over content, iOS-style with safe area support */}
        <nav
          aria-label="Mobile navigation"
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] z-30 flex items-center justify-around rounded-2xl border border-hairline/15 bg-chrome/85 px-1.5 py-1.5 shadow-2xl backdrop-blur-2xl lg:hidden"
        >
          {ALL_ITEMS.filter((i) => i.primary).map((item) => {
            const active = isActive(pathname, item.href);
            const { Icon } = item;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`press relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl py-1 text-2xs font-medium transition-colors ${
                  active ? "font-semibold text-accent" : "text-secondary hover:text-primary"
                }`}
              >
                {active && (
                  <span className="absolute inset-0 -z-10 rounded-xl bg-accent/12" />
                )}
                <Icon className={`h-5 w-5 shrink-0 ${active ? "text-accent" : "text-secondary"}`} />
                <span className="mt-0.5 max-w-full truncate text-center text-[10px] tracking-tight">
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
