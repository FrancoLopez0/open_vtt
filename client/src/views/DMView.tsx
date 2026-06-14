import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PluginSlot from '../components/PluginSlot.tsx'

export interface CharacterSheet {
  name: string
  race: string
  class_name: string
  level: number
  hp_current: number
  hp_max: number
  stats: Array<{ name: string; value: string }>
  inventory: string
}

export interface Player {
  name: string
  token: string
  connected: boolean
  join_url: string
}

export interface ChatEntry {
  id: number
  type: 'system' | 'chat' | 'roll' | 'secret'
  sender?: string
  text: string
}

const WS_URL = (token: string) =>
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
  const [log, setLog] = useState<ChatEntry[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [newPlayerName, setNewPlayerName] = useState('')
  const [creatingPlayer, setCreatingPlayer] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'combat'>('dashboard')

  const wsRef = useRef(null)
  const logEndRef = useRef(null)

  // Auto-scroll chat log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  // Append a message to the chat log
  const appendLog = useCallback((entry: Omit<ChatEntry, 'id'>) => {
    setLog((prev) => [...prev, { id: Date.now() + Math.random(), ...entry }])
  }, [])

  // Fetch player list from REST API
  const fetchPlayers = useCallback(async () => {
    try {
      const res = await fetch('/api/players', {
        headers: { 'X-Host-Token': hostToken },
      })
      if (res.ok) {
        const playersData = await res.json()
        setPlayers(playersData)
        // Notify plugins that the player list has updated
        window.dispatchEvent(new CustomEvent('vtt-players-update', { detail: playersData }))
      }
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
            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`btn ${activeTab === 'combat' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('combat')}
          >
            Combat
          </button>
          <div className="w-[1px] h-6 bg-white/20 mx-2"></div>
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
          
          {activeTab === 'dashboard' ? (
            <>
              {/* Add Player */}
              <div className="flex gap-2 max-w-md mb-8">
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

              {/* Plugin Table Area */}
              <section>
                <PluginSlot role="dm" />
              </section>
            </>
          ) : (
            <section className="flex flex-col items-center justify-center h-full text-center p-12 bg-[#13131f] border border-[#b38135]/30 rounded-xl shadow-lg">
              <h2 className="text-3xl font-cinzel text-[#e8c46a] uppercase tracking-widest mb-4">Combat Engine</h2>
              <p className="text-white/60 max-w-lg mb-8">
                The initiative tracker and combat management system will be placed here.
                Currently under construction.
              </p>
              <div className="w-16 h-16 opacity-30">
                <svg viewBox="0 0 24 24" fill="none" stroke="#e8c46a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 17.5L3 6l1.5-1.5L16 16l-1.5 1.5z"></path>
                  <path d="M17.5 14.5L6 3 4.5 4.5 16 16l1.5-1.5z"></path>
                  <path d="M21 9l-4-4"></path>
                  <path d="M22 3l-6 6"></path>
                </svg>
              </div>
            </section>
          )}

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
