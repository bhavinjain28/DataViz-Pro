import { useMemo } from 'react'

export default function FilterBar({ columns, rows, filter, onFilterChange, totalShown }) {
  const { search, column, value } = filter

  // Unique values for the selected column, derived from the preview rows.
  const valueOptions = useMemo(() => {
    if (!column) return []
    const seen = new Set()
    for (const row of rows) {
      const v = row[column]
      if (v !== null && v !== undefined) seen.add(String(v))
      if (seen.size >= 50) break
    }
    return [...seen].sort()
  }, [column, rows])

  const hasFilter = search || (column && value)

  return (
    <div className="filter-bar">
      <span className="filter-label">🔍 Filter</span>
      <input
        type="text"
        className="search-input"
        placeholder="Search all columns..."
        value={search}
        onChange={(e) => onFilterChange({ ...filter, search: e.target.value })}
      />
      <select
        className="filter-select"
        value={column}
        onChange={(e) => onFilterChange({ ...filter, column: e.target.value, value: '' })}
      >
        <option value="">All Columns</option>
        {columns.map((col) => (
          <option key={col} value={col}>
            {col}
          </option>
        ))}
      </select>
      <select
        className="filter-select"
        value={value}
        disabled={!column}
        onChange={(e) => onFilterChange({ ...filter, value: e.target.value })}
      >
        <option value="">All Values</option>
        {valueOptions.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      <button
        className="btn-sm btn-secondary"
        onClick={() => onFilterChange({ search: '', column: '', value: '' })}
      >
        ✕ Clear
      </button>
      {hasFilter && (
        <span className="filter-count">
          {totalShown.toLocaleString()} of {rows.length.toLocaleString()} preview rows
        </span>
      )}
    </div>
  )
}
