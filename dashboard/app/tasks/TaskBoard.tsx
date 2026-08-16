"use client";

import { useState, useRef } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  type Tone,
} from "@/components/ui";
import { relativeTime } from "@/lib/format";
import type { Task } from "@/lib/mongo";
import { withBasePath } from "@/lib/basePath";

/* ───────── Constants ───────── */

const PRIORITY_TONE: Record<string, Tone> = {
  high: "danger",
  medium: "warn",
  low: "neutral",
};

const RECURRENCE_LABEL: Record<string, string> = {
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
  monthly: "Monthly",
};

/* ───────── Helpers ───────── */

function dueLabel(due: string | null): {
  text: string;
  tone: Tone;
} | null {
  if (!due) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (due < today)
    return { text: `Overdue · ${formatDate(due)}`, tone: "danger" };
  if (due === today) return { text: "Due today", tone: "warn" };

  const d = new Date(due + "T00:00:00");
  const diff = Math.ceil(
    (d.getTime() - new Date(today + "T00:00:00").getTime()) / 86400000
  );
  if (diff <= 7)
    return {
      text: `Due ${d.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}`,
      tone: "accent",
    };
  return { text: formatDate(due), tone: "neutral" };
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Sort: overdue first, then today, then upcoming, then no due date. */
function sortOpenTasks(tasks: Task[]): Task[] {
  const today = new Date().toISOString().slice(0, 10);
  return [...tasks].sort((a, b) => {
    const aDate = a.due_date ?? "9999-12-31";
    const bDate = b.due_date ?? "9999-12-31";
    // Both have dates → sort ascending
    if (a.due_date && b.due_date) return aDate.localeCompare(bDate);
    // One has no date → push it later
    if (!a.due_date && b.due_date) return 1;
    if (a.due_date && !b.due_date) return -1;
    // Neither has date → sort by created_at desc
    return b.created_at.localeCompare(a.created_at);
  });
}

/* ───────── API calls ───────── */

async function apiPost(url: string, body?: object) {
  const res = await fetch(withBasePath(url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function apiPatch(url: string, body: object) {
  const res = await fetch(withBasePath(url), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiDelete(url: string) {
  const res = await fetch(withBasePath(url), { method: "DELETE" });
  return res.json();
}

/* ───────── Task Card ───────── */

function TaskCard({
  task,
  onComplete,
  onReopen,
  onDelete,
  onEdit,
  showActions = true,
}: {
  task: Task;
  onComplete?: (id: string) => void;
  onReopen?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (task: Task) => void;
  showActions?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const due = dueLabel(task.due_date);

  return (
    <Card className="min-w-0 p-3.5 sm:p-4">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:gap-4">
        {/* Priority indicator */}
        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-center sm:gap-1">
          <Badge tone={PRIORITY_TONE[task.priority] ?? "neutral"}>
            {task.priority}
          </Badge>
          {task.recurrence && (
            <span className="text-2xs font-medium text-muted">
              🔁 {RECURRENCE_LABEL[task.recurrence] ?? task.recurrence}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0 flex-1">
              <p
                className={`break-words text-sm font-semibold tracking-tight sm:text-base ${
                  task.status === "done"
                    ? "text-muted line-through"
                    : "text-primary"
                }`}
              >
                {task.title}
              </p>
              {/*
                A <p class="truncate"> around the badge clipped it to a sliver
                on narrow cards - `truncate` sets overflow:hidden + nowrap on
                the container, which a pill child can't survive.
              */}
              <div className="mt-1 text-xs text-muted">
                {due ? (
                  <Badge tone={due.tone}>{due.text}</Badge>
                ) : (
                  task.created_at && (
                    <span>Added {relativeTime(task.created_at)}</span>
                  )
                )}
              </div>
            </div>
          </div>

          {task.description && (
            <p className="mt-2 break-words text-xs leading-relaxed text-secondary sm:text-sm">
              {task.description}
            </p>
          )}

          {/* Tags */}
          {task.tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-lg bg-primary/[0.06] px-2 py-0.5 text-2xs font-medium text-secondary"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          {showActions && (
            <div className="mt-3 flex flex-wrap gap-2 border-t pt-2.5">
              {task.status === "open" && onComplete && (
                <Button
                  variant="approve"
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await onComplete(task.id);
                    setBusy(false);
                  }}
                >
                  ✓ Complete
                </Button>
              )}
              {task.status === "done" && onReopen && (
                <Button
                  variant="quiet"
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await onReopen(task.id);
                    setBusy(false);
                  }}
                >
                  ↩ Reopen
                </Button>
              )}
              {onEdit && task.status === "open" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(task)}
                >
                  Edit
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  className="text-danger-ink hover:bg-danger/10"
                  onClick={async () => {
                    if (!confirm("Delete this task permanently?")) return;
                    setBusy(true);
                    await onDelete(task.id);
                    setBusy(false);
                  }}
                >
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ───────── Add / Edit Form ───────── */

function TaskForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Task | null;
  onSubmit: (data: {
    title: string;
    description: string;
    priority: string;
    due_date: string;
    recurrence: string;
    tags: string[];
  }) => Promise<void>;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [recurrence, setRecurrence] = useState(initial?.recurrence ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const inputClasses = "field";
  // Selects were `appearance-none` with nothing drawn in its place, so they
  // looked exactly like text inputs that refused to be typed into.
  const selectClasses = "field select-field";

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  }

  return (
    <Card className="p-4 sm:p-5">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim()) return;
          setSaving(true);
          await onSubmit({
            title: title.trim(),
            description: description.trim(),
            priority,
            due_date: dueDate,
            recurrence,
            tags,
          });
          if (!initial) {
            // Reset form after add (not edit)
            setTitle("");
            setDescription("");
            setPriority("medium");
            setDueDate("");
            setRecurrence("");
            setTags([]);
            titleRef.current?.focus();
          }
          setSaving(false);
        }}
        className="space-y-3"
      >
        <input
          ref={titleRef}
          type="text"
          placeholder="What needs doing?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={inputClasses}
          autoFocus
        />

        <textarea
          placeholder="Notes (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={`${inputClasses} resize-none`}
        />

        <div className="grid grid-cols-1 gap-3 xs:grid-cols-3">
          {/* Priority */}
          <div>
            <label className="mb-1 block text-xs font-medium text-primary">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Task["priority"])}
              className={selectClasses}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Due date */}
          <div>
            <label className="mb-1 block text-xs font-medium text-primary">
              Due date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClasses}
            />
          </div>

          {/* Recurrence */}
          <div>
            <label className="mb-1 block text-xs font-medium text-primary">
              Repeat
            </label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              className={selectClasses}
            >
              <option value="">None</option>
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="mb-1 block text-xs font-medium text-primary">
            Tags
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Add a tag…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              className={`${inputClasses} flex-1`}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addTag}
            >
              +
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                  className="press rounded-lg bg-accent/12 px-2 py-0.5 text-2xs font-medium text-accent-ink hover:bg-danger/12 hover:text-danger-ink"
                  title={`Remove "${tag}"`}
                >
                  {tag} ✕
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center gap-2 pt-1">
          <Button variant="primary" type="submit" disabled={saving || !title.trim()}>
            {saving ? "Saving…" : initial ? "Save changes" : "Add task"}
          </Button>
          {onCancel && (
            <Button variant="ghost" type="button" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

/* ───────── Main Board ───────── */

export default function TaskBoard({
  initialOpen = [],
  initialDone = [],
  openError,
  doneError,
}: {
  initialOpen?: Task[];
  initialDone?: Task[];
  openError?: string | null;
  doneError?: string | null;
}) {
  const [tab, setTab] = useState<"open" | "done" | "add">("open");
  const [openTasks, setOpenTasks] = useState<Task[]>(initialOpen);
  const [doneTasks, setDoneTasks] = useState<Task[]>(initialDone);
  const [editing, setEditing] = useState<Task | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  function flash(msg: string) {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }

  const tabs = [
    { key: "open" as const, label: "Open", count: openTasks.length },
    { key: "done" as const, label: "Done", count: doneTasks.length },
    { key: "add" as const, label: "+ New Task", count: null },
  ];

  /* ── Handlers ── */

  async function handleAdd(data: {
    title: string;
    description: string;
    priority: string;
    due_date: string;
    recurrence: string;
    tags: string[];
  }) {
    const json = await apiPost("/api/tasks", data);
    if (json.task) {
      setOpenTasks((prev) => sortOpenTasks([json.task, ...prev]));
      setTab("open");
      flash("Task added");
    }
  }

  async function handleEdit(data: {
    title: string;
    description: string;
    priority: string;
    due_date: string;
    recurrence: string;
    tags: string[];
  }) {
    if (!editing) return;
    const json = await apiPatch(`/api/tasks/${editing.id}`, data);
    if (json.task) {
      setOpenTasks((prev) =>
        sortOpenTasks(prev.map((t) => (t.id === editing.id ? json.task : t)))
      );
      setEditing(null);
      flash("Task updated");
    }
  }

  async function handleComplete(id: string) {
    const json = await apiPost(`/api/tasks/${id}/complete`);
    if (json.task) {
      setOpenTasks((prev) => {
        let next = prev.filter((t) => t.id !== id);
        if (json.next) next = sortOpenTasks([json.next, ...next]);
        return next;
      });
      setDoneTasks((prev) => [json.task, ...prev]);
      flash(
        json.next
          ? `Done! Next occurrence scheduled for ${formatDate(json.next.due_date)}`
          : "Task completed"
      );
    }
  }

  async function handleReopen(id: string) {
    const json = await apiPost(`/api/tasks/${id}/complete`, {
      action: "reopen",
    });
    if (json.task) {
      setDoneTasks((prev) => prev.filter((t) => t.id !== id));
      setOpenTasks((prev) => sortOpenTasks([json.task, ...prev]));
      flash("Task reopened");
    }
  }

  async function handleDelete(id: string) {
    const json = await apiDelete(`/api/tasks/${id}`);
    if (json.deleted) {
      setOpenTasks((prev) => prev.filter((t) => t.id !== id));
      setDoneTasks((prev) => prev.filter((t) => t.id !== id));
      flash("Task deleted");
    }
  }

  const sortedOpen = sortOpenTasks(openTasks);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Notification toast */}
      {notification && (
        <div className="animate-rise rounded-xl bg-ok/12 px-4 py-2.5 text-sm font-medium text-ok-ink ring-1 ring-inset ring-ok/25">
          {notification}
        </div>
      )}

      {/* Tabs - raised thumb rather than an accent-filled pill, so the tab
          strip doesn't compete with the primary buttons inside the panel. */}
      <div className="no-scrollbar -mx-1 max-w-full overflow-x-auto px-1">
        <div className="inline-flex min-w-full gap-1 rounded-xl bg-primary/[0.04] p-1 sm:min-w-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setEditing(null);
              }}
              aria-pressed={tab === t.key}
              className={`press flex-1 shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-center text-xs transition-colors sm:flex-initial sm:px-4 sm:py-2 ${
                tab === t.key
                  ? "bg-raised font-medium text-primary shadow-sm"
                  : "text-secondary hover:text-primary"
              }`}
            >
              {t.label}
              {t.count !== null && (
                <span className="tnum ml-1.5 text-muted sm:ml-2">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {openError && <ErrorNote>{openError}</ErrorNote>}
      {doneError && <ErrorNote>{doneError}</ErrorNote>}

      {/* Edit overlay */}
      {editing && (
        <div>
          <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted">
            Editing task
          </p>
          <TaskForm
            initial={editing}
            onSubmit={handleEdit}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {/* Tab: Open */}
      {tab === "open" &&
        !editing &&
        (sortedOpen.length === 0 ? (
          <EmptyState
            title="No open tasks"
            body="Add your first task to get started — or let the agent create them for you by asking naturally."
            action={
              <Button variant="primary" onClick={() => setTab("add")}>
                + Add a task
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {sortedOpen.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onComplete={handleComplete}
                onDelete={handleDelete}
                onEdit={(task) => {
                  setEditing(task);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            ))}
          </div>
        ))}

      {/* Tab: Done */}
      {tab === "done" &&
        !editing &&
        (doneTasks.length === 0 ? (
          <EmptyState
            title="No completed tasks"
            body="Tasks you complete will appear here — a satisfying record of everything you've ticked off."
          />
        ) : (
          <div className="space-y-3">
            {doneTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onReopen={handleReopen}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ))}

      {/* Tab: Add */}
      {tab === "add" && !editing && (
        <TaskForm onSubmit={handleAdd} />
      )}
    </div>
  );
}
