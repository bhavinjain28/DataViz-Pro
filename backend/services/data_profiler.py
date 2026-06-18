"""Column type detection, stats, KPIs, anomaly scan, and the data_context
text block that goes into Claude's system prompt.

profile_dataframe() never mutates the input DataFrame. For DataFrames over
100K rows, stats are computed on a 50K-row sample (row/column counts always
reflect the full frame).
"""

import json
import math
import re
from datetime import date, datetime

import numpy as np
import pandas as pd

PROFILE_SAMPLE_THRESHOLD = 100_000
PROFILE_SAMPLE_SIZE = 50_000

_ID_NAME_RE = re.compile(r"(^id$|[_\s-]id$|^id[_\s-]|uuid|guid)", re.IGNORECASE)
# Numeric columns that are identifiers, not measures — summing them is
# meaningless, so they are excluded from auto-KPIs (e.g. customerid,
# invoiceno, zipcode, productkey).
_IDENTIFIER_KPI_RE = re.compile(r"(id|uuid|guid|code|number|no|key|zip|phone)$", re.IGNORECASE)
_DATE_NAME_RE = re.compile(r"(date|time|day|month|year|created|updated|timestamp)", re.IGNORECASE)
_BOOL_STRINGS = {"true", "false", "yes", "no", "y", "n", "t", "f"}


def _py(value):
    """Convert numpy/pandas scalars to JSON-safe Python values."""
    if value is None:
        return None
    if isinstance(value, (np.bool_, bool)):
        return bool(value)
    if isinstance(value, (np.integer, int)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        f = float(value)
        return None if (math.isnan(f) or math.isinf(f)) else round(f, 4)
    if isinstance(value, (pd.Timestamp, np.datetime64, datetime, date)):
        return str(value)
    return str(value) if not isinstance(value, (str, list, dict)) else value


def _try_parse_dates(series: pd.Series) -> pd.Series | None:
    """Return the series parsed as datetimes if it convincingly is one, else None."""
    non_null = series.dropna()
    if non_null.empty or not pd.api.types.is_object_dtype(series):
        return None
    sample = non_null.sample(min(len(non_null), 200), random_state=0).astype(str)
    # Quick rejection: pure numbers are almost never dates in business data.
    if sample.str.fullmatch(r"-?\d+(\.\d+)?").mean() > 0.5:
        return None
    parsed = pd.to_datetime(sample, errors="coerce", format="mixed")
    success = parsed.notna().mean()
    threshold = 0.8 if _DATE_NAME_RE.search(str(series.name) or "") else 0.95
    if success >= threshold:
        return pd.to_datetime(series, errors="coerce", format="mixed")
    return None


def detect_column_type(name: str, series: pd.Series, total_rows: int) -> tuple[str, pd.Series]:
    """Return (type, working_series). Type is numeric|categorical|date|boolean|id.

    working_series is the date-parsed series for date columns, otherwise the
    original series.
    """
    if pd.api.types.is_bool_dtype(series):
        return "boolean", series
    if pd.api.types.is_datetime64_any_dtype(series):
        return "date", series

    non_null = series.dropna()
    unique_count = int(non_null.nunique())

    if pd.api.types.is_object_dtype(series) and non_null.size > 0:
        lowered = {str(v).strip().lower() for v in non_null.unique()[:10]}
        if unique_count <= 2 and lowered <= _BOOL_STRINGS:
            return "boolean", series
        parsed = _try_parse_dates(series)
        if parsed is not None:
            return "date", parsed

    looks_like_id_name = bool(_ID_NAME_RE.search(name))
    all_unique = total_rows > 0 and unique_count == len(non_null) == total_rows

    if pd.api.types.is_numeric_dtype(series):
        if looks_like_id_name and (all_unique or unique_count > 0.9 * max(total_rows, 1)):
            return "id", series
        return "numeric", series

    if looks_like_id_name or all_unique:
        return "id", series
    return "categorical", series


def _column_meta(col_type: str, series: pd.Series, total_rows: int) -> dict:
    non_null = series.dropna()
    meta = {
        "type": col_type,
        "unique_count": int(non_null.nunique()),
        "null_count": int(total_rows - len(non_null)),
        "sample": [_py(v) for v in non_null.head(3).tolist()],
    }
    if col_type == "numeric":
        meta.update(
            min=_py(non_null.min()) if len(non_null) else None,
            max=_py(non_null.max()) if len(non_null) else None,
            mean=_py(non_null.mean()) if len(non_null) else None,
            std=_py(non_null.std()) if len(non_null) > 1 else None,
        )
    elif col_type == "categorical":
        top = non_null.value_counts().head(5)
        meta["top_values"] = [(str(v), int(c)) for v, c in top.items()]
    elif col_type == "date" and len(non_null):
        meta.update(min=str(non_null.min()), max=str(non_null.max()))
    return meta


def _iqr_outliers(series: pd.Series) -> dict | None:
    non_null = series.dropna()
    if len(non_null) < 8:
        return None
    q1, q3 = non_null.quantile(0.25), non_null.quantile(0.75)
    iqr = q3 - q1
    if iqr == 0:
        return None
    lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    outliers = non_null[(non_null < lo) | (non_null > hi)]
    if outliers.empty:
        return None
    return {
        "col": str(series.name),
        "count": int(len(outliers)),
        "lower_bound": _py(lo),
        "upper_bound": _py(hi),
        "examples": [_py(v) for v in outliers.head(5).tolist()],
    }


def _build_data_context(filename: str, rows: int, cols: int, column_meta: dict,
                        kpis: list, anomalies: list, sample_rows: list) -> str:
    lines = [
        f"=== DATASET: {filename} ===",
        f"Rows: {rows:,} | Columns: {cols} | Loaded: {datetime.now():%Y-%m-%d %H:%M}",
    ]

    numeric = {c: m for c, m in column_meta.items() if m["type"] == "numeric"}
    categorical = {c: m for c, m in column_meta.items() if m["type"] == "categorical"}
    dates = {c: m for c, m in column_meta.items() if m["type"] == "date"}

    if numeric:
        lines += ["", "--- NUMERIC COLUMNS ---"]
        for col, m in numeric.items():
            lines.append(
                f"{col}: min={m['min']}, max={m['max']}, mean={m['mean']}, "
                f"std={m['std']}, nulls={m['null_count']}"
            )
    if categorical:
        lines += ["", "--- CATEGORICAL COLUMNS ---"]
        for col, m in categorical.items():
            lines.append(f"{col}: {m['unique_count']} unique values")
            if m.get("top_values"):
                tops = ", ".join(f'"{v}" ({c})' for v, c in m["top_values"][:3])
                lines.append(f"  Top values: {tops}")
    if dates:
        lines += ["", "--- DATE COLUMNS ---"]
        for col, m in dates.items():
            count = rows - m["null_count"]
            lines.append(f"{col}: {m.get('min')} → {m.get('max')} ({count:,} values)")

    if kpis:
        lines += ["", "--- AUTO-DETECTED KPIs ---"]
        for k in kpis:
            lines.append(f"{k['col']}: Total={k['sum']:,.0f}, Avg={k['mean']:,.2f}")

    if anomalies:
        lines += ["", "--- POTENTIAL ANOMALIES ---"]
        for a in anomalies:
            lines.append(
                f"{a['col']}: {a['count']} outliers detected (IQR method), "
                f"values above {a['upper_bound']} or below {a['lower_bound']}"
            )

    lines += ["", "--- SAMPLE DATA (first 3 rows) ---", json.dumps(sample_rows, default=str)]
    return "\n".join(lines)


def profile_dataframe(df: pd.DataFrame, filename: str) -> dict:
    rows, cols = len(df), len(df.columns)

    stats_df = df
    if rows > PROFILE_SAMPLE_THRESHOLD:
        stats_df = df.sample(PROFILE_SAMPLE_SIZE, random_state=42)

    column_meta: dict[str, dict] = {}
    kpis: list[dict] = []
    anomalies: list[dict] = []

    for col in df.columns:
        series = stats_df[col]
        col_type, working = detect_column_type(str(col), series, len(stats_df))
        column_meta[str(col)] = _column_meta(col_type, working, len(stats_df))

        if col_type == "numeric":
            non_null = working.dropna()
            if len(kpis) < 6 and len(non_null) and not _IDENTIFIER_KPI_RE.search(str(col)):
                kpis.append({
                    "col": str(col),
                    "sum": float(non_null.sum()),
                    "mean": float(non_null.mean()),
                    "min": float(non_null.min()),
                    "max": float(non_null.max()),
                })
            outlier_info = _iqr_outliers(working)
            if outlier_info:
                anomalies.append(outlier_info)

    sample_rows = json.loads(df.head(3).to_json(orient="records", date_format="iso"))

    return {
        "filename": filename,
        "rows": rows,
        "cols": cols,
        "column_meta": column_meta,
        "kpis": kpis,
        "anomalies": anomalies,
        "data_context": _build_data_context(
            filename, rows, cols, column_meta, kpis, anomalies, sample_rows
        ),
    }
