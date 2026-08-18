import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { askResearch, searchResearch } from "@/lib/research";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id || (session.user as any).email;
    const body = await req.json();
    const { question, mode, topK } = body;

    if (!question || !question.trim()) {
      return NextResponse.json(
        { error: "Question query is required." },
        { status: 400 }
      );
    }

    // If caller specifically requests raw search passages without full LLM synthesis
    if (mode === "search") {
      const results = await searchResearch({
        query: question.trim(),
        userId,
        limit: topK || 5,
      });
      return NextResponse.json({ results });
    }

    // Default: Grounded RAG synthesis with citations
    const response = await askResearch({
      question: question.trim(),
      userId,
      topK: topK || 4,
    });

    return NextResponse.json(response);
  } catch (err) {
    console.error("POST /api/research/ask error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "RAG query failed" },
      { status: 500 }
    );
  }
}
