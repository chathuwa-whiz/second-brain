"""
local_resumes.py — read resume files from a local directory on disk.

This is the PRIMARY resume source: the second-brain webapp (hosted on the
same VPS as this MCP server, eventually) writes uploaded resume files
directly into RESUME_DIR, and this module just reads them straight off
disk. No external API, no credentials, no network dependency — works
identically whether job-tracker-mcp is running on your local machine
today (RESUME_DIR = some local folder) or on the VPS later (RESUME_DIR =
whatever path the webapp's upload handler writes into), as long as both
processes agree on that one directory.

Supports .docx and .pdf. Files are matched non-recursively (top-level of
RESUME_DIR only) — if you want subfolders (e.g. one per resume variant),
say so and this can be made recursive.
"""

import os
from pathlib import Path

from resume_extract import extract_text

SUPPORTED_EXTENSIONS = (".docx", ".pdf")


def _resolve_dir(dir_path: str) -> Path:
    resolved = Path(dir_path).expanduser().resolve()
    if not resolved.is_dir():
        raise RuntimeError(
            f"RESUME_DIR '{dir_path}' (resolved: {resolved}) does not "
            "exist or is not a directory. Create it and have the webapp's "
            "upload handler write resume files there, or point RESUME_DIR "
            "at wherever it already writes them."
        )
    return resolved


def list_resume_files(dir_path: str) -> list[dict]:
    """List supported resume files directly inside a local directory.
    Returns [{"id": "<absolute path, doubles as a stable identifier>",
    "name": "<filename>"}, ...], mirroring drive_resumes.list_resume_files'
    shape so callers don't need to care which backend is in use.
    """
    resolved = _resolve_dir(dir_path)
    files = [
        {"id": str(p), "name": p.name}
        for p in sorted(resolved.iterdir())
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS
    ]
    return files


def get_resume_text(file_id: str) -> str:
    """Read a single local resume file (file_id is its absolute path, as
    returned by list_resume_files) and extract its plain text.
    """
    path = Path(file_id)
    if not path.is_file():
        raise RuntimeError(f"Resume file not found: {file_id}")
    raw = path.read_bytes()
    return extract_text(raw, path.name)
