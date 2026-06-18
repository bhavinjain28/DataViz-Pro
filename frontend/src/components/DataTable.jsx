import { useEffect, useMemo, useState } from 'react'

const PAGE_SIZES = [25, 50, 100, 'All']

const TYPE_BADGE = {
  numeric: { label: '#', cls: 'col-score' },
  categorical: { label: 'abc', cls: 'col-text' },
  date: { label: '📅', cls: 'col-date' },
  boolean: { label: '☑', cls: 'col-count' },
  id: { label: '🔑', cls: 'col-id' },
}

function compare(a, b, numeric) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (numeric) return Number(a) - Number(b)
  return String(a).localeCompare(String(b), undefined, { numeric: true })
}

export default function DataTable({ rows, columns, columnMeta, totalRows, onExport }) {
  const [sort, setSort] = useState({ col: null, dir: null }) // dir: 'asc' | 'desc'
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(0)

  // Snap back to page 1 whenever the visible row set changes.
  useEffect(() => {
    setPage(0)
  }, [rows, pageSize, sort])

  const sorted = useMemo(() => {
    if (!sort.col || !sort.dir) return rows
    const numeric = ['numeric', 'id'].includes(columnMeta[sort.col]?.type)
    const out = [...rows].sort((a, b) => compare(a[sort.col], b[sort.col], numeric))
    if (sort.dir === 'desc') out.reverse()
    return out
  }, [rows, sort, columnMeta])

  const effectiveSize = pageSize === 'All' ? sorted.length || 1 : pageSize
  const pageCount = Math.max(1, Math.ceil(sorted.length / effectiveSize))
  const pageRows = sorted.slice(page * effectiveSize, (page + 1) * effectiveSize)

  const cycleSort = (col) => {
    setSort((s) => {
      if (s.col !== col) return { col, dir: 'asc' }
      if (s.dir === 'asc') return { col, dir: 'desc' }
      return { col: null, dir: null }
    })
  }

  // Windowed page numbers: at most 7 buttons centred on the current page.
  const pageNumbers = useMemo(() => {
    if (pageCount <= 7) return [...Array(pageCount).keys()]
    const start = Math.max(0, Math.min(page - 3, pageCount - 7))
    return [...Array(7).keys()].map((i) => start + i)
  }, [page, pageCount])

  return (
    <div className="table-wrapper">
      <div className="table-toolbar">
        <span className="table-title">
          {rows.length.toLocaleString()} rows
          {rows.length < totalRows && (
            <span style={{ color: 'var(--text2)', fontWeight: 400 }}>
              {' '}(preview of {totalRows.toLocaleString()})
            </span>
          )}
        </span>
        <div className="table-actions">
          <select
            className="filter-select"
            value={String(pageSize)}
            onChange={(e) =>
              setPageSize(e.target.value === 'All' ? 'All' : Number(e.target.value))
            }
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} / page
              </option>
            ))}
          </select>
          <button className="btn-sm btn-secondary" onClick={onExport}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((col) => {
                const badge = TYPE_BADGE[columnMeta[col]?.type]
                const sortCls =
                  sort.col === col && sort.dir ? ` sort-${sort.dir}` : ''
                return (
                  <th key={col} className={sortCls.trim()} onClick={() => cycleSort(col)}>
                    {col}
                    {badge && (
                      <span className={`col-type th-badge ${badge.cls}`}>{badge.label}</span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={page * effectiveSize + i}>
                {columns.map((col) => (
                  <td key={col} title={String(row[col] ?? '')}>
                    {row[col] == null || row[col] === '' ? '—' : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem' }}>
                  No rows match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="page-controls">
        <span>
          Page {page + 1} of {pageCount}
        </span>
        <div className="page-btns">
          <button
            className="page-btn"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            ←
          </button>
          {pageNumbers.map((n) => (
            <button
              key={n}
              className={`page-btn${n === page ? ' active' : ''}`}
              onClick={() => setPage(n)}
            >
              {n + 1}
            </button>
          ))}
          <button
            className="page-btn"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}
