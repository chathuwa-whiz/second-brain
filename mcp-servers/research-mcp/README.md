# research-mcp — Knowledge Base & RAG MCP Server

FastMCP server providing document ingestion, web scraping, vector chunking, and grounded question answering (RAG) over saved articles, papers, and notes.

## Storage Schema (MongoDB)

- **`research_sources`**:
  - `_id`: ObjectId
  - `user_id`: string (multi-tenant scope)
  - `title`: string
  - `type`: `"url"` | `"file"` | `"note"`
  - `url`: string (optional)
  - `summary`: string
  - `key_takeaways`: array of strings
  - `tags`: array of strings
  - `raw_content`: string
  - `chunk_count`: integer
  - `status`: `"ready"` | `"processing"` | `"error"`
  - `created_at`: ISO timestamp

- **`research_chunks`**:
  - `_id`: ObjectId
  - `source_id`: string (foreign key to `research_sources._id`)
  - `user_id`: string
  - `chunk_index`: integer
  - `content`: string (passage text)
  - `embedding`: float array (128-1536 dim vector)
  - `created_at`: ISO timestamp

## Tools Exposed

| Tool | Parameters | Description |
|---|---|---|
| `save_research_source` | `title`, `content`, `url`, `source_type`, `tags`, `user_id` | Ingest and chunk web article, note, or file |
| `search_research` | `query`, `tags`, `source_type`, `user_id`, `limit` | Hybrid vector + keyword similarity search |
| `ask_knowledge_base` | `question`, `user_id`, `top_k` | Grounded RAG answer generation with citations |
| `list_research_sources` | `tag`, `source_type`, `user_id`, `limit` | List saved knowledge sources |
| `delete_research_source` | `source_id`, `user_id` | Delete source and chunk vectors |

## Run Standalone

```bash
pip install -r requirements.txt
cp .env.example .env
python server.py
```
