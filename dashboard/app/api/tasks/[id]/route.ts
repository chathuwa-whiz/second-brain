import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateTask, deleteTask } from "@/lib/mongo";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = (session.user as any)?.id;
  const body = await req.json();

  const allowedFields = [
    "title",
    "description",
    "priority",
    "status",
    "due_date",
    "recurrence",
    "tags",
  ];
  const updates: Record<string, any> = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no valid fields to update" }, { status: 400 });
  }

  const task = await updateTask(params.id, updates, userId);
  if (!task) return NextResponse.json({ error: "task not found" }, { status: 404 });
  return NextResponse.json({ task });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = (session.user as any)?.id;
  const deleted = await deleteTask(params.id, userId);
  if (!deleted) return NextResponse.json({ error: "task not found" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
