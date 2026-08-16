import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchTasks, createTask } from "@/lib/mongo";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = (session.user as any)?.id;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const priority = searchParams.get("priority") ?? undefined;
  const due = searchParams.get("due") as "today" | "overdue" | "upcoming" | undefined;
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;

  const { tasks, error } = await fetchTasks({ status, priority, due, limit, userId });
  if (error) return NextResponse.json({ tasks: [], error }, { status: 500 });
  return NextResponse.json({ tasks });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userId = (session.user as any)?.id;
  const body = await req.json();

  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const validPriorities = ["low", "medium", "high"];
  if (body.priority && !validPriorities.includes(body.priority)) {
    return NextResponse.json({ error: "priority must be low/medium/high" }, { status: 400 });
  }

  const validRecurrences = ["daily", "weekdays", "weekly", "monthly"];
  if (body.recurrence && !validRecurrences.includes(body.recurrence)) {
    return NextResponse.json(
      { error: "recurrence must be daily/weekdays/weekly/monthly" },
      { status: 400 }
    );
  }

  const result = await createTask({
    userId,
    title: body.title,
    description: body.description,
    priority: body.priority,
    due_date: body.due_date,
    recurrence: body.recurrence,
    tags: Array.isArray(body.tags) ? body.tags : [],
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ task: result.task }, { status: 201 });
}
