// Shown via <Suspense> while the (lazy-loaded) Dashboard + Recharts chunk
// downloads. Matches the real layout so the swap is seamless.
export default function DashboardSkeleton() {
  return (
    <div id="dashboard">
      <div className="topbar">
        <div className="topbar-left">
          <div className="logo-sm">⚡ DataViz Pro</div>
          <div className="skeleton" style={{ width: 220, height: 28, borderRadius: 8 }} />
        </div>
        <div className="topbar-right">
          <div className="skeleton" style={{ width: 260, height: 36, borderRadius: 12 }} />
          <div className="skeleton" style={{ width: 70, height: 32, borderRadius: 9 }} />
          <div className="skeleton" style={{ width: 90, height: 32, borderRadius: 9 }} />
        </div>
      </div>

      <div className="filter-bar">
        <div className="skeleton" style={{ width: 210, height: 30, borderRadius: 8 }} />
        <div className="skeleton" style={{ width: 130, height: 30, borderRadius: 8 }} />
      </div>

      <div className="main">
        <div className="section-header">
          <span className="section-title">Key Metrics</span>
        </div>
        <div className="kpi-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="kpi-card" style={{ gap: '0.7rem' }}>
              <div className="skeleton" style={{ width: 70, height: 16, borderRadius: 99 }} />
              <div className="skeleton" style={{ width: '60%', height: 30, borderRadius: 8 }} />
              <div className="skeleton" style={{ width: '85%', height: 12, borderRadius: 99 }} />
              <div className="skeleton" style={{ width: '100%', height: 40, borderRadius: 8, marginTop: 8 }} />
            </div>
          ))}
        </div>

        <div className="section-header" style={{ marginTop: '2rem' }}>
          <span className="section-title">Highlights</span>
        </div>
        <div className="chart-grid">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="chart-card" style={{ gap: '1rem' }}>
              <div className="skeleton" style={{ width: '50%', height: 18, borderRadius: 8 }} />
              <div className="skeleton" style={{ width: '100%', height: 230, borderRadius: 12 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
