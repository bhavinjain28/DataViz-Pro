import { AnimatePresence, motion } from 'framer-motion'

/** Theme toggle with spring rotation + icon swap (animations spec, step 15). */
export default function ThemeToggle({ id, theme, onToggle }) {
  return (
    <motion.button
      id={id}
      title="Toggle light/dark mode"
      onClick={onToggle}
      whileHover={{ rotate: 20, scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={theme}
          initial={{ rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          exit={{ rotate: 90, opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'inline-block' }}
        >
          {theme === 'dark' ? '🌙' : '☀️'}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}
