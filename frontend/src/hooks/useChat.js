import { useCallback, useEffect, useRef, useState } from 'react'
import { CHAT_STREAM_URL } from '../utils/api.js'

let nextId = 1

/**
 * SSE streaming chat against POST /api/chat/stream.
 *
 * Message shape:
 *   { id, role: 'user'|'assistant', content, tools: [{tool, description,
 *     detail, done, ok}], charts: n, error?, streaming? }
 */
export default function useChat({ sessionId, onChart }) {
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef(null)
  const onChartRef = useRef(onChart)
  onChartRef.current = onChart

  useEffect(() => () => abortRef.current?.abort(), [])

  /** Update the in-flight assistant message in place. */
  const patchAssistant = (id, fn) => {
    setMessages((msgs) => msgs.map((m) => (m.id === id ? fn(m) : m)))
  }

  const sendMessage = useCallback(
    async (text, opts = {}) => {
      const trimmed = text.trim()
      if (!trimmed || abortRef.current) return

      const history = []
      setMessages((msgs) => {
        for (const m of msgs) {
          if (m.content.trim()) history.push({ role: m.role, content: m.content })
        }
        return msgs
      })

      // hidden: the prompt participates in history but never renders
      // (used for the automatic post-upload analysis).
      const userMsg = { id: nextId++, role: 'user', content: trimmed, hidden: opts.hidden }
      const botId = nextId++
      const botMsg = {
        id: botId, role: 'assistant', content: '', tools: [], charts: 0, streaming: true,
      }
      setMessages((msgs) => [...msgs, userMsg, botMsg])
      setIsStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch(CHAT_STREAM_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            message: trimmed,
            history: history.slice(-10),
          }),
          signal: controller.signal,
        })
        if (!res.ok || !res.body) {
          throw new Error(`Server responded ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() // keep the partial trailing line

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const body = line.slice(6)
            if (body === '[DONE]') continue

            let evt
            try {
              evt = JSON.parse(body)
            } catch {
              continue
            }

            switch (evt.type) {
              case 'text':
                patchAssistant(botId, (m) => ({ ...m, content: m.content + evt.content }))
                break
              case 'tool_start':
                patchAssistant(botId, (m) => ({
                  ...m,
                  tools: [
                    ...m.tools,
                    {
                      tool: evt.tool,
                      description: evt.description,
                      detail: evt.detail,
                      done: false,
                      ok: true,
                    },
                  ],
                }))
                break
              case 'tool_done':
                patchAssistant(botId, (m) => {
                  const tools = [...m.tools]
                  for (let i = tools.length - 1; i >= 0; i--) {
                    if (tools[i].tool === evt.tool && !tools[i].done) {
                      tools[i] = { ...tools[i], done: true, ok: evt.ok }
                      break
                    }
                  }
                  return { ...m, tools }
                })
                break
              case 'chart_data':
                onChartRef.current?.(evt.data)
                patchAssistant(botId, (m) => ({ ...m, charts: m.charts + 1 }))
                break
              case 'error':
                patchAssistant(botId, (m) => ({ ...m, error: evt.content }))
                break
              default:
                break
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          patchAssistant(botId, (m) => ({
            ...m,
            error: m.error || 'Connection lost — is the backend running?',
          }))
        }
      } finally {
        patchAssistant(botId, (m) => ({ ...m, streaming: false }))
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [sessionId],
  )

  const resetChat = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setMessages([])
    setIsStreaming(false)
  }, [])

  return { messages, isStreaming, sendMessage, resetChat }
}
