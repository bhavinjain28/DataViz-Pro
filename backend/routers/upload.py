"""File upload + parsing endpoint.

POST /api/upload — accepts a multipart file (csv, xlsx, xls, json, tsv,
jsonl), validates size and content (magic bytes, not just extension),
parses with Pandas, profiles the DataFrame, and creates a session.

Errors: 413 file too large, 415 unsupported format, 422 parse failure —
all shaped as {"error": ..., "detail": ...} via the handler in main.py.
"""

import io
import json
import os

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile

from services.data_profiler import profile_dataframe
from services.session_store import create_session

router = APIRouter()

ACCEPTED_EXTENSIONS = {"csv", "xlsx", "xls", "json", "tsv", "jsonl"}

_ZIP_MAGIC = b"PK\x03\x04"                              # xlsx (zip container)
_OLE2_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"       # legacy xls (OLE2)


def _err(status: int, error: str, detail: str):
    raise HTTPException(status_code=status, detail={"error": error, "detail": detail})


def _max_bytes() -> int:
    return int(os.getenv("MAX_FILE_SIZE_MB", "50")) * 1024 * 1024


def _validate_content(ext: str, content: bytes) -> None:
    """Reject files whose bytes don't match their claimed format."""
    if ext == "xlsx":
        if not content.startswith(_ZIP_MAGIC):
            _err(415, "Unsupported file format",
                 "File has a .xlsx extension but is not a valid Excel (zip) file.")
    elif ext == "xls":
        if not content.startswith(_OLE2_MAGIC):
            _err(415, "Unsupported file format",
                 "File has a .xls extension but is not a valid legacy Excel file.")
    else:
        # Text formats: binary content (null bytes) means a mislabeled file.
        if b"\x00" in content[:8192]:
            _err(415, "Unsupported file format",
                 f"File has a .{ext} extension but contains binary data.")


def _parse(ext: str, content: bytes) -> pd.DataFrame:
    buf = io.BytesIO(content)
    if ext == "csv":
        return pd.read_csv(buf)
    if ext == "tsv":
        return pd.read_csv(buf, sep="\t")
    if ext in ("xlsx", "xls"):
        return pd.read_excel(buf)
    if ext == "jsonl":
        return pd.read_json(buf, lines=True)
    # json: list of records, or dict of columns
    data = json.loads(content)
    if isinstance(data, list):
        return pd.json_normalize(data)
    if isinstance(data, dict):
        try:
            return pd.DataFrame(data)
        except ValueError:
            return pd.json_normalize(data)
    raise ValueError("JSON file must contain an array of records or an object of columns.")


@router.post("")
async def upload_file(file: UploadFile = File(...)):
    filename = file.filename or "upload"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ACCEPTED_EXTENSIONS:
        _err(415, "Unsupported file format",
             f"'.{ext}' is not supported. Accepted: {', '.join(sorted(ACCEPTED_EXTENSIONS))}.")

    content = await file.read()
    max_bytes = _max_bytes()
    if len(content) > max_bytes:
        _err(413, "File too large",
             f"File is {len(content) / 1024 / 1024:.1f} MB; limit is {max_bytes // 1024 // 1024} MB.")
    if not content.strip():
        _err(422, "Empty file", "The uploaded file contains no data.")

    _validate_content(ext, content)

    try:
        df = _parse(ext, content)
    except HTTPException:
        raise
    except Exception as exc:  # pandas/json parse failures
        _err(422, "Parse error", f"Could not parse {filename}: {str(exc)[:300]}")

    if df is None or df.empty or len(df.columns) == 0:
        _err(422, "Empty dataset", "The file parsed successfully but contains no rows.")

    profile = profile_dataframe(df, filename)
    session_id = create_session(df, filename, profile)
    preview = json.loads(df.head(100).to_json(orient="records", date_format="iso"))

    return {
        "session_id": session_id,
        "filename": filename,
        "rows": profile["rows"],
        "cols": profile["cols"],
        "column_meta": profile["column_meta"],
        "kpis": profile["kpis"],
        "preview": preview,
        "anomalies": profile["anomalies"],
    }
