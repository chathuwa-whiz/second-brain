"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorNote } from "@/components/ui";
import { IconCheck, IconResumes, IconSettings, IconJobs } from "@/components/icons";
import { formatBytes } from "@/lib/format";
import { withBasePath } from "@/lib/basePath";

/*
  Onboarding runs before the workspace exists, so it deliberately does not use
  AppShell (see components/ShellGate) and does not wrap its content in a Card.
  A panel floating inside a panel inside a sidebar was three frames deep for a
  form the user has to fill in exactly once. What's left is the standard shape:
  a thin progress rail, one column of content on the canvas, and a docked
  action bar that stays in reach on a phone.
*/

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

const STEPS = [
  { n: 1, label: "Resumes", Icon: IconResumes },
  { n: 2, label: "Targets", Icon: IconJobs },
  { n: 3, label: "Autonomy", Icon: IconSettings },
] as const;

/** Small labelled block. Replaces the ad-hoc label/space markup repeated below. */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-primary">{label}</label>
      {hint && <p className="text-2xs text-muted">{hint}</p>}
      {children}
    </div>
  );
}

/** Removable token. One shape for titles, locations and skills alike. */
function Chip({
  children,
  onRemove,
  tone = "neutral",
}: {
  children: React.ReactNode;
  onRemove: () => void;
  tone?: "neutral" | "accent";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md py-1 pl-2.5 pr-1 text-2xs font-medium ${
        tone === "accent"
          ? "bg-accent/10 text-accent ring-1 ring-inset ring-accent/20"
          : "bg-primary/[0.05] text-secondary ring-1 ring-inset ring-hairline/15"
      }`}
    >
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="grid h-4 w-4 place-items-center rounded text-muted transition-colors hover:text-danger"
      >
        ✕
      </button>
    </span>
  );
}

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

  // Moving between steps should start at the top of the new step, not halfway
  // down whatever the previous one had scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

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

  /* ─────────────────────────── Step 4: done ─────────────────────────── */

  if (step === 4) {
    return (
      <main className="grid min-h-screen place-items-center px-5 py-12 pb-safe pt-safe">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ok/12 text-ok ring-1 ring-ok/25">
            <IconCheck className="h-7 w-7" />
          </div>

          <h1 className="mt-5 text-xl font-semibold tracking-tight text-primary sm:text-2xl">
            Your workspace is ready
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-secondary sm:text-sm">
            Targets and resumes are saved, and the agent knows when to act on
            its own and when to ask you first.
          </p>

          <dl className="mt-7 divide-y divide-hairline/10 border-y border-hairline/10 text-left text-xs">
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-muted">Resumes</dt>
              <dd className="tnum font-medium text-primary">{resumes.length} of 5</dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="shrink-0 text-muted">Target roles</dt>
              <dd className="truncate font-medium text-primary">
                {targetTitles.join(", ") || "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-muted">Work preference</dt>
              <dd className="font-medium capitalize text-primary">
                {remotePref.replace("_", " ")}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-muted">Acts alone above</dt>
              <dd className="tnum font-medium text-accent">
                {Math.round(confidenceThreshold * 100)}%
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-2xs leading-relaxed text-muted">
            All of this is editable later under Settings.
          </p>

          <Button
            variant="primary"
            onClick={() => {
              router.push("/");
              router.refresh();
            }}
            className="mt-6 min-h-[46px] w-full text-sm font-medium"
          >
            Go to dashboard
          </Button>
        </div>
      </main>
    );
  }

  /* ───────────────────────── Steps 1-3: wizard ──────────────────────── */

  const stepMeta = {
    1: {
      title: "Add your resumes",
      blurb:
        "Upload up to five versions of your CV. The agent picks whichever one fits each job posting best, so tailored variants are worth adding.",
    },
    2: {
      title: "Tell it what to look for",
      blurb:
        "The roles, places and pay you want. These drive every match the agent scores.",
    },
    3: {
      title: "Decide how much it does alone",
      blurb:
        "Above the line the agent acts by itself. Below it, the action waits for you in Approvals.",
    },
  }[step];

  return (
    <main className="flex min-h-screen flex-col">
      {/* ── Top bar: identity + escape hatch ── */}
      <header className="pt-safe sticky top-0 z-20 border-b border-hairline/10 bg-base/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-5 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-accent to-violet">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[18px] w-[18px]"
                aria-hidden="true"
              >
                <path d="M12 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 6 0v-9a3 3 0 0 0-3-3z" />
                <path d="M9 8.5H6.5a2.5 2.5 0 0 0 0 5H9M15 8.5h2.5a2.5 2.5 0 0 1 0 5H15" />
              </svg>
            </div>
            <p className="truncate text-sm font-medium tracking-tight text-primary">
              Set up Second Brain
            </p>
          </div>

          <button
            type="button"
            onClick={handleQuickSkip}
            disabled={skipping || loading}
            className="press shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:text-primary disabled:opacity-50"
          >
            {skipping ? "Skipping…" : "Skip"}
          </button>
        </div>

        {/*
          Progress as a rail rather than three tappable cards. It reports where
          you are without pretending to be the primary control - Continue is.
        */}
        <div className="mx-auto w-full max-w-xl px-5 pb-3">
          <div className="flex items-center gap-1.5">
            {STEPS.map(({ n, label }) => (
              <button
                key={n}
                type="button"
                onClick={() => setStep(n)}
                aria-current={step === n ? "step" : undefined}
                aria-label={`Step ${n}: ${label}`}
                className="group flex-1 text-left"
              >
                <span
                  className={`block h-[3px] rounded-full transition-colors ${
                    n <= step
                      ? "bg-accent"
                      : "bg-primary/10 group-hover:bg-primary/20"
                  }`}
                />
                <span
                  className={`mt-1.5 block text-3xs font-medium uppercase tracking-wider transition-colors ${
                    n === step ? "text-primary" : "text-muted"
                  }`}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Step content ── */}
      <div className="mx-auto w-full max-w-xl flex-1 px-5 py-7 sm:py-10">
        <h1 className="text-xl font-semibold tracking-tight text-primary sm:text-2xl">
          {stepMeta.title}
        </h1>
        <p className="mt-1.5 max-w-lg text-xs leading-relaxed text-secondary sm:text-sm">
          {stepMeta.blurb}
        </p>

        <div className="mt-7 space-y-7">
          {/* ══════════════ STEP 1: RESUMES ══════════════ */}
          {step === 1 && (
            <>
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
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-9 text-center transition-colors ${
                  dragging
                    ? "border-accent bg-accent/[0.06]"
                    : "border-hairline/25 hover:border-accent/40 hover:bg-primary/[0.02]"
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
                <IconResumes className="h-6 w-6 text-muted" />
                <p className="mt-3 text-sm font-medium text-primary">
                  {uploading ? "Uploading…" : "Drop a resume, or click to browse"}
                </p>
                <p className="mt-1 text-2xs text-muted">
                  PDF, DOCX or TXT · up to 5 files
                </p>
              </div>

              {resumes.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-primary">
                    Uploaded{" "}
                    <span className="tnum text-muted">
                      ({resumes.length}/5)
                    </span>
                  </p>
                  <ul className="mt-2 divide-y divide-hairline/10 border-y border-hairline/10">
                    {resumes.map((file) => (
                      <li
                        key={file.name}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <IconCheck className="h-4 w-4 shrink-0 text-ok" />
                          <span className="truncate text-xs font-medium text-primary">
                            {file.name}
                          </span>
                          <span className="shrink-0 text-2xs text-muted">
                            {formatBytes(file.size)}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={deleting === file.name}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteResume(file.name);
                          }}
                          className="press shrink-0 rounded-lg px-2 py-1 text-2xs font-medium text-muted transition-colors hover:text-danger disabled:opacity-50"
                        >
                          {deleting === file.name ? "Removing…" : "Remove"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* ══════════════ STEP 2: TARGETS ══════════════ */}
          {step === 2 && (
            <>
              <Field
                label="Target job titles"
                hint="Add your own, or tap a suggestion below."
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Software Engineer"
                    value={targetTitleInput}
                    onChange={(e) => setTargetTitleInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), addTitle())
                    }
                    className="field"
                  />
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => addTitle()}
                    className="shrink-0"
                  >
                    Add
                  </Button>
                </div>

                {targetTitles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {targetTitles.map((t) => (
                      <Chip key={t} tone="accent" onRemove={() => removeTitle(t)}>
                        {t}
                      </Chip>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {Object.values(POPULAR_ROLES_BY_CATEGORY)
                    .flatMap((roles) => roles.slice(0, 2))
                    .filter((role) => !targetTitles.includes(role))
                    .map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => addTitle(role)}
                        className="press rounded-md px-2.5 py-1 text-2xs font-medium text-secondary ring-1 ring-inset ring-hairline/15 transition-colors hover:text-primary hover:ring-accent/30"
                      >
                        + {role}
                      </button>
                    ))}
                </div>
              </Field>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Work preference">
                  <select
                    value={remotePref}
                    onChange={(e) => setRemotePref(e.target.value as any)}
                    className="field select-field"
                  >
                    <option value="remote_only">Remote only</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">On-site</option>
                    <option value="any">Any / flexible</option>
                  </select>
                </Field>

                <Field label="Experience level">
                  <select
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value)}
                    className="field select-field"
                  >
                    <option value="junior">Junior (1–2 yrs)</option>
                    <option value="mid">Mid-level (3–5 yrs)</option>
                    <option value="senior">Senior (5–8 yrs)</option>
                    <option value="lead">Lead / Staff (8+ yrs)</option>
                    <option value="executive">Executive / VP</option>
                  </select>
                </Field>
              </div>

              <Field label="Minimum salary" hint="Annual, in USD.">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="80000"
                  value={minSalary}
                  onChange={(e) => setMinSalary(e.target.value)}
                  className="field"
                />
              </Field>

              <Field label="Target locations">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Remote, Sri Lanka, UK"
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), addLocation())
                    }
                    className="field"
                  />
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={addLocation}
                    className="shrink-0"
                  >
                    Add
                  </Button>
                </div>
                {locations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {locations.map((loc) => (
                      <Chip key={loc} onRemove={() => removeLocation(loc)}>
                        {loc}
                      </Chip>
                    ))}
                  </div>
                )}
              </Field>

              <Field
                label="Core skills"
                hint="Used to score how well you fit each posting."
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. React, SQL, SEO"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), addSkill())
                    }
                    className="field"
                  />
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={addSkill}
                    className="shrink-0"
                  >
                    Add
                  </Button>
                </div>
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {skills.map((s) => (
                      <Chip key={s} onRemove={() => removeSkill(s)}>
                        {s}
                      </Chip>
                    ))}
                  </div>
                )}
              </Field>
            </>
          )}

          {/* ══════════════ STEP 3: AUTONOMY ══════════════ */}
          {step === 3 && (
            <>
              <div className="space-y-4">
                <div className="flex items-baseline justify-between gap-3">
                  <label
                    htmlFor="confidence"
                    className="text-xs font-medium text-primary"
                  >
                    Acts on its own above
                  </label>
                  <span className="tnum text-2xl font-semibold tracking-tight text-accent">
                    {Math.round(confidenceThreshold * 100)}%
                  </span>
                </div>

                <input
                  id="confidence"
                  type="range"
                  min="0.5"
                  max="0.95"
                  step="0.05"
                  value={confidenceThreshold}
                  onChange={(e) =>
                    setConfidenceThreshold(parseFloat(e.target.value))
                  }
                  className="w-full cursor-pointer accent-accent"
                />

                <div className="flex justify-between text-3xs text-muted">
                  <span>50% · permissive</span>
                  <span>75% · recommended</span>
                  <span>95% · strict</span>
                </div>

                <p className="text-xs leading-relaxed text-secondary">
                  Anything the agent scores at{" "}
                  <span className="tnum font-medium text-primary">
                    {Math.round(confidenceThreshold * 100)}%
                  </span>{" "}
                  or higher runs automatically. Everything below waits in your{" "}
                  <span className="font-medium text-primary">Approvals</span>{" "}
                  queue for a one-tap decision.
                </p>
              </div>

              <Field label="When something needs your approval">
                <select
                  value={notificationFreq}
                  onChange={(e) => setNotificationFreq(e.target.value as any)}
                  className="field select-field"
                >
                  <option value="instant">Email me right away</option>
                  <option value="daily_digest">Send one daily summary</option>
                  <option value="manual">Don&apos;t email — I&apos;ll check the dashboard</option>
                </select>
              </Field>

              <div className="flex items-start gap-2.5 rounded-xl bg-ok/[0.08] p-3.5 ring-1 ring-inset ring-ok/20">
                <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
                <p className="text-xs leading-relaxed text-secondary">
                  <span className="font-medium text-primary">
                    Everything is included, free.
                  </span>{" "}
                  Unlimited job scanning, resume matching and autonomous
                  actions — no trial clock, no card required.
                </p>
              </div>
            </>
          )}

          {error && <ErrorNote>{error}</ErrorNote>}
        </div>
      </div>

      {/* ── Docked action bar ── */}
      <div className="pb-safe sticky bottom-0 z-20 border-t border-hairline/10 bg-base/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-5 py-3">
          {step > 1 ? (
            <Button
              variant="ghost"
              onClick={() => {
                setError(null);
                setStep((s) => (s - 1) as 1 | 2 | 3);
              }}
            >
              Back
            </Button>
          ) : (
            <span />
          )}

          {step < 3 ? (
            <Button
              variant="primary"
              onClick={() => {
                setError(null);
                setStep((s) => (s + 1) as 2 | 3);
              }}
              className="min-h-[44px] px-6 text-sm font-medium"
            >
              Continue
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={loading || skipping}
              onClick={handleFinishOnboarding}
              className="min-h-[44px] px-6 text-sm font-medium"
            >
              {loading ? "Finishing…" : "Finish setup"}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
