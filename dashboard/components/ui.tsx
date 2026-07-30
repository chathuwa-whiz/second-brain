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
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="text-2xs font-semibold uppercase tracking-widest text-muted">
            {eyebrow}
          </p>
        )}
        <h2 className="text-lg font-semibold tracking-tight text-primary">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

const TONES = {
  neutral: "bg-primary/[0.06] text-secondary ring-primary/10",
  accent: "bg-accent/12 text-accent-deep ring-accent/25",
  ok: "bg-ok/12 text-ok ring-ok/25",
  warn: "bg-warn/14 text-warn ring-warn/30",
  danger: "bg-danger/12 text-danger ring-danger/25",
  violet: "bg-violet/12 text-violet ring-violet/25",
} as const;

export type Tone = keyof typeof TONES;

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide ring-1 ring-inset ${TONES[tone]}`}
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
  return <span className={`h-1.5 w-1.5 rounded-full ${color}`} />;
}

const BUTTON_VARIANTS = {
  primary:
    "bg-accent text-white hover:bg-accent-deep shadow-sm shadow-accent/25",
  approve: "bg-ok text-white hover:brightness-95 shadow-sm shadow-ok/25",
  reject: "bg-danger text-white hover:brightness-95 shadow-sm shadow-danger/25",
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
  const sizing = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  return (
    <button
      {...props}
      className={`press inline-flex items-center justify-center gap-2 rounded-xl font-medium disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${BUTTON_VARIANTS[variant]} ${className}`}
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

  const body = (
    <Card className="relative overflow-hidden p-5">
      <div
        className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accentBar} to-transparent`}
      />
      <p className="text-2xs font-semibold uppercase tracking-widest text-muted">
        {label}
      </p>
      <p className="tnum mt-2 text-3xl font-semibold tracking-tight text-primary">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );

  return href ? (
    <a href={href} className="block transition-transform hover:-translate-y-0.5">
      {body}
    </a>
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
    <div className="flex items-center gap-2.5">
      <div
        className="relative h-1.5 w-24 overflow-hidden rounded-full bg-primary/10"
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
        <span className="tnum text-xs text-muted">{value.toFixed(2)}</span>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card className="p-10 text-center">
      <p className="text-base font-medium text-primary">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-secondary">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </Card>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger ring-1 ring-inset ring-danger/25">
      {children}
    </div>
  );
}
