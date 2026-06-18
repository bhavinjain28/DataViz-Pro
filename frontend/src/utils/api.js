import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const client = axios.create({ baseURL: BASE_URL })

/** Normalize backend {error, detail} payloads into a friendly Error. */
function toError(err) {
  const data = err.response?.data
  if (data?.error) {
    const e = new Error(data.detail || data.error)
    e.title = data.error
    return e
  }
  if (err.code === 'ERR_NETWORK') {
    return new Error('Cannot reach the server. Is the backend running?')
  }
  return new Error(err.message || 'Request failed')
}

/** POST /api/upload — returns the profile payload (session_id, column_meta, ...). */
export async function uploadFile(file) {
  const form = new FormData()
  form.append('file', file)
  try {
    const res = await client.post('/upload', form)
    return res.data
  } catch (err) {
    throw toError(err)
  }
}

/** URL for the SSE chat endpoint (consumed with fetch + ReadableStream). */
export const CHAT_STREAM_URL = `${BASE_URL}/chat/stream`

/**
 * Run a chat turn invisibly and return the accumulated text (used for the
 * suggestion-chip generation — the exchange never appears in the chat UI).
 */
export async function fetchChatText(sessionId, message) {
  const res = await fetch(CHAT_STREAM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, message, history: [] }),
  })
  if (!res.ok || !res.body) throw new Error(`Server responded ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data: ') || line.slice(6) === '[DONE]') continue
      try {
        const evt = JSON.parse(line.slice(6))
        if (evt.type === 'text') text += evt.content
      } catch {
        /* skip malformed lines */
      }
    }
  }
  return text
}
