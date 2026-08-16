import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { fetchTasks } from "@/lib/mongo";
import PageHeader from "@/components/PageHeader";
import TaskBoard from "./TaskBoard";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = (session.user as any)?.id;

  const [openResult, doneResult] = await Promise.all([
    fetchTasks({ status: "open", userId }),
    fetchTasks({ status: "done", limit: 50, userId }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Daily Tasks"
        title="Tasks"
        description="Your to-do list — one-offs, routines, and everything the agent manages on your behalf."
      />
      <TaskBoard
        initialOpen={openResult.tasks}
        initialDone={doneResult.tasks}
        openError={openResult.error}
        doneError={doneResult.error}
      />
    </>
  );
}
