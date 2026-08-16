import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createApiKey, listApiKeys, deleteApiKey } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id;
  if (!userId) {
    return NextResponse.json({ error: "user_not_found" }, { status: 401 });
  }

  try {
    const keys = await listApiKeys(userId);
    return NextResponse.json({ keys });
  } catch (err) {
    console.error("GET /api/settings/keys error:", err);
    return NextResponse.json(
      { error: "Failed to list API keys" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id;
  if (!userId) {
    return NextResponse.json({ error: "user_not_found" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const name = body.name || "n8n Automation Key";

    const created = await createApiKey(userId, name);
    return NextResponse.json({
      success: true,
      apiKey: created,
      message:
        "API key generated! Please copy your key now — you won't be able to see it again.",
    });
  } catch (err) {
    console.error("POST /api/settings/keys error:", err);
    return NextResponse.json(
      { error: "Failed to generate API key" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id;
  if (!userId) {
    return NextResponse.json({ error: "user_not_found" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const keyId = searchParams.get("id");

    if (!keyId) {
      return NextResponse.json({ error: "Key ID is required" }, { status: 400 });
    }

    const deleted = await deleteApiKey(userId, keyId);
    return NextResponse.json({ success: deleted });
  } catch (err) {
    console.error("DELETE /api/settings/keys error:", err);
    return NextResponse.json(
      { error: "Failed to delete API key" },
      { status: 500 }
    );
  }
}
