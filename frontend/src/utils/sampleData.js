// Built-in e-commerce sample dataset (200 rows, full 2025 calendar year).
//
// Intentional patterns for the AI analyst to discover:
//   1. Q4 revenue spike (seasonal ramp, peaks in December)
//   2. South region consistently underperforms (~45% of the other regions)
//   3. Paid Social has a brutal CAC (~$140) vs Email (~$18) / Organic (~$6)
//   4. March profit margin collapses (~8%) vs the ~21% norm (COGS spike)
//   5. Churn anomaly: July churn_rate jumps to ~20% vs ~3.5% baseline
//
// Deterministic (seeded PRNG) so every demo tells the same story.

function mulberry32(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const REGIONS = ['North', 'South', 'East', 'West']
const CHANNELS = ['Email', 'Paid Social', 'Organic', 'Referral']
const CATEGORIES = ['Electronics', 'Fashion', 'Home', 'Beauty']

const UNIT_PRICE = { Electronics: 120, Fashion: 45, Home: 65, Beauty: 28 }
const BASE_UNITS = { Electronics: 90, Fashion: 130, Home: 75, Beauty: 150 }
const CAC = { Email: 18, 'Paid Social': 142, Organic: 6, Referral: 32 }

export function generateSampleRows(count = 200) {
  const rand = mulberry32(20250101)
  const rows = []

  for (let i = 0; i < count; i++) {
    // Spread rows evenly across 2025.
    const dayOfYear = Math.round((i * 363) / (count - 1))
    const date = new Date(Date.UTC(2025, 0, 1 + dayOfYear))
    const month = date.getUTCMonth() // 0-based
    const iso = date.toISOString().slice(0, 10)

    const region = REGIONS[Math.floor(rand() * 4)]
    const channel = CHANNELS[Math.floor(rand() * 4)]
    const category = CATEGORIES[Math.floor(rand() * 4)]

    // Pattern 1: seasonal ramp into Q4 (Oct +25%, Nov +45%, Dec +70%).
    const seasonal = [1, 0.95, 1, 1.02, 1, 1.05, 1.02, 1, 1.05, 1.25, 1.45, 1.7][month]
    // Pattern 2: South chronically weak.
    const regional = region === 'South' ? 0.45 : 0.95 + rand() * 0.15

    const units = Math.max(
      5,
      Math.round(BASE_UNITS[category] * seasonal * regional * (0.8 + rand() * 0.4)),
    )
    const revenue = +(units * UNIT_PRICE[category] * (0.92 + rand() * 0.16)).toFixed(2)

    // Pattern 4: March COGS spike crushes margin to ~8%; ~21% elsewhere.
    const cogsRatio = month === 2 ? 0.9 + rand() * 0.04 : 0.76 + rand() * 0.06
    const cogs = +(revenue * cogsRatio).toFixed(2)
    const profit = +(revenue - cogs).toFixed(2)

    // Pattern 3: CAC by channel with noise.
    const cac = +(CAC[channel] * (0.85 + rand() * 0.3)).toFixed(2)

    // Pattern 5: July churn anomaly.
    const churnBase = month === 6 ? 0.17 + rand() * 0.07 : 0.025 + rand() * 0.02
    const churn_rate = +churnBase.toFixed(4)

    rows.push({
      date: iso,
      region,
      channel,
      product_category: category,
      units_sold: units,
      revenue,
      cogs,
      profit,
      cac,
      churn_rate,
    })
  }
  return rows
}

export function generateSampleCsv() {
  const rows = generateSampleRows()
  const header = Object.keys(rows[0]).join(',')
  return [header, ...rows.map((r) => Object.values(r).join(','))].join('\n')
}
