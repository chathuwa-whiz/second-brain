import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { readdir, stat, mkdir, writeFile } from "fs/promises";
import path from "path";

// Same directory job-tracker-mcp's select_best_resume reads from (RESUME_DIR
// in its own .env) — this dashboard and job-tracker-mcp must agree on this
// path. Locally that means the same value in both .env files; once hosted
// on the VPS, both processes point at the same absolute path on disk.
const RESUME_DIR = process.env.RESUME_DIR;

const ALLOWED_EXTENSIONS = [".docx", ".pdf"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB — resumes are small; this is generous headroom, not a real limit

function requireResumeDir(): string {
  if (!RESUME_DIR) {
    throw new Error(
      "RESUME_DIR is not set in the dashboard's environment. Add it to " +
        "dashboard/.env.local, pointing at the same directory job-tracker-mcp uses."
    );
  }
  return RESUME_DIR;
}

// Prevents path traversal (e.g. "../../etc/passwd") and rejects anything
// that isn't a plain filename — every write/delete here derives its target
// path from a user-controlled filename, so this check runs before every one.
function sanitizeFilename(name: string): string {
  const base = path.basename(name).trim();
  if (!base || base !== name.trim() || base.includes("..")) {
    throw new Error(`invalid filename: ${name}`);
  }
  return base;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const dir = requireResumeDir();
    await mkdir(dir, { recursive: true });
    const entries = await readdir(dir);
    const files = await Promise.all(
      entries
        .filter((name) => ALLOWED_EXTENSIONS.includes(path.extname(name).toLowerCase()))
        .map(async (name) => {
          const s = await stat(path.join(dir, name));
          return { name, size: s.size, modifiedAt: s.mtime.toISOString() };
        })
    );
    files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    return NextResponse.json({ files });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed to list resumes" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const dir = requireResumeDir();
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "no file provided (field name must be 'file')" }, { status: 400 });
    }
    if (!ALLOWED_EXTENSIONS.includes(path.extname(file.name).toLowerCase())) {
      return NextResponse.json(
        { error: `unsupported file type — only ${ALLOWED_EXTENSIONS.join(", ")} are supported` },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "file too large (max 10MB)" }, { status: 400 });
    }

    const filename = sanitizeFilename(file.name);
    await mkdir(dir, { recursive: true });
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, filename), bytes);

    return NextResponse.json({ uploaded: filename, size: bytes.length }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "upload failed" },
      { status: 500 }
    );
  }
}
