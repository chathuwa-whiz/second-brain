import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEmailSettings, saveEmailSettings } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getEmailSettings();
    // Mask API key / password for display if desired, but allow full edit
    return NextResponse.json({ settings });
  } catch (err) {
    console.error("GET /api/settings/email error:", err);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const updated = await saveEmailSettings(body);
    return NextResponse.json({ success: true, settings: updated });
  } catch (err) {
    console.error("POST /api/settings/email error:", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
