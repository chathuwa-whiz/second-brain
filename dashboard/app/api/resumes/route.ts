import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listUserResumes, uploadUserResume } from "@/lib/storage";

export async function GET(req: NextRequest) {
  const secretHeader = req.headers.get("x-webhook-secret");
  const session = await getServerSession(authOptions);

  const envSecret =
    process.env.ORCHESTRATOR_WEBHOOK_SECRET ||
    process.env.WEBHOOK_SECRET ||
    "second-brain-secret";

  if (!session && (!secretHeader || secretHeader !== envSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = (session?.user as any)?.id || req.headers.get("x-user-id") || "default_user";

  try {
    const result = await listUserResumes(userId);
    return NextResponse.json({
      files: result.files,
      resumes: result.files.map((f) => f.name),
      total: result.total,
      maxAllowed: result.maxAllowed,
    });
  } catch (err) {
    console.error("GET /api/resumes error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list resumes" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id || "default_user";

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided (form field name must be 'file')" },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const uploadResult = await uploadUserResume(
      userId,
      file.name,
      bytes,
      file.type
    );

    return NextResponse.json(
      {
        uploaded: uploadResult.filename,
        size: uploadResult.size,
        url: uploadResult.url,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/resumes upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 400 }
    );
  }
}
