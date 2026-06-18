import NumberFlow from '@number-flow/react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Line, LineChart } from 'recharts'
import {
  COLORS, TYPE_LABELS, aggregateFor, fmtSmart, inferDisplayType, isIdentifierLike, tagClass,
} from '../utils/formatters.js'

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.2 } },
}
const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
}

/** NumberFlow counter: mounts at 0, rolls to the real value. */
function AnimatedValue({ raw, type, fallback }) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setValue(raw), 350)
    return () => clearTimeout(t)
  }, [raw])
  if (raw == null || typeof raw !== 'number') return fallback
  return (
    <NumberFlow
      value={value}
      prefix={type === 'currency' ? '$' : ''}
      suffix={type === 'percentage' ? '%' : ''}
      format={{ notation: 'compact', maximumFractionDigits: 1 }}
    />
  )
}

function KpiCard({ label, value, raw, sub, color, type, bar, spark }) {
  return (
    <motion.div
      className="kpi-card"
      variants={cardVariants}
      whileHover={{
        y: -4,
        scale: 1.02,
        boxShadow: `0 8px 32px rgba(0,0,0,.4), 0 0 20px ${color}59, 0 0 60px ${color}1f`,
        transition: { duration: 0.2, ease: 'easeOut' },
      }}
    >
      <div
        className="kpi-accent-bar"
        style={{ background: `linear-gradient(90deg, ${color}88, ${color}, ${color}88)` }}
      />
      <div className="kpi-orb" style={{ background: color }} />
      {type && (
        <div className={`kpi-type-tag ${tagClass(type)}`}>{TYPE_LABELS[type] || type}</div>
      )}
      <div className="kpi-label">{label}</div>
      <div
        className={`kpi-value${
          typeof raw !== 'number' && String(value).length >= 10 ? ' kpi-value-text' : ''
        }`}
        style={{ color }}
        title={typeof raw !== 'number' ? String(value) : undefined}
      >
        <AnimatedValue raw={raw} type={type} fallback={value} />
      </div>
      <div className="kpi-sub">{sub}</div>
      {bar && (
        <div className="kpi-range">
          <div className="kpi-range-track">
            <div
              className="kpi-range-fill"
              style={{ width: `${bar.pct}%`, background: color }}
            />
          </div>
          <div className="kpi-range-labels">
            <span>{bar.min}</span>
            <span>{bar.max}</span>
          </div>
        </div>
      )}
      {spark && (
        <div className="kpi-spark">
          <LineChart width={120} height={40} data={spark}>
            <Line
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive
              animationDuration={900}
            />
          </LineChart>
        </div>
      )}
    </motion.div>
  )
}

/** Build KPI cards from the backend profile (full-data stats). */
export function buildKpis(profile) {
  const cards = []
  const meta = profile.column_meta

  for (const kpi of profile.kpis) {
    if (isIdentifierLike(kpi.col)) continue // summing IDs is meaningless
    const type = inferDisplayType(kpi.col)
    const range = kpi.max - kpi.min
    // Intensive measures (temps, prices, rates…) average; additive ones total.
    const agg = aggregateFor(kpi.col)
    const headline = agg === 'mean' ? kpi.mean : kpi.sum
    const name = kpi.col.replace(/_/g, ' ')
    // Sparkline from the preview rows, chronological order (≥7 points).
    const series = profile.preview
      .map((r) => Number(r[kpi.col]))
      .filter(Number.isFinite)
      .slice(0, 40)
    cards.push({
      label: agg === 'mean' ? `Avg ${name}` : `Total ${name}`,
      value: fmtSmart(headline, type),
      raw: headline,
      sub:
        agg === 'mean'
          ? `${meta[kpi.col]?.null_count ?? 0} nulls`
          : `avg ${fmtSmart(kpi.mean, type)} · ${meta[kpi.col]?.null_count ?? 0} nulls`,
      type,
      bar: {
        pct: range > 0 ? Math.round(((kpi.mean - kpi.min) / range) * 100) : 50,
        min: fmtSmart(kpi.min, type),
        max: fmtSmart(kpi.max, type),
      },
      spark: series.length >= 7 ? series.map((v) => ({ v })) : null,
    })
  }

  for (const [col, m] of Object.entries(meta)) {
    if (cards.length >= 8) break
    if (m.type === 'categorical' && m.top_values?.length) {
      const [top, count] = m.top_values[0]
      cards.push({
        label: `Top ${col.replace(/_/g, ' ')}`,
        value: top,
        sub: `${m.unique_count} unique values · top has ${count}`,
        type: 'categorical',
      })
    } else if (m.type === 'date' && m.min) {
      cards.push({
        label: `${col.replace(/_/g, ' ')} range`,
        value: String(m.min).slice(0, 10),
        sub: `→ ${String(m.max).slice(0, 10)}`,
        type: 'date',
      })
    } else if (m.type === 'boolean' && m.top_values?.length) {
      const [top, count] = m.top_values[0]
      cards.push({
        label: col.replace(/_/g, ' '),
        value: String(top).toUpperCase(),
        sub: `${count} records`,
        type: 'boolean',
      })
    }
  }
  return cards
}

export default function KpiGrid({ profile }) {
  const cards = buildKpis(profile)
  if (!cards.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📭</div>
        No numeric or categorical columns detected.
      </div>
    )
  }
  return (
    <motion.div className="kpi-grid" variants={gridVariants} initial="hidden" animate="show">
      {cards.map((card, i) => (
        <KpiCard key={card.label} {...card} color={COLORS[i % COLORS.length]} />
      ))}
    </motion.div>
  )
}
