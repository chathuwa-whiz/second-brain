import type { ReactNode } from "react";

export default function AdminHeader({
  title,
  description,
  badge = "Admin Console",
  actions,
}: {
  title: string;
  description?: string;
  badge?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider text-amber-500 ring-1 ring-amber-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            {badge}
          </span>
        </div>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-primary sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-secondary max-w-3xl leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 items-center gap-2.5">
          {actions}
        </div>
      )}
    </header>
  );
}
