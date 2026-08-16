import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { readdir, stat, mkdir, writeFile, unlink, readFile } from "fs/promises";
import path from "path";

export const MAX_RESUMES_PER_USER = 5;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_EXTENSIONS = [".pdf", ".docx"];

export type ResumeFile = {
  name: string;
  size: number;
  modifiedAt: string;
  url?: string;
  storage: "r2" | "local";
};

// ---------------------------------------------------------------------------
// Cloudflare R2 Client
// ---------------------------------------------------------------------------

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME
  );
}

let _r2Client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (_r2Client) return _r2Client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Cloudflare R2 is not configured. Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY."
    );
  }

  _r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return _r2Client;
}

export function getBucketName(): string {
  return process.env.R2_BUCKET_NAME || "second-brain-resumes";
}

export function getUserPrefix(userId: string): string {
  const cleanId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `users/${cleanId}/resumes/`;
}

export function sanitizeFilename(name: string): string {
  const base = path.basename(name).trim();
  if (!base || base !== name.trim() || base.includes("..")) {
    throw new Error(`Invalid filename: ${name}`);
  }
  return base;
}

// ---------------------------------------------------------------------------
// Local Directory Fallback Helper
// ---------------------------------------------------------------------------

function getLocalUserDir(userId: string): string {
  const baseDir =
    process.env.RESUME_DIR ||
    "D:\\second-brain\\mcp-servers\\job-tracker-mcp\\resumes";
  const cleanId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(baseDir, cleanId);
}

// ---------------------------------------------------------------------------
// Storage Operations
// ---------------------------------------------------------------------------

export async function listUserResumes(
  userId: string
): Promise<{ files: ResumeFile[]; total: number; maxAllowed: number }> {
  if (isR2Configured()) {
    const s3 = getR2Client();
    const bucket = getBucketName();
    const prefix = getUserPrefix(userId);

    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    });

    const response = await s3.send(command);
    const contents = response.Contents || [];

    const files: ResumeFile[] = await Promise.all(
      contents
        .filter((item) => item.Key && !item.Key.endsWith("/"))
        .map(async (item) => {
          const filename = item.Key!.replace(prefix, "");
          let signedUrl: string | undefined;
          try {
            const getCommand = new GetObjectCommand({
              Bucket: bucket,
              Key: item.Key!,
            });
            signedUrl = await getSignedUrl(s3, getCommand, { expiresIn: 3600 });
          } catch {
            signedUrl = undefined;
          }

          return {
            name: filename,
            size: item.Size || 0,
            modifiedAt: item.LastModified
              ? item.LastModified.toISOString()
              : new Date().toISOString(),
            url: signedUrl,
            storage: "r2" as const,
          };
        })
    );

    files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));

    return {
      files,
      total: files.length,
      maxAllowed: MAX_RESUMES_PER_USER,
    };
  }

  // Local filesystem fallback
  const dir = getLocalUserDir(userId);
  await mkdir(dir, { recursive: true });
  const entries = await readdir(dir);
  const files: ResumeFile[] = await Promise.all(
    entries
      .filter((name) =>
        ALLOWED_EXTENSIONS.includes(path.extname(name).toLowerCase())
      )
      .map(async (name) => {
        const s = await stat(path.join(dir, name));
        return {
          name,
          size: s.size,
          modifiedAt: s.mtime.toISOString(),
          storage: "local" as const,
        };
      })
  );

  files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));

  return {
    files,
    total: files.length,
    maxAllowed: MAX_RESUMES_PER_USER,
  };
}

export async function uploadUserResume(
  userId: string,
  rawFilename: string,
  buffer: Buffer,
  contentType = "application/pdf"
): Promise<{ filename: string; size: number; url?: string }> {
  const filename = sanitizeFilename(rawFilename);
  const ext = path.extname(filename).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(
      `Unsupported file type (${ext}). Only ${ALLOWED_EXTENSIONS.join(
        ", "
      )} are supported.`
    );
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error("File size exceeds the 10MB limit.");
  }

  // Check 5-resume cap per user
  const { files } = await listUserResumes(userId);
  const exists = files.some((f) => f.name.toLowerCase() === filename.toLowerCase());
  if (!exists && files.length >= MAX_RESUMES_PER_USER) {
    throw new Error(
      `Maximum limit of ${MAX_RESUMES_PER_USER} resumes reached. Please delete an older resume before uploading a new one.`
    );
  }

  if (isR2Configured()) {
    const s3 = getR2Client();
    const bucket = getBucketName();
    const key = `${getUserPrefix(userId)}${filename}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType || (ext === ".pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    });

    await s3.send(command);

    let signedUrl: string | undefined;
    try {
      const getCommand = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      signedUrl = await getSignedUrl(s3, getCommand, { expiresIn: 3600 });
    } catch {
      signedUrl = undefined;
    }

    return {
      filename,
      size: buffer.length,
      url: signedUrl,
    };
  }

  // Local filesystem fallback
  const dir = getLocalUserDir(userId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);

  return {
    filename,
    size: buffer.length,
  };
}

export async function deleteUserResume(
  userId: string,
  rawFilename: string
): Promise<{ deleted: string }> {
  const filename = sanitizeFilename(rawFilename);

  if (isR2Configured()) {
    const s3 = getR2Client();
    const bucket = getBucketName();
    const key = `${getUserPrefix(userId)}${filename}`;

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await s3.send(command);
    return { deleted: filename };
  }

  // Local filesystem fallback
  const dir = getLocalUserDir(userId);
  const filePath = path.join(dir, filename);
  await unlink(filePath);
  return { deleted: filename };
}

export async function getUserResumeBuffer(
  userId: string,
  rawFilename: string
): Promise<Buffer | null> {
  const filename = sanitizeFilename(rawFilename);

  if (isR2Configured()) {
    try {
      const s3 = getR2Client();
      const bucket = getBucketName();
      const key = `${getUserPrefix(userId)}${filename}`;

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await s3.send(command);
      if (!response.Body) return null;

      const bytes = await response.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (err) {
      console.error(`Failed to get R2 resume buffer for ${filename}:`, err);
      return null;
    }
  }

  // Local filesystem fallback
  try {
    const dir = getLocalUserDir(userId);
    const filePath = path.join(dir, filename);
    return await readFile(filePath);
  } catch {
    return null;
  }
}

export async function getUserResumeUrl(
  userId: string,
  rawFilename: string
): Promise<string | null> {
  const filename = sanitizeFilename(rawFilename);

  if (isR2Configured()) {
    try {
      const s3 = getR2Client();
      const bucket = getBucketName();
      const key = `${getUserPrefix(userId)}${filename}`;

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      return await getSignedUrl(s3, command, { expiresIn: 3600 });
    } catch (err) {
      console.error(`Failed to get signed URL for ${filename}:`, err);
      return null;
    }
  }

  return `/api/resumes/${encodeURIComponent(filename)}`;
}
