"use client";

import { useState, useEffect } from "react";
import { Button, Card, ErrorNote } from "@/components/ui";
import { relativeTime } from "@/lib/format";
import { withBasePath } from "@/lib/basePath";

type ApiKey = {
  id: string;
  name: string;
  key_preview: string;
  last_used_at: string | null;
  created_at: string;
};

export default function ApiKeysCard() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  /*
    Reading window.location during render made the server emit one origin and
    the client another, so React threw a hydration mismatch and discarded the
    server HTML for this whole subtree - the settings page visibly re-rendered
    on load. The origin is only knowable on the client, so it's state that
    lands after mount, starting from the empty string both sides agree on.
  */
  const [baseUrl, setBaseUrl] = useState("");
  useEffect(() => setBaseUrl(window.location.origin), []);

  async function fetchKeys() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withBasePath("/api/settings/keys"));
      const data = await res.json();
      if (res.ok) {
        setKeys(data.keys || []);
      } else {
        setError(data.error || "Failed to load API keys.");
      }
    } catch {
      setError("Network error loading API keys.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchKeys();
  }, []);

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(withBasePath("/api/settings/keys"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName || "n8n Integration Key" }),
      });
      const data = await res.json();
      if (res.ok && data.apiKey) {
        setNewlyCreatedKey(data.apiKey.key);
        setKeyName("");
        setShowCreateForm(false);
        await fetchKeys();
      } else {
        setError(data.error || "Failed to generate key.");
      }
    } catch {
      setError("Network error generating API key.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevokeKey(id: string) {
    if (!confirm("Are you sure you want to revoke this API key? External workflows using it will immediately stop working.")) {
      return;
    }
    setRevokingId(id);
    try {
      const res = await fetch(withBasePath(`/api/settings/keys?id=${encodeURIComponent(id)}`), {
        method: "DELETE",
      });
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
      } else {
        setError("Failed to revoke API key.");
      }
    } catch {
      setError("Network error revoking API key.");
    } finally {
      setRevokingId(null);
    }
  }

  function copyToClipboard(text: string, setCopied: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const activeKeyStr = newlyCreatedKey || (keys[0] ? `${keys[0].key_preview.replace("...", "xxxx")}` : "YOUR_API_KEY");
  const sampleWebhookUrl = `${baseUrl}${withBasePath(`/api/webhooks/jobs?api_key=${activeKeyStr}`)}`;

  const sampleCurl = `curl -X POST "${baseUrl}${withBasePath("/api/webhooks/jobs")}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${newlyCreatedKey || "sb_live_xxxxxxxx"}" \\
  -d '{
    "title": "Senior AI / Full-Stack Engineer",
    "company": "Anthropic",
    "url": "https://jobs.lever.co/example",
    "location": "Remote",
    "remote": true,
    "score": 8.5,
    "reason": "Strong alignment with candidate skills"
  }'`;

  return (
    <Card className="p-4 sm:p-6 space-y-6">
      <div>
        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-primary sm:text-base">
              External webhook integrations
            </h3>
            <p className="mt-0.5 text-xs text-secondary leading-relaxed">
              Feed automated job postings from n8n, Make.com, or custom scrapers directly into your workspace.
            </p>
          </div>
          {!showCreateForm && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setShowCreateForm(true);
                setNewlyCreatedKey(null);
              }}
              className="text-xs shrink-0"
            >
              + Create API Key
            </Button>
          )}
        </div>
      </div>

      {/* New Key Revealed Banner */}
      {newlyCreatedKey && (
        <div className="space-y-3 rounded-xl bg-ok/[0.08] p-4 text-xs ring-1 ring-inset ring-ok/25">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-primary">
              New key generated — copy it now
            </span>
            <span className="text-2xs font-medium text-ok-ink">Shown only once</span>
          </div>
          <div className="flex items-center gap-2 break-all rounded-lg bg-primary/[0.06] p-2.5 font-mono text-2xs text-primary">
            <span className="flex-1 select-all">{newlyCreatedKey}</span>
            <button
              type="button"
              onClick={() => copyToClipboard(newlyCreatedKey, setCopiedKey)}
              className="press shrink-0 rounded-md bg-ok/15 px-2.5 py-1 text-2xs font-medium text-ok-ink hover:bg-ok/25"
            >
              {copiedKey ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <p className="text-2xs leading-relaxed text-secondary">
            Keep this safe. Send it as the <code>x-api-key</code> header, or as
            an <code>?api_key=</code> query parameter.
          </p>
        </div>
      )}

      {/* Create Key Form */}
      {showCreateForm && (
        <form onSubmit={handleCreateKey} className="rounded-2xl border border-hairline/20 bg-primary/[0.02] p-4 space-y-3.5">
          <div className="space-y-1">
            <label htmlFor="key-name" className="block text-xs font-medium text-primary">
              Key name
            </label>
            <input
              id="key-name"
              type="text"
              placeholder="e.g. n8n Job Search Workflow"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className="field"
              required
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateForm(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={creating}
              className="text-xs font-semibold"
            >
              {creating ? "Generating…" : "Generate Key"}
            </Button>
          </div>
        </form>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}

      {/* Personalized n8n Webhook URL Box */}
      <div className="rounded-2xl border border-hairline/15 bg-primary/[0.02] p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-primary">
            Your Dedicated Job Webhook Endpoint
          </span>
          <button
            type="button"
            onClick={() => copyToClipboard(sampleWebhookUrl, setCopiedUrl)}
            className="press text-2xs font-semibold text-accent-ink hover:underline"
          >
            {copiedUrl ? "Copied URL! ✓" : "Copy Webhook URL"}
          </button>
        </div>
        <div className="rounded-xl bg-primary/[0.04] p-2.5 font-mono text-2xs text-secondary break-all border border-hairline/10">
          {sampleWebhookUrl}
        </div>
      </div>

      {/* Quickstart Example */}
      <details className="group rounded-2xl border border-hairline/15 bg-primary/[0.01] p-3.5 text-xs">
        <summary className="cursor-pointer font-semibold text-primary select-none flex items-center justify-between">
          <span>View Sample JSON Payload & cURL for n8n</span>
          <span className="text-muted group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="mt-3 space-y-2 pt-2 border-t border-hairline/10">
          <p className="text-2xs text-secondary">
            Configure your n8n <strong>HTTP Request</strong> node with <code>POST</code> to your webhook URL, passing this JSON body:
          </p>
          <pre className="overflow-x-auto rounded-lg bg-primary/[0.06] p-3 font-mono text-2xs leading-relaxed text-secondary">
            {sampleCurl}
          </pre>
        </div>
      </details>

      {/* Active Keys List */}
      <div className="space-y-2.5">
        <h4 className="text-2xs font-semibold uppercase tracking-wider text-muted">
          Active keys ({keys.length})
        </h4>

        {loading ? (
          <div className="h-14 animate-pulse rounded-xl bg-primary/[0.04]" />
        ) : keys.length === 0 ? (
          <p className="text-xs text-muted py-2">
            No API keys created yet. Generate one above to connect n8n or external job scrapers.
          </p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div
                key={k.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-hairline/15 bg-primary/[0.02] p-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-primary truncate">{k.name}</p>
                    <code className="rounded bg-primary/[0.06] px-1.5 py-0.5 text-2xs text-secondary font-mono">
                      {k.key_preview}
                    </code>
                  </div>
                  <p className="mt-0.5 text-2xs text-muted">
                    Created {relativeTime(k.created_at)}
                    {k.last_used_at && ` · Last used ${relativeTime(k.last_used_at)}`}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  disabled={revokingId === k.id}
                  onClick={() => handleRevokeKey(k.id)}
                  className="self-end sm:self-auto text-danger-ink hover:bg-danger/10 text-xs shrink-0"
                >
                  {revokingId === k.id ? "Revoking…" : "Revoke"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
