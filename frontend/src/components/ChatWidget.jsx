import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import useChat from '../hooks/useChat.js'
import { fetchChatText } from '../utils/api.js'
import { downloadReport } from '../utils/reportExport.js'
import { toast } from './Toast.jsx'

const ANALYZE_PROMPT =
  'Analyze this dataset and give me exactly 3 business insights in bullet points. ' +
  'Be specific with numbers — run queries to verify. End with one recommended action.'

const SUGGEST_PROMPT =
  'Given the columns in this dataset, suggest exactly 3 short, specific questions a ' +
  'business analyst would ask. Do not use any tools. Return ONLY a JSON array of 3 strings.'

/** Pull a JSON string array out of a model reply, defensively. */
function parseSuggestions(text) {
  const match = text.match(/\[[\s\S]*?\]/)
  if (!match) return []
  try {
    const arr = JSON.parse(match[0])
    return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string').slice(0, 3) : []
  } catch {
    return []
  }
}

// Sessions that already ran auto-analysis (survives StrictMode remounts).
const analyzedSessions = new Set()

const TOOL_LABELS = {
  run_dataframe_query: 'Running query',
  run_sql_query: 'Running SQL',
  generate_chart_data: 'Building chart',
  run_forecast: 'Running forecast',
  detect_anomalies: 'Scanning for anomalies',
}

/** Minimal markdown: **bold**, `code`, bullet lines, paragraphs. */
function renderMarkdown(text) {
  const renderInline = (line, key) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean)
    return (
      <span key={key}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i}>{part.slice(2, -2)}</strong>
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={i}>{part.slice(1, -1)}</code>
          }
          return part
        })}
      </span>
    )
  }

  return text.split('\n').map((line, i) => {
    const bullet = /^\s*[-•]\s+/.test(line)
    return (
      <div key={i} style={bullet ? { paddingLeft: 14, textIndent: -10 } : undefined}>
        {bullet ? '• ' : null}
        {renderInline(line.replace(/^\s*[-•]\s+/, ''), i)}
        {line === '' ? ' ' : null}
      </div>
    )
  })
}

function ToolPill({ tool }) {
  if (!tool.done) {
    return (
      <div className="tool-pill">
        <span className="gear">⚙️</span>
        <span>{tool.description || TOOL_LABELS[tool.tool] || tool.tool}…</span>
        <span className="tool-dots"><i /><i /><i /></span>
      </div>
    )
  }
  return (
    <details className="code-pill" data-failed={String(!tool.ok)}>
      <summary>
        {tool.ok ? '✓' : '✗'} Ran: {tool.description || TOOL_LABELS[tool.tool] || tool.tool}
        {tool.detail ? ' ▾' : ''}
      </summary>
      {tool.detail && <pre>{tool.detail}</pre>}
    </details>
  )
}

const bubbleEntrance = {
  initial: { opacity: 0, y: 12, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
}

function Message({ msg, onGoToCharts }) {
  if (msg.role === 'user') {
    return (
      <motion.div className="chat-msg chat-user" {...bubbleEntrance}>
        <div className="chat-bubble chat-bubble-user">{msg.content}</div>
      </motion.div>
    )
  }
  const waiting = msg.streaming && !msg.content && !msg.tools.length && !msg.error
  return (
    <motion.div className="chat-msg chat-bot" {...bubbleEntrance}>
      {msg.tools.map((tool, i) => (
        <ToolPill key={i} tool={tool} />
      ))}
      {waiting && (
        <div className="typing-dots"><span /><span /><span /></div>
      )}
      {msg.content && (
        <div className="chat-bubble chat-bubble-bot">
          {renderMarkdown(msg.content)}
          {msg.streaming && <span className="stream-cursor" />}
        </div>
      )}
      {msg.charts > 0 && (
        <button className="chart-link" onClick={onGoToCharts}>
          📊 Added to Charts tab →
        </button>
      )}
      {msg.error && <div className="chat-error">⚠ {msg.error}</div>}
    </motion.div>
  )
}

export default function ChatWidget({ sessionId, profile, onChart, onGoToCharts }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [seen, setSeen] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const { messages, isStreaming, sendMessage } = useChat({ sessionId, onChart })
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-analysis: once per session, open the panel, stream 3 insights, and
  // fetch suggestion chips in parallel.
  useEffect(() => {
    if (!sessionId || analyzedSessions.has(sessionId)) return
    const timer = setTimeout(() => {
      // Marked when the timer fires (not when scheduled) so StrictMode's
      // mount→cleanup→remount cycle doesn't swallow the one real run.
      if (analyzedSessions.has(sessionId)) return
      analyzedSessions.add(sessionId)
      setOpen(true)
      sendMessage(ANALYZE_PROMPT, { hidden: true })
      fetchChatText(sessionId, SUGGEST_PROMPT)
        .then((text) => setSuggestions(parseSuggestions(text)))
        .catch(() => {})
    }, 600)
    return () => clearTimeout(timer)
  }, [sessionId, sendMessage])

  // Pin the message list to the bottom as content streams in.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(() => {
    if (open) {
      setSeen(true)
      inputRef.current?.focus()
    }
  }, [open])

  const submit = (text) => {
    const value = (text ?? draft).trim()
    if (!value || isStreaming) return
    setDraft('')
    sendMessage(value)
  }

  const showChips = suggestions.length > 0 && !isStreaming

  return (
    <div id="chat-widget" className={open ? 'chat-open' : ''}>
      <AnimatePresence>
        {!open && (
          <motion.button
            key="toggle"
            id="chat-toggle"
            title="Ask about your data"
            onClick={() => setOpen(true)}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.08, rotate: -5 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            💬
            {!seen && <span className="chat-pulse-dot" />}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            id="chat-panel"
            style={{ display: 'flex' }}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div id="chat-header">
          <span className="chat-header-title">
            ✨ AI Analyst
            <span className="chat-badge">Powered by Claude</span>
          </span>
          <div className="chat-header-actions">
            <button
              id="chat-export"
              title="Export analysis report"
              onClick={() => {
                downloadReport({ profile, messages })
                toast('Analysis report downloaded', 'success')
              }}
            >
              ⬇
            </button>
            <button id="chat-close" onClick={() => setOpen(false)}>✕</button>
          </div>
        </div>

        <div id="chat-messages" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="chat-msg chat-bot">
              <div className="chat-bubble chat-bubble-bot">
                Hi! I can run real queries, build charts, forecast trends, and find
                anomalies in your data. Ask me anything.
              </div>
            </div>
          )}
          {messages
            .filter((msg) => !msg.hidden)
            .map((msg) => (
              <Message key={msg.id} msg={msg} onGoToCharts={onGoToCharts} />
            ))}
          {showChips && (
            <div className="chip-row">
              {suggestions.map((chip, i) => (
                <motion.button
                  key={chip}
                  className="chip"
                  onClick={() => submit(chip)}
                  initial={{ opacity: 0, scale: 0.9, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                  whileHover={{ scale: 1.04, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {chip}
                </motion.button>
              ))}
            </div>
          )}
        </div>

        <div id="chat-input-bar">
          <input
            id="chat-input"
            ref={inputRef}
            type="text"
            placeholder="Ask about your data..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <motion.button
            id="chat-send"
            onClick={() => submit()}
            disabled={isStreaming || !draft.trim()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
          >
            ➤
          </motion.button>
        </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
