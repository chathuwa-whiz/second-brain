import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import ActionsTable from "./ActionsTable";
import SignOutButton from "./SignOutButton";

export const dynamic = "force-dynamic";

export default async function ActionsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const { rows } = await pool.query(
    "SELECT * FROM agent_actions ORDER BY created_at DESC LIMIT 100"
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agent Actions</h1>
          <p className="text-sm text-slate-400">
            Every decision the orchestrator has made, most recent first.
          </p>
        </div>
        <SignOutButton />
      </div>
      <ActionsTable initialActions={rows} />
    </main>
  );
}
