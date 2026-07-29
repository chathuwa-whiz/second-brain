import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { unlink } from "fs/promises";
import path from "path";

const RESUME_DIR = process.env.RESUME_DIR;

function sanitizeFilename(name: string): string {
  const base = path.basename(name).trim();
  if (!base || base !== name.trim() || base.includes("..")) {
    throw new Error(`invalid filename: ${name}`);
  }
  return base;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { filename: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!RESUME_DIR) {
    return NextResponse.json({ error: "RESUME_DIR is not set" }, { status: 500 });
  }

  try {
    const filename = sanitizeFilename(decodeURIComponent(params.filename));
    await unlink(path.join(RESUME_DIR, filename));
    return NextResponse.json({ deleted: filename });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "delete failed";
    const notFound = (err as NodeJS.ErrnoException)?.code === "ENOENT";
    return NextResponse.json({ error: message }, { status: notFound ? 404 : 500 });
  }
}
