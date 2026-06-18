"""Safe execution of Claude's tool calls against session DataFrames.

execute_tool() never raises: failures come back as "Error: ..." strings so
the chat router can hand them to Claude as tool results and let it explain
the problem to the user in plain English.

Security model for run_dataframe_query:
- pattern screen rejects imports, dunders, exec/eval/open, os/sys/etc.
- code runs with a whitelist of builtins only ({"df", "pd", "np"} namespace)
- wall-clock timeout per execution
DuckDB runs with external access disabled (no file reads, no ATTACH).
"""

import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout

import duckdb
import numpy as np
import pandas as pd

from services.session_store import get_session

MAX_RESULT_CHARS = 2000
CODE_TIMEOUT_SECONDS = 15
FORECAST_TIMEOUT_SECONDS = 90
MAX_FORECAST_PERIODS = 365
HISTORICAL_POINTS_CAP = 120

_FORBIDDEN_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"__"), "double underscores"),
    (re.compile(r"\bimport\b"), "import statements"),
    (re.compile(r"\b(open|exec|eval|compile|input|breakpoint|help)\s*\("), "that builtin"),
    (re.compile(r"\b(globals|locals|vars|getattr|setattr|delattr)\s*\("), "reflection builtins"),
    (re.compile(r"\bos\s*\."), "the os module"),
    (re.compile(r"\bsys\s*\."), "the sys module"),
    (re.compile(r"\b(subprocess|shutil|socket|pathlib|builtins)\b", re.IGNORECASE), "that module"),
]

_SAFE_BUILTINS = {
    "len": len, "sum": sum, "min": min, "max": max, "abs": abs, "round": round,
    "sorted": sorted, "reversed": reversed, "range": range, "enumerate": enumerate,
    "zip": zip, "map": map, "filter": filter, "any": any, "all": all,
    "str": str, "int": int, "float": float, "bool": bool,
    "list": list, "dict": dict, "set": set, "tuple": tuple,
    "isinstance": isinstance, "divmod": divmod, "format": format, "repr": repr,
    "True": True, "False": False, "None": None,
}


def _truncate(text: str) -> str:
    if len(text) <= MAX_RESULT_CHARS:
        return text
    return text[:MAX_RESULT_CHARS] + f"\n... [truncated, {len(text):,} chars total]"


def _run_with_timeout(fn, seconds: int):
    pool = ThreadPoolExecutor(max_workers=1)
    try:
        return pool.submit(fn).result(timeout=seconds)
    finally:
        pool.shutdown(wait=False, cancel_futures=True)


def _round(value) -> float | None:
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return None if (np.isnan(f) or np.isinf(f)) else round(f, 4)


def _require_columns(df: pd.DataFrame, *cols: str) -> None:
    missing = [c for c in cols if c not in df.columns]
    if missing:
        raise ValueError(
            f"Column(s) {missing} not found. Available columns: {list(df.columns)}"
        )


# ── run_dataframe_query ────────────────────────────────────────────────────

def _exec_dataframe_query(df: pd.DataFrame, tool_input: dict) -> str:
    code = tool_input.get("code", "")
    if not code.strip():
        raise ValueError("No code provided.")
    if len(code) > 4000:
        raise ValueError("Code is too long (4000 char limit).")
    for pattern, label in _FORBIDDEN_PATTERNS:
        if pattern.search(code):
            raise ValueError(f"Code rejected for safety: {label} not allowed.")

    namespace = {"df": df, "pd": pd, "np": np, "__builtins__": _SAFE_BUILTINS}

    def run():
        exec(code, namespace)  # noqa: S102 — screened + builtin-whitelisted sandbox
        return namespace.get("result")

    result = _run_with_timeout(run, CODE_TIMEOUT_SECONDS)
    if result is None:
        raise ValueError("Code executed but did not assign the `result` variable.")
    if isinstance(result, (pd.DataFrame, pd.Series)):
        result = result.head(50).to_string()
    return _truncate(str(result))


# ── run_sql_query ──────────────────────────────────────────────────────────

def _exec_sql_query(df: pd.DataFrame, tool_input: dict) -> str:
    sql = tool_input.get("sql", "")
    if not sql.strip():
        raise ValueError("No SQL provided.")

    con = duckdb.connect(database=":memory:", config={"enable_external_access": False})
    try:
        con.register("df", df)
        out = _run_with_timeout(lambda: con.execute(sql).fetch_df(), CODE_TIMEOUT_SECONDS)
    finally:
        con.close()

    if out is None or out.empty:
        return "Query executed successfully but returned no rows."
    return _truncate(out.head(50).to_string(index=False))


# ── generate_chart_data ────────────────────────────────────────────────────

def _exec_chart_data(df: pd.DataFrame, tool_input: dict) -> str:
    chart_type = tool_input["chart_type"]
    x, y = tool_input["x_column"], tool_input["y_column"]
    agg = tool_input["aggregation"]
    title = tool_input["title"]
    limit = max(1, min(int(tool_input.get("limit") or 20), 100))
    _require_columns(df, x, y)

    work = df[[x, y]].dropna(subset=[x]).copy()

    if chart_type == "scatter":
        work[y] = pd.to_numeric(work[y], errors="coerce")
        work = work.dropna()
        if len(work) > limit:
            work = work.sample(limit, random_state=42)
        data = [{"x": _round(r[x]) if pd.api.types.is_numeric_dtype(df[x]) else str(r[x]),
                 "y": _round(r[y])} for _, r in work.iterrows()]
        payload = {"type": chart_type, "title": title, "x_column": x, "y_column": y,
                   "aggregation": agg, "data": data}
        return json.dumps(payload, default=str)

    if agg == "count":
        series = work.groupby(x, dropna=False)[y].count()
    else:
        work[y] = pd.to_numeric(work[y], errors="coerce")
        series = work.groupby(x, dropna=False)[y].agg(agg)
    series = series.dropna()

    if chart_type in ("line", "area"):
        # Chronological order; keep the most recent points if over the limit.
        try:
            parsed = pd.to_datetime(series.index, errors="coerce", format="mixed")
            if parsed.notna().all():
                series = series.set_axis(parsed).sort_index()
        except (ValueError, TypeError):
            series = series.sort_index()
        if len(series) > limit:
            series = series.tail(limit)
    else:
        series = series.sort_values(ascending=False).head(limit)

    data = [{"x": str(idx)[:10] if isinstance(idx, pd.Timestamp) else str(idx),
             "y": _round(val)} for idx, val in series.items()]
    payload = {"type": chart_type, "title": title, "x_column": x, "y_column": y,
               "aggregation": agg, "data": data}
    return json.dumps(payload, default=str)


# ── run_forecast ───────────────────────────────────────────────────────────

def _exec_forecast(df: pd.DataFrame, tool_input: dict) -> str:
    date_col = tool_input["date_column"]
    value_col = tool_input["value_column"]
    periods = max(1, min(int(tool_input.get("periods") or 30), MAX_FORECAST_PERIODS))
    title = tool_input.get("title") or f"{value_col} forecast"
    _require_columns(df, date_col, value_col)

    work = df[[date_col, value_col]].copy()
    work[date_col] = pd.to_datetime(work[date_col], errors="coerce", format="mixed")
    work[value_col] = pd.to_numeric(work[value_col], errors="coerce")
    work = work.dropna()
    daily = work.groupby(work[date_col].dt.normalize())[value_col].sum()
    if len(daily) < 10:
        raise ValueError(
            f"Need at least 10 distinct dates to forecast; found {len(daily)}."
        )

    prophet_df = daily.reset_index()
    prophet_df.columns = ["ds", "y"]

    for noisy in ("cmdstanpy", "prophet"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    from prophet import Prophet  # lazy import — heavy module

    def run():
        model = Prophet(daily_seasonality=False)
        model.fit(prophet_df)
        future = model.make_future_dataframe(periods=periods)
        return model.predict(future)

    fc = _run_with_timeout(run, FORECAST_TIMEOUT_SECONDS)

    last_actual_date = prophet_df["ds"].max()
    hist = prophet_df.tail(HISTORICAL_POINTS_CAP)
    future_rows = fc[fc["ds"] > last_actual_date]

    data = [
        {"x": str(r.ds.date()), "historical": _round(r.y)} for r in hist.itertuples()
    ] + [
        {
            "x": str(r.ds.date()),
            "forecast": _round(r.yhat),
            "confidence_lower": _round(r.yhat_lower),
            "confidence_upper": _round(r.yhat_upper),
        }
        for r in future_rows.itertuples()
    ]

    end = future_rows.iloc[-1]
    last_actual = float(prophet_df["y"].iloc[-1])
    summary = {
        "last_actual_date": str(last_actual_date.date()),
        "last_actual_value": _round(last_actual),
        "forecast_end_date": str(end.ds.date()),
        "forecast_end_value": _round(end.yhat),
        "confidence_interval_at_end": [_round(end.yhat_lower), _round(end.yhat_upper)],
        "change_pct": _round((end.yhat - last_actual) / last_actual * 100) if last_actual else None,
    }
    payload = {"type": "forecast", "title": title, "date_column": date_col,
               "value_column": value_col, "periods": periods,
               "summary": summary, "data": data}
    return json.dumps(payload, default=str)


# ── detect_anomalies ───────────────────────────────────────────────────────

def _exec_anomalies(df: pd.DataFrame, tool_input: dict) -> str:
    col = tool_input["column"]
    method = tool_input.get("method") or "both"
    _require_columns(df, col)

    s = pd.to_numeric(df[col], errors="coerce").dropna()
    if len(s) < 8:
        raise ValueError(f"Column '{col}' has too few numeric values ({len(s)}) to analyze.")

    lines = [f"Anomaly analysis for '{col}' ({len(s):,} non-null numeric values):"]

    if method in ("iqr", "both"):
        q1, q3 = s.quantile(0.25), s.quantile(0.75)
        iqr = q3 - q1
        lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        outliers = s[(s < lo) | (s > hi)]
        lines.append(
            f"\nIQR method: {len(outliers)} outliers ({len(outliers) / len(s) * 100:.1f}%). "
            f"Normal range: {_round(lo)} to {_round(hi)}."
        )
        if not outliers.empty:
            lines.append(f"Examples: {[_round(v) for v in outliers.head(10)]}")

    if method in ("zscore", "both"):
        mean, std = s.mean(), s.std()
        if std == 0:
            lines.append("\nZ-score method: not applicable (zero variance).")
        else:
            z = (s - mean) / std
            outliers = s[z.abs() > 3]
            lines.append(
                f"\nZ-score method (|z| > 3): {len(outliers)} outliers "
                f"({len(outliers) / len(s) * 100:.1f}%). Mean={_round(mean)}, std={_round(std)}."
            )
            if not outliers.empty:
                lines.append(f"Examples: {[_round(v) for v in outliers.head(10)]}")

    return _truncate("\n".join(lines))


# ── dispatcher ─────────────────────────────────────────────────────────────

_HANDLERS = {
    "run_dataframe_query": _exec_dataframe_query,
    "run_sql_query": _exec_sql_query,
    "generate_chart_data": _exec_chart_data,
    "run_forecast": _exec_forecast,
    "detect_anomalies": _exec_anomalies,
}

# Tools whose result string is JSON the frontend renders as a chart.
CHART_PAYLOAD_TOOLS = {"generate_chart_data", "run_forecast"}


def execute_tool(tool_name: str, tool_input: dict, session_id: str) -> str:
    session = get_session(session_id)
    if session is None:
        return "Error: session not found or expired. Ask the user to re-upload their file."

    handler = _HANDLERS.get(tool_name)
    if handler is None:
        return f"Error: unknown tool '{tool_name}'."

    try:
        return handler(session["df"], tool_input or {})
    except FutureTimeout:
        return f"Error: {tool_name} timed out. Try a simpler operation or fewer rows."
    except KeyError as exc:
        return f"Error executing {tool_name}: missing required input {exc}."
    except Exception as exc:
        return _truncate(f"Error executing {tool_name}: {exc}")
