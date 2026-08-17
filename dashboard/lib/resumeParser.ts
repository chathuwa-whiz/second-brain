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
      const { getDocumentProxy, extractText } = require("unpdf");
      const uint8 = new Uint8Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength
      );
      const pdf = await getDocumentProxy(uint8);
      const { text } = await extractText(pdf, { mergePages: true });
      return text || "";
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
