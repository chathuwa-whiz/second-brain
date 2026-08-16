"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Badge } from "@/components/ui";
import { IconCheck, IconJobs } from "@/components/icons";
import { withBasePath } from "@/lib/basePath";

export default function AiJobSearchCard() {
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(withBasePath("/api/user/profile"));
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile || {});
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleToggleDiscovery() {
    if (!profile) return;
    setToggling(true);
    const newStatus = !(profile.jobDiscoveryActive ?? true);
    try {
      const res = await fetch(withBasePath("/api/user/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDiscoveryActive: newStatus }),
      });
      if (res.ok) {
        setProfile({ ...profile, jobDiscoveryActive: newStatus });
      }
    } catch (err) {
      console.error("Failed to toggle discovery:", err);
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-5 animate-pulse space-y-3">
        <div className="h-5 w-48 rounded bg-primary/[0.06]" />
        <div className="h-4 w-72 rounded bg-primary/[0.04]" />
      </Card>
    );
  }

  const isDiscoveryActive = profile?.jobDiscoveryActive ?? true;
  const targetTitles = (profile?.targetJobTitles && profile.targetJobTitles.length > 0)
    ? profile.targetJobTitles
    : ["Software Engineer", "Full Stack Developer"];
  const locations = (profile?.locations && profile.locations.length > 0)
    ? profile.locations
    : ["Remote", "Worldwide"];
  const workMode = profile?.remotePreference === "remote_only"
    ? "Remote Only"
    : profile?.remotePreference === "hybrid"
    ? "Hybrid & Remote"
    : "Any Work Mode";

  return (
    <Card className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-primary sm:text-base">
              Job discovery
            </h3>
            <Badge tone={isDiscoveryActive ? "ok" : "warn"}>
              {isDiscoveryActive ? "Scanning" : "Paused"}
            </Badge>
          </div>
          <p className="text-xs leading-relaxed text-secondary">
            The agent watches job boards for roles matching your criteria.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant={isDiscoveryActive ? "quiet" : "primary"}
            size="sm"
            onClick={handleToggleDiscovery}
            disabled={toggling}
          >
            {toggling ? "Saving…" : isDiscoveryActive ? "Pause" : "Resume"}
          </Button>
          <Link
            href="/onboarding"
            className="press inline-flex min-h-[34px] items-center justify-center rounded-xl bg-primary/[0.06] px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/[0.1]"
          >
            Edit targets
          </Link>
        </div>
      </div>

      {/*
        Flat sections divided by a rule, rather than bordered boxes nested
        inside the card - one frame is enough to group this.
      */}
      <div className="grid grid-cols-1 gap-5 border-t border-hairline/10 pt-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-3xs font-semibold uppercase tracking-wider text-muted">
            Target job titles
          </p>
          <div className="flex flex-wrap gap-1.5">
            {targetTitles.map((title: string) => (
              <span
                key={title}
                className="inline-flex items-center rounded-md bg-accent/10 px-2 py-0.5 text-2xs font-medium text-accent ring-1 ring-inset ring-accent/20"
              >
                {title}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-3xs font-semibold uppercase tracking-wider text-muted">
            Locations &amp; work mode
          </p>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center rounded-md bg-primary/[0.06] px-2 py-0.5 text-2xs font-medium text-primary">
              {workMode}
            </span>
            {locations.map((loc: string) => (
              <span
                key={loc}
                className="inline-flex items-center rounded-md bg-primary/[0.04] px-2 py-0.5 text-2xs font-medium text-secondary"
              >
                {loc}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 pt-1 text-2xs leading-relaxed text-muted">
        <IconCheck className="mt-px h-3.5 w-3.5 shrink-0 text-ok" />
        <span>Matches show up in your Jobs and Approvals queues automatically.</span>
      </div>
    </Card>
  );
}
