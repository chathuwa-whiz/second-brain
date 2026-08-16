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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-semibold text-primary">
              Automated Job Discovery
            </h3>
            <Badge tone={isDiscoveryActive ? "ok" : "warn"}>
              {isDiscoveryActive ? "Scanning Active" : "Discovery Paused"}
            </Badge>
          </div>
          <p className="text-xs text-secondary">
            Your AI agent continuously scours global job boards for roles matching your target criteria.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={isDiscoveryActive ? "quiet" : "primary"}
            onClick={handleToggleDiscovery}
            disabled={toggling}
            className="text-xs font-semibold"
          >
            {toggling
              ? "Saving…"
              : isDiscoveryActive
              ? "Pause Scanning"
              : "Resume Scanning"}
          </Button>
          <Link
            href="/onboarding"
            className="press inline-flex items-center justify-center rounded-xl bg-primary/[0.06] px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/[0.1] transition-colors"
          >
            Edit Targets
          </Link>
        </div>
      </div>

      {/* Target Roles & Location Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <div className="rounded-xl bg-primary/[0.02] p-3.5 border border-hairline/10 space-y-2">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted">
            Target Job Titles
          </p>
          <div className="flex flex-wrap gap-1.5">
            {targetTitles.map((title: string) => (
              <span
                key={title}
                className="inline-flex items-center rounded-lg bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent border border-accent/20"
              >
                {title}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-primary/[0.02] p-3.5 border border-hairline/10 space-y-2">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted">
            Preferred Locations & Mode
          </p>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center rounded-lg bg-primary/[0.06] px-2.5 py-1 text-xs font-medium text-primary">
              {workMode}
            </span>
            {locations.map((loc: string) => (
              <span
                key={loc}
                className="inline-flex items-center rounded-lg bg-primary/[0.04] px-2.5 py-1 text-xs font-medium text-secondary"
              >
                {loc}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-2xs text-muted pt-1">
        <IconCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        <span>Matching leads automatically appear in your Jobs and Approvals queues.</span>
      </div>
    </Card>
  );
}
