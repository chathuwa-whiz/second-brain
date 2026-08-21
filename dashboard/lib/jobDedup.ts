/**
 * Job Deduplication and URL Normalization Utilities
 */

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "source",
  "fbclid",
  "gclid",
  "gh_src",
  "trk",
  "trkinfo",
  "refid",
  "origin",
  "sessionid",
]);

/**
 * Normalizes a job posting URL:
 * - Trims whitespace
 * - Strips marketing/tracking query parameters (utm_*, ref, etc.)
 * - Strips URL hash fragments
 * - Removes trailing slashes
 * - Lowercases scheme and hostname
 */
export function normalizeJobUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  try {
    const urlObj = new URL(trimmed);
    const cleanedParams = new URLSearchParams();

    urlObj.searchParams.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!TRACKING_PARAMS.has(lowerKey) && !lowerKey.startsWith("utm_")) {
        cleanedParams.append(key, value);
      }
    });

    const qs = cleanedParams.toString();
    const cleanPath = urlObj.pathname.replace(/\/+$/, "");
    const host = urlObj.hostname.toLowerCase();
    const protocol = urlObj.protocol.toLowerCase();
    const port = urlObj.port ? `:${urlObj.port}` : "";

    return `${protocol}//${host}${port}${cleanPath}${qs ? `?${qs}` : ""}`;
  } catch {
    // If invalid URL format, perform basic string cleaning
    return trimmed
      .toLowerCase()
      .replace(/[?#].*$/, "")
      .replace(/\/+$/, "");
  }
}

/**
 * Normalizes text (title, company) by lowercasing and stripping special punctuation
 */
export function normalizeString(str?: string | null): string {
  if (!str || typeof str !== "string") return "";
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generates a deterministic job fingerprint for a specific user
 */
export function getJobFingerprint(
  userId: string | null | undefined,
  url?: string | null,
  title?: string | null,
  company?: string | null
): string {
  const user = userId || "global";
  const cleanUrl = normalizeJobUrl(url);

  if (cleanUrl) {
    return `${user}_url_${cleanUrl}`;
  }

  const cleanTitle = normalizeString(title);
  const cleanCompany = normalizeString(company);
  return `${user}_meta_${cleanCompany}_${cleanTitle}`;
}
