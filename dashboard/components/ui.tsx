import Link from "next/link";
import type { ReactNode } from "react";

/* Shared primitives. Everything visual in the control panel is built from
   these, so a token change lands everywhere at once. */

export function Card({
  children,
  className = "",
  sheen = true,
}: {
  children: ReactNode;
  className?: string;
  sheen?: boolean;
}) {
  return (
    <div
      className={`glass ${sheen ? "glass-sheen" : ""} rounded-2xl ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2 sm:mb-4 sm:gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted">
            {eyebrow}
          </p>
        )}
        <h2 className="text-sm font-semibold tracking-tight text-primary sm:text-base">
          {title}
        </h2>
        {description && (
          <p className="text-2xs text-secondary mt-0.5 max-w-2xl">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* Text tones use the theme-aware `ink` hues: `text-accent-deep` is a dark blue
   that measured 3.46:1 as badge text on a dark card. Fills stay fixed. */
const TONES = {
  neutral: "bg-primary/[0.06] text-secondary ring-primary/10",
  accent: "bg-accent/12 text-accent-ink ring-accent/25",
  ok: "bg-ok/12 text-ok-ink ring-ok/25",
  warn: "bg-warn/14 text-warn-ink ring-warn/30",
  danger: "bg-danger/12 text-danger-ink ring-danger/25",
  violet: "bg-violet/12 text-violet-ink ring-violet/25",
} as const;

export type Tone = keyof typeof TONES;

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  /*
    Deliberately a rounded rectangle, not a pill, and sentence case rather than
    ALL-CAPS. Badges appear several per card here; as shouty full-round pills
    they competed with the content they were labelling. `first-letter` rather
    than `capitalize` so raw enum values ("high") read as "High" without
    Title-Casing whole sentences ("Ran on its own").
  */
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-2xs font-medium ring-1 ring-inset first-letter:uppercase ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = "neutral" }: { tone?: Tone }) {
  const color = {
    neutral: "bg-muted",
    accent: "bg-accent",
    ok: "bg-ok",
    warn: "bg-warn",
    danger: "bg-danger",
    violet: "bg-violet",
  }[tone];
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${color}`} />;
}

/* Solid fills, not the tint hues: white on `bg-ok` measured 2.15:1. */
const BUTTON_VARIANTS = {
  primary:
    "bg-accent-solid text-white hover:brightness-110 shadow-sm shadow-accent/25",
  approve: "bg-ok-solid text-white hover:brightness-110 shadow-sm shadow-ok/25",
  reject: "bg-danger-solid text-white hover:brightness-110 shadow-sm shadow-danger/25",
  quiet:
    "glass text-secondary hover:text-primary hover:bg-primary/[0.04]",
  ghost: "text-secondary hover:text-primary hover:bg-primary/[0.05]",
} as const;

export function Button({
  children,
  variant = "quiet",
  size = "md",
  className = "",
  ...props
}: {
  children: ReactNode;
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: "sm" | "md";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizing =
    size === "sm"
      ? "min-h-[34px] px-3 py-1.5 text-xs"
      : "min-h-[38px] px-3.5 sm:px-4 py-2 text-xs sm:text-sm";
  return (
    <button
      {...props}
      className={`press inline-flex items-center justify-center gap-2 rounded-xl font-medium touch-manipulation disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
  href?: string;
}) {
  const accentBar = {
    neutral: "from-muted/40",
    accent: "from-accent",
    ok: "from-ok",
    warn: "from-warn",
    danger: "from-danger",
    violet: "from-violet",
  }[tone];

  const dotColor = {
    neutral: "bg-muted/60",
    accent: "bg-accent",
    ok: "bg-ok",
    warn: "bg-warn",
    danger: "bg-danger",
    violet: "bg-violet",
  }[tone];

  const body = (
    <Card className="relative overflow-hidden p-3 transition-all xs:p-3.5 sm:p-5">
      <div
        className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${accentBar} to-transparent`}
      />
      <div className="flex items-center justify-between gap-1">
        <p className="truncate text-2xs font-semibold uppercase tracking-wide text-muted">
          {label}
        </p>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
      </div>
      {/* These sit four-up on a 420px screen; text-3xl there was a wall of
          numerals with no room left for the label under it. */}
      <p className="tnum mt-1 text-xl font-semibold tracking-tight text-primary xs:mt-1.5 xs:text-2xl sm:text-3xl">
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 truncate text-2xs text-secondary sm:text-xs">
          {hint}
        </p>
      )}
    </Card>
  );

  return href ? (
    <Link href={href} className="block transition-transform hover:-translate-y-0.5">
      {body}
    </Link>
  ) : (
    body
  );
}

/*
  The signature element.

  Every action the orchestrator plans carries a confidence score, and the
  architecture gates on it: at or above AUTO_EXECUTE_CONFIDENCE_THRESHOLD the
  action runs itself, below it the action waits in the approval queue. This
  meter marks that threshold on the track, so a glance answers the question
  that actually matters - "did this clear the bar, or is it here because it
  didn't?" - rather than just restating a number.
*/
export function ConfidenceMeter({
  value,
  threshold = 0.75,
  showLabel = true,
}: {
  value: number;
  threshold?: number;
  showLabel?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const cleared = value >= threshold;
  const fill = cleared
    ? "from-ok/70 to-ok"
    : value >= threshold * 0.7
      ? "from-warn/70 to-warn"
      : "from-danger/70 to-danger";

  return (
    <div className="flex shrink-0 items-center gap-1.5 xs:gap-2">
      <div
        className="relative h-1.5 w-12 overflow-hidden rounded-full bg-primary/10 xs:w-16 sm:w-20"
        role="meter"
        aria-valuenow={Number(value.toFixed(2))}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-label={`Planner confidence ${value.toFixed(2)}, auto-execute threshold ${threshold}`}
      >
        <div
          className={`h-full rounded-full bg-gradient-to-r ${fill}`}
          style={{ width: `${pct}%` }}
        />
        {/* The threshold tick - the whole point of the component */}
        <div
          className="absolute inset-y-0 w-px bg-primary/40"
          style={{ left: `${threshold * 100}%` }}
        />
      </div>
      {showLabel && (
        <span className="tnum text-2xs text-muted sm:text-xs">{value.toFixed(2)}</span>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  message,
  action,
}: {
  title: string;
  body?: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="p-6 text-center sm:p-10">
      <p className="text-sm font-semibold text-primary sm:text-base">{title}</p>
      {(body || message) && (
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-secondary sm:text-sm">
          {body || message}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center sm:mt-5">{action}</div>}
    </Card>
  );
}

export function ErrorNote({
  children,
  message,
}: {
  children?: ReactNode;
  message?: string;
}) {
  return (
    <div className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-xs leading-relaxed text-danger-ink ring-1 ring-inset ring-danger/25 sm:px-4 sm:py-3 sm:text-sm">
      {children || message}
    </div>
  );
}

