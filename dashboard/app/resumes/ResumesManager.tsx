"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, EmptyState, ErrorNote } from "@/components/ui";
import { formatBytes, relativeTime } from "@/lib/format";
import { withBasePath } from "@/lib/basePath";

type ResumeFile = {
  name: string;
  size: number;
  modifiedAt: string;
  url?: string;
  storage?: "r2" | "local";
};

export default function ResumesManager() {
  const [files, setFiles] = useState<ResumeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxAllowed = 5;

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withBasePath("/api/resumes"));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't load resumes.");
      setFiles(data.files || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load resumes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function upload(list: FileList | null) {
    if (!list || list.length === 0) return;
    if (files.length + list.length > maxAllowed) {
      setError(`Cannot exceed the maximum limit of ${maxAllowed} resumes.`);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(list)) {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch(withBasePath("/api/resumes"), { method: "POST", body });
        const data = await res.json();
        if (!res.ok)
          throw new Error(`${file.name}: ${data.error ?? "upload failed"}`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(name: string) {
    setDeleting(name);
    setError(null);
    try {
      const res = await fetch(withBasePath(`/api/resumes/${encodeURIComponent(name)}`), {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't delete that file.");
      setFiles((prev) => prev.filter((f) => f.name !== name));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't delete that file."
      );
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Capacity summary */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-primary sm:text-base">
              Resume library
            </h2>
            <span className="tnum rounded-md bg-accent/12 px-2 py-0.5 text-2xs font-medium text-accent">
              {files.length} of {maxAllowed}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-secondary">
            Keep a few tailored versions and the agent picks the closest fit for
            each posting.
          </p>
        </div>

        <div className="w-full shrink-0 space-y-1.5 sm:w-44">
          <div className="flex justify-between text-2xs text-muted">
            <span>Capacity</span>
            <span className="tnum">
              {Math.round((files.length / maxAllowed) * 100)}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/[0.08]">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                files.length >= maxAllowed ? "bg-warn" : "bg-accent"
              }`}
              style={{ width: `${(files.length / maxAllowed) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Upload Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (files.length < maxAllowed) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (files.length < maxAllowed) upload(e.dataTransfer.files);
        }}
        className={`rounded-2xl border border-dashed p-6 text-center transition-colors sm:p-9 ${
          dragging ? "border-accent bg-accent/[0.06]" : "border-hairline/25"
        } ${files.length >= maxAllowed ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-primary/[0.05] text-muted">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M12 16V4M12 4 8 8M12 4l4 4" />
            <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
          </svg>
        </div>
        <p className="mt-3 text-sm font-medium text-primary">
          {files.length >= maxAllowed
            ? `You've reached the limit of ${maxAllowed} resumes`
            : "Drop a resume here"}
        </p>
        <p className="mt-1 text-2xs text-muted sm:text-xs">
          PDF or Word, up to 10 MB each
        </p>
        <div className="mt-4">
          <Button
            variant="primary"
            disabled={uploading || files.length >= maxAllowed}
            onClick={() => inputRef.current?.click()}
            className="w-full xs:w-auto"
          >
            {uploading
              ? "Uploading…"
              : files.length >= maxAllowed
                ? `Limit reached (${maxAllowed}/${maxAllowed})`
                : "Upload resume"}
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".docx,.pdf"
          multiple
          disabled={files.length >= maxAllowed}
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {/* Resumes List */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="glass h-[68px] animate-pulse rounded-2xl opacity-60"
            />
          ))}
        </div>
      ) : files.length === 0 ? (
        <EmptyState
          title="No resumes yet"
          body="Add at least two tailored versions (e.g. Frontend vs Backend) and the agent will pick whichever fits a given job posting best."
        />
      ) : (
        <div className="space-y-2.5">
          {files.map((f) => (
            <Card
              key={f.name}
              className="flex flex-col justify-between gap-3 p-3.5 transition-colors hover:border-hairline/35 xs:flex-row xs:items-center sm:p-4"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent/10 text-3xs font-semibold tracking-wide text-accent">
                  {f.name.endsWith(".docx") ? "DOC" : "PDF"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="break-all text-xs font-semibold text-primary xs:truncate sm:text-sm">
                    {f.name}
                  </p>
                  <p className="mt-0.5 text-2xs text-muted sm:text-xs">
                    {formatBytes(f.size)} · updated {relativeTime(f.modifiedAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end xs:self-auto">
                <a
                  href={f.url || withBasePath(`/api/resumes/${encodeURIComponent(f.name)}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press inline-flex min-h-[34px] items-center gap-1.5 rounded-xl border border-hairline/15 bg-primary/[0.04] px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/[0.08]"
                >
                  Open
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={deleting === f.name}
                  onClick={() => remove(f.name)}
                  className="shrink-0 text-danger hover:bg-danger/10 text-xs"
                >
                  {deleting === f.name ? "Removing…" : "Remove"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
