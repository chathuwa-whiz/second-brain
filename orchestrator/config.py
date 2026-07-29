import os

# LLM gateway (reuses the same self-hosted 9router pattern as your n8n workflows)
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "http://62.171.163.6:20128/v1")
LLM_MODEL = os.environ.get("LLM_MODEL", "GeminiALL")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "not-needed")

# task-mcp server — launched as a local subprocess over stdio by default.
# When task-mcp is deployed on the VPS instead, swap MCP_SERVER_COMMAND for
# an HTTP/SSE client (see mcp_client.py docstring).
MCP_SERVER_COMMAND = os.environ.get("MCP_SERVER_COMMAND", "python")
MCP_SERVER_ARGS = os.environ.get(
    "MCP_SERVER_ARGS", "../mcp-servers/task-mcp/server.py"
).split()

# Below this confidence, the planner's decision is logged as "pending" instead
# of "auto_executed" — i.e. it waits for a human to approve it from the dashboard.
AUTO_EXECUTE_CONFIDENCE_THRESHOLD = float(
    os.environ.get("AUTO_EXECUTE_CONFIDENCE_THRESHOLD", "0.75")
)
