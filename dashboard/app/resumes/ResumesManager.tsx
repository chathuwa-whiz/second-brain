"use client";

import { useEffect, useRef, useState } from "react";

type ResumeFile = {
  name: string;
  size: number;
  modifiedAt: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ResumesManager() {
  const [files, setFiles] = useState<ResumeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/resumes");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed to load resumes");
      setFiles(data.files);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to load resumes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(fileList)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/resumes", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(`${file.name}: ${data.error ?? "upload failed"}`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(name: string) {
    setDeletingName(name);
    setError(null);
    try {
      const res = await fetch(`/api/resumes/${encodeURIComponent(name)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "delete failed");
      setFiles((prev) => prev.filter((f) => f.name !== name));
    } catch (err) {
      setError(err instanceof Error ? err.message : "delete failed");
    } finally {
      setDeletingName(null);
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleUpload(e.dataTransfer.files);
        }}
        className="rounded-lg border-2 border-dashed border-slate-700 bg-slate-900 p-8 text-center"
      >
        <p className="mb-3 text-sm text-slate-400">
          Drag & drop a resume here, or
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Choose file"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.pdf"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
        <p className="mt-3 text-xs text-slate-500">.docx or .pdf, up to 10MB each</p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : files.length === 0 ? (
        <p className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-slate-400">
          No resumes uploaded yet.
        </p>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div
              key={f.name}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 p-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-200">{f.name}</p>
                <p className="text-xs text-slate-500">
                  {formatSize(f.size)} · updated {new Date(f.modifiedAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(f.name)}
                disabled={deletingName === f.name}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deletingName === f.name ? "Deleting…" : "Delete"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
