import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { setMatchStatus } from "@/lib/mongo";

const VALID = ["new", "applied", "dismissed"] as const;

/*
  Only ever sets the status label on a job match. There is deliberately no
  endpoint here that creates a job_applications row: marking a match "applied"
  is bookkeeping, and logging a real application stays an explicit separate
  step through the agent. Same boundary the n8n webhook respects on the way in.
*/
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { status } = await req.json();
  if (!VALID.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of ${VALID.join(", ")}` },
      { status: 400 }
    );
  }

  const userId = (session.user as any)?.id;
  const userRole = (session.user as any)?.role;
  const scopedUserId = userRole === "admin" ? undefined : userId;

  try {
    const match = await setMatchStatus(params.id, status, scopedUserId);
    if (!match) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ match });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "database error" },
      { status: 500 }
    );
  }
}
