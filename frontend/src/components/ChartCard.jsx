import { motion } from 'framer-motion'
import { useState } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart,
  Pie, PieChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts'
import { COLORS, fmtSmart } from '../utils/formatters.js'

const TYPE_OPTIONS = ['bar', 'line', 'area', 'pie', 'scatter']

function GlassTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: 'rgba(13, 15, 26, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(108, 99, 255, 0.25)',
        borderRadius: 12,
        padding: '10px 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,.5), 0 0 20px rgba(108,99,255,.1)',
      }}
    >
      <div style={{ color: 'var(--text2)', fontSize: 11, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color || 'var(--accent)', fontWeight: 700, fontSize: 14 }}>
          {typeof p.value === 'number' ? fmtSmart(p.value) : String(p.value)}
        </div>
      ))}
    </div>
  )
}

const axisProps = {
  tick: { fill: 'var(--text2)', fontSize: 11 },
  tickLine: false,
}

function renderChart(type, data, color, gradId) {
  const xAxis = (
    <XAxis dataKey="x" {...axisProps} axisLine={{ stroke: 'rgba(255,255,255,.05)' }} />
  )
  const yAxis = <YAxis {...axisProps} axisLine={false} tickFormatter={(v) => fmtSmart(v)} width={52} />
  const grid = <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,.04)" vertical={false} />

  switch (type) {
    case 'line':
      return (
        <LineChart data={data}>
          {grid}{xAxis}{yAxis}
          <Tooltip content={<GlassTooltip />} />
          <Line
            type="monotone" dataKey="y" stroke={color} strokeWidth={2.5}
            dot={{ fill: color, strokeWidth: 0, r: 3 }} activeDot={{ r: 6, fill: color }}
            isAnimationActive animationDuration={1000} animationEasing="ease-out"
          />
        </LineChart>
      )
    case 'area':
      return (
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {grid}{xAxis}{yAxis}
          <Tooltip content={<GlassTooltip />} />
          <Area
            type="monotone" dataKey="y" stroke={color} strokeWidth={2.5}
            fill={`url(#${gradId})`} dot={{ fill: color, strokeWidth: 0, r: 3 }}
            activeDot={{ r: 6, fill: color }}
            isAnimationActive animationDuration={1000} animationEasing="ease-out"
          />
        </AreaChart>
      )
    case 'pie':
      return (
        <PieChart>
          <Tooltip content={<GlassTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: 'var(--text2)' }}
            formatter={(v) => <span style={{ color: 'var(--text2)' }}>{v}</span>}
          />
          <Pie
            data={data} dataKey="y" nameKey="x" innerRadius="52%" outerRadius="78%"
            paddingAngle={3} stroke="none"
            isAnimationActive animationDuration={800}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      )
    case 'scatter':
      return (
        <ScatterChart>
          {grid}
          <XAxis dataKey="x" {...axisProps} axisLine={{ stroke: 'rgba(255,255,255,.05)' }} name="x" />
          <YAxis dataKey="y" {...axisProps} axisLine={false} tickFormatter={(v) => fmtSmart(v)} width={52} name="y" />
          <Tooltip content={<GlassTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={data} fill={color} isAnimationActive animationDuration={800} />
        </ScatterChart>
      )
    default: // bar
      return (
        <BarChart data={data}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.9} />
              <stop offset="100%" stopColor={color} stopOpacity={0.2} />
            </linearGradient>
          </defs>
          {grid}{xAxis}{yAxis}
          <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(108,99,255,.06)' }} />
          <Bar
            dataKey="y" fill={`url(#${gradId})`} radius={[6, 6, 0, 0]}
            isAnimationActive animationDuration={800} animationEasing="ease-out"
          />
        </BarChart>
      )
  }
}

/**
 * Prophet forecast: historical solid line, forecast dashed, shaded confidence
 * band between yhat_lower/yhat_upper, and a "Today" reference line.
 */
function renderForecast(payload, color, gradId) {
  const summary = payload.summary || {}
  const todayLabel = summary.last_actual_date
  // Bridge the gap so the dashed forecast line starts where history ends.
  const rows = payload.data.map((d) => ({
    x: d.x,
    historical: d.historical ?? null,
    forecast: d.forecast ?? null,
    lower: d.confidence_lower ?? null,
    band:
      d.confidence_upper != null && d.confidence_lower != null
        ? d.confidence_upper - d.confidence_lower
        : null,
  }))
  const lastHist = [...rows].reverse().find((r) => r.historical != null)
  if (lastHist) lastHist.forecast = lastHist.historical

  return (
    <ComposedChart data={rows}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0.04} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,.04)" vertical={false} />
      <XAxis dataKey="x" tick={{ fill: 'var(--text2)', fontSize: 11 }} tickLine={false}
        axisLine={{ stroke: 'rgba(255,255,255,.05)' }} minTickGap={28} />
      <YAxis tick={{ fill: 'var(--text2)', fontSize: 11 }} tickLine={false} axisLine={false}
        tickFormatter={(v) => fmtSmart(v)} width={52} />
      <Tooltip content={<GlassTooltip />} />
      {/* Confidence band: invisible base + stacked band height */}
      <Area dataKey="lower" stackId="band" stroke="none" fill="transparent"
        isAnimationActive={false} activeDot={false} legendType="none" />
      <Area dataKey="band" stackId="band" stroke="none" fill={`url(#${gradId})`}
        isAnimationActive animationDuration={900} activeDot={false} legendType="none" />
      <Line type="monotone" dataKey="historical" stroke={color} strokeWidth={2.5}
        dot={false} connectNulls isAnimationActive animationDuration={1000} />
      <Line type="monotone" dataKey="forecast" stroke={color} strokeWidth={2}
        strokeDasharray="6 4" strokeOpacity={0.75} dot={false} connectNulls
        isAnimationActive animationDuration={1000} />
      {todayLabel && (
        <ReferenceLine x={todayLabel} stroke="rgba(247,151,30,.6)" strokeDasharray="4 4"
          label={{ value: 'Today', fill: '#f7971e', fontSize: 11, position: 'insideTopRight' }} />
      )}
    </ComposedChart>
  )
}

/**
 * chart: { id, type, title, subtitle?, data: [{x, y}], color?, forecast? }
 * AI-generated charts (from chat tool results) use the same shape.
 * entranceDelay staggers the initial dashboard reveal; AI charts mount with 0.
 */
export default function ChartCard({ chart, onDelete, entranceDelay = 0 }) {
  const [type, setType] = useState(chart.type)
  const [expanded, setExpanded] = useState(false)
  const color = chart.color || COLORS[0]
  const gradId = `grad-${chart.id}`
  const isForecast = !!chart.forecast

  return (
    <motion.div
      className="chart-card"
      style={expanded ? { gridColumn: '1 / -1' } : undefined}
      initial={{ opacity: 0, scale: 0.96, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: entranceDelay }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      layout
    >
      <div className="chart-card-header">
        <div>
          <div className="chart-title">{chart.title}</div>
          {chart.subtitle && <div className="chart-subtitle">{chart.subtitle}</div>}
        </div>
        <div className="chart-actions">
          {!isForecast &&
            TYPE_OPTIONS.map((t) => (
              <button
                key={t}
                className={`btn-chart-action${type === t ? ' active' : ''}`}
                title={t}
                onClick={() => setType(t)}
              >
                {{ bar: '▮', line: '╱', area: '◢', pie: '◔', scatter: '∴' }[t]}
              </button>
            ))}
          <button className="btn-chart-action" title="Expand" onClick={() => setExpanded((e) => !e)}>
            {expanded ? '⤡' : '⤢'}
          </button>
          {onDelete && (
            <button className="btn-chart-action" title="Remove" onClick={() => onDelete(chart.id)}>
              ✕
            </button>
          )}
        </div>
      </div>
      <div className="chart-container" style={expanded ? { height: 380 } : undefined}>
        <ResponsiveContainer width="100%" height="100%">
          {isForecast
            ? renderForecast(chart.forecast, color, gradId)
            : renderChart(type, chart.data, color, gradId)}
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
