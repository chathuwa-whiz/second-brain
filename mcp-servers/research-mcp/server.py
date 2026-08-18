"""
research-mcp — FastMCP server for the Second Brain Research & Knowledge Base (RAG) module.

Backed by MongoDB collections:
  - `research_sources`: metadata, summary, key takeaways, tags, raw content
  - `research_chunks`: chunked text passages with embedding vectors

Tools exposed:
  1. save_research_source — Ingest a URL, note, or document with AI summary and embeddings
  2. search_research — Vector / hybrid semantic search over knowledge base
  3. ask_knowledge_base — Grounded RAG question answering with source citations
  4. list_research_sources — Filter and list saved materials
  5. delete_research_source — Safely delete source and associated chunk vectors
"""

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from mcp.server.fastmcp import FastMCP
from dotenv import load_dotenv
from openai import AsyncOpenAI

from ingest import (
    scrape_url,
    chunk_text,
    get_embedding,
    cosine_similarity,
    generate_summary_and_tags,
    clean_text,
)

# Load environment
load_dotenv(Path(__file__).resolve().parent / ".env")

MONGO_URL = os.environ.get("MONGO_URL")
if not MONGO_URL:
    raise RuntimeError(
        "MONGO_URL is not set. Put your MongoDB connection string in .env"
    )
DB_NAME = os.environ.get("MONGO_DB", "second_brain")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
sources_col = db["research_sources"]
chunks_col = db["research_chunks"]

LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "http://62.171.163.6:20128/v1")
LLM_MODEL = os.environ.get("LLM_MODEL", "secondbrain")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "not-needed")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")

llm_client = AsyncOpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)

mcp = FastMCP("research-mcp")


def _serialize(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    if "embedding" in doc:
        doc.pop("embedding")  # Never send huge float arrays over MCP
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    if isinstance(doc.get("updated_at"), datetime):
        doc["updated_at"] = doc["updated_at"].isoformat()
    return doc


@mcp.tool()
async def save_research_source(
    title: Optional[str] = None,
    content: Optional[str] = None,
    url: Optional[str] = None,
    source_type: str = "note",
    tags: Optional[List[str]] = None,
    user_id: Optional[str] = None,
) -> dict:
    """Ingest a web article, note, or document into the knowledge base with automatic AI summary, tags, and vector chunking.

    Args:
        title: Title for the research source. If empty and URL provided, extracted from webpage.
        content: Raw text content (for notes or documents).
        url: Web URL to scrape (if source_type is "url").
        source_type: "url", "note", or "file".
        tags: Optional list of topical tags.
        user_id: Optional multi-tenant user ID.
    """
    try:
        final_content = content or ""
        final_title = title or ""

        if url and source_type == "url":
            try:
                scraped = await scrape_url(url)
                if not final_title:
                    final_title = scraped["title"]
                final_content = scraped["content"]
            except Exception as e:
                return {"error": f"Failed to scrape URL {url}: {e}"}

        if not final_content or not final_content.strip():
            return {"error": "Content or valid URL is required and cannot be empty."}

        if not final_title:
            final_title = "Untitled Research Note"

        final_content = clean_text(final_content)

        # Generate summary, takeaways, and tags via LLM
        analysis = await generate_summary_and_tags(final_title, final_content, llm_client, LLM_MODEL)
        merged_tags = list(set([t.lower().strip() for t in (tags or []) + analysis.get("tags", []) if t.strip()]))

        now = datetime.now(timezone.utc)
        source_doc = {
            "title": final_title.strip(),
            "type": source_type,
            "url": url,
            "summary": analysis.get("summary", ""),
            "key_takeaways": analysis.get("key_takeaways", []),
            "tags": merged_tags,
            "raw_content": final_content,
            "created_at": now,
            "updated_at": now,
            "user_id": user_id,
            "chunk_count": 0,
            "status": "ready",
        }

        insert_res = await sources_col.insert_one(source_doc)
        source_id = insert_res.inserted_id
        source_doc["_id"] = source_id

        # Chunk and embed
        passages = chunk_text(final_content, chunk_size=700, overlap=100)
        chunk_docs = []

        for idx, passage in enumerate(passages):
            emb = await get_embedding(passage, llm_client, EMBEDDING_MODEL)
            chunk_docs.append({
                "source_id": str(source_id),
                "source_title": final_title.strip(),
                "source_type": source_type,
                "source_url": url,
                "user_id": user_id,
                "chunk_index": idx,
                "content": passage,
                "embedding": emb,
                "created_at": now,
            })

        if chunk_docs:
            await chunks_col.insert_many(chunk_docs)
            await sources_col.update_one(
                {"_id": source_id},
                {"$set": {"chunk_count": len(chunk_docs)}}
            )
            source_doc["chunk_count"] = len(chunk_docs)

        return {
            "source": _serialize(source_doc),
            "chunks_created": len(chunk_docs),
            "summary": source_doc["summary"],
            "takeaways": source_doc["key_takeaways"],
        }
    except Exception as e:
        return {"error": f"Failed to save research source: {e}"}


@mcp.tool()
async def search_research(
    query: str,
    tags: Optional[List[str]] = None,
    source_type: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 5,
) -> dict:
    """Semantic vector and keyword search across all indexed research documents, articles, and notes.

    Args:
        query: Natural language search query or topic.
        tags: Optional filter by specific tags.
        source_type: Optional filter by "url", "file", or "note".
        user_id: Optional multi-tenant user ID.
        limit: Number of top relevant passages to return (default: 5).
    """
    if not query or not query.strip():
        return {"error": "Query cannot be empty."}

    try:
        # Build query match filter
        match_filter: Dict[str, Any] = {}
        if user_id:
            match_filter["$or"] = [
                {"user_id": user_id},
                {"user_id": None},
                {"user_id": {"$exists": False}}
            ]
        if source_type:
            match_filter["source_type"] = source_type

        # Fetch candidate chunks
        cursor = chunks_col.find(match_filter).limit(300)
        all_chunks = [doc async for doc in cursor]

        if not all_chunks:
            return {"results": [], "count": 0, "message": "No indexed research materials found."}

        # Embed search query
        query_emb = await get_embedding(query, llm_client, EMBEDDING_MODEL)
        query_words = set(re.findall(r"\w+", query.lower()))

        scored_chunks = []
        for ch in all_chunks:
            vec = ch.get("embedding", [])
            cos_sim = cosine_similarity(query_emb, vec) if vec else 0.0

            # Lexical keyword bonus
            content_words = set(re.findall(r"\w+", ch.get("content", "").lower()))
            overlap_count = len(query_words.intersection(content_words))
            keyword_score = (overlap_count / max(len(query_words), 1)) * 0.35

            final_score = (cos_sim * 0.65) + keyword_score

            scored_chunks.append({
                "source_id": ch.get("source_id"),
                "source_title": ch.get("source_title", "Untitled Source"),
                "source_url": ch.get("source_url"),
                "source_type": ch.get("source_type"),
                "chunk_index": ch.get("chunk_index", 0),
                "snippet": ch.get("content", ""),
                "score": round(final_score, 4),
            })

        # Rank by score
        scored_chunks.sort(key=lambda x: x["score"], reverse=True)
        top_results = scored_chunks[:limit]

        return {
            "query": query,
            "count": len(top_results),
            "results": top_results,
        }
    except Exception as e:
        return {"error": f"Failed to execute research search: {e}"}


@mcp.tool()
async def ask_knowledge_base(
    question: str,
    user_id: Optional[str] = None,
    top_k: int = 4,
) -> dict:
    """Ask a question to your Second Brain knowledge base. Retrieves relevant passages and synthesizes an answer with citations.

    Args:
        question: The question to answer from saved knowledge.
        user_id: Optional user ID for multi-tenant scoping.
        top_k: Number of reference passages to consult (default: 4).
    """
    if not question or not question.strip():
        return {"error": "Question cannot be empty."}

    search_res = await search_research(
        query=question,
        user_id=user_id,
        limit=top_k,
    )

    if "error" in search_res:
        return search_res

    results = search_res.get("results", [])
    if not results:
        return {
            "question": question,
            "answer": "I could not find any relevant notes or documents in your research library on this topic.",
            "citations": [],
        }

    # Build grounded context
    context_blocks = []
    citations = []
    for i, r in enumerate(results, start=1):
        context_blocks.append(f"[{i}] Title: {r['source_title']}\nSource: {r.get('source_url') or r.get('source_type')}\nContent:\n{r['snippet']}")
        citations.append({
            "index": i,
            "title": r["source_title"],
            "url": r.get("source_url"),
            "source_type": r.get("source_type"),
            "source_id": r.get("source_id"),
            "snippet": r["snippet"][:200] + "...",
            "score": r["score"],
        })

    context_str = "\n\n---\n\n".join(context_blocks)

    system_prompt = (
        "You are the knowledge synthesis engine of the user's Second Brain.\n"
        "Answer the question accurately based ONLY on the provided context passages below.\n"
        "Cite your sources in-text using square bracket numbers like [1], [2] corresponding to the passages.\n"
        "If the context does not contain enough information to answer fully, state what is known and what is missing.\n"
        "Be concise, clear, and structured."
    )

    user_prompt = f"Context Passages:\n{context_str}\n\nQuestion: {question}\n\nAnswer with citations:"

    try:
        completion = await llm_client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.1,
        )
        answer = completion.choices[0].message.content.strip()
        return {
            "question": question,
            "answer": answer,
            "citations": citations,
        }
    except Exception as e:
        return {"error": f"Failed to synthesize answer: {e}"}


@mcp.tool()
async def list_research_sources(
    tag: Optional[str] = None,
    source_type: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 50,
) -> dict:
    """List saved research sources with metadata and summaries.

    Args:
        tag: Optional filter by tag.
        source_type: Optional filter by "url", "file", "note".
        user_id: Optional user ID scoping.
        limit: Max number of items to return (default: 50).
    """
    query: Dict[str, Any] = {}
    if user_id:
        query["$or"] = [{"user_id": user_id}, {"user_id": None}, {"user_id": {"$exists": False}}]
    if tag:
        query["tags"] = tag.lower().strip()
    if source_type:
        query["type"] = source_type

    cursor = sources_col.find(query, {"raw_content": 0}).sort("created_at", -1).limit(limit)
    sources = [_serialize(doc) async for doc in cursor]

    return {
        "sources": sources,
        "count": len(sources),
    }


@mcp.tool()
async def delete_research_source(
    source_id: str,
    user_id: Optional[str] = None,
) -> dict:
    """Delete a research source and all its vector chunks.

    Args:
        source_id: The ID of the research source.
        user_id: Optional user ID scoping.
    """
    try:
        oid = ObjectId(source_id)
    except Exception:
        return {"error": f"Invalid source_id: {source_id!r}"}

    query = {"_id": oid}
    if user_id:
        query["$or"] = [{"user_id": user_id}, {"user_id": None}, {"user_id": {"$exists": False}}]

    del_res = await sources_col.delete_one(query)
    if del_res.deleted_count == 0:
        return {"error": f"No research source found with id {source_id} or permission denied."}

    # Delete all associated chunk vectors
    chunk_del = await chunks_col.delete_many({"source_id": source_id})

    return {
        "deleted_source_id": source_id,
        "chunks_removed": chunk_del.deleted_count,
    }


if __name__ == "__main__":
    mcp.run(transport="stdio")
