import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchApplications, fetchJobMatches } from "@/lib/mongo";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id;
  const kind = req.nextUrl.searchParams.get("kind") ?? "matches";
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 100);

  if (kind === "applications") {
    const { applications, error } = await fetchApplications(limit, userId);
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ applications });
  }

  const { matches, error } = await fetchJobMatches(status, limit, userId);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ matches });
}
