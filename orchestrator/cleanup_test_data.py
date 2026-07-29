"""
cleanup_test_data.py — one-off script to delete the test applications
created while verifying Phase 1 (all "Acme Corp" with example.com job_urls).

Safe by default: lists what it WOULD delete and asks for confirmation
before deleting anything. Run with --yes to skip the prompt.

Run from orchestrator/:
    python cleanup_test_data.py          # dry-run + confirm
    python cleanup_test_data.py --yes    # delete without prompting
"""

import asyncio
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from mcp_client import list_tools, call_tool, find_server_for_tool

# Heuristic for "this is test data, not a real application": every test
# application created during Phase 1 testing used example.com as the
# job_url (real postings never will). Company name isn't used as a filter
# on its own since a real "Acme Corp" application is plausible someday.
TEST_URL_MARKER = "example.com"


async def main():
    skip_confirm = "--yes" in sys.argv

    tools = await list_tools()
    server = find_server_for_tool("get_applications", tools)
    if server is None:
        print("job-tracker-mcp not found among configured MCP servers.")
        return

    result = await call_tool(server, "get_applications", {"limit": 200})
    applications = json.loads(result["raw"][0])["applications"]

    to_delete = [a for a in applications if TEST_URL_MARKER in a.get("job_url", "")]

    if not to_delete:
        print("No test applications found (nothing matches "
              f"job_url containing '{TEST_URL_MARKER}').")
        return

    print(f"Found {len(to_delete)} test application(s) to delete:\n")
    for a in to_delete:
        print(f"  - {a['company']} / {a['role']} (id={a['id']}, status={a['status']})")

    if not skip_confirm:
        answer = input(f"\nDelete these {len(to_delete)} application(s)? [y/N] ").strip().lower()
        if answer != "y":
            print("Aborted, nothing deleted.")
            return

    print()
    for a in to_delete:
        result = await call_tool(server, "delete_application", {"application_id": a["id"]})
        parsed = json.loads(result["raw"][0])
        if "error" in parsed:
            print(f"  FAILED to delete {a['id']}: {parsed['error']}")
        else:
            print(f"  Deleted {a['company']} / {a['role']} (id={a['id']})")

    print(f"\nDone. Deleted {len(to_delete)} application(s).")


if __name__ == "__main__":
    asyncio.run(main())
