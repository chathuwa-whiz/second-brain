# job-tracker-mcp — Phase 1: Job Finding

Tools exposed:

| Tool | What it does |
|---|---|
| `add_application` | Log a new application (company, role, url, resume version, notes) |
| `get_applications` | List applications, optionally filtered by status |
| `update_application_status` | Move an application to interview/offer/rejected/etc. |
| `get_pending_followups` | Applications still "applied" past N days — candidates for a follow-up |
| `match_resume_to_posting` | LLM-scored fit between a resume and a job posting, + missing keywords |
| `draft_cover_letter` | LLM-drafted cover letter — **draft only, nothing is ever sent** |

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env   # then edit with your real Atlas connection string
export $(grep -v '^#' .env | xargs)
python server.py
```

Same as task-mcp: raises a clear error if `MONGO_URL` is missing, runs over
stdio for local dev, switch to `sse`/`streamable-http` transport when this
moves to your VPS.

## Why no `send_email` tool

Sending is a real-world side effect with real consequences (a bad cover
letter going to a recruiter can't be un-sent). `draft_cover_letter` always
returns a draft for you to review — the send step is intentionally left for
a later phase, wired through Gmail's MCP connector *and* gated by the
trust-layer approval flow in the dashboard, not bolted on here as a
convenience.

## MongoDB

New `job_applications` collection, created on first insert:

```json
{
  "_id": ObjectId(...),
  "company": "string",
  "role": "string",
  "job_url": "string",
  "resume_version": "string",
  "notes": "string",
  "status": "applied | interview | offer | rejected | no_response | withdrawn",
  "date_applied": "ISO datetime",
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```

## Using `match_resume_to_posting` with your existing resumes

You have three tailored resume versions (web/full-stack, general, marketing).
Pass whichever one's text is most relevant as `resume_text`, and the job
posting text as `job_description` — the tool scores fit and flags gaps
between them, so you can pick the best-matching version per posting or
patch the gaps before you apply.
