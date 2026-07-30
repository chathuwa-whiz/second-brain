"use client";

import { useTheme } from "@/components/theme";
import { Card } from "@/components/ui";
import { IconAuto, IconMoon, IconSun } from "@/components/icons";

const OPTIONS = [
  {
    key: "light" as const,
    label: "Light",
    hint: "Soft paper, easy on the eyes",
    Icon: IconSun,
  },
  { key: "dark" as const, label: "Dark", hint: "Deep navy", Icon: IconMoon },
  {
    key: "system" as const,
    label: "Match system",
    hint: "Follows your device",
    Icon: IconAuto,
  },
];

export default function AppearancePicker() {
  const { preference, setPreference } = useTheme();

  return (
    <Card className="p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map(({ key, label, hint, Icon }) => {
          const active = preference === key;
          return (
            <button
              key={key}
              onClick={() => setPreference(key)}
              aria-pressed={active}
              className={`press rounded-xl p-4 text-left ring-1 ring-inset ${
                active
                  ? "bg-accent/12 ring-accent/40"
                  : "ring-hairline/10 hover:bg-primary/[0.04]"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${active ? "text-accent" : "text-muted"}`}
              />
              <p className="mt-2.5 text-sm font-medium text-primary">{label}</p>
              <p className="mt-0.5 text-xs text-muted">{hint}</p>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
