"use client";

import { useState, useTransition } from "react";
import PageHeader from "@/components/PageHeader";
import { Badge, Button, Card } from "@/components/ui";
import {
  IconSearch,
  IconPlus,
  IconSparkles,
  IconExternal,
  IconTrash,
  IconRefresh,
} from "@/components/icons";
import { ResearchSource, ResearchCitation, ResearchQAResponse } from "@/lib/research";

interface ResearchClientProps {
  initialSources: ResearchSource[];
  initialError: string | null;
  currentUser: {
    id?: string;
    name?: string | null;
    email?: string | null;
  };
}

export default function ResearchClient({
  initialSources,
  initialError,
  currentUser,
}: ResearchClientProps) {
  const [sources, setSources] = useState<ResearchSource[]>(initialSources);
  const [activeTab, setActiveTab] = useState<"ask" | "library">("ask");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Q&A State
  const [question, setQuestion] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [qaResponse, setQaResponse] = useState<ResearchQAResponse | null>(null);
  const [qaError, setQaError] = useState<string | null>(null);

  // Ingest Modal State
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [ingestType, setIngestType] = useState<"url" | "note">("url");
  const [ingestUrl, setIngestUrl] = useState("");
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestContent, setIngestContent] = useState("");
  const [ingestTags, setIngestTags] = useState("");
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);

  // Detail Modal State
  const [selectedSource, setSelectedSource] = useState<ResearchSource | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Collect all unique tags
  const allTags = Array.from(
    new Set(sources.flatMap((s) => s.tags || []))
  ).filter(Boolean);

  // Filter sources
  const filteredSources = sources.filter((s) => {
    if (selectedType && s.type !== selectedType) return false;
    if (selectedTag && !s.tags?.includes(selectedTag)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = s.title.toLowerCase().includes(q);
      const matchSummary = s.summary.toLowerCase().includes(q);
      const matchTags = s.tags?.some((t) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchSummary && !matchTags) return false;
    }
    return true;
  });

  async function handleAskQuestion(qToAsk?: string) {
    const q = (qToAsk || question).trim();
    if (!q) return;

    setQaLoading(true);
    setQaError(null);
    if (qToAsk) setQuestion(qToAsk);

    try {
      const res = await fetch("/api/research/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to synthesize knowledge answer");
      }

      setQaResponse(data);
    } catch (err) {
      setQaError(err instanceof Error ? err.message : "Error executing query");
    } finally {
      setQaLoading(false);
    }
  }

  async function handleIngestSource(e: React.FormEvent) {
    e.preventDefault();
    setIngestLoading(true);
    setIngestError(null);

    const parsedTags = ingestTags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    try {
      const res = await fetch("/api/research/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: ingestTitle.trim(),
          content: ingestContent.trim(),
          url: ingestUrl.trim() || undefined,
          type: ingestType,
          tags: parsedTags,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to save research source");
      }

      if (data.source) {
        setSources((prev) => [data.source, ...prev]);
      }

      // Reset form and close
      setIngestTitle("");
      setIngestContent("");
      setIngestUrl("");
      setIngestTags("");
      setIsIngestOpen(false);
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : "Ingestion failed");
    } finally {
      setIngestLoading(false);
    }
  }

  async function handleDeleteSource(id: string) {
    if (!confirm("Are you sure you want to delete this research source and its indexed chunks?")) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/research/sources/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSources((prev) => prev.filter((s) => s.id !== id));
        if (selectedSource?.id === id) {
          setSelectedSource(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete source:", err);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          eyebrow="Knowledge Base"
          title="Research & Knowledge (RAG)"
          description="Saves articles, documents, and notes, indexes them into vector chunks, and synthesizes answers with source citations."
        />

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => setIsIngestOpen(true)}
            variant="primary"
            className="flex items-center gap-1.5 shadow-sm"
          >
            <IconPlus className="h-4 w-4" />
            <span>Add Source</span>
          </Button>
        </div>
      </div>

      {initialError && (
        <Card className="border-danger/30 bg-danger/5 p-4 text-sm text-danger-ink">
          <p className="font-medium">Connection Notice</p>
          <p className="mt-0.5 text-xs text-secondary">{initialError}</p>
        </Card>
      )}

      {/* Main Tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-hairline/20 bg-raised/40 p-1 backdrop-blur-md">
        <button
          onClick={() => setActiveTab("ask")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all sm:text-sm ${
            activeTab === "ask"
              ? "bg-accent/15 text-accent-ink shadow-sm ring-1 ring-accent/20"
              : "text-secondary hover:text-primary"
          }`}
        >
          <IconSparkles className="h-4 w-4" />
          <span>Ask Knowledge Base</span>
        </button>

        <button
          onClick={() => setActiveTab("library")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all sm:text-sm ${
            activeTab === "library"
              ? "bg-accent/15 text-accent-ink shadow-sm ring-1 ring-accent/20"
              : "text-secondary hover:text-primary"
          }`}
        >
          <IconSearch className="h-4 w-4" />
          <span>Research Library</span>
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-3xs font-bold text-muted">
            {sources.length}
          </span>
        </button>
      </div>

      {/* ----------------- TAB 1: ASK KNOWLEDGE BASE ----------------- */}
      {activeTab === "ask" && (
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-ink">
              <IconSparkles className="h-4 w-4 text-accent" />
              <span>Grounded Retrieval-Augmented Generation</span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskQuestion();
              }}
              className="mt-3 space-y-3"
            >
              <div className="relative">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a question across your research, articles, and notes..."
                  className="w-full rounded-xl border border-hairline/25 bg-chrome/60 px-4 py-3.5 pr-28 text-sm text-primary placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={qaLoading || !question.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                  >
                    {qaLoading ? (
                      <>
                        <IconRefresh className="h-3.5 w-3.5 animate-spin" />
                        <span>Synthesizing...</span>
                      </>
                    ) : (
                      <>
                        <IconSparkles className="h-3.5 w-3.5" />
                        <span>Ask Brain</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Suggestions */}
              {sources.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-2xs font-medium text-muted">Suggestions:</span>
                  {sources.slice(0, 3).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleAskQuestion(`Summarize key insights from "${s.title}"`)}
                      className="press rounded-full border border-hairline/20 bg-raised/60 px-2.5 py-1 text-2xs text-secondary hover:border-accent/40 hover:text-accent-ink transition-colors"
                    >
                      Summary of {s.title.slice(0, 32)}...
                    </button>
                  ))}
                </div>
              )}
            </form>

            {qaError && (
              <div className="mt-4 rounded-xl border border-danger/25 bg-danger/5 p-3.5 text-xs text-danger-ink">
                <span className="font-semibold">Query Failed: </span>
                {qaError}
              </div>
            )}

            {/* Answer Display */}
            {qaResponse && (
              <div className="animate-rise mt-6 space-y-4 rounded-2xl border border-hairline/25 bg-raised/70 p-5 sm:p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-hairline/15 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-accent/15 text-accent-ink">
                      <IconSparkles className="h-3.5 w-3.5" />
                    </span>
                    <h3 className="text-sm font-semibold tracking-tight text-primary">
                      Synthesized Knowledge Answer
                    </h3>
                  </div>
                  <Badge tone="ok">Grounded RAG</Badge>
                </div>

                <div className="prose prose-sm max-w-none text-xs leading-relaxed text-secondary sm:text-sm whitespace-pre-wrap">
                  {qaResponse.answer}
                </div>

                {/* Citations Section */}
                {qaResponse.citations && qaResponse.citations.length > 0 && (
                  <div className="mt-4 border-t border-hairline/15 pt-4">
                    <p className="text-2xs font-bold uppercase tracking-wider text-muted">
                      Source Citations ({qaResponse.citations.length})
                    </p>

                    <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                      {qaResponse.citations.map((cite) => (
                        <div
                          key={cite.index}
                          className="group relative rounded-xl border border-hairline/20 bg-chrome/50 p-3 text-xs transition-all hover:border-accent/30"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-accent/15 text-3xs font-bold text-accent-ink">
                                [{cite.index}]
                              </span>
                              <span className="truncate font-semibold text-primary">
                                {cite.title}
                              </span>
                            </div>
                            <span className="tnum text-3xs font-medium text-muted">
                              {Math.round(cite.score * 100)}% match
                            </span>
                          </div>

                          <p className="mt-2 line-clamp-2 text-2xs text-secondary leading-relaxed">
                            {cite.snippet}
                          </p>

                          {cite.url && (
                            <a
                              href={cite.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-3xs font-medium text-accent-ink hover:underline"
                            >
                              <span>Open source article</span>
                              <IconExternal className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ----------------- TAB 2: RESEARCH LIBRARY ----------------- */}
      {activeTab === "library" && (
        <div className="space-y-5">
          {/* Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <IconSearch className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes, articles, tags..."
                className="w-full rounded-xl border border-hairline/25 bg-chrome/60 py-2 pl-9.5 pr-3 text-xs text-primary placeholder:text-muted focus:border-accent focus:outline-none sm:text-sm"
              />
            </div>

            {/* Type Filters */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setSelectedType(null)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  selectedType === null
                    ? "bg-accent/15 text-accent-ink font-semibold"
                    : "text-secondary hover:bg-primary/[0.05]"
                }`}
              >
                All Types
              </button>
              <button
                onClick={() => setSelectedType("url")}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  selectedType === "url"
                    ? "bg-accent/15 text-accent-ink font-semibold"
                    : "text-secondary hover:bg-primary/[0.05]"
                }`}
              >
                Web Articles
              </button>
              <button
                onClick={() => setSelectedType("note")}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  selectedType === "note"
                    ? "bg-accent/15 text-accent-ink font-semibold"
                    : "text-secondary hover:bg-primary/[0.05]"
                }`}
              >
                Notes
              </button>
            </div>
          </div>

          {/* Tag Cloud */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-2xs font-semibold uppercase tracking-wider text-muted mr-1">
                Tags:
              </span>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`press rounded-md px-2 py-0.5 text-2xs transition-all ${
                    selectedTag === tag
                      ? "bg-accent text-white font-semibold"
                      : "bg-raised/70 text-secondary border border-hairline/20 hover:border-accent/30"
                  }`}
                >
                  #{tag}
                </button>
              ))}
              {selectedTag && (
                <button
                  onClick={() => setSelectedTag(null)}
                  className="text-2xs font-semibold text-danger-ink hover:underline ml-1"
                >
                  Clear tag
                </button>
              )}
            </div>
          )}

          {/* Source Cards Grid */}
          {filteredSources.length === 0 ? (
            <Card className="p-8 text-center sm:p-12">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent-ink">
                <IconSearch className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-primary">
                No research materials found
              </h3>
              <p className="mt-1 text-xs text-secondary max-w-sm mx-auto">
                {searchQuery || selectedTag || selectedType
                  ? "No saved documents match your current filter criteria."
                  : "Your research library is empty. Click 'Add Source' above to ingest your first article, paper, or research note."}
              </p>
              <Button
                onClick={() => setIsIngestOpen(true)}
                variant="primary"
                className="mt-5"
              >
                Add Your First Source
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSources.map((source) => (
                <Card
                  key={source.id}
                  className="flex flex-col p-4 sm:p-5 transition-all hover:border-accent/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Badge tone={source.type === "url" ? "ok" : "neutral"}>
                        {source.type === "url" ? "Web Article" : "Note"}
                      </Badge>
                      <span className="tnum text-3xs text-muted">
                        {source.chunk_count} chunk{source.chunk_count === 1 ? "" : "s"}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteSource(source.id)}
                      disabled={deletingId === source.id}
                      className="press rounded p-1 text-muted hover:bg-danger/10 hover:text-danger-ink transition-colors"
                      title="Delete source"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <h4 className="mt-2.5 font-semibold text-sm tracking-tight text-primary line-clamp-2">
                    {source.title}
                  </h4>

                  <p className="mt-2 text-xs leading-relaxed text-secondary line-clamp-3">
                    {source.summary}
                  </p>

                  {/* Key Takeaways */}
                  {source.key_takeaways && source.key_takeaways.length > 0 && (
                    <div className="mt-3 space-y-1 border-t border-hairline/15 pt-2.5">
                      <p className="text-3xs font-bold uppercase tracking-wider text-muted">
                        Key Takeaway
                      </p>
                      <p className="text-2xs text-secondary line-clamp-2 italic">
                        • {source.key_takeaways[0]}
                      </p>
                    </div>
                  )}

                  {/* Tags */}
                  {source.tags && source.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {source.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded bg-primary/5 px-1.5 py-0.5 text-3xs text-muted font-medium"
                        >
                          #{t}
                        </span>
                      ))}
                      {source.tags.length > 3 && (
                        <span className="text-3xs text-muted">
                          +{source.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Card Footer */}
                  <div className="mt-auto flex items-center justify-between border-t border-hairline/15 pt-3 mt-4">
                    <span className="text-3xs text-muted">
                      {new Date(source.created_at).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-2">
                      {source.url && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="press inline-flex items-center gap-1 text-2xs font-medium text-accent-ink hover:underline"
                        >
                          <span>Source</span>
                          <IconExternal className="h-3 w-3" />
                        </a>
                      )}
                      <button
                        onClick={() => setSelectedSource(source)}
                        className="press text-2xs font-medium text-primary hover:text-accent-ink"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ----------------- INGEST MODAL ----------------- */}
      {isIngestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="animate-rise w-full max-w-lg rounded-2xl border border-hairline/25 bg-raised p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline/15 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-accent-ink">
                  <IconPlus className="h-4 w-4" />
                </span>
                <h3 className="text-base font-semibold text-primary">
                  Ingest Research Source
                </h3>
              </div>
              <button
                onClick={() => setIsIngestOpen(false)}
                className="press rounded-lg p-1.5 text-muted hover:bg-primary/10 hover:text-primary"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex gap-1 rounded-xl bg-chrome/50 p-1">
              <button
                type="button"
                onClick={() => setIngestType("url")}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                  ingestType === "url"
                    ? "bg-accent/15 text-accent-ink shadow-sm"
                    : "text-secondary"
                }`}
              >
                Web URL Article
              </button>
              <button
                type="button"
                onClick={() => setIngestType("note")}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                  ingestType === "note"
                    ? "bg-accent/15 text-accent-ink shadow-sm"
                    : "text-secondary"
                }`}
              >
                Direct Note / Document
              </button>
            </div>

            <form onSubmit={handleIngestSource} className="mt-4 space-y-3.5">
              {ingestType === "url" ? (
                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-muted">
                    Article Web URL *
                  </label>
                  <input
                    type="url"
                    required
                    value={ingestUrl}
                    onChange={(e) => setIngestUrl(e.target.value)}
                    placeholder="https://example.com/blog/ai-agents"
                    className="mt-1 w-full rounded-xl border border-hairline/25 bg-chrome/60 px-3.5 py-2 text-xs text-primary placeholder:text-muted focus:border-accent focus:outline-none"
                  />
                  <p className="mt-1 text-3xs text-muted">
                    The agent will automatically scrape, clean, summarize, and index the text.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-muted">
                    Note / Paper Title
                  </label>
                  <input
                    type="text"
                    value={ingestTitle}
                    onChange={(e) => setIngestTitle(e.target.value)}
                    placeholder="e.g. Distributed Consensus in Raft"
                    className="mt-1 w-full rounded-xl border border-hairline/25 bg-chrome/60 px-3.5 py-2 text-xs text-primary placeholder:text-muted focus:border-accent focus:outline-none"
                  />
                </div>
              )}

              {ingestType === "note" && (
                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-muted">
                    Content Text *
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={ingestContent}
                    onChange={(e) => setIngestContent(e.target.value)}
                    placeholder="Paste full text, markdown, or research notes..."
                    className="mt-1 w-full rounded-xl border border-hairline/25 bg-chrome/60 p-3 text-xs text-primary placeholder:text-muted focus:border-accent focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-2xs font-semibold uppercase tracking-wider text-muted">
                  Custom Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={ingestTags}
                  onChange={(e) => setIngestTags(e.target.value)}
                  placeholder="ai, llm, architecture, postgres"
                  className="mt-1 w-full rounded-xl border border-hairline/25 bg-chrome/60 px-3.5 py-2 text-xs text-primary placeholder:text-muted focus:border-accent focus:outline-none"
                />
              </div>

              {ingestError && (
                <div className="rounded-xl border border-danger/25 bg-danger/5 p-3 text-xs text-danger-ink">
                  {ingestError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsIngestOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={ingestLoading}
                  className="flex items-center gap-1.5"
                >
                  {ingestLoading ? (
                    <>
                      <IconRefresh className="h-3.5 w-3.5 animate-spin" />
                      <span>Embedding & Indexing...</span>
                    </>
                  ) : (
                    <span>Save to Knowledge Base</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- SOURCE DETAIL MODAL ----------------- */}
      {selectedSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="animate-rise max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-hairline/25 bg-raised p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-hairline/15 pb-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge tone={selectedSource.type === "url" ? "ok" : "neutral"}>
                    {selectedSource.type.toUpperCase()}
                  </Badge>
                  <span className="text-3xs text-muted">
                    {selectedSource.chunk_count} Vector Chunks
                  </span>
                </div>
                <h3 className="mt-2 text-base font-semibold text-primary">
                  {selectedSource.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSource(null)}
                className="press rounded-lg p-1.5 text-muted hover:bg-primary/10 hover:text-primary"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-secondary">
              <div>
                <h4 className="text-2xs font-bold uppercase tracking-wider text-muted">
                  AI Summary
                </h4>
                <p className="mt-1 leading-relaxed">{selectedSource.summary}</p>
              </div>

              {selectedSource.key_takeaways && selectedSource.key_takeaways.length > 0 && (
                <div>
                  <h4 className="text-2xs font-bold uppercase tracking-wider text-muted">
                    Key Takeaways
                  </h4>
                  <ul className="mt-1.5 space-y-1 list-disc pl-4 text-secondary">
                    {selectedSource.key_takeaways.map((k, i) => (
                      <li key={i}>{k}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedSource.tags && selectedSource.tags.length > 0 && (
                <div>
                  <h4 className="text-2xs font-bold uppercase tracking-wider text-muted">
                    Tags
                  </h4>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {selectedSource.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-md bg-accent/10 px-2 py-0.5 text-3xs font-medium text-accent-ink"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedSource.url && (
                <div>
                  <h4 className="text-2xs font-bold uppercase tracking-wider text-muted">
                    Original Source URL
                  </h4>
                  <a
                    href={selectedSource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent-ink hover:underline break-all"
                  >
                    <span>{selectedSource.url}</span>
                    <IconExternal className="h-3.5 w-3.5 shrink-0" />
                  </a>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end border-t border-hairline/15 pt-4">
              <Button onClick={() => setSelectedSource(null)} variant="ghost">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
