import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PluginSlot from '../components/PluginSlot.jsx'

const WS_URL = (token: string) =>
  `ws://${window.location.host}/ws/player?token=${encodeURIComponent(token)}`

export default function PlayerView() {
  const [searchParams] = useSearchParams()
  const playerToken = searchParams.get('token') ?? ''

  const [status, setStatus] = useState('connecting')
  const [playerName, setPlayerName] = useState<string | null>(null)
  const [log, setLog] = useState<any[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const messageQueue = useRef<any[]>([])
  const logEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  const appendLog = useCallback((entry: any) => {
    setLog((prev) => [...prev, { id: Date.now() + Math.random(), ...entry }])
  }, [])

  // ── WebSocket lifecycle ───────────────────────────────────────────────
  useEffect(() => {
    if (!playerToken) {
      setStatus('rejected')
      return
    }

    let ws: WebSocket | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      ws = new WebSocket(WS_URL(playerToken))
      wsRef.current = ws

      ws.onopen = () => {
        setStatus('connected')
        appendLog({ type: 'system', text: 'Connected to game session.' })
        while (messageQueue.current.length > 0) {
          ws!.send(JSON.stringify(messageQueue.current.shift()))
        }
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          switch (data.type) {
            case 'welcome':
              setStatus('connected')
              setPlayerName(data.name)
              appendLog({ type: 'system', text: `You joined as ${data.name}.` })
              break
            case 'player_connected':
              appendLog({ type: 'system', text: `${data.name} joined the session.` })
              break
            case 'chat':
              appendLog({ type: 'chat', sender: data.sender, text: data.message })
              break
            case 'dice_roll':
              appendLog({ type: 'roll', sender: data.roller, text: `rolled ${data.result}` })
              break
            case 'host_connected':
              appendLog({ type: 'system', text: 'The Dungeon Master has entered the session.' })
              break
            case 'host_disconnected':
              appendLog({ type: 'system', text: 'The Dungeon Master disconnected.' })
              break
            case 'player_disconnected':
              appendLog({ type: 'system', text: `${data.name} left the session.` })
              break
            case 'plugin_message':
              window.dispatchEvent(new CustomEvent('plugin-message', { detail: data }))
              break
            default:
              break
          }
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = (event) => {
        if (event.code === 4001) {
          setStatus('rejected')
        } else {
          setStatus('disconnected')
          appendLog({ type: 'system', text: 'Disconnected. Reconnecting in 3s…' })
          reconnectTimeout = setTimeout(() => {
            setStatus('connecting')
            connect()
          }, 3000)
        }
      }

      ws.onerror = () => setStatus('error')
    }

    connect()

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (ws) ws.close()
      wsRef.current = null
    }
  }, [playerToken, appendLog])

  // ── Expose WS for plugins via custom event ────────────────────────────
  useEffect(() => {
    const handleSendWs = (event: any) => {
      if (!wsRef.current) return
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(event.detail))
      } else if (wsRef.current.readyState === WebSocket.CONNECTING) {
        messageQueue.current.push(event.detail)
      }
    }
    window.addEventListener('send-ws', handleSendWs)
    return () => window.removeEventListener('send-ws', handleSendWs)
  }, [])

  const sendChat = useCallback(() => {
    if (!chatInput.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'chat', message: chatInput.trim() }))
    setChatInput('')
  }, [chatInput])

  if (!playerToken || status === 'rejected') {
    return (
      <div className="error-screen">
        <h1>Invalid Token</h1>
        <p>
          This link is not valid or has expired.
          <br />
          Ask your Dungeon Master for a new join link.
        </p>
      </div>
    )
  }

  const statusClass =
    status === 'connected' ? 'badge-connected' :
    status === 'disconnected' ? 'badge-disconnected' : 'badge-waiting'
  const statusLabel =
    status === 'connected' ? 'Connected' :
    status === 'disconnected' ? 'Disconnected' : 'Connecting…'

  return (
    <div className="layout-full">
      {/* Top bar */}
      <div className="topbar">
        <span className="topbar-title">
          🎲 Open VTT{playerName ? ` — ${playerName}` : ''}
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px 10px', fontSize: '11px' }}
            onClick={() => setIsChatOpen(!isChatOpen)}
          >
            {isChatOpen ? 'Hide Chat' : '💬 Chat'}
          </button>
          <span className={`badge ${statusClass}`}>{statusLabel}</span>
        </div>
      </div>

      {/* Main layout */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Plugin area — the active plugin (core_rpg or custom) owns this space */}
        <main className="flex-1 overflow-y-auto p-4">
          <PluginSlot role="player" />
        </main>

        {/* Chat overlay */}
        {isChatOpen && (
          <div className="chat-overlay">
            <div className="chat-log flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {log.map((entry) => (
                <div key={entry.id} className={`chat-message fade-in ${entry.type === 'roll' ? 'is-roll' : ''}`}>
                  <span className={`chat-sender ${entry.sender === 'DM' ? 'is-dm' : entry.type === 'system' ? 'is-system' : ''}`}>
                    {entry.type === 'system' ? 'System' : entry.sender}
                  </span>
                  <span className="chat-text">{entry.text}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
            <div className="p-3 flex gap-2" style={{ borderTop: '1px solid rgba(179,129,53,0.2)', backgroundColor: '#06060e' }}>
              <input
                type="text"
                placeholder="Send a message…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                className="flex-1"
                disabled={status !== 'connected'}
              />
              <button className="btn btn-primary" onClick={sendChat} disabled={!chatInput.trim() || status !== 'connected'}>
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
