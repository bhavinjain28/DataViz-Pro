import { motion } from 'framer-motion'
import ThemeToggle from './ThemeToggle.jsx'

const TABS = [
  { id: 'overview', label: '📈 Overview' },
  { id: 'charts', label: '📊 Charts' },
  { id: 'stats', label: '🔬 Stats' },
  { id: 'table', label: '📋 Table' },
]

export default function Topbar({
  profile,
  activeTab,
  onTabChange,
  onExportCsv,
  onReset,
  theme,
  onToggleTheme,
}) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="logo-sm">⚡ DataViz Pro</div>
        <div className="file-info">
          <span>{profile.filename}</span> · {profile.rows.toLocaleString()} rows ·{' '}
          {profile.cols} cols
        </div>
      </div>
      <div className="topbar-right">
        <div className="tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="tab-indicator"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
        <motion.button
          className="btn-sm btn-secondary"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onExportCsv}
        >
          ⬇ CSV
        </motion.button>
        <motion.button
          className="btn-sm btn-danger"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onReset}
        >
          ↩ New File
        </motion.button>
        <ThemeToggle id="theme-toggle" theme={theme} onToggle={onToggleTheme} />
      </div>
    </div>
  )
}
