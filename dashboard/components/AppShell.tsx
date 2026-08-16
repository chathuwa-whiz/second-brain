"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, useEffect, type ReactNode } from "react";
import { useTheme } from "./theme";
import { withBasePath } from "@/lib/basePath";
import {
  IconOverview,
  IconApprovals,
  IconActivity,
  IconJobs,
  IconTasks,
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
      { href: "/tasks", label: "Tasks", Icon: IconTasks, primary: true },
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
      className="glass flex items-center justify-between gap-1 rounded-xl p-1 w-full"
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
          className={`press flex-1 flex items-center justify-center rounded-lg py-1.5 transition-colors ${
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
          ? "bg-accent/12 text-primary font-semibold"
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
        <p className="text-2xs uppercase tracking-widest text-muted font-medium">
          Control panel
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
  const current = ALL_ITEMS.find((i) => isActive(pathname, i.href));

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

        <div className="mt-auto space-y-3 border-t px-3 pt-4">
          <ThemeToggle />

          {/* User Profile Card */}
          <div className="flex items-center gap-2.5 rounded-xl bg-primary/[0.03] p-2 border border-hairline/10">
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userImage}
                alt={userName}
                className="h-8 w-8 rounded-lg object-cover ring-1 ring-hairline/20"
              />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent text-xs font-bold ring-1 ring-accent/30">
                {userInitials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-primary">
                {userName}
              </p>
              {userEmail && (
                <p className="truncate text-2xs text-muted">
                  {userEmail}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: withBasePath("/login") })}
            className="press flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-secondary hover:bg-danger/10 hover:text-danger transition-colors"
          >
            <IconSignOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ---------- Main column ---------- */}
      <div className="flex min-w-0 max-w-full flex-1 flex-col lg:pl-[248px]">
        {/* Sticky Mobile Top Bar */}
        <header className="glass-chrome sticky top-0 z-40 flex items-center justify-between gap-3 border-b px-3.5 py-2.5 backdrop-blur-2xl sm:px-4 sm:py-3 lg:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="Toggle navigation menu"
              className={`press flex h-9 w-9 items-center justify-center rounded-xl transition-colors focus:outline-none ${
                menuOpen
                  ? "bg-accent/15 text-accent ring-1 ring-accent/30"
                  : "text-secondary hover:bg-primary/[0.06] hover:text-primary"
              }`}
            >
              <IconMenu />
            </button>
            <p className="truncate text-sm font-semibold tracking-tight text-primary">
              {current?.label ?? "Second Brain"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userImage}
                alt={userName}
                className="h-7 w-7 rounded-lg object-cover ring-1 ring-hairline/20"
              />
            ) : (
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-accent text-2xs font-bold ring-1 ring-accent/30">
                {userInitials}
              </div>
            )}
          </div>
        </header>

        {/* Overlaying Glassmorphism Dropdown Menu */}
        {menuOpen && (
          <>
            {/* Backdrop Scrim */}
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 lg:hidden"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />

            {/* Floating Glassmorphism Menu Panel */}
            <div className="fixed inset-x-3.5 top-[58px] z-50 rounded-2xl glass-chrome border border-hairline/20 p-4 shadow-2xl backdrop-blur-2xl animate-rise lg:hidden">
              <div className="flex items-center justify-between border-b pb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-accent text-2xs font-bold">
                    {userInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-primary truncate">{userName}</p>
                    {userEmail && <p className="text-2xs text-muted truncate">{userEmail}</p>}
                  </div>
                </div>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="press rounded-lg px-2 py-0.5 text-xs font-medium text-muted hover:text-primary"
                >
                  ✕ Close
                </button>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-1 xs:grid-cols-2">
                {ALL_ITEMS.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    onNavigate={() => setMenuOpen(false)}
                  />
                ))}
              </div>

              <div className="mt-3.5 border-t pt-3 space-y-2">
                <ThemeToggle />
                <button
                  onClick={() => signOut({ callbackUrl: withBasePath("/login") })}
                  className="press flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-hairline/15 bg-primary/[0.04] px-3.5 py-2.5 text-sm font-medium text-secondary hover:bg-danger/10 hover:text-danger"
                >
                  <IconSignOut className="h-[18px] w-[18px]" />
                  Sign out
                </button>
              </div>
            </div>
          </>
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
