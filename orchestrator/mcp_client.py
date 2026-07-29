"""
Thin wrapper around the official `mcp` Python SDK client, so the rest of the
orchestrator doesn't need to know about MCP session/transport plumbing.

Local dev: connects to task-mcp as a stdio subprocess (MCP_SERVER_COMMAND/ARGS).

Production on your VPS: once task-mcp runs as a standalone service (transport
switched to "sse" or "streamable-http" in server.py), replace `stdio_client`
below with `mcp.client.sse.sse_client(url)` or the streamable-http equivalent
and point it at the deployed URL. Everything else (list_tools/call_tool) stays
the same — that's the point of going through MCP instead of calling task-mcp
directly.
"""

from contextlib import asynccontextmanager

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from config import MCP_SERVER_COMMAND, MCP_SERVER_ARGS


@asynccontextmanager
async def mcp_session():
    params = StdioServerParameters(command=MCP_SERVER_COMMAND, args=MCP_SERVER_ARGS)
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            yield session


async def list_tools() -> list[dict]:
    """Return [{name, description, input_schema}, ...] for the planner prompt."""
    async with mcp_session() as session:
        resp = await session.list_tools()
        return [
            {
                "name": t.name,
                "description": t.description or "",
                "input_schema": t.inputSchema,
            }
            for t in resp.tools
        ]


async def call_tool(name: str, arguments: dict) -> dict:
    """Call a tool by name, return its result as a plain dict/string."""
    async with mcp_session() as session:
        result = await session.call_tool(name, arguments)
        # MCP tool results are a list of content blocks; task-mcp's tools
        # return JSON-serializable dicts via FastMCP, which arrive as text.
        texts = [block.text for block in result.content if hasattr(block, "text")]
        return {"raw": texts, "is_error": result.isError}
