import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PluginSlot from '../components/PluginSlot.jsx'

const WS_URL = (token) =>
  `ws://${window.location.host}/ws/player?token=${encodeURIComponent(token)}`

/**
 * PlayerView — the player's browser interface.
 *
 * Loaded at /player?token=<player_token> in any browser on the LAN.
 * Connects to the player WebSocket. Tokens rejected with code 4001
 * show a clear error screen rather than a blank page.
 */
export default function PlayerView() {
  const [searchParams] = useSearchParams()
  const playerToken = searchParams.get('token') ?? ''

  const [status, setStatus] = useState('connecting') // 'connecting' | 'connected' | 'rejected' | 'disconnected'
  const [playerName, setPlayerName] = useState(null)
  const [log, setLog] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)

  const wsRef = useRef(null)
  const logEndRef = useRef(null)

  // Auto-scroll chat log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  const appendLog = useCallback((entry) => {
    setLog((prev) => [...prev, { id: Date.now() + Math.random(), ...entry }])
  }, [])

  // WebSocket lifecycle
  useEffect(() => {
    if (!playerToken) {
      setStatus('rejected')
      return
    }

    const ws = new WebSocket(WS_URL(playerToken))
    wsRef.current = ws

    ws.onopen = () => {
      // Status will update on first server message or stay 'connecting' briefly
      appendLog({ type: 'system', text: 'Joining session…' })
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        switch (data.type) {
          case 'welcome':
            // Server echoes our name back when we connect
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
            appendLog({
              type: 'roll',
              sender: data.roller,
              text: `rolled ${data.result}`,
            })
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
            // Route custom plugin messages to the DOM so Web Components can catch them
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
        appendLog({ type: 'system', text: 'Disconnected from session.' })
      }
    }

    ws.onerror = () => {
      // onclose will fire after onerror and set the status
    }

    return () => {
      ws.close()
    }
  }, [playerToken, appendLog])

  // Bridge custom events from Web Components (plugins) to the WebSocket
  useEffect(() => {
    const handleSendWs = (event) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(event.detail))
      }
    }
    window.addEventListener('send-ws', handleSendWs)
    return () => window.removeEventListener('send-ws', handleSendWs)
  }, [])

  // Send chat message
  const sendChat = useCallback(() => {
    if (!chatInput.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'chat', message: chatInput.trim() }))
    setChatInput('')
  }, [chatInput])

  // --- Error: no token or rejected ---
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
    status === 'connected'
      ? 'badge-connected'
      : status === 'disconnected'
      ? 'badge-disconnected'
      : 'badge-waiting'

  const statusLabel =
    status === 'connected'
      ? 'Connected'
      : status === 'disconnected'
      ? 'Disconnected'
      : 'Connecting…'

  return (
    <div className="layout-full">
      {/* Top bar */}
      <div className="topbar">
        <span className="topbar-title">
          🎲 Open VTT{playerName ? ` — ${playerName}` : ''}
        </span>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '4px 8px', fontSize: '12px' }}
            onClick={() => setIsChatOpen(!isChatOpen)}
          >
            {isChatOpen ? 'Hide Chat' : 'Show Chat'}
          </button>
          <span className={`badge ${statusClass}`}>{statusLabel}</span>
        </div>
      </div>

      {/* Main layout */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Main Content: Plugin widgets */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <PluginSlot role="player" />
        </main>

        {/* Chat area (Floating Overlay) */}
        {isChatOpen && (
          <div className="absolute top-0 right-0 h-full w-80 bg-black/90 backdrop-blur-md border-l border-[#b38135]/30 flex flex-col shadow-[0_0_20px_rgba(0,0,0,0.8)] z-50 transition-transform">
            <div className="chat-log flex-1 overflow-y-auto p-4 flex flex-col gap-2" style={{ paddingBottom: '16px' }}>
              {log.map((entry) => (
                <div
                  key={entry.id}
                  className={`chat-message fade-in ${entry.type === 'roll' ? 'is-roll' : ''}`}
                >
                  <span
                    className={`chat-sender ${
                      entry.sender === 'DM' ? 'is-dm' : entry.type === 'system' ? 'is-system' : ''
                    }`}
                  >
                    {entry.type === 'system' ? 'System' : entry.sender}
                  </span>
                  <span className="chat-text">{entry.text}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>

            <div className="p-3 border-t border-[#b38135]/20 bg-[#080810] flex gap-2">
              <input
                type="text"
                placeholder="Send a message…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                className="flex-1 bg-black/50 border border-white/10 text-white p-2 rounded focus:outline-none focus:border-[#b38135] text-sm"
                disabled={status !== 'connected'}
              />
              <button
                className="btn btn-primary"
                onClick={sendChat}
                disabled={!chatInput.trim() || status !== 'connected'}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
