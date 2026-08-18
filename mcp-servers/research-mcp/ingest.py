"""
ingest.py — Document ingestion, URL scraping, text chunking, and embedding generation
for the research-mcp server and RAG pipeline.
"""

import math
import os
import re
from io import BytesIO
from typing import List, Dict, Any, Optional, Tuple

import httpx
from openai import AsyncOpenAI

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    BeautifulSoup = None
    HAS_BS4 = False

try:
    from pypdf import PdfReader
    HAS_PYPDF = True
except ImportError:
    PdfReader = None
    HAS_PYPDF = False


def clean_text(text: str) -> str:
    """Normalize whitespace and remove excessive blank lines."""
    text = re.sub(r"\r\n|\r", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


async def scrape_url(url: str) -> Dict[str, Any]:
    """Fetch and extract clean readable text and metadata from a web page."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()

    html = response.text

    if HAS_BS4 and BeautifulSoup:
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript", "svg", "form", "button"]):
            tag.decompose()

        title = ""
        if soup.title and soup.title.string:
            title = soup.title.string.strip()
        elif soup.find("h1"):
            title = soup.find("h1").get_text().strip()
        if not title:
            title = url.split("/")[-1] or url

        main_el = soup.find("article") or soup.find("main") or soup.find("div", class_=re.compile(r"content|post|article|body", re.I)) or soup.body
        content = main_el.get_text(separator="\n") if main_el else soup.get_text(separator="\n")
    else:
        # Pure regex fallback
        title_match = re.search(r"<title[^>]*>([^<]+)</title>", html, re.I)
        title = title_match.group(1).strip() if title_match else url.split("/")[-1] or url
        cleaned_html = re.sub(r"<(script|style|nav|footer|header|aside|noscript|svg|form|button)\b[^>]*>.*?</\1>", "", html, flags=re.S | re.I)
        content = re.sub(r"<[^>]+>", " ", cleaned_html)

    cleaned_content = clean_text(content)
    return {
        "title": title[:200],
        "content": cleaned_content,
        "url": url,
    }


def extract_pdf_text(pdf_bytes: bytes) -> Tuple[str, str]:
    """Extract text from PDF bytes using pypdf if available."""
    if not HAS_PYPDF or not PdfReader:
        return "Uploaded Document", ""

    reader = PdfReader(BytesIO(pdf_bytes))
    pages_text = []
    for page in reader.pages:
        t = page.extract_text()
        if t:
            pages_text.append(t)
    
    full_text = clean_text("\n\n".join(pages_text))
    title = ""
    if reader.metadata and reader.metadata.title:
        title = str(reader.metadata.title).strip()
    if not title and pages_text:
        first_lines = [line.strip() for line in pages_text[0].split("\n") if line.strip()]
        if first_lines:
            title = first_lines[0][:150]
    
    return title or "Uploaded Document", full_text


def chunk_text(text: str, chunk_size: int = 600, overlap: int = 100) -> List[str]:
    """Split text into overlapping passages respecting paragraph and sentence boundaries."""
    if not text:
        return []
        
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = ""

    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
            
        if len(current_chunk) + len(p) <= chunk_size:
            current_chunk = (current_chunk + "\n\n" + p).strip()
        else:
            if current_chunk:
                chunks.append(current_chunk)
            # If paragraph itself is huge, split by sentences or chunks
            if len(p) > chunk_size:
                sentences = re.split(r"(?<=[.?!])\s+", p)
                sub_chunk = ""
                for s in sentences:
                    if len(sub_chunk) + len(s) <= chunk_size:
                        sub_chunk = (sub_chunk + " " + s).strip()
                    else:
                        if sub_chunk:
                            chunks.append(sub_chunk)
                        sub_chunk = s
                if sub_chunk:
                    current_chunk = sub_chunk
                else:
                    current_chunk = ""
            else:
                current_chunk = p

    if current_chunk:
        chunks.append(current_chunk)

    # If chunks are too few or flat, sliding window
    if not chunks and text:
        step = max(chunk_size - overlap, 100)
        chunks = [text[i : i + chunk_size] for i in range(0, len(text), step)]

    return [c.strip() for c in chunks if c.strip()]


def _deterministic_hash(s: str) -> int:
    """Deterministic 32-bit FNV-1a hash."""
    h = 2166136261
    for c in s:
        h = ((h ^ ord(c)) * 16777619) & 0xFFFFFFFF
    return h


def _fallback_deterministic_embedding(text: str, dim: int = 256) -> List[float]:
    """Deterministic token and n-gram frequency vector fallback for 100% offline vector search reliability."""
    vec = [0.0] * dim
    words = re.findall(r"\w+", text.lower())
    if not words:
        return vec

    # Unigrams + bigrams + character trigrams
    tokens = list(words)
    for i in range(len(words) - 1):
        tokens.append(f"{words[i]}_{words[i+1]}")
    for w in words:
        if len(w) >= 3:
            for j in range(len(w) - 2):
                tokens.append(w[j : j + 3])

    for t in tokens:
        idx = _deterministic_hash(t) % dim
        vec[idx] += 1.0

    # L2 normalize
    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [v / norm for v in vec]
    return vec


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Calculate cosine similarity between two vector lists."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)


async def get_embedding(
    text: str,
    llm_client: Optional[AsyncOpenAI] = None,
    embedding_model: str = "text-embedding-3-small"
) -> List[float]:
    """Generate embedding vector for a piece of text using OpenAI endpoint or deterministic fallback."""
    if llm_client:
        try:
            res = await llm_client.embeddings.create(
                model=embedding_model,
                input=text[:2000]
            )
            if res.data and res.data[0].embedding:
                return res.data[0].embedding
        except Exception:
            # Fall back gracefully to deterministic vector representation
            pass
            
    return _fallback_deterministic_embedding(text)


async def generate_summary_and_tags(
    title: str,
    content: str,
    llm_client: AsyncOpenAI,
    llm_model: str
) -> Dict[str, Any]:
    """Generate concise summary, key takeaways, and relevant tags for ingested source."""
    prompt = f"""Analyze this document and return a concise summary, 3-5 bullet key takeaways, and 3-6 topical tags.

Document Title: {title}
Content Snippet:
{content[:3500]}

Respond ONLY with a JSON object in this exact format (no markdown fences):
{{
  "summary": "2-3 sentence overview of the document",
  "key_takeaways": ["takeaway 1", "takeaway 2", "takeaway 3"],
  "tags": ["tag1", "tag2", "tag3"]
}}"""

    try:
        completion = await llm_client.chat.completions.create(
            model=llm_model,
            messages=[
                {"role": "system", "content": "You are a research analyst. Output only raw JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
        )
        raw = completion.choices[0].message.content.strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        import json
        data = json.loads(raw)
        return {
            "summary": data.get("summary", ""),
            "key_takeaways": data.get("key_takeaways", []),
            "tags": [str(t).lower().strip() for t in data.get("tags", []) if str(t).strip()]
        }
    except Exception:
        # Fallback basic extraction
        return {
            "summary": content[:250].replace("\n", " ") + "...",
            "key_takeaways": ["Key research material."],
            "tags": ["research", "notes"]
        }
