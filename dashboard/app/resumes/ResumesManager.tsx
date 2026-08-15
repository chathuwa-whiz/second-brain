"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, EmptyState, ErrorNote } from "@/components/ui";
import { formatBytes, relativeTime } from "@/lib/format";
import { withBasePath } from "@/lib/basePath";

type ResumeFile = { name: string; size: number; modifiedAt: string };

export default function ResumesManager() {
  const [files, setFiles] = useState<ResumeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withBasePath("/api/resumes"));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't load resumes.");
      setFiles(data.files);
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
    <div className="space-y-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files);
        }}
        className={`glass glass-sheen rounded-2xl border-2 border-dashed p-6 text-center transition-colors sm:p-10 ${
          dragging ? "border-accent bg-accent/[0.06]" : "border-hairline/20"
        }`}
      >
        <div className="mx-auto mb-3.5 grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-accent to-violet shadow-lg shadow-accent/25 sm:mb-4 sm:h-12 sm:w-12">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M12 16V4M12 4 8 8M12 4l4 4" />
            <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
          </svg>
        </div>
        <p className="text-sm font-medium text-primary">
          Drop a resume here to add it
        </p>
        <p className="mt-1 text-2xs text-muted sm:text-xs">Word or PDF, up to 10 MB each</p>
        <div className="mt-4">
          <Button
            variant="primary"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="w-full xs:w-auto"
          >
            {uploading ? "Adding…" : "Choose a file"}
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".docx,.pdf"
          multiple
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

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
          body="Add at least two tailored versions and the agent will pick whichever fits a given posting best, instead of always sending the same one."
        />
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <Card
              key={f.name}
              className="flex flex-col justify-between gap-3 p-3.5 xs:flex-row xs:items-center sm:p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="break-all text-xs font-medium text-primary xs:truncate sm:text-sm">
                  {f.name}
                </p>
                <p className="mt-0.5 text-2xs text-muted sm:text-xs">
                  {formatBytes(f.size)} · updated {relativeTime(f.modifiedAt)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={deleting === f.name}
                onClick={() => remove(f.name)}
                className="w-full shrink-0 text-danger hover:bg-danger/10 xs:w-auto"
              >
                {deleting === f.name ? "Removing…" : "Remove"}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
