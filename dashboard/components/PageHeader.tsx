import type { ReactNode } from "react";

export default function PageHeader({
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
    <header className="mb-5 flex flex-col justify-between gap-3 sm:mb-7 sm:flex-row sm:items-end sm:gap-4">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="text-2xs font-semibold uppercase tracking-wider text-accent-ink">
            {eyebrow}
          </p>
        )}
        {/* semibold, not bold: at 18-20px on a phone the extra weight reads as
            a banner rather than a heading, and every page opens with one. */}
        <h1 className="mt-1 break-words text-lg font-semibold tracking-tight text-primary sm:text-xl lg:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-secondary sm:text-sm">
            {description}
          </p>
        )}
      </div>
      {action && <div className="w-full shrink-0 sm:w-auto">{action}</div>}
    </header>
  );
}
