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
  const [isChatOpen, setIsChatOpen] = useState(false)
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

    ws.onclose = () => {
      setStatus('disconnected')
      appendLog({ type: 'system', text: 'Disconnected from game session.' })
    }

    ws.onerror = () => setStatus('error')

    return () => {
      ws.close()
    }
  }, [hostToken, appendLog, fetchPlayers])

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
        <span className="topbar-title text-amber-400 font-bold tracking-wider">⚔ Open VTT — Dungeon Master</span>
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
        
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-8">
          
          {/* Player Grid Section */}
          <section>
            <h2 className="text-xl font-cinzel text-[#e8c46a] uppercase tracking-widest border-b border-[#b38135]/30 pb-2 mb-4">Player Grid</h2>
            
            {/* Add Player */}
            <div className="flex gap-2 mb-6 max-w-md">
              <input
                type="text"
                placeholder="New Player name…"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createPlayer()}
                className="flex-1 bg-black/50 border border-white/10 text-white p-2 rounded focus:outline-none focus:border-[#b38135] text-sm"
              />
              <button
                className="btn btn-primary"
                onClick={createPlayer}
                disabled={creatingPlayer || !newPlayerName.trim()}
              >
                Add Player
              </button>
            </div>

            {/* Players Grid */}
            {players.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {players.map((p) => (
                  <div key={p.token} className="bg-[#13131f] border border-[#b38135]/30 p-4 rounded-xl flex flex-col gap-2 shadow-lg relative">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-lg text-white">{p.name}</span>
                      <span className={`badge ${p.connected ? 'badge-connected' : 'badge-disconnected'}`}>
                        {p.connected ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    
                    {/* Placeholder for future HP bars or plugin state */}
                    <div className="text-xs text-white/50 italic mb-2">
                      (Character sheet data will appear in the Table section below)
                    </div>

                    <div className="mt-auto pt-3 flex justify-between items-center border-t border-white/5">
                      <button 
                        className="btn btn-ghost text-xs py-1 px-2"
                        onClick={() => navigator.clipboard.writeText(p.join_url)}
                      >
                        Copy Join Link
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-white/40 italic text-sm">No players added yet.</div>
            )}
          </section>

          {/* Plugin Widgets Area */}
          <section>
            <h2 className="text-xl font-cinzel text-[#e8c46a] uppercase tracking-widest border-b border-[#b38135]/30 pb-2 mb-4">Table</h2>
            <PluginSlot role="dm" />
          </section>

        </main>

        {/* Chat area (Floating Overlay) */}
        {isChatOpen && (
          <div className="absolute top-0 right-0 h-full w-80 bg-black/90 backdrop-blur-md border-l border-[#b38135]/30 flex flex-col shadow-[0_0_20px_rgba(0,0,0,0.8)] z-50 transition-transform">
            <div className="chat-log flex-1 overflow-y-auto p-4 flex flex-col gap-2" style={{ paddingBottom: '16px' }}>
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
