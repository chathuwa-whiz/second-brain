import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { completeTask, updateTask } from "@/lib/mongo";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = (session.user as any)?.id;
  const body = await req.json().catch(() => ({}));
  const action = body.action ?? "complete";

  if (action === "reopen") {
    const task = await updateTask(params.id, { status: "open" }, userId);
    if (!task) return NextResponse.json({ error: "task not found" }, { status: 404 });
    return NextResponse.json({ task });
  }

  // Default: complete
  const result = await completeTask(params.id, userId);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ task: result.task, next: result.next ?? null });
}
