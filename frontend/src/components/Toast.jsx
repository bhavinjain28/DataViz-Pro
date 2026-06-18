import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

// Tiny event bus so any module can fire a toast without prop-drilling.
const listeners = new Set()
let nextToastId = 1

/** toast('CSV exported', 'success' | 'error' | 'info' | 'tool', ms?) */
export function toast(message, type = 'info', duration = 3200) {
  const item = { id: nextToastId++, message, type, duration }
  listeners.forEach((fn) => fn(item))
}

const STYLES = {
  success: { icon: '✅', color: '#43e97b', border: 'rgba(67, 233, 123, 0.3)' },
  error:   { icon: '❌', color: '#ff6584', border: 'rgba(255, 101, 132, 0.3)' },
  info:    { icon: '💡', color: '#6c63ff', border: 'rgba(108, 99, 255, 0.3)' },
  tool:    { icon: '⚙️', color: '#f7971e', border: 'rgba(247, 151, 30, 0.3)' },
}

export default function Toasts() {
  const [items, setItems] = useState([])

  useEffect(() => {
    const add = (item) => {
      setItems((ts) => [...ts, item])
      setTimeout(
        () => setItems((ts) => ts.filter((t) => t.id !== item.id)),
        item.duration,
      )
    }
    listeners.add(add)
    return () => listeners.delete(add)
  }, [])

  return (
    <div className="toast-stack">
      <AnimatePresence>
        {items.map((t) => {
          const s = STYLES[t.type] || STYLES.info
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 48, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 48, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="toast-item"
              style={{
                borderColor: s.border,
                boxShadow: `0 8px 32px rgba(0,0,0,.5), 0 0 20px ${s.color}26`,
              }}
            >
              <span>{s.icon}</span>
              <span className="toast-msg">{t.message}</span>
              <motion.div
                className="toast-progress"
                style={{ background: s.color }}
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: t.duration / 1000, ease: 'linear' }}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
