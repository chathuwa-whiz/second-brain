import path from "path";

/**
 * Extracts plain text from resume file buffers (PDF, DOCX, TXT).
 */
export async function extractResumeText(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const ext = path.extname(filename).toLowerCase();

  if (ext === ".txt") {
    return buffer.toString("utf-8");
  }

  if (ext === ".pdf") {
    try {
      // Lazy import pdf-parse to avoid loading binary dependencies if unused
      // pdf-parse is a CommonJS module
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(buffer);
      return data.text || "";
    } catch (err) {
      console.error("PDF parsing error:", err);
      throw new Error(
        `Failed to parse PDF resume (${filename}): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  if (ext === ".docx") {
    try {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value || "";
    } catch (err) {
      console.error("DOCX parsing error:", err);
      throw new Error(
        `Failed to parse DOCX resume (${filename}): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  throw new Error(`Unsupported resume format: ${ext}. Supported: .pdf, .docx, .txt`);
}
