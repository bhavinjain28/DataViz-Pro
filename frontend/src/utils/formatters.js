// Number formatting — fmt() ported verbatim from the original app.

export const COLORS = [
  '#6c63ff', '#ff6584', '#43e97b', '#f7971e', '#56ccf2',
  '#ffd200', '#f48fb1', '#a5d6a7', '#80deea', '#ffcc80',
]

export function fmtSmart(n, type) {
  if (typeof n !== 'number' || isNaN(n)) return '-'
  if (type === 'currency') {
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
    if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K'
    return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  }
  if (type === 'percentage') return n.toFixed(1) + '%'
  if (type === 'score') return n.toFixed(2)
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

/** Infer a display flavor for a numeric column from its name. */
export function inferDisplayType(colName) {
  const c = colName.toLowerCase()
  if (/revenue|price|cost|cogs|profit|sales|amount|spend|cac|income|salary/.test(c)) return 'currency'
  if (/rate|pct|percent|churn|ratio|margin/.test(c)) return 'percentage'
  if (/score|rating/.test(c)) return 'score'
  if (/count|qty|units|quantity|orders|clicks|views/.test(c)) return 'count'
  if (/year/.test(c)) return 'year'
  return 'numeric'
}

/**
 * Headline aggregate for a numeric column. Additive measures (revenue,
 * units…) total meaningfully; intensive measures (temperature, price, rate,
 * speed, times-of-day…) only make sense averaged.
 */
export function aggregateFor(colName) {
  const c = colName.toLowerCase()
  if (
    /temp|degree|rate|pct|percent|ratio|margin|score|rating|speed|price|age$|humidity|pressure|lat|lng|lon|altitude|elevation|sunrise|sunset|index|cac|churn|density|depth/.test(c)
  ) {
    return 'mean'
  }
  return 'sum'
}

/** Numeric columns that are identifiers — never meaningful as KPI cards. */
export function isIdentifierLike(colName) {
  return /(id|uuid|guid|code|number|no|key|zip|phone)$/i.test(colName)
}

export const TYPE_LABELS = {
  currency: '💰 Currency',
  score: '⭐ Score',
  percentage: '📊 Rate',
  count: '🔢 Count',
  numeric: '# Numeric',
  year: '📅 Year',
  categorical: '🏷 Category',
  id: '🔑 ID',
  boolean: '☑ Boolean',
  date: '📅 Date',
}

/** CSS tag class for a display type (matches original tag-* classes). */
export function tagClass(type) {
  return ['currency', 'score', 'count', 'year'].includes(type) ? `tag-${type}` : 'tag-categorical'
}

/** Pretty cell rendering for tables/tooltips. */
export function fmtCell(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'number') return fmtSmart(v)
  return String(v)
}
