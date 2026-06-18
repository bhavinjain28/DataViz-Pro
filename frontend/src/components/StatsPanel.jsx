import { COLORS, fmtSmart } from '../utils/formatters.js'

const COL_TYPE_CLASS = {
  numeric: 'col-score',
  categorical: 'col-text',
  date: 'col-date',
  boolean: 'col-count',
  id: 'col-id',
}

function StatRow({ k, v }) {
  return (
    <div className="stat-row">
      <span className="stat-k">{k}</span>
      <span className="stat-v">{v}</span>
    </div>
  )
}

function StatsCard({ col, meta, totalRows }) {
  const topValues = meta.top_values || []
  const maxCount = topValues.length ? topValues[0][1] : 0

  return (
    <div className="stats-card">
      <div className="stats-col-name">
        {col}
        <span className={`col-type ${COL_TYPE_CLASS[meta.type] || 'col-text'}`}>{meta.type}</span>
      </div>
      <div className="stats-rows">
        {meta.type === 'numeric' && (
          <>
            <StatRow k="Min" v={fmtSmart(meta.min)} />
            <StatRow k="Max" v={fmtSmart(meta.max)} />
            <StatRow k="Mean" v={fmtSmart(meta.mean)} />
            <StatRow k="Std dev" v={meta.std != null ? fmtSmart(meta.std) : '—'} />
          </>
        )}
        {meta.type === 'date' && (
          <>
            <StatRow k="From" v={String(meta.min ?? '—').slice(0, 10)} />
            <StatRow k="To" v={String(meta.max ?? '—').slice(0, 10)} />
          </>
        )}
        <StatRow k="Unique values" v={meta.unique_count.toLocaleString()} />
        <StatRow
          k="Nulls"
          v={`${meta.null_count.toLocaleString()} (${((meta.null_count / totalRows) * 100).toFixed(1)}%)`}
        />
      </div>

      {topValues.length > 0 && (
        <div className="mini-bar-wrap">
          {topValues.map(([value, count], i) => (
            <div className="mini-bar-item" key={String(value)}>
              <span className="mini-bar-label" title={String(value)}>{String(value)}</span>
              <div className="mini-bar-track">
                <div
                  className="mini-bar-fill"
                  style={{
                    width: `${maxCount ? (count / maxCount) * 100 : 0}%`,
                    background: COLORS[i % COLORS.length],
                  }}
                />
              </div>
              <span className="mini-bar-count">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function StatsPanel({ profile }) {
  // Stats reflect the full dataset (computed server-side at upload).
  const sampled = profile.rows > 100000
  const statRows = sampled ? 50000 : profile.rows
  return (
    <div className="stats-grid">
      {Object.entries(profile.column_meta).map(([col, meta]) => (
        <StatsCard key={col} col={col} meta={meta} totalRows={statRows} />
      ))}
    </div>
  )
}
