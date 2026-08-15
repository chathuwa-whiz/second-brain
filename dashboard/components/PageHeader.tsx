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
          <p className="text-2xs font-semibold uppercase tracking-widest text-accent">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 break-words text-xl font-semibold tracking-tight text-primary xs:text-2xl sm:text-[1.75rem]">
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
