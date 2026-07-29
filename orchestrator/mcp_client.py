"""
Thin wrapper around the official `mcp` Python SDK client, generalized to talk
to multiple MCP servers (see config.MCP_SERVERS) and let the orchestrator
treat "all tools from all connected servers" as one flat list.

Local dev: each server in MCP_SERVERS connects as a stdio subprocess.

Production on your VPS: once a server runs standalone (transport switched to
"sse" or "streamable-http" in its server.py), give that server's config entry
a "url" instead of "command"/"args", and swap `stdio_client` below for
`mcp.client.sse.sse_client(url)` (or the streamable-http equivalent) in
`_open_session`. Everything else — list_tools/call_tool signatures — stays
the same, which is the point of going through MCP instead of calling each
server's code directly.
"""

import os
from contextlib import asynccontextmanager
from typing import Optional

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from config import MCP_SERVERS


@asynccontextmanager
async def _open_session(server: dict):
    # IMPORTANT: the MCP SDK does NOT inherit the parent process's full
    # environment by default — it only passes a small safe allowlist (PATH,
    # HOME, etc.), not MONGO_URL/LLM_BASE_URL/etc. Pass the current
    # environment through explicitly, or task-mcp/job-tracker-mcp will fail
    # with "MONGO_URL is not set" even though it's exported in your shell.
    params = StdioServerParameters(
        command=server["command"], args=server["args"], env=os.environ.copy()
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            yield session


async def list_tools() -> list[dict]:
    """Return tools from every configured server, flattened, each tagged
    with which server (and module) it belongs to:
    [{name, description, input_schema, server, module}, ...]
    """
    all_tools = []
    for server in MCP_SERVERS:
        async with _open_session(server) as session:
            resp = await session.list_tools()
            for t in resp.tools:
                all_tools.append(
                    {
                        "name": t.name,
                        "description": t.description or "",
                        "input_schema": t.inputSchema,
                        "server": server["name"],
                        "module": server["module"],
                    }
                )
    return all_tools


def find_server_for_tool(tool_name: str, tools: list[dict]) -> Optional[dict]:
    """Given a tool name and the list returned by list_tools(), find which
    configured server owns it."""
    for t in tools:
        if t["name"] == tool_name:
            return next((s for s in MCP_SERVERS if s["name"] == t["server"]), None)
    return None


async def call_tool(server: dict, name: str, arguments: dict) -> dict:
    """Call a tool by name on a specific server, return its result as a
    plain dict."""
    async with _open_session(server) as session:
        result = await session.call_tool(name, arguments)
        texts = [block.text for block in result.content if hasattr(block, "text")]
        return {"raw": texts, "is_error": result.isError}
