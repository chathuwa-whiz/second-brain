"""
Phase 1 end-to-end smoke test — exercises every job-tracker-mcp tool
directly through mcp_client, bypassing the LLM planner.

This is deliberately separate from testing the planner (agent.py) — it
answers "does job-tracker-mcp actually work" independent of "can the LLM
correctly extract structured args from a natural-language sentence". Keep
both kinds of tests; they catch different bugs.

Run from orchestrator/:
    python test_phase1.py

Requires the same env as agent.py (orchestrator/.env with MONGO_URL,
LLM_BASE_URL, etc. — loaded automatically below, same as agent.py does).
"""

import asyncio
import json
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from mcp_client import list_tools, call_tool, find_server_for_tool

# Real resume text (your web/full-stack version) and a realistic job
# description, used to actually exercise match_resume_to_posting and
# draft_cover_letter with real content instead of placeholder text.
RESUME_TEXT = """
CHATHUSHKA NAVOD — Undergraduate, BSc (Hons) Information Technology, SLIIT.

WORK EXPERIENCE
Full Stack Developer Intern, Webminds, Malabe (12/2024 - 06/2025)
- Collaborated on web applications using the MERN stack, Next.js, and TypeScript.
- Wrote and maintained Jest test cases to ensure high code quality.
- Managed deployments, server configuration, and continuous integration.

PROJECTS
- Personal Portfolio (zorscode.com): Built with Next.js (SSR/SSG), self-hosted
  on a private VPS, SEO best practices, contact form via Next.js API routes.
- kodernet: Full-stack POS system built with Electron + Vite, inventory
  management, real-time transaction processing, role-based access control.
- Pocket Gym: Cross-platform fitness app in Flutter integrating an AI/LLM to
  generate personalized workouts, MySQLi persistence, light/dark themes.
- VPN Sales Automation Bot: Python Telegram bot, 3XUI API integration,
  automated payment verification and service delivery, deployed on a Linux VPS.
- Language Learning App: Flutter + MongoDB, Google Gemini AI quizzes, Google
  Auth, Zoom meeting integration, role-based auth.
- Odessa Ecommerce Website: Next.js/TypeScript, frontend + backend API routes,
  deployed on Nginx.

TECHNICAL SKILLS
JavaScript, TypeScript, Python, Java, PHP, C/C++, MERN Stack, Next.js,
MongoDB, MySQL, Flutter, Git/GitHub/GitLab, Linux, Nginx, VPS, REST APIs,
OOP, Data Structures & Algorithms, Testing/Debugging.
""".strip()

JOB_DESCRIPTION = """
Junior Full Stack Developer — Remote

We're looking for a junior full stack developer comfortable across the MERN
stack and Next.js, with an interest in AI-integrated products. You'll work
on both frontend (React/Next.js, TypeScript) and backend (Node.js, MongoDB)
features, write tests, and help maintain CI/CD pipelines. Experience with
Linux server administration and deploying to a VPS is a strong plus.
Familiarity with integrating third-party/LLM APIs into product features is
a bonus. Remote-friendly, async-first team.
""".strip()


def _print_step(title: str):
    print(f"\n{'=' * 60}\n{title}\n{'=' * 60}")


def _print_result(result: dict):
    for raw in result.get("raw", []):
        try:
            print(json.dumps(json.loads(raw), indent=2))
        except json.JSONDecodeError:
            print(raw)
    if result.get("is_error"):
        print("*** is_error=True ***")


async def main():
    _print_step("1. Discovering tools from all configured MCP servers")
    tools = await list_tools()
    job_tools = [t["name"] for t in tools if t["server"] == "job-tracker-mcp"]
    print(f"job-tracker-mcp tools found: {job_tools}")
    expected = {
        "add_application", "get_applications", "update_application_status",
        "get_pending_followups", "match_resume_to_posting", "draft_cover_letter",
    }
    missing = expected - set(job_tools)
    if missing:
        print(f"*** MISSING TOOLS: {missing} — check config.py / server.py ***")
        return

    server = find_server_for_tool("add_application", tools)

    _print_step("2. add_application — logging a real test application")
    result = await call_tool(server, "add_application", {
        "company": "Acme Corp",
        "role": "Junior Full Stack Developer",
        "job_url": "https://example.com/jobs/acme-junior-fullstack",
        "resume_version": "web",
        "notes": "Applied via test_phase1.py smoke test",
    })
    _print_result(result)
    app_id = json.loads(result["raw"][0])["application"]["id"]
    print(f"\n-> created application id: {app_id}")

    _print_step("3. get_applications — should include the one we just added")
    result = await call_tool(server, "get_applications", {"limit": 5})
    _print_result(result)

    _print_step("4. update_application_status — move it to 'interview'")
    result = await call_tool(server, "update_application_status", {
        "application_id": app_id, "status": "interview",
    })
    _print_result(result)

    _print_step("5. get_pending_followups — days_since_applied=0 (should catch"
                 " any 'applied'-status apps; ours just moved to 'interview' so"
                 " it should NOT appear here — that's the correct behavior)")
    result = await call_tool(server, "get_pending_followups", {"days_since_applied": 0})
    _print_result(result)

    _print_step("6. match_resume_to_posting — real resume vs real job description")
    result = await call_tool(server, "match_resume_to_posting", {
        "resume_text": RESUME_TEXT, "job_description": JOB_DESCRIPTION,
    })
    _print_result(result)

    _print_step("7. draft_cover_letter — real resume vs real job description")
    result = await call_tool(server, "draft_cover_letter", {
        "resume_text": RESUME_TEXT,
        "job_description": JOB_DESCRIPTION,
        "company": "Acme Corp",
        "role": "Junior Full Stack Developer",
    })
    _print_result(result)

    _print_step("Done. Review each section above for errors or unexpected output.")


if __name__ == "__main__":
    asyncio.run(main())
