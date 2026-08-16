import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  deleteUserResume,
  getUserResumeBuffer,
  getUserResumeUrl,
} from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: { filename: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id || "default_user";
  const filename = decodeURIComponent(params.filename);

  try {
    const signedUrl = await getUserResumeUrl(userId, filename);
    if (signedUrl && signedUrl.startsWith("http")) {
      return NextResponse.redirect(signedUrl);
    }

    const buffer = await getUserResumeBuffer(userId, filename);
    if (!buffer) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const contentType = filename.endsWith(".docx")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (err) {
    console.error("GET /api/resumes/[filename] error:", err);
    return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { filename: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id || "default_user";
  const filename = decodeURIComponent(params.filename);

  try {
    const result = await deleteUserResume(userId, filename);
    return NextResponse.json({ deleted: result.deleted });
  } catch (err) {
    console.error("DELETE /api/resumes/[filename] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
