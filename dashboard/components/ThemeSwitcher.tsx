"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "./theme";
import { IconSun, IconMoon, IconAuto, IconCheck } from "./icons";

/*
  The old switcher was three unlabeled icon buttons wedged into the sidebar
  footer. Two problems: a monitor glyph doesn't say "match system" to anyone
  who hasn't already learned it, and a permanently-expanded three-way control
  spends a full row of chrome on a setting people touch once. This is the
  now-standard shape instead - one button showing the theme you're actually
  in, opening a short labelled menu.
*/

const OPTIONS = [
  { key: "light" as const, label: "Light", Icon: IconSun },
  { key: "dark" as const, label: "Dark", Icon: IconMoon },
  { key: "system" as const, label: "System", Icon: IconAuto },
];

export function ThemeSwitcher({
  placement = "top",
  showLabel = false,
  className = "",
}: {
  /** Which way the menu opens. Sidebar footer wants "top", a header wants "bottom". */
  placement?: "top" | "bottom";
  showLabel?: boolean;
  className?: string;
}) {
  const { preference, resolved, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // The provider can't know the real theme until it reads localStorage after
  // mount, so hold the neutral glyph until then rather than flashing the wrong
  // one on every load.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const active = OPTIONS.find((o) => o.key === preference) ?? OPTIONS[2];
  const TriggerIcon = !mounted
    ? IconAuto
    : resolved === "light"
      ? IconSun
      : IconMoon;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Appearance: ${active.label}`}
        title={`Appearance: ${active.label}`}
        className={`press flex items-center gap-2 rounded-lg text-secondary hover:bg-primary/[0.06] hover:text-primary ${
          showLabel ? "w-full px-2.5 py-2 text-xs font-medium" : "h-9 w-9 justify-center"
        } ${open ? "bg-primary/[0.06] text-primary" : ""}`}
      >
        <TriggerIcon className="h-[18px] w-[18px] shrink-0" />
        {showLabel && (
          <>
            <span className="flex-1 text-left">Appearance</span>
            <span className="text-muted">{active.label}</span>
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Appearance"
          className={`absolute right-0 z-50 min-w-[168px] overflow-hidden rounded-xl border border-hairline/15 bg-raised p-1 shadow-xl ${
            placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {OPTIONS.map(({ key, label, Icon }) => {
            const selected = preference === key;
            return (
              <button
                key={key}
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setPreference(key);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                  selected
                    ? "text-primary"
                    : "text-secondary hover:bg-primary/[0.06] hover:text-primary"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${selected ? "text-accent" : ""}`}
                />
                <span className="flex-1">{label}</span>
                {selected && <IconCheck className="h-3.5 w-3.5 text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/*
  Inline variant for the settings page, where the choice is the content of the
  panel rather than a corner affordance and hiding it behind a menu would be
  perverse.
*/
export function ThemeSegmented() {
  const { preference, setPreference } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="grid grid-cols-3 gap-1 rounded-xl bg-primary/[0.04] p-1"
    >
      {OPTIONS.map(({ key, label, Icon }) => {
        const selected = mounted && preference === key;
        return (
          <button
            key={key}
            role="radio"
            aria-checked={selected}
            onClick={() => setPreference(key)}
            className={`press flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs transition-colors ${
              selected
                ? "bg-raised font-medium text-primary shadow-sm"
                : "text-secondary hover:text-primary"
            }`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 ${selected ? "text-accent" : ""}`}
            />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
