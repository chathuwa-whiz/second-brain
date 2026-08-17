import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listUserResumes, getUserResumeBuffer } from "@/lib/storage";
import { extractResumeText } from "@/lib/resumeParser";

export interface TargetSuggestions {
  targetJobTitles: string[];
  experienceLevel: "junior" | "mid" | "senior" | "lead" | "executive";
  minSalary: number;
  locations: string[];
  skills: string[];
  remotePreference: "remote_only" | "hybrid" | "onsite" | "any";
  sourceResumeName?: string;
}

export const runtime = "nodejs";

/**
 * Robustly parses model response regardless of whether it returned raw JSON,
 * an OpenAI JSON response, an SSE stream (data: {...}), or Markdown-wrapped JSON.
 */
function parseModelJson(textResponse: string): any {
  let rawContent = "";

  // 1. Try parsing directly as OpenAI chat completion JSON response
  try {
    const data = JSON.parse(textResponse);
    if (data?.choices?.[0]?.message?.content) {
      rawContent = data.choices[0].message.content;
    } else if (data && typeof data === "object" && !data.choices) {
      // Direct raw JSON payload
      return data;
    }
  } catch {
    // 2. If parsing direct JSON failed, check for Server-Sent Events (SSE) stream format
    if (textResponse.includes("data:")) {
      const lines = textResponse.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (trimmed.startsWith("data:")) {
          try {
            const chunk = JSON.parse(trimmed.slice(5).trim());
            const delta =
              chunk?.choices?.[0]?.delta?.content ||
              chunk?.choices?.[0]?.message?.content ||
              "";
            rawContent += delta;
          } catch {
            // ignore unparseable SSE line
          }
        }
      }
    } else {
      rawContent = textResponse;
    }
  }

  if (!rawContent) {
    rawContent = textResponse;
  }

  // 3. Clean any markdown code fences (```json ... ```)
  const cleanJsonStr = rawContent
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```$/m, "")
    .trim();

  try {
    return JSON.parse(cleanJsonStr);
  } catch {
    // 4. Fallback: extract the first outermost {...} JSON block
    const firstBrace = rawContent.indexOf("{");
    const lastBrace = rawContent.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = rawContent.slice(firstBrace, lastBrace + 1);
      return JSON.parse(candidate);
    }
    throw new Error(
      `Could not parse model response as JSON. Content preview: ${rawContent.slice(
        0,
        200
      )}`
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id || "default_user";

  try {
    let requestedFilename: string | undefined;
    try {
      const body = await req.json();
      requestedFilename = body?.filename;
    } catch {
      // JSON body is optional
    }

    let promptContent = "";
    let sourceLabel = "";

    if (requestedFilename && requestedFilename !== "all") {
      // Single specific resume analysis
      const buffer = await getUserResumeBuffer(userId, requestedFilename);
      if (!buffer) {
        return NextResponse.json(
          { error: `Could not retrieve file content for ${requestedFilename}` },
          { status: 404 }
        );
      }

      const text = await extractResumeText(buffer, requestedFilename);
      if (!text || text.trim().length < 20) {
        return NextResponse.json(
          { error: `Resume ${requestedFilename} is empty or unreadable.` },
          { status: 422 }
        );
      }

      promptContent = `RESUME (${requestedFilename}):\n"""\n${text.slice(0, 12000)}\n"""`;
      sourceLabel = requestedFilename;
    } else {
      // Multi-resume synthesis: load and combine all uploaded resumes
      const { files } = await listUserResumes(userId);
      if (!files || files.length === 0) {
        return NextResponse.json(
          { error: "No resumes found for this user. Please upload a resume first." },
          { status: 400 }
        );
      }

      const extractedEntries: { name: string; text: string }[] = [];
      for (const file of files) {
        const buffer = await getUserResumeBuffer(userId, file.name);
        if (!buffer) continue;
        try {
          const text = await extractResumeText(buffer, file.name);
          if (text && text.trim().length >= 20) {
            extractedEntries.push({
              name: file.name,
              text: text.slice(0, 7000), // Allocate per-resume token space
            });
          }
        } catch (err) {
          console.warn(`Could not extract text from ${file.name}:`, err);
        }
      }

      if (extractedEntries.length === 0) {
        return NextResponse.json(
          { error: "Could not extract text from any of the uploaded resumes." },
          { status: 422 }
        );
      }

      if (extractedEntries.length === 1) {
        promptContent = `RESUME (${extractedEntries[0].name}):\n"""\n${extractedEntries[0].text}\n"""`;
        sourceLabel = extractedEntries[0].name;
      } else {
        const combinedTexts = extractedEntries
          .map(
            (e, i) =>
              `--- RESUME ${i + 1} (${e.name}) ---\n${e.text}`
          )
          .join("\n\n");
        promptContent = `MULTIPLE RESUMES (${extractedEntries.length} documents provided by candidate):\n"""\n${combinedTexts}\n"""`;
        sourceLabel = `${extractedEntries.length} resumes synthesized`;
      }
    }

    const prompt = `You are an expert career advisor and technical recruiter analyzing a candidate's resume data to configure their automated job search targets.
Analyze the following resume content (synthesizing across all provided documents if multiple) and infer their optimal unified career targets in Sri Lanka / global remote market.

${promptContent}

Instructions:
1. "targetJobTitles": List 3 to 6 specific, high-intent job titles the candidate is qualified for across their experience and variants (e.g., ["Senior Full Stack Engineer", "React Developer", "Node.js Architect", "Engineering Lead"]).
2. "experienceLevel": Choose exactly one of ["junior", "mid", "senior", "lead", "executive"] based on their overall highest level of relevant work experience (junior: 1-2 yrs, mid: 3-5 yrs, senior: 5-8 yrs, lead: 8+ yrs, executive: VP/Director/C-level).
3. "minSalary": Inferred realistic minimum monthly base salary in Sri Lankan Rupees (LKR).
   Guidelines for Sri Lankan market in LKR:
   - Junior: 120000 to 200000
   - Mid: 250000 to 450000
   - Senior: 500000 to 850000
   - Lead/Staff: 900000 to 1400000
   - Executive: 1500000+
   (Return as a single integer number, e.g. 350000).
4. "locations": List 2 to 4 target locations relevant to candidate (e.g., ["Colombo", "Remote", "Sri Lanka"]).
5. "skills": List 8 to 14 key technical and core skills synthesizing their actual experience and stack across all documents.
6. "remotePreference": Choose exactly one of ["remote_only", "hybrid", "onsite", "any"] (default to "remote_only" or "hybrid" for modern knowledge/tech workers).

You MUST return ONLY a valid, single JSON object with no markdown formatting or backticks:
{
  "targetJobTitles": ["Job Title 1", "Job Title 2", "Job Title 3"],
  "experienceLevel": "mid",
  "minSalary": 350000,
  "locations": ["Remote", "Colombo", "Sri Lanka"],
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "remotePreference": "remote_only"
}`;

    const llmBaseUrl =
      process.env.LLM_BASE_URL || "http://62.171.163.6:20128/v1";
    const llmModel = process.env.LLM_MODEL || "GeminiALL";
    const llmApiKey =
      process.env.LLM_API_KEY ||
      "Bearer sk-02aebea5bd06e96f-avyk7j-64c88030".replace("Bearer ", "");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 28000);

    const authHeader = llmApiKey.startsWith("Bearer ")
      ? llmApiKey
      : `Bearer ${llmApiKey}`;

    const llmRes = await fetch(`${llmBaseUrl}/chat/completions`, {
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
            content:
              "You are a strict JSON generator. You only reply with raw, valid JSON. Never output markdown code blocks, backticks, or explanatory text.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      console.error("LLM Gateway error response:", llmRes.status, errText);
      throw new Error(`LLM Gateway responded with status ${llmRes.status}`);
    }

    const textResponse = await llmRes.text();
    const suggestions: TargetSuggestions = parseModelJson(textResponse);

    // Validate and enforce fallback shapes
    const validExpLevels = ["junior", "mid", "senior", "lead", "executive"];
    const validRemotePrefs = ["remote_only", "hybrid", "onsite", "any"];

    const normalizedSuggestions: TargetSuggestions = {
      targetJobTitles:
        Array.isArray(suggestions.targetJobTitles) &&
        suggestions.targetJobTitles.length > 0
          ? suggestions.targetJobTitles.map(String).slice(0, 8)
          : ["Software Engineer", "Full Stack Developer"],
      experienceLevel: validExpLevels.includes(suggestions.experienceLevel)
        ? suggestions.experienceLevel
        : "mid",
      minSalary:
        typeof suggestions.minSalary === "number" && suggestions.minSalary > 0
          ? Math.round(suggestions.minSalary)
          : 250000,
      locations:
        Array.isArray(suggestions.locations) && suggestions.locations.length > 0
          ? suggestions.locations.map(String).slice(0, 6)
          : ["Remote", "Colombo", "Sri Lanka"],
      skills:
        Array.isArray(suggestions.skills) && suggestions.skills.length > 0
          ? suggestions.skills.map(String).slice(0, 16)
          : ["Problem Solving", "Communication", "Teamwork"],
      remotePreference: validRemotePrefs.includes(suggestions.remotePreference)
        ? suggestions.remotePreference
        : "remote_only",
      sourceResumeName: sourceLabel,
    };

    return NextResponse.json({
      success: true,
      suggestions: normalizedSuggestions,
    });
  } catch (err) {
    console.error("POST /api/resumes/suggest-targets error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to suggest targets",
      },
      { status: 500 }
    );
  }
}
