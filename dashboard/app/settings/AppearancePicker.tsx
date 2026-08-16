"use client";

import { Card } from "@/components/ui";
import { ThemeSegmented } from "@/components/ThemeSwitcher";

/*
  Was three large tap-cards with a headline and a hint apiece - a lot of panel
  for a three-way toggle, and a third visual language for the same setting the
  sidebar already exposes. Now it's the same control, inline.
*/
export default function AppearancePicker() {
  return (
    <Card className="p-4 sm:p-5">
      <ThemeSegmented />
      <p className="mt-3 text-xs leading-relaxed text-secondary">
        <span className="font-medium text-primary">System</span> follows your
        device setting and switches with it. Your choice is remembered on this
        browser.
      </p>
    </Card>
  );
}
