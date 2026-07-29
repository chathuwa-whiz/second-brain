import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ResumesManager from "./ResumesManager";
import SignOutButton from "../actions/SignOutButton";

export const dynamic = "force-dynamic";

export default async function ResumesPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Resumes</h1>
          <p className="text-sm text-slate-400">
            Add or remove resumes here — select_best_resume picks between
            these when matching a job posting.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <a href="/actions" className="text-sm text-slate-400 hover:text-slate-200">
            Actions
          </a>
          <SignOutButton />
        </div>
      </div>
      <ResumesManager />
    </main>
  );
}
