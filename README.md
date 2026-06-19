# ⚡ DataViz Pro

Instant data analytics with a real AI analyst. Drop a CSV/Excel/JSON file and get a
glassmorphism dashboard — KPIs, charts, column stats, a sortable table — plus a chat
analyst powered by Claude that **runs actual code against your data**: Pandas queries,
DuckDB SQL, Prophet forecasts, and anomaly detection, streamed live over SSE.

| Layer | Stack |
|---|---|
| Backend | FastAPI · Pandas · DuckDB · Prophet · scikit-learn · Anthropic SDK |
| Frontend | React 18 · Vite · Recharts · react-dropzone |
| AI | Claude (tool use + streaming) — 5 real tools, full agentic loop |
| Deploy | Railway (backend) · Vercel (frontend) |

## How it works

```
Browser ──upload──▶ FastAPI ──▶ Pandas parse ──▶ profile (types/stats/KPIs/outliers)
   │                                │
   │                          in-memory session (UUID, TTL)
   │
   ├──chat (SSE)──▶ /api/chat/stream ──▶ Claude + tools
   │                    │  run_dataframe_query   (sandboxed Pandas)
   │                    │  run_sql_query         (DuckDB, no file access)
   │                    │  generate_chart_data   (→ Recharts payload)
   │                    │  run_forecast          (Prophet + confidence bands)
   │                    │  detect_anomalies      (IQR + Z-score)
   │                    ▼
   ◀──text tokens · tool events · chart_data ──┘
```

On upload the chat auto-opens, Claude runs verification queries, and streams three
data-backed insights plus AI-generated suggestion chips. Charts Claude creates land
directly on the dashboard. The whole conversation exports as a standalone HTML report.

## Local setup

**Prereqs:** Python 3.10+ and Node 18+.

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env          # then put your real ANTHROPIC_API_KEY in .env
uvicorn main:app --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                      # http://localhost:5173, /api proxied to :8000
```

Open http://localhost:5173 and click **▶ Try with sample dataset** — a 200-row
e-commerce dataset with planted patterns (Q4 spike, an underperforming region, a
high-CAC channel, a margin dip, a churn anomaly) for the AI to discover.

### Environment variables (`backend/.env`)

| Var | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | **Required.** Never ships to the frontend. |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | Model for the chat analyst |
| `ALLOWED_ORIGINS` | `http://localhost:5173,https://intelligent-analytics-dashboard-bjain.netlify.app` | Comma-separated CORS origins |
| `MAX_FILE_SIZE_MB` | `50` | Upload size limit |
| `SESSION_TTL_MINUTES` | `60` | In-memory session expiry |

## Deployment

### Backend → Railway

1. Create a new project and deploy from this repo.
2. Set the service root to `backend/` so Railway builds the FastAPI backend.
3. Add required env vars:
   - `ANTHROPIC_API_KEY`
   - `ALLOWED_ORIGINS=http://localhost:5173,https://intelligent-analytics-dashboard-bjain.netlify.app`
4. Copy the Railway public URL, for example:
   `https://dataviz-pro-production.up.railway.app`

### Frontend → Netlify

1. Connect `bhavinjain28/DataViz-Pro` to Netlify.
2. Set the base directory to `frontend`.
3. Set the build command to `npm run build` and publish directory to `dist`.
4. Add a build environment variable:
   - `VITE_API_URL=https://dataviz-pro-production.up.railway.app/api`
5. Deploy the site. The inferred frontend URL is your Netlify site.

## Security notes

- The Claude API key lives **only** on the backend; the browser talks to FastAPI.
- `run_dataframe_query` executes in a screened sandbox: pattern blocklist
  (imports, dunders, `exec`/`eval`/`open`, os/sys/subprocess), builtin whitelist,
  and a wall-clock timeout.
- DuckDB runs with `enable_external_access=false` — no file reads, no `ATTACH`.
- Uploads are validated by magic bytes, not just extension; errors return
  `{"error", "detail"}` with proper 413/415/422 codes.

## Project structure

```
dataviz-pro/
├── backend/
│   ├── main.py                  # FastAPI app, CORS, error shape, health
│   ├── routers/
│   │   ├── upload.py            # multipart upload → parse → profile → session
│   │   └── chat.py              # SSE streaming + the Claude tool loop
│   ├── services/
│   │   ├── data_profiler.py     # type detection, stats, KPIs, data_context
│   │   ├── session_store.py     # UUID-keyed DataFrames with TTL
│   │   └── tool_executor.py     # sandboxed execution of all 5 tools
│   └── tools/                   # Claude tool JSON-schema definitions
└── frontend/
    └── src/
        ├── components/          # UploadScreen, Dashboard, Topbar, FilterBar,
        │                        # KpiGrid, ChartCard, StatsPanel, DataTable,
        │                        # ChatWidget
        ├── hooks/useChat.js     # SSE reader + message/tool/chart state
        └── utils/               # api, formatters, sampleData, reportExport
```
