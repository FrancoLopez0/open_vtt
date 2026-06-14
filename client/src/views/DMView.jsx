import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PluginSlot from '../components/PluginSlot.jsx'

const WS_URL = (token) =>
  `ws://${window.location.host}/ws/host?token=${encodeURIComponent(token)}`

/**
 * DMView — the Dungeon Master's dashboard.
 *
 * Loaded exclusively inside the pywebview window at /dm?token=<host_token>.
 * Connects to the host WebSocket, manages players, and renders the DM plugin slot.
 */
export default function DMView() {
  const [searchParams] = useSearchParams()
  const hostToken = searchParams.get('token') ?? ''

  const [status, setStatus] = useState('disconnected') // 'connected' | 'disconnected' | 'error'
  const [log, setLog] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [players, setPlayers] = useState([])
  const [newPlayerName, setNewPlayerName] = useState('')
  const [creatingPlayer, setCreatingPlayer] = useState(false)

  const wsRef = useRef(null)
  const logEndRef = useRef(null)

  // Auto-scroll chat log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  // Append a message to the chat log
  const appendLog = useCallback((entry) => {
    setLog((prev) => [...prev, { id: Date.now() + Math.random(), ...entry }])
  }, [])

  // Fetch player list from REST API
  const fetchPlayers = useCallback(async () => {
    try {
      const res = await fetch('/api/players', {
        headers: { 'X-Host-Token': hostToken },
      })
      if (res.ok) setPlayers(await res.json())
    } catch {
      // silently retry on next event
    }
  }, [hostToken])

  // WebSocket lifecycle
  useEffect(() => {
    if (!hostToken) {
      setStatus('error')
      return
    }

    const ws = new WebSocket(WS_URL(hostToken))
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      appendLog({ type: 'system', text: 'Connected to game session.' })
      fetchPlayers()
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        switch (data.type) {
          case 'chat':
            appendLog({ type: 'chat', sender: data.sender, text: data.message })
            break
          case 'dice_roll':
            appendLog({
              type: data.secret ? 'secret' : 'roll',
              sender: data.roller,
              text: data.secret
                ? `[SECRET] rolled ${data.result}`
                : `rolled ${data.result}`,
            })
            break
          case 'player_connected':
          case 'player_disconnected':
            appendLog({
              type: 'system',
              text: `${data.name} ${data.type === 'player_connected' ? 'joined' : 'left'}.`,
            })
            fetchPlayers()
            break
          default:
            break
        }
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      setStatus('disconnected')
      appendLog({ type: 'system', text: 'Disconnected from game session.' })
    }

    ws.onerror = () => setStatus('error')

    return () => ws.close()
  }, [hostToken, appendLog, fetchPlayers])

  // Send chat message
  const sendChat = useCallback(() => {
    if (!chatInput.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'chat', message: chatInput.trim() }))
    setChatInput('')
  }, [chatInput])

  // Create a new player
  const createPlayer = useCallback(async () => {
    if (!newPlayerName.trim()) return
    setCreatingPlayer(true)
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Host-Token': hostToken,
        },
        body: JSON.stringify({ name: newPlayerName.trim() }),
      })
      if (res.ok) {
        setNewPlayerName('')
        fetchPlayers()
      }
    } finally {
      setCreatingPlayer(false)
    }
  }, [newPlayerName, hostToken, fetchPlayers])



  // --- Error: no token ---
  if (!hostToken) {
    return (
      <div className="error-screen">
        <h1>No Host Token</h1>
        <p>
          The DM window must be opened by the application. Restart Open VTT to get a
          valid session token.
        </p>
      </div>
    )
  }

  const statusClass =
    status === 'connected'
      ? 'badge-connected'
      : status === 'error'
      ? 'badge-disconnected'
      : 'badge-waiting'

  const statusLabel =
    status === 'connected' ? 'Connected' : status === 'error' ? 'Error' : 'Connecting…'

  return (
    <div className="layout-full">
      {/* Top bar */}
      <div className="topbar">
        <span className="topbar-title">⚔ Open VTT — Dungeon Master</span>
        <span className={`badge ${statusClass}`}>{statusLabel}</span>
      </div>

      {/* Main layout */}
      <div className="layout-sidebar" style={{ flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <aside className="sidebar">
          {/* Player Manager */}
          <div className="panel">
            <div className="panel-header">
              <h3>Players</h3>
            </div>

            {/* Create player form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              <input
                type="text"
                placeholder="Player name…"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createPlayer()}
              />
              <button
                className="btn btn-primary"
                onClick={createPlayer}
                disabled={creatingPlayer || !newPlayerName.trim()}
              >
                Add Player
              </button>
            </div>



            {/* Player list */}
            {players.length > 0 && (
              <div className="player-list" style={{ marginTop: 'var(--space-md)' }}>
                {players.map((p) => (
                  <div key={p.token} className="player-item fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="player-name">{p.name}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button 
                        className="btn btn-ghost" 
                        style={{ padding: '2px 6px', fontSize: 10 }}
                        onClick={() => navigator.clipboard.writeText(p.join_url)}
                        title="Copy Join Link"
                      >
                        Copy Link
                      </button>
                      <span className={`badge ${p.connected ? 'badge-connected' : 'badge-disconnected'}`}>
                        {p.connected ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Plugin widgets (DM role) */}
          <PluginSlot role="dm" />
        </aside>

        {/* Chat area */}
        <div className="layout-main">
          <div className="chat-log">
            {log.map((entry) => (
              <div
                key={entry.id}
                className={`chat-message fade-in ${
                  entry.type === 'roll' ? 'is-roll' : entry.type === 'secret' ? 'is-secret' : ''
                }`}
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

          <div className="chat-input-row">
            <input
              type="text"
              placeholder="Send a message…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              style={{ flex: 1 }}
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
      </div>
    </div>
  )
}
