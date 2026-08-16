"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ErrorNote } from "@/components/ui";
import { IconCheck, IconResumes, IconSettings, IconJobs } from "@/components/icons";
import { formatBytes } from "@/lib/format";
import { withBasePath } from "@/lib/basePath";

type ResumeItem = {
  name: string;
  size: number;
  modifiedAt: string;
};

const POPULAR_ROLES_BY_CATEGORY: Record<string, string[]> = {
  "Software & Tech": [
    "Full Stack Engineer",
    "Frontend Developer",
    "Backend Developer",
    "AI/ML Engineer",
    "DevOps Engineer",
  ],
  "Accounting & Finance": [
    "Accountant",
    "Financial Analyst",
    "Audit Associate",
    "Accounts Executive",
  ],
  "Sales & Marketing": [
    "Marketing Manager",
    "Digital Marketing Specialist",
    "Sales Executive",
    "Content Strategist",
  ],
  "Management & HR": [
    "Project Manager",
    "HR Executive",
    "Operations Manager",
    "Talent Acquisition",
  ],
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Resumes
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Career Targets
  const [targetTitleInput, setTargetTitleInput] = useState("");
  const [targetTitles, setTargetTitles] = useState<string[]>([
    "Full Stack Engineer",
    "Software Developer",
  ]);
  const [locations, setLocations] = useState<string[]>(["Remote", "Worldwide"]);
  const [locationInput, setLocationInput] = useState("");
  const [remotePref, setRemotePref] = useState<"remote_only" | "hybrid" | "onsite" | "any">("remote_only");
  const [minSalary, setMinSalary] = useState<string>("80000");
  const [experienceLevel, setExperienceLevel] = useState<string>("mid");
  const [skills, setSkills] = useState<string[]>([
    "TypeScript",
    "React",
    "Node.js",
    "Python",
  ]);
  const [skillInput, setSkillInput] = useState("");

  // Step 3: AI Trust Layer
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.75);
  const [notificationFreq, setNotificationFreq] = useState<"instant" | "daily_digest" | "manual">("instant");

  // Form State
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial profile & resumes if any exist
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [resumesRes, profileRes] = await Promise.all([
          fetch(withBasePath("/api/resumes")),
          fetch(withBasePath("/api/user/onboarding")),
        ]);

        if (resumesRes.ok) {
          const resData = await resumesRes.json();
          if (resData.files) setResumes(resData.files);
        }

        if (profileRes.ok) {
          const profData = await profileRes.json();
          if (profData.profile) {
            const p = profData.profile;
            if (p.targetJobTitles?.length) setTargetTitles(p.targetJobTitles);
            if (p.locations?.length) setLocations(p.locations);
            if (p.remotePreference) setRemotePref(p.remotePreference);
            if (p.minSalary) setMinSalary(String(p.minSalary));
            if (p.experienceLevel) setExperienceLevel(p.experienceLevel);
            if (p.skills?.length) setSkills(p.skills);
            if (p.confidenceThreshold) setConfidenceThreshold(p.confidenceThreshold);
            if (p.notificationFrequency) setNotificationFreq(p.notificationFrequency);
          }
        }
      } catch {
        // ignore
      }
    }
    loadInitialData();
  }, []);

  async function fetchResumes() {
    try {
      const res = await fetch(withBasePath("/api/resumes"));
      const data = await res.json();
      if (res.ok && data.files) {
        setResumes(data.files);
      }
    } catch {
      // ignore
    }
  }

  async function handleFileUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      for (const file of Array.from(fileList)) {
        if (resumes.length >= 5) {
          throw new Error("Maximum limit of 5 resumes reached. Delete one to upload another.");
        }
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(withBasePath("/api/resumes"), {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Failed to upload ${file.name}`);
        }
      }
      await fetchResumes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteResume(name: string) {
    setDeleting(name);
    setError(null);
    try {
      const res = await fetch(withBasePath(`/api/resumes/${encodeURIComponent(name)}`), {
        method: "DELETE",
      });
      if (res.ok) {
        setResumes((prev) => prev.filter((r) => r.name !== name));
      }
    } catch {
      setError("Failed to delete resume.");
    } finally {
      setDeleting(null);
    }
  }

  function addTitle(titleToAdd?: string) {
    const val = (titleToAdd || targetTitleInput).trim();
    if (!val) return;
    if (!targetTitles.includes(val)) {
      setTargetTitles([...targetTitles, val]);
    }
    setTargetTitleInput("");
  }

  function removeTitle(title: string) {
    setTargetTitles(targetTitles.filter((t) => t !== title));
  }

  function addLocation() {
    if (!locationInput.trim()) return;
    if (!locations.includes(locationInput.trim())) {
      setLocations([...locations, locationInput.trim()]);
    }
    setLocationInput("");
  }

  function removeLocation(loc: string) {
    setLocations(locations.filter((l) => l !== loc));
  }

  function addSkill() {
    if (!skillInput.trim()) return;
    if (!skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
    }
    setSkillInput("");
  }

  function removeSkill(skill: string) {
    setSkills(skills.filter((s) => s !== skill));
  }

  // Quick skip all setup and go straight to dashboard
  async function handleQuickSkip() {
    setSkipping(true);
    setError(null);

    const payload = {
      targetJobTitles: targetTitles.length > 0 ? targetTitles : ["Software Developer", "Accountant", "Marketing Executive"],
      locations: locations.length > 0 ? locations : ["Remote", "Worldwide"],
      remotePreference: remotePref,
      minSalary: minSalary ? Number(minSalary) : 80000,
      experienceLevel,
      skills: skills.length > 0 ? skills : ["General Professional Skills"],
      confidenceThreshold: confidenceThreshold || 0.75,
      notificationFrequency: notificationFreq || "instant",
      onboardingCompleted: true,
    };

    try {
      const res = await fetch(withBasePath("/api/user/onboarding"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to save default workspace preferences.");
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to skip onboarding.");
      setSkipping(false);
    }
  }

  async function handleFinishOnboarding() {
    setLoading(true);
    setError(null);

    const payload = {
      targetJobTitles: targetTitles.length > 0 ? targetTitles : ["Professional"],
      locations: locations.length > 0 ? locations : ["Remote", "Worldwide"],
      remotePreference: remotePref,
      minSalary: minSalary ? Number(minSalary) : null,
      experienceLevel,
      skills,
      confidenceThreshold,
      notificationFrequency: notificationFreq,
      onboardingCompleted: true,
    };

    try {
      const res = await fetch(withBasePath("/api/user/onboarding"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to save workspace settings.");
      }

      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finish onboarding.");
    } finally {
      setLoading(false);
    }
  }

  const field =
    "w-full min-h-[44px] rounded-xl bg-primary/[0.04] px-3.5 py-2.5 text-sm text-primary outline-none ring-1 ring-inset ring-hairline/15 transition-shadow placeholder:text-muted focus:ring-2 focus:ring-accent";

  return (
    <main className="min-h-screen px-4 py-8 pb-safe pt-safe sm:py-12 flex flex-col items-center justify-center">
      {/* Top Bar / Header */}
      <div className="w-full max-w-2xl mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-accent to-violet shadow-lg shadow-accent/20">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5 text-white"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a8 8 0 0 0-8 8c0 3.36 2.07 6.24 5 7.42V20a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2.58c2.93-1.18 5-4.06 5-7.42a8 8 0 0 0-8-8z" />
              <path d="M10 14h4" />
              <path d="M10 17h4" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-primary">Second Brain Workspace Setup</h1>
            <p className="text-2xs text-secondary">
              {step === 1 && "Step 1 of 3: Resume Management"}
              {step === 2 && "Step 2 of 3: Job Discovery Targets"}
              {step === 3 && "Step 3 of 3: AI Trust Layer"}
              {step === 4 && "Workspace Ready"}
            </p>
          </div>
        </div>

        {step < 4 && (
          <Button
            variant="quiet"
            onClick={handleQuickSkip}
            disabled={skipping || loading}
            className="text-xs font-semibold text-muted hover:text-primary transition-colors"
          >
            {skipping ? "Skipping…" : "Skip Setup for Now →"}
          </Button>
        )}
      </div>

      {/* Wizard Progress Steps Indicator */}
      {step < 4 && (
        <div className="w-full max-w-2xl mb-6">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-semibold transition-all text-left ${
                step === 1
                  ? "bg-accent/15 text-accent ring-1 ring-accent/30"
                  : step > 1
                  ? "bg-primary/[0.05] text-primary hover:bg-primary/[0.08]"
                  : "bg-primary/[0.02] text-muted opacity-60"
              }`}
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-accent/20 text-accent text-2xs font-bold shrink-0">
                1
              </span>
              <span className="truncate">Resumes</span>
            </button>

            <button
              type="button"
              onClick={() => setStep(2)}
              className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-semibold transition-all text-left ${
                step === 2
                  ? "bg-accent/15 text-accent ring-1 ring-accent/30"
                  : step > 2
                  ? "bg-primary/[0.05] text-primary hover:bg-primary/[0.08]"
                  : "bg-primary/[0.02] text-muted opacity-60"
              }`}
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-accent/20 text-accent text-2xs font-bold shrink-0">
                2
              </span>
              <span className="truncate">Career Targets</span>
            </button>

            <button
              type="button"
              onClick={() => setStep(3)}
              className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-semibold transition-all text-left ${
                step === 3
                  ? "bg-accent/15 text-accent ring-1 ring-accent/30"
                  : "bg-primary/[0.02] text-muted opacity-60"
              }`}
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-accent/20 text-accent text-2xs font-bold shrink-0">
                3
              </span>
              <span className="truncate">Trust Layer</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Form Card */}
      <Card className="w-full max-w-2xl p-5 sm:p-8">
        {/* ================================================================= */}
        {/* STEP 1: RESUME UPLOAD                                             */}
        {/* ================================================================= */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                <IconResumes className="h-5 w-5 text-accent" />
                Upload Candidate Resumes
              </h2>
              <p className="mt-1 text-xs text-secondary leading-relaxed">
                Upload up to 5 variations of your CV (e.g. Full Stack, Frontend, Executive). Your AI agent selects the most relevant resume dynamically for each job application.
              </p>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFileUpload(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-7 text-center transition-all ${
                dragging
                  ? "border-accent bg-accent/10"
                  : "border-hairline/25 bg-primary/[0.02] hover:border-accent/40 hover:bg-primary/[0.04]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/[0.05] text-primary transition-transform group-hover:scale-105">
                <IconResumes className="h-6 w-6 text-accent" />
              </div>
              <p className="mt-3 text-xs font-semibold text-primary">
                {uploading ? "Uploading to Cloudflare R2…" : "Click or drag & drop resumes here"}
              </p>
              <p className="mt-1 text-2xs text-muted">
                Supports PDF, DOCX, TXT · Maximum 5 resumes
              </p>
            </div>

            {/* Uploaded Resumes List */}
            {resumes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-primary">
                  Uploaded Resumes ({resumes.length}/5)
                </p>
                <div className="divide-y divide-hairline/15 rounded-xl border border-hairline/15 bg-primary/[0.02] overflow-hidden">
                  {resumes.map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center justify-between p-3 text-xs text-secondary"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <IconCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span className="truncate font-medium text-primary">{file.name}</span>
                        <span className="text-2xs text-muted shrink-0">({formatBytes(file.size)})</span>
                      </div>
                      <Button
                        variant="quiet"
                        disabled={deleting === file.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteResume(file.name);
                        }}
                        className="text-2xs text-rose-400 hover:text-rose-300"
                      >
                        {deleting === file.name ? "Deleting…" : "Delete"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && <ErrorNote>{error}</ErrorNote>}

            {/* Step 1 Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-hairline/15">
              <Button
                variant="quiet"
                onClick={() => {
                  setError(null);
                  setStep(2);
                }}
                className="text-xs text-muted hover:text-primary font-medium"
              >
                Skip for now →
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setError(null);
                  setStep(2);
                }}
                className="min-h-[44px] px-6 text-sm font-semibold"
              >
                Continue to Targets →
              </Button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 2: CAREER TARGETS & CRITERIA                                 */}
        {/* ================================================================= */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                <IconJobs className="h-5 w-5 text-accent" />
                Target Career Roles & Criteria
              </h2>
              <p className="mt-1 text-xs text-secondary leading-relaxed">
                Define the roles you want your agent to hunt for across TopJobs and career feeds.
              </p>
            </div>

            {/* Quick Presets by Industry */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-primary">
                Quick Category Suggestions
              </label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(POPULAR_ROLES_BY_CATEGORY).flatMap(([cat, roles]) =>
                  roles.slice(0, 2).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => addTitle(role)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-2xs font-medium border transition-colors ${
                        targetTitles.includes(role)
                          ? "bg-accent/15 border-accent/30 text-accent"
                          : "bg-primary/[0.03] border-hairline/15 text-secondary hover:bg-primary/[0.08]"
                      }`}
                    >
                      + {role}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Target Job Titles Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-primary">
                Target Job Titles
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Software Engineer, Accountant, Marketing Lead"
                  value={targetTitleInput}
                  onChange={(e) => setTargetTitleInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTitle())}
                  className={field}
                />
                <Button type="button" variant="quiet" onClick={() => addTitle()} className="text-xs font-semibold">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {targetTitles.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-2.5 py-1 text-2xs font-semibold text-accent border border-accent/20"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTitle(t)}
                      className="hover:text-primary"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Location & Remote Preference */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-primary">
                  Work Preference
                </label>
                <select
                  value={remotePref}
                  onChange={(e) => setRemotePref(e.target.value as any)}
                  className={field}
                >
                  <option value="remote_only">Remote Only</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                  <option value="any">Any / Flexible</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-primary">
                  Experience Level
                </label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className={field}
                >
                  <option value="junior">Junior (1–2 yrs)</option>
                  <option value="mid">Mid-Level (3–5 yrs)</option>
                  <option value="senior">Senior (5–8 yrs)</option>
                  <option value="lead">Lead / Staff (8+ yrs)</option>
                  <option value="executive">Executive / VP</option>
                </select>
              </div>
            </div>

            {/* Target Salary & Locations */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-primary">
                  Minimum Target Salary (Annual USD)
                </label>
                <input
                  type="number"
                  placeholder="80000"
                  value={minSalary}
                  onChange={(e) => setMinSalary(e.target.value)}
                  className={field}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-primary">
                  Target Locations
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Remote, Sri Lanka, UK"
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLocation())}
                    className={field}
                  />
                  <Button type="button" variant="quiet" onClick={addLocation} className="text-xs">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {locations.map((loc) => (
                    <span
                      key={loc}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary/[0.05] px-2 py-0.5 text-2xs font-medium text-secondary"
                    >
                      {loc}
                      <button
                        type="button"
                        onClick={() => removeLocation(loc)}
                        className="hover:text-primary ml-1"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Core Skills */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-primary">
                Core Skills & Domain Expertise
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. React, Financial Accounting, CRM, SEO, SQL"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                  className={field}
                />
                <Button type="button" variant="quiet" onClick={addSkill} className="text-xs">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {skills.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary/[0.06] px-2.5 py-1 text-2xs font-medium text-secondary border border-hairline/20"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => removeSkill(s)}
                      className="hover:text-primary"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {error && <ErrorNote>{error}</ErrorNote>}

            {/* Step 2 Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-hairline/15">
              <Button
                variant="quiet"
                onClick={() => setStep(1)}
                className="text-xs font-medium"
              >
                ← Back
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  variant="quiet"
                  onClick={() => {
                    setError(null);
                    setStep(3);
                  }}
                  className="text-xs text-muted hover:text-primary font-medium"
                >
                  Skip for now →
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setError(null);
                    setStep(3);
                  }}
                  className="min-h-[44px] px-6 text-sm font-semibold"
                >
                  Continue to Trust Layer →
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 3: TRUST LAYER & CONFIDENCE THRESHOLD                        */}
        {/* ================================================================= */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                <IconSettings className="h-5 w-5 text-accent" />
                AI Agent & Trust Layer Tuning
              </h2>
              <p className="mt-1 text-xs text-secondary leading-relaxed">
                Control the autonomy of your Second Brain agent. High-confidence actions auto-execute; lower confidence actions stop for your review.
              </p>
            </div>

            {/* Confidence Slider */}
            <div className="rounded-2xl border border-hairline/20 bg-primary/[0.02] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary">
                  Auto-Execute Confidence Threshold
                </span>
                <span className="rounded-lg bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent">
                  {Math.round(confidenceThreshold * 100)}%
                </span>
              </div>

              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                className="w-full accent-accent cursor-pointer"
              />

              <div className="flex justify-between text-2xs text-muted font-medium">
                <span>50% (Permissive)</span>
                <span>75% (Recommended)</span>
                <span>95% (Strict Review)</span>
              </div>

              <div className="rounded-xl bg-accent/10 border border-accent/20 p-3 text-xs text-accent space-y-1">
                <p className="font-semibold">How this works:</p>
                <p className="text-2xs leading-relaxed text-secondary">
                  Actions scored ≥ <strong>{Math.round(confidenceThreshold * 100)}%</strong> will be automatically executed by your agent. Actions below this score will wait in your <strong>Approvals Queue</strong> for 1-click human authorization.
                </p>
              </div>
            </div>

            {/* Notifications */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-primary">
                Pending Approval Notification Mode
              </label>
              <select
                value={notificationFreq}
                onChange={(e) => setNotificationFreq(e.target.value as any)}
                className={field}
              >
                <option value="instant">Instant Email Alert (When an action needs approval)</option>
                <option value="daily_digest">Daily Summary Digest</option>
                <option value="manual">Dashboard Review Only (No emails)</option>
              </select>
            </div>

            {/* 7-Day Free Trial Notice */}
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-xs text-emerald-300 flex items-start gap-3">
              <div className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500/20 text-emerald-300 font-bold shrink-0">
                🎉
              </div>
              <div className="space-y-0.5">
                <p className="font-bold text-emerald-200">7-Day Full Access Trial Included</p>
                <p className="text-2xs text-emerald-300/90 leading-relaxed">
                  Your account includes 7 days of free unlimited job scraping, resume matching, and autonomous agent executions. Later only $1.00/month.
                </p>
              </div>
            </div>

            {error && <ErrorNote>{error}</ErrorNote>}

            {/* Step 3 Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-hairline/15">
              <Button
                variant="quiet"
                onClick={() => setStep(2)}
                className="text-xs font-medium"
              >
                ← Back
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  variant="quiet"
                  onClick={handleQuickSkip}
                  disabled={skipping || loading}
                  className="text-xs text-muted hover:text-primary font-medium"
                >
                  {skipping ? "Skipping…" : "Skip & Launch →"}
                </Button>
                <Button
                  variant="primary"
                  disabled={loading}
                  onClick={handleFinishOnboarding}
                  className="min-h-[44px] px-7 text-sm font-semibold"
                >
                  {loading ? "Activating Workspace…" : "Complete Setup & Launch ⚡"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 4: CELEBRATION & WORKSPACE READY                             */}
        {/* ================================================================= */}
        {step === 4 && (
          <div className="py-6 text-center space-y-5">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-400 ring-8 ring-emerald-500/10">
              <IconCheck className="h-8 w-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-primary">
                Your Second Brain Workspace is Ready!
              </h2>
              <p className="text-xs text-secondary max-w-md mx-auto leading-relaxed">
                Your career targets and resumes are synchronized, and your autonomous trust layer is active.
              </p>
            </div>

            <div className="rounded-2xl border border-hairline/15 bg-primary/[0.02] p-4 text-left text-xs max-w-md mx-auto space-y-2">
              <div className="flex justify-between">
                <span className="text-muted">Resumes Indexed:</span>
                <span className="font-semibold text-primary">{resumes.length} / 5</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Target Roles:</span>
                <span className="font-semibold text-primary truncate max-w-[200px]">
                  {targetTitles.join(", ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Work Preference:</span>
                <span className="font-semibold text-primary capitalize">{remotePref.replace("_", " ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Auto-Execute Gate:</span>
                <span className="font-semibold text-accent">{Math.round(confidenceThreshold * 100)}%</span>
              </div>
            </div>

            <div className="rounded-xl bg-accent/10 border border-accent/20 p-3 text-xs text-accent max-w-md mx-auto">
              💡 Tip: You can adjust all target roles, add resumes, and change thresholds anytime in <strong>Settings</strong>.
            </div>

            <div className="pt-3">
              <Button
                variant="primary"
                onClick={() => {
                  router.push("/");
                  router.refresh();
                }}
                className="min-h-[46px] w-full max-w-sm text-sm font-semibold"
              >
                Go to Control Panel Dashboard →
              </Button>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}
