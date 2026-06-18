import { AnimatePresence, motion } from 'framer-motion'
import { lazy, Suspense, useEffect, useState } from 'react'
import DashboardSkeleton from './components/DashboardSkeleton.jsx'
import Toasts from './components/Toast.jsx'
import UploadScreen from './components/UploadScreen.jsx'

// Code-split the chart-heavy dashboard (Recharts ~280KB) — the skeleton
// fills the chunk download.
const Dashboard = lazy(() => import('./components/Dashboard.jsx'))

export default function App() {
  const [profile, setProfile] = useState(null) // upload response incl. session_id
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light')
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  // Upload screen slides up and blurs out; dashboard rises in — the app
  // "opens up" (animations spec, step 16).
  return (
    <>
      <Toasts />
      <AnimatePresence mode="wait">
      {!profile ? (
        <motion.div
          key="upload"
          exit={{
            opacity: 0,
            scale: 0.97,
            y: -32,
            filter: 'blur(8px)',
            transition: { duration: 0.4, ease: [0.4, 0, 1, 1] },
          }}
        >
          <UploadScreen onLoaded={setProfile} theme={theme} onToggleTheme={toggleTheme} />
        </motion.div>
      ) : (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0, y: 32, scale: 1.02 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <Suspense fallback={<DashboardSkeleton />}>
            <Dashboard
              profile={profile}
              onReset={() => setProfile(null)}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
          </Suspense>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  )
}
