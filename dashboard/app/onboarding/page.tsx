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
    "Full-Stack Engineer",
    "AI/ML Engineer",
  ]);
  const [locations, setLocations] = useState<string[]>(["Remote", "United States", "Worldwide"]);
  const [locationInput, setLocationInput] = useState("");
  const [remotePref, setRemotePref] = useState<"remote_only" | "hybrid" | "onsite" | "any">("remote_only");
  const [minSalary, setMinSalary] = useState<string>("100000");
  const [experienceLevel, setExperienceLevel] = useState<string>("mid");
  const [skills, setSkills] = useState<string[]>([
    "TypeScript",
    "React",
    "Python",
    "Next.js",
    "PostgreSQL",
  ]);
  const [skillInput, setSkillInput] = useState("");

  // Step 3: AI Trust Layer
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.75);
  const [notificationFreq, setNotificationFreq] = useState<"instant" | "daily_digest" | "manual">("instant");

  // Form State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial resumes if any exist
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

  useEffect(() => {
    fetchResumes();
  }, []);

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

  function addTitle() {
    if (!targetTitleInput.trim()) return;
    if (!targetTitles.includes(targetTitleInput.trim())) {
      setTargetTitles([...targetTitles, targetTitleInput.trim()]);
    }
    setTargetTitleInput("");
  }

  function removeTitle(t: string) {
    setTargetTitles(targetTitles.filter((item) => item !== t));
  }

  function addLocation() {
    if (!locationInput.trim()) return;
    if (!locations.includes(locationInput.trim())) {
      setLocations([...locations, locationInput.trim()]);
    }
    setLocationInput("");
  }

  function removeLocation(l: string) {
    setLocations(locations.filter((item) => item !== l));
  }

  function addSkill() {
    if (!skillInput.trim()) return;
    if (!skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
    }
    setSkillInput("");
  }

  function removeSkill(s: string) {
    setSkills(skills.filter((item) => item !== s));
  }

  async function handleFinishOnboarding() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(withBasePath("/api/user/onboarding"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetJobTitles: targetTitles,
          locations,
          remotePreference: remotePref,
          minSalary: minSalary ? Number(minSalary) : null,
          experienceLevel,
          skills,
          confidenceThreshold,
          notificationFrequency: notificationFreq,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to complete onboarding.");
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
    <main className="min-h-screen py-10 px-4 sm:px-6 max-w-3xl mx-auto flex flex-col justify-center">
      {/* Top Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3.5 py-1 text-2xs font-semibold uppercase tracking-wider text-accent mb-3">
          <span>✨ Workspace Setup</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
          Welcome to Second Brain
        </h1>
        <p className="mt-1.5 text-xs text-secondary sm:text-sm max-w-md mx-auto">
          Let&apos;s configure your autonomous AI assistant and career copilot in 3 simple steps.
        </p>

        {/* 3-Step Progress Indicators */}
        {step < 4 && (
          <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-4 max-w-lg mx-auto">
            <div
              className={`flex items-center gap-2 rounded-xl p-2 sm:px-3 text-xs font-semibold transition-all ${
                step === 1
                  ? "bg-accent text-white shadow-md shadow-accent/25"
                  : step > 1
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-primary/[0.04] text-muted"
              }`}
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20 text-2xs">
                {step > 1 ? "✓" : "1"}
              </span>
              <span className="truncate">Resumes</span>
            </div>

            <div
              className={`flex items-center gap-2 rounded-xl p-2 sm:px-3 text-xs font-semibold transition-all ${
                step === 2
                  ? "bg-accent text-white shadow-md shadow-accent/25"
                  : step > 2
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-primary/[0.04] text-muted"
              }`}
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20 text-2xs">
                {step > 2 ? "✓" : "2"}
              </span>
              <span className="truncate">Targets</span>
            </div>

            <div
              className={`flex items-center gap-2 rounded-xl p-2 sm:px-3 text-xs font-semibold transition-all ${
                step === 3
                  ? "bg-accent text-white shadow-md shadow-accent/25"
                  : "bg-primary/[0.04] text-muted"
              }`}
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20 text-2xs">
                3
              </span>
              <span className="truncate">Trust Layer</span>
            </div>
          </div>
        )}
      </div>

      <Card className="p-6 sm:p-8 shadow-2xl backdrop-blur-2xl">
        {/* ================================================================= */}
        {/* STEP 1: RESUMES UPLOAD (Cloudflare R2)                            */}
        {/* ================================================================= */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                  <IconResumes className="h-5 w-5 text-accent" />
                  Upload Your Resumes
                </h2>
                <span className="text-xs font-semibold text-secondary">
                  {resumes.length} / 5 Uploaded
                </span>
              </div>
              <p className="mt-1 text-xs text-secondary leading-relaxed">
                Upload up to 5 variations of your resume (PDF or DOCX). Second Brain automatically indexes and matches the best version for each opportunity.
              </p>
            </div>

            {/* Cloudflare R2 Upload Zone */}
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
              className={`rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                dragging
                  ? "border-accent bg-accent/[0.08]"
                  : "border-hairline/25 bg-primary/[0.02] hover:bg-primary/[0.04]"
              }`}
            >
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent shadow-lg shadow-accent/20">
                <IconResumes className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-primary">
                {uploading ? "Uploading to Cloudflare R2…" : "Drag & drop your resumes here"}
              </p>
              <p className="mt-1 text-2xs text-muted">
                PDF or Word DOCX (Max 10MB each)
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />

              <Button
                type="button"
                variant="quiet"
                disabled={uploading || resumes.length >= 5}
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 text-xs font-medium"
              >
                {resumes.length >= 5 ? "Limit Reached (5/5)" : "Browse Files"}
              </Button>
            </div>

            {/* Uploaded List */}
            {resumes.length > 0 && (
              <div className="space-y-2">
                <p className="text-2xs font-bold uppercase tracking-wider text-muted">
                  Indexed Resumes ({resumes.length}/5)
                </p>
                <div className="space-y-1.5">
                  {resumes.map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center justify-between gap-3 rounded-xl border border-hairline/15 bg-primary/[0.03] p-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent font-bold text-2xs">
                          PDF
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-primary truncate">{file.name}</p>
                          <p className="text-2xs text-muted">{formatBytes(file.size)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteResume(file.name)}
                        disabled={deleting === file.name}
                        className="press rounded-lg p-1.5 text-secondary hover:bg-danger/10 hover:text-danger text-2xs font-medium"
                      >
                        {deleting === file.name ? "…" : "Remove"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && <ErrorNote>{error}</ErrorNote>}

            <div className="flex justify-end pt-4 border-t">
              <Button
                variant="primary"
                onClick={() => {
                  if (resumes.length === 0) {
                    setError("Please upload at least 1 resume to continue.");
                    return;
                  }
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
        {/* STEP 2: CAREER TARGETS & CRITERIA                                */}
        {/* ================================================================= */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                <IconJobs className="h-5 w-5 text-accent" />
                Career Targets & Job Criteria
              </h2>
              <p className="mt-1 text-xs text-secondary leading-relaxed">
                Define the roles and parameters you want your AI agent to actively search and match.
              </p>
            </div>

            {/* Target Job Titles */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-primary">
                Target Job Titles
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Lead Full-Stack Engineer"
                  value={targetTitleInput}
                  onChange={(e) => setTargetTitleInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTitle())}
                  className={field}
                />
                <Button type="button" variant="quiet" onClick={addTitle} className="text-xs">
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

            {/* Remote Preference & Experience Level */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-primary">
                  Work Location Preference
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

            {/* Min Target Salary */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-primary">
                Minimum Target Salary (Annual USD)
              </label>
              <input
                type="number"
                placeholder="100000"
                value={minSalary}
                onChange={(e) => setMinSalary(e.target.value)}
                className={field}
              />
            </div>

            {/* Core Skills */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-primary">
                Core Technologies & Skills
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Next.js, LangChain, Kubernetes"
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

            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="quiet"
                onClick={() => setStep(1)}
                className="text-xs"
              >
                ← Back
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (targetTitles.length === 0) {
                    setError("Please add at least 1 target job title.");
                    return;
                  }
                  setError(null);
                  setStep(3);
                }}
                className="min-h-[44px] px-6 text-sm font-semibold"
              >
                Continue to Trust Layer →
              </Button>
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

            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="quiet"
                onClick={() => setStep(2)}
                className="text-xs"
              >
                ← Back
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
                Your career targets and resumes are synchronized with Cloudflare R2 and your autonomous trust layer is active.
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
