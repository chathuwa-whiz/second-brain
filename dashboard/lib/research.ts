import { getDb } from "./mongo";
import { ObjectId } from "mongodb";

export type SourceType = "url" | "file" | "note";

export type ResearchSource = {
  id: string;
  user_id: string | null;
  title: string;
  type: SourceType;
  url?: string | null;
  summary: string;
  key_takeaways: string[];
  tags: string[];
  raw_content?: string;
  chunk_count: number;
  status: "ready" | "processing" | "error";
  created_at: string;
  updated_at: string;
};

export type ResearchChunk = {
  id: string;
  source_id: string;
  source_title: string;
  source_type: SourceType;
  source_url?: string | null;
  user_id: string | null;
  chunk_index: number;
  content: string;
  embedding?: number[];
  created_at: string;
};

export type SearchResult = {
  source_id: string;
  source_title: string;
  source_url?: string | null;
  source_type: SourceType;
  chunk_index: number;
  snippet: string;
  score: number;
};

export type ResearchCitation = {
  index: number;
  title: string;
  url?: string | null;
  source_type: SourceType;
  source_id: string;
  snippet: string;
  score: number;
};

export type ResearchQAResponse = {
  question: string;
  answer: string;
  citations: ResearchCitation[];
  error?: string;
};

function iso(v: unknown): string {
  return v instanceof Date ? v.toISOString() : String(v ?? "");
}

function formatSource(doc: any): ResearchSource {
  return {
    id: String(doc._id),
    user_id: doc.user_id ? String(doc.user_id) : null,
    title: doc.title ?? "Untitled Source",
    type: doc.type ?? "note",
    url: doc.url ?? null,
    summary: doc.summary ?? "",
    key_takeaways: Array.isArray(doc.key_takeaways) ? doc.key_takeaways : [],
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    raw_content: doc.raw_content ?? undefined,
    chunk_count: typeof doc.chunk_count === "number" ? doc.chunk_count : 0,
    status: doc.status ?? "ready",
    created_at: iso(doc.created_at),
    updated_at: iso(doc.updated_at),
  };
}

// ---------------------------------------------------------------------------
// Vector & Embedding Helpers
// ---------------------------------------------------------------------------

function deterministicHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = ((h ^ s.charCodeAt(i)) * 16777619) >>> 0;
  }
  return h;
}

function fallbackVector(text: string, dim = 256): number[] {
  const vec = new Array(dim).fill(0);
  const words = text.toLowerCase().match(/\w+/g) || [];
  if (words.length === 0) return vec;

  const tokens: string[] = [...words];
  for (let i = 0; i < words.length - 1; i++) {
    tokens.push(`${words[i]}_${words[i + 1]}`);
  }
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.length >= 3) {
      for (let j = 0; j < w.length - 2; j++) {
        tokens.push(w.slice(j, j + 3));
      }
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    const idx = deterministicHash(tokens[i]) % dim;
    vec[idx] += 1;
  }

  // Normalize
  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0));
  if (norm > 0) {
    return vec.map((v) => v / norm);
  }
  return vec;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const llmBaseUrl = process.env.LLM_BASE_URL || "http://62.171.163.6:20128/v1";
  const llmApiKey = process.env.LLM_API_KEY || "not-needed";
  const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";

  try {
    const authHeader = llmApiKey.startsWith("Bearer ")
      ? llmApiKey
      : `Bearer ${llmApiKey}`;

    const res = await fetch(`${llmBaseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        model,
        input: text.slice(0, 2000),
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.data?.[0]?.embedding) {
        return data.data[0].embedding;
      }
    }
  } catch {
    // Fall back gracefully
  }

  return fallbackVector(text);
}

export function chunkText(text: string, chunkSize = 700, overlap = 100): string[] {
  if (!text) return [];
  const paragraphs = text.split("\n\n");
  const chunks: string[] = [];
  let current = "";

  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length <= chunkSize) {
      current = current ? `${current}\n\n${trimmed}` : trimmed;
    } else {
      if (current) chunks.push(current);
      if (trimmed.length > chunkSize) {
        const sentences = trimmed.split(/(?<=[.?!])\s+/);
        let sub = "";
        for (const s of sentences) {
          if (sub.length + s.length <= chunkSize) {
            sub = sub ? `${sub} ${s}` : s;
          } else {
            if (sub) chunks.push(sub);
            sub = s;
          }
        }
        current = sub;
      } else {
        current = trimmed;
      }
    }
  }

  if (current) chunks.push(current);

  if (chunks.length === 0 && text) {
    const step = Math.max(chunkSize - overlap, 100);
    for (let i = 0; i < text.length; i += step) {
      chunks.push(text.slice(i, i + chunkSize));
    }
  }

  return chunks.map((c) => c.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// LLM Analysis & Synthesis Helpers
// ---------------------------------------------------------------------------

export async function summarizeDocument(
  title: string,
  content: string
): Promise<{ summary: string; key_takeaways: string[]; tags: string[] }> {
  const llmBaseUrl = process.env.LLM_BASE_URL || "http://62.171.163.6:20128/v1";
  const llmModel = process.env.LLM_MODEL || "secondbrain";
  const llmApiKey = process.env.LLM_API_KEY || "not-needed";

  const prompt = `Analyze this document. Return ONLY a single raw JSON object (no markdown, no backticks):
{
  "summary": "2-3 sentence overview of this material",
  "key_takeaways": ["key takeaway 1", "key takeaway 2", "key takeaway 3"],
  "tags": ["tag1", "tag2", "tag3"]
}

Document Title: ${title}
Content Sample:
${content.slice(0, 3500)}`;

  try {
    const authHeader = llmApiKey.startsWith("Bearer ")
      ? llmApiKey
      : `Bearer ${llmApiKey}`;

    const res = await fetch(`${llmBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        model: llmModel,
        messages: [
          {
            role: "system",
            content: "You are a strict research analysis engine. Output only valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (res.ok) {
      const text = await res.text();
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return {
        summary: parsed.summary || "",
        key_takeaways: Array.isArray(parsed.key_takeaways) ? parsed.key_takeaways : [],
        tags: Array.isArray(parsed.tags)
          ? parsed.tags.map((t: string) => String(t).toLowerCase().trim())
          : [],
      };
    }
  } catch (err) {
    console.error("summarizeDocument LLM error:", err);
  }

  return {
    summary: content.slice(0, 240).replace(/\n+/g, " ") + "...",
    key_takeaways: ["Saved research note."],
    tags: ["research"],
  };
}

// ---------------------------------------------------------------------------
// Database Operations
// ---------------------------------------------------------------------------

export async function fetchResearchSources(options: {
  tag?: string;
  type?: string;
  query?: string;
  limit?: number;
  userId?: string;
} = {}): Promise<{ sources: ResearchSource[]; error: string | null }> {
  try {
    const db = await getDb();
    const filter: Record<string, any> = {};

    if (options.userId) {
      filter.$or = [
        { user_id: options.userId },
        { user_id: null },
        { user_id: { $exists: false } },
      ];
    }
    if (options.type) filter.type = options.type;
    if (options.tag) filter.tags = options.tag.toLowerCase().trim();

    if (options.query) {
      const q = options.query.trim();
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { summary: { $regex: q, $options: "i" } },
        { tags: { $regex: q, $options: "i" } },
      ];
    }

    const docs = await db
      .collection("research_sources")
      .find(filter, { projection: { raw_content: 0 } })
      .sort({ created_at: -1 })
      .limit(options.limit ?? 100)
      .toArray();

    return { sources: docs.map(formatSource), error: null };
  } catch (err) {
    console.error("fetchResearchSources failed:", err);
    return {
      sources: [],
      error: err instanceof Error ? err.message : "Database query failed",
    };
  }
}

export async function fetchResearchSourceById(
  id: string,
  userId?: string
): Promise<ResearchSource | null> {
  try {
    const db = await getDb();
    const filter: Record<string, any> = { _id: new ObjectId(id) };
    if (userId) {
      filter.$or = [
        { user_id: userId },
        { user_id: null },
        { user_id: { $exists: false } },
      ];
    }

    const doc = await db.collection("research_sources").findOne(filter);
    return doc ? formatSource(doc) : null;
  } catch {
    return null;
  }
}

export async function createResearchSource(input: {
  title?: string;
  content: string;
  url?: string;
  type?: SourceType;
  tags?: string[];
  userId?: string;
}): Promise<{ source: ResearchSource | null; error: string | null }> {
  try {
    const db = await getDb();
    const type: SourceType = input.type || (input.url ? "url" : "note");
    let content = input.content.trim();
    let title = (input.title || "").trim();

    if (!content) {
      return { source: null, error: "Content is required" };
    }
    if (!title) {
      title = input.url ? input.url.replace(/^https?:\/\//, "").slice(0, 50) : "Untitled Research Note";
    }

    const analysis = await summarizeDocument(title, content);
    const mergedTags = Array.from(
      new Set([
        ...(input.tags || []).map((t) => t.toLowerCase().trim()),
        ...analysis.tags,
      ])
    ).filter(Boolean);

    const now = new Date();
    const sourceDoc = {
      user_id: input.userId || null,
      title,
      type,
      url: input.url || null,
      summary: analysis.summary,
      key_takeaways: analysis.key_takeaways,
      tags: mergedTags,
      raw_content: content,
      chunk_count: 0,
      status: "ready",
      created_at: now,
      updated_at: now,
    };

    const insRes = await db.collection("research_sources").insertOne(sourceDoc);
    const sourceId = String(insRes.insertedId);

    // Chunk and generate embeddings
    const passages = chunkText(content);
    const chunkDocs = [];

    for (let i = 0; i < passages.length; i++) {
      const passage = passages[i];
      const emb = await generateEmbedding(passage);
      chunkDocs.push({
        source_id: sourceId,
        source_title: title,
        source_type: type,
        source_url: input.url || null,
        user_id: input.userId || null,
        chunk_index: i,
        content: passage,
        embedding: emb,
        created_at: now,
      });
    }

    if (chunkDocs.length > 0) {
      await db.collection("research_chunks").insertMany(chunkDocs);
      await db.collection("research_sources").updateOne(
        { _id: insRes.insertedId },
        { $set: { chunk_count: chunkDocs.length } }
      );
      sourceDoc.chunk_count = chunkDocs.length;
    }

    return {
      source: formatSource({ ...sourceDoc, _id: insRes.insertedId }),
      error: null,
    };
  } catch (err) {
    console.error("createResearchSource error:", err);
    return {
      source: null,
      error: err instanceof Error ? err.message : "Failed to create source",
    };
  }
}

export async function deleteResearchSource(
  id: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb();
    const filter: Record<string, any> = { _id: new ObjectId(id) };
    if (userId) {
      filter.$or = [
        { user_id: userId },
        { user_id: null },
        { user_id: { $exists: false } },
      ];
    }

    const res = await db.collection("research_sources").deleteOne(filter);
    if (res.deletedCount === 0) {
      return { success: false, error: "Source not found or permission denied" };
    }

    await db.collection("research_chunks").deleteMany({ source_id: id });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Delete failed",
    };
  }
}

export async function searchResearch(options: {
  query: string;
  limit?: number;
  userId?: string;
  type?: string;
}): Promise<SearchResult[]> {
  const query = options.query.trim();
  if (!query) return [];

  const db = await getDb();
  const filter: Record<string, any> = {};
  if (options.userId) {
    filter.$or = [
      { user_id: options.userId },
      { user_id: null },
      { user_id: { $exists: false } },
    ];
  }
  if (options.type) filter.source_type = options.type;

  const chunks = await db
    .collection("research_chunks")
    .find(filter)
    .limit(300)
    .toArray();

  if (chunks.length === 0) return [];

  const queryEmb = await generateEmbedding(query);
  const queryWords = new Set(query.toLowerCase().match(/\w+/g) || []);

  const scored: SearchResult[] = [];

  for (const ch of chunks) {
    const emb = ch.embedding || [];
    const cos = emb.length > 0 ? cosineSimilarity(queryEmb, emb) : 0;

    // Lexical bonus
    const contentWords = new Set(
      (ch.content || "").toLowerCase().match(/\w+/g) || []
    );
    let overlap = 0;
    queryWords.forEach((w) => {
      if (contentWords.has(w)) overlap++;
    });
    const keywordScore = (overlap / Math.max(queryWords.size, 1)) * 0.35;
    const finalScore = cos * 0.65 + keywordScore;

    scored.push({
      source_id: String(ch.source_id),
      source_title: ch.source_title || "Untitled",
      source_url: ch.source_url || null,
      source_type: ch.source_type || "note",
      chunk_index: ch.chunk_index || 0,
      snippet: ch.content || "",
      score: Number(finalScore.toFixed(4)),
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, options.limit ?? 5);
}

export async function askResearch(options: {
  question: string;
  userId?: string;
  topK?: number;
}): Promise<ResearchQAResponse> {
  const question = options.question.trim();
  if (!question) {
    return {
      question: "",
      answer: "Please provide a question to search your knowledge base.",
      citations: [],
    };
  }

  const results = await searchResearch({
    query: question,
    userId: options.userId,
    limit: options.topK ?? 4,
  });

  if (results.length === 0) {
    return {
      question,
      answer:
        "I could not find any relevant notes, articles, or documents in your research library on this topic.",
      citations: [],
    };
  }

  const citations: ResearchCitation[] = results.map((r, i) => ({
    index: i + 1,
    title: r.source_title,
    url: r.source_url,
    source_type: r.source_type,
    source_id: r.source_id,
    snippet: r.snippet.slice(0, 220) + "...",
    score: r.score,
  }));

  const contextStr = results
    .map(
      (r, i) =>
        `[${i + 1}] Title: ${r.source_title}\nSource: ${
          r.source_url || r.source_type
        }\nContent:\n${r.snippet}`
    )
    .join("\n\n---\n\n");

  const llmBaseUrl = process.env.LLM_BASE_URL || "http://62.171.163.6:20128/v1";
  const llmModel = process.env.LLM_MODEL || "secondbrain";
  const llmApiKey = process.env.LLM_API_KEY || "not-needed";

  const systemPrompt =
    "You are the research knowledge synthesis engine of the user's Second Brain.\n" +
    "Answer the question accurately based ONLY on the provided context passages below.\n" +
    "Cite your sources in-text using square bracket numbers like [1], [2] corresponding to the passages.\n" +
    "If the context does not contain enough information, explain what is known from the sources and what is missing.\n" +
    "Be concise, insightful, and structured.";

  const userPrompt = `Context Passages:\n${contextStr}\n\nQuestion: ${question}\n\nAnswer with citations:`;

  try {
    const authHeader = llmApiKey.startsWith("Bearer ")
      ? llmApiKey
      : `Bearer ${llmApiKey}`;

    const res = await fetch(`${llmBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        model: llmModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.15,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (res.ok) {
      const data = await res.json();
      const answer = data?.choices?.[0]?.message?.content?.trim() || "";
      return { question, answer, citations };
    }
  } catch (err) {
    console.error("askResearch synthesis error:", err);
  }

  return {
    question,
    answer: "Unable to generate answer synthesis. Please check LLM gateway connection.",
    citations,
  };
}
