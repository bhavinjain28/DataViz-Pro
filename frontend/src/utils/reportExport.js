// Standalone HTML analysis report — dataset summary + the AI conversation.
// Pure functions; the download itself happens via Blob in the caller.

import { fmtSmart, inferDisplayType } from './formatters.js'

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Markdown-lite → HTML (bold, inline code, bullets, paragraphs). */
function mdToHtml(text) {
  const inline = (line) =>
    esc(line)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
  return text
    .split('\n')
    .map((line) => {
      const stripped = line.replace(/^\s*[-•]\s+/, '')
      if (stripped !== line) return `<li>${inline(stripped)}</li>`
      if (!line.trim()) return ''
      return `<p>${inline(line)}</p>`
    })
    .join('\n')
    .replace(/(<li>[\s\S]+?<\/li>)(?!\n<li>)/g, '<ul>$1</ul>')
}

function columnRows(profile) {
  return Object.entries(profile.column_meta)
    .map(([col, m]) => {
      const stats =
        m.type === 'numeric'
          ? `min ${fmtSmart(m.min)} · max ${fmtSmart(m.max)} · mean ${fmtSmart(m.mean)}`
          : m.type === 'date'
            ? `${String(m.min ?? '').slice(0, 10)} → ${String(m.max ?? '').slice(0, 10)}`
            : m.top_values?.length
              ? `top: ${m.top_values.slice(0, 3).map(([v, c]) => `${esc(String(v))} (${c})`).join(', ')}`
              : '—'
      return `<tr>
        <td><strong>${esc(col)}</strong></td>
        <td><span class="type type-${m.type}">${m.type}</span></td>
        <td>${m.unique_count.toLocaleString()}</td>
        <td>${m.null_count.toLocaleString()}</td>
        <td class="muted">${stats}</td>
      </tr>`
    })
    .join('\n')
}

function conversationHtml(messages) {
  return messages
    .filter((m) => !m.hidden)
    .filter((m) => m.content?.trim() || m.tools?.length || m.charts)
    .map((m) => {
      if (m.role === 'user') {
        return `<div class="msg user"><div class="bubble">${mdToHtml(m.content)}</div></div>`
      }
      const tools = (m.tools || [])
        .map(
          (t) => `<details class="tool">
            <summary>${t.ok ? '✓' : '✗'} ${esc(t.description || t.tool)}</summary>
            ${t.detail ? `<pre>${esc(t.detail)}</pre>` : ''}
          </details>`,
        )
        .join('\n')
      const charts = m.charts
        ? `<div class="chart-note">📊 ${m.charts} chart${m.charts > 1 ? 's' : ''} added to the dashboard</div>`
        : ''
      return `<div class="msg ai">${tools}<div class="bubble">${mdToHtml(m.content)}</div>${charts}</div>`
    })
    .join('\n')
}

export function buildReportHtml({ profile, messages }) {
  const date = new Date().toLocaleString()
  const kpis = profile.kpis
    .map((k) => {
      const t = inferDisplayType(k.col)
      return `<div class="kpi">
        <div class="kpi-name">${esc(k.col)}</div>
        <div class="kpi-val">${fmtSmart(k.sum, t)}</div>
        <div class="kpi-sub">avg ${fmtSmart(k.mean, t)} · range ${fmtSmart(k.min, t)}–${fmtSmart(k.max, t)}</div>
      </div>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>DataViz Pro — Analysis Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; background: #fff; color: #1a1b2e;
         max-width: 860px; margin: 0 auto; padding: 48px 28px; line-height: 1.6; }
  header { border-bottom: 3px solid #6c63ff; padding-bottom: 20px; margin-bottom: 32px; }
  h1 { font-size: 1.7rem; font-weight: 900; letter-spacing: -0.5px; }
  h1 span { color: #6c63ff; }
  .meta { color: #6b7280; font-size: 0.9rem; margin-top: 6px; }
  h2 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280;
       margin: 36px 0 14px; border-left: 3px solid #6c63ff; padding-left: 10px; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
  .kpi { border: 1px solid #e5e7f0; border-radius: 12px; padding: 14px; }
  .kpi-name { font-size: 0.72rem; text-transform: uppercase; color: #6b7280; font-weight: 700; }
  .kpi-val { font-size: 1.45rem; font-weight: 900; color: #6c63ff; }
  .kpi-sub { font-size: 0.74rem; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
  th { text-align: left; padding: 8px 10px; background: #f4f5fb; color: #6b7280;
       font-size: 0.72rem; text-transform: uppercase; }
  td { padding: 8px 10px; border-bottom: 1px solid #eef0f8; vertical-align: top; }
  .muted { color: #6b7280; font-size: 0.78rem; }
  .type { font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
  .type-numeric { background: #ece9ff; color: #5b52e8; }
  .type-categorical { background: #ffe9ee; color: #e84d6a; }
  .type-date { background: #fff1de; color: #e08a0e; }
  .type-boolean { background: #e3f8ec; color: #27b85a; }
  .type-id { background: #f0f1f5; color: #6b7280; }
  .msg { margin: 14px 0; display: flex; flex-direction: column; }
  .msg.user { align-items: flex-end; }
  .msg.ai { align-items: flex-start; }
  .bubble { max-width: 80%; padding: 12px 16px; border-radius: 14px; font-size: 0.9rem; }
  .user .bubble { background: #6c63ff; color: #fff; border-bottom-right-radius: 4px; }
  .ai .bubble { background: #f4f5fb; border: 1px solid #e5e7f0; border-bottom-left-radius: 4px; }
  .bubble ul { padding-left: 18px; margin: 6px 0; }
  .bubble p { margin: 4px 0; }
  .bubble code { background: #ece9ff; border-radius: 4px; padding: 1px 5px; font-size: 0.82em; }
  .tool { margin: 6px 0; font-size: 0.78rem; max-width: 80%; }
  .tool summary { cursor: pointer; color: #27b85a; font-weight: 600; }
  .tool pre { background: #f4f5fb; border: 1px solid #e5e7f0; border-radius: 8px;
              padding: 10px; font-size: 0.74rem; white-space: pre-wrap; margin-top: 6px; }
  .chart-note { font-size: 0.78rem; color: #e08a0e; margin-top: 4px; }
  footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #eef0f8;
           color: #6b7280; font-size: 0.78rem; text-align: center; }
</style>
</head>
<body>
  <header>
    <h1><span>⚡ DataViz Pro</span> Analysis Report</h1>
    <div class="meta">File: <strong>${esc(profile.filename)}</strong> · ${date} ·
      ${profile.rows.toLocaleString()} rows · ${profile.cols} columns</div>
  </header>

  <h2>Key Metrics</h2>
  <div class="kpis">${kpis}</div>

  <h2>Dataset Summary</h2>
  <table>
    <thead><tr><th>Column</th><th>Type</th><th>Unique</th><th>Nulls</th><th>Stats</th></tr></thead>
    <tbody>${columnRows(profile)}</tbody>
  </table>

  <h2>AI Conversation</h2>
  ${conversationHtml(messages) || '<p class="muted">No conversation yet.</p>'}

  <footer>Generated by DataViz Pro · AI analysis powered by Claude</footer>
</body>
</html>`
}

export function downloadReport({ profile, messages }) {
  const html = buildReportHtml({ profile, messages })
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  const a = document.createElement('a')
  a.href = url
  a.download = profile.filename.replace(/\.[^.]+$/, '') + '_report.html'
  a.click()
  URL.revokeObjectURL(url)
}
