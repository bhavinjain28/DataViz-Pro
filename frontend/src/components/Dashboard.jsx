import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useRef, useState } from 'react'
import { COLORS } from '../utils/formatters.js'
import ChartCard from './ChartCard.jsx'
import ChatWidget from './ChatWidget.jsx'
import DataTable from './DataTable.jsx'
import FilterBar from './FilterBar.jsx'
import KpiGrid from './KpiGrid.jsx'
import StatsPanel from './StatsPanel.jsx'
import { toast } from './Toast.jsx'
import Topbar from './Topbar.jsx'

const EMPTY_FILTER = { search: '', column: '', value: '' }

const TAB_ORDER = ['overview', 'charts', 'stats', 'table']

// Directional slide + blur between tabs (animations spec, step 13).
const tabVariants = {
  enter: (dir) => ({ opacity: 0, x: dir * 20, filter: 'blur(3px)' }),
  center: { opacity: 1, x: 0, filter: 'blur(0px)' },
  exit: (dir) => ({ opacity: 0, x: dir * -20, filter: 'blur(3px)' }),
}

/** Apply search + column/value filters to the preview rows. */
function applyFilter(rows, { search, column, value }) {
  let out = rows
  if (column && value) {
    out = out.filter((row) => String(row[column] ?? '') === value)
  }
  if (search.trim()) {
    const q = search.trim().toLowerCase()
    out = out.filter((row) =>
      Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)),
    )
  }
  return out
}

function rowsToCsv(rows, columns) {
  const escape = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [
    columns.join(','),
    ...rows.map((row) => columns.map((c) => escape(row[c])).join(',')),
  ].join('\n')
}

/** Auto-generate the initial chart set from the upload profile. */
function buildDefaultCharts(profile) {
  const charts = []
  const meta = profile.column_meta
  const categoricals = Object.entries(meta).filter(
    ([, m]) => m.type === 'categorical' && m.top_values?.length > 1,
  )
  const numerics = Object.entries(meta).filter(([, m]) => m.type === 'numeric')
  const dates = Object.entries(meta).filter(([, m]) => m.type === 'date')

  categoricals.slice(0, 2).forEach(([col, m], i) => {
    charts.push({
      id: `dist-${col}`,
      type: i === 0 ? 'bar' : 'pie',
      title: `${col.replace(/_/g, ' ')} distribution`,
      subtitle: 'row count per value (full dataset)',
      color: COLORS[charts.length % COLORS.length],
      data: m.top_values.map(([value, count]) => ({ x: String(value), y: count })),
    })
  })

  if (dates.length && numerics.length) {
    const [dateCol] = dates[0]
    const [numCol] = numerics[0]
    const series = profile.preview
      .filter((r) => r[dateCol] != null && r[numCol] != null)
      .map((r) => ({ x: String(r[dateCol]).slice(0, 10), y: Number(r[numCol]) }))
      .sort((a, b) => (a.x < b.x ? -1 : 1))
    if (series.length > 2) {
      charts.push({
        id: `trend-${numCol}`,
        type: 'area',
        title: `${numCol.replace(/_/g, ' ')} over ${dateCol.replace(/_/g, ' ')}`,
        subtitle: `first ${profile.preview.length} rows preview`,
        color: COLORS[charts.length % COLORS.length],
        data: series,
      })
    }
  }

  if (numerics.length >= 2) {
    const [[xCol], [yCol]] = numerics
    const pts = profile.preview
      .filter((r) => r[xCol] != null && r[yCol] != null)
      .map((r) => ({ x: Number(r[xCol]), y: Number(r[yCol]) }))
    if (pts.length > 2) {
      charts.push({
        id: `corr-${xCol}-${yCol}`,
        type: 'scatter',
        title: `${yCol.replace(/_/g, ' ')} vs ${xCol.replace(/_/g, ' ')}`,
        subtitle: `first ${profile.preview.length} rows preview`,
        color: COLORS[charts.length % COLORS.length],
        data: pts,
      })
    }
  }

  return charts
}

export default function Dashboard({ profile, onReset, theme, onToggleTheme }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [tabDirection, setTabDirection] = useState(1)
  const [filter, setFilter] = useState(EMPTY_FILTER)

  const changeTab = (next) => {
    if (next === activeTab) return
    setTabDirection(TAB_ORDER.indexOf(next) > TAB_ORDER.indexOf(activeTab) ? 1 : -1)
    setActiveTab(next)
  }
  const [charts, setCharts] = useState(() => buildDefaultCharts(profile))
  // Charts present at mount get the staggered reveal; later (AI) charts pop
  // in immediately.
  const initialChartCount = useRef(charts.length)
  const entranceDelay = (i) => (i < initialChartCount.current ? 0.4 + i * 0.08 : 0)

  const columns = useMemo(() => Object.keys(profile.column_meta), [profile])
  const filteredRows = useMemo(
    () => applyFilter(profile.preview, filter),
    [profile.preview, filter],
  )

  const deleteChart = (id) => {
    setCharts((cs) => cs.filter((c) => c.id !== id))
    toast('Chart removed', 'info', 2200)
  }

  /** Convert an AI tool payload (chart or forecast) into a ChartCard chart. */
  const addAiChart = (payload) => {
    toast(`📊 "${payload.title}" added to Charts`, 'tool')
    setCharts((cs) => {
      const id = `ai-${Date.now()}-${cs.length}`
      const color = COLORS[cs.length % COLORS.length]
      if (payload.type === 'forecast') {
        return [
          ...cs,
          {
            id,
            type: 'line',
            title: payload.title,
            subtitle: `✨ AI forecast · ${payload.periods} periods ahead`,
            color,
            data: payload.data.map((d) => ({ x: d.x, y: d.historical ?? d.forecast })),
            forecast: payload, // full payload kept for the confidence-band chart later
          },
        ]
      }
      return [
        ...cs,
        {
          id,
          type: payload.type,
          title: payload.title,
          subtitle: `✨ AI generated · ${payload.aggregation} of ${payload.y_column} by ${payload.x_column}`,
          color,
          data: payload.data,
        },
      ]
    })
  }

  const exportCsv = () => {
    const csv = rowsToCsv(filteredRows, columns)
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = profile.filename.replace(/\.[^.]+$/, '') + '_export.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast(`Exported ${filteredRows.length.toLocaleString()} rows to CSV`, 'success')
  }

  return (
    <div id="dashboard">
      <motion.div
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        // Above the chat widget (9998) so topbar controls stay clickable even
        // when the floating chat panel overlaps them on small viewports.
        style={{ position: 'sticky', top: 0, zIndex: 9999 }}
      >
        <Topbar
          profile={profile}
          activeTab={activeTab}
          onTabChange={changeTab}
          onExportCsv={exportCsv}
          onReset={onReset}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />
      </motion.div>
      <motion.div
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      >
        <FilterBar
          columns={columns}
          rows={profile.preview}
          filter={filter}
          onFilterChange={setFilter}
          totalShown={filteredRows.length}
        />
      </motion.div>

      <div className="main">
        <AnimatePresence mode="wait" custom={tabDirection}>
          <motion.div
            key={activeTab}
            custom={tabDirection}
            variants={tabVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeTab === 'overview' && (
              <>
                <div className="section-header">
                  <span className="section-title">Key Metrics</span>
                </div>
                <KpiGrid profile={profile} />
                {charts.length > 0 && (
                  <>
                    <div className="section-header" style={{ marginTop: '2rem' }}>
                      <span className="section-title">Highlights</span>
                    </div>
                    <div className="chart-grid">
                      {charts.slice(0, 2).map((chart, i) => (
                        <ChartCard
                          key={chart.id}
                          chart={chart}
                          entranceDelay={entranceDelay(i)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {activeTab === 'charts' && (
              <>
                <div className="section-header">
                  <span className="section-title">Charts</span>
                </div>
                {charts.length ? (
                  <div className="chart-grid">
                    <AnimatePresence>
                      {charts.map((chart, i) => (
                        <ChartCard
                          key={chart.id}
                          chart={chart}
                          onDelete={deleteChart}
                          entranceDelay={entranceDelay(i)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📊</div>
                    No charts yet — ask the AI analyst to create one.
                  </div>
                )}
              </>
            )}

            {activeTab === 'stats' && (
              <>
                <div className="section-header">
                  <span className="section-title">Column Statistics</span>
                </div>
                <StatsPanel profile={profile} />
              </>
            )}

            {activeTab === 'table' && (
              <>
                <div className="section-header">
                  <span className="section-title">Data Table</span>
                </div>
                <DataTable
                  rows={filteredRows}
                  columns={columns}
                  columnMeta={profile.column_meta}
                  totalRows={profile.rows}
                  onExport={exportCsv}
                />
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <ChatWidget
        sessionId={profile.session_id}
        profile={profile}
        onChart={addAiChart}
        onGoToCharts={() => changeTab('charts')}
      />
    </div>
  )
}
