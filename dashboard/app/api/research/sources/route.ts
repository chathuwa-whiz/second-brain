import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchResearchSources, createResearchSource, SourceType } from "@/lib/research";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id || (session.user as any).email;
    const { searchParams } = new URL(req.url);
    const tag = searchParams.get("tag") || undefined;
    const type = searchParams.get("type") || undefined;
    const query = searchParams.get("query") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 100;

    const { sources, error } = await fetchResearchSources({
      tag,
      type,
      query,
      limit,
      userId,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ sources });
  } catch (err) {
    console.error("GET /api/research/sources error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch sources" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id || (session.user as any).email;
    const body = await req.json();

    const { title, content, url, type, tags } = body;

    if (!content && !url) {
      return NextResponse.json(
        { error: "Either content or a valid URL must be provided." },
        { status: 400 }
      );
    }

    let finalContent = content || "";
    let finalTitle = title || "";

    // If URL provided and content is empty, scrape URL
    if (url && !finalContent) {
      try {
        const scrapeRes = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          signal: AbortSignal.timeout(15000),
        });

        if (scrapeRes.ok) {
          const html = await scrapeRes.text();
          // Extract title if missing
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (!finalTitle && titleMatch) {
            finalTitle = titleMatch[1].trim();
          }

          // Strip HTML tags for clean text content
          finalContent = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
            .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, "")
            .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "")
            .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
            .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/\s{2,}/g, " ")
            .trim();
        }
      } catch (e) {
        console.warn("Failed to scrape URL in API route:", e);
      }
    }

    if (!finalContent) {
      return NextResponse.json(
        { error: "Could not retrieve text content from URL. Please paste content directly." },
        { status: 400 }
      );
    }

    const { source, error } = await createResearchSource({
      title: finalTitle,
      content: finalContent,
      url,
      type: (type as SourceType) || (url ? "url" : "note"),
      tags: Array.isArray(tags) ? tags : [],
      userId,
    });

    if (error || !source) {
      return NextResponse.json({ error: error || "Failed to create source" }, { status: 500 });
    }

    return NextResponse.json({ source }, { status: 201 });
  } catch (err) {
    console.error("POST /api/research/sources error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create source" },
      { status: 500 }
    );
  }
}
