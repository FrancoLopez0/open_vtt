import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PluginSlot from '../components/PluginSlot.tsx'
import { CombatEngine } from '../components/CombatEngine.tsx'

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

export default function DMView() {
  const [searchParams] = useSearchParams()
  const hostToken = searchParams.get('token') ?? (import.meta.env.DEV ? 'dev_host' : '')

  const [status, setStatus] = useState('disconnected')
  const [log, setLog] = useState<ChatEntry[]>([])
  const [chatInput, setChatInput] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [newPlayerName, setNewPlayerName] = useState('')
  const [creatingPlayer, setCreatingPlayer] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'combat'>('dashboard')
  const [initialCombatState, setInitialCombatState] = useState<any>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const messageQueue = useRef<any[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  const appendLog = useCallback((entry: Omit<ChatEntry, 'id'>) => {
    setLog((prev) => [...prev, { id: Date.now() + Math.random(), ...entry }])
  }, [])

  const fetchPlayers = useCallback(async () => {
    try {
      const res = await fetch('/api/players', {
        headers: { 'X-Host-Token': hostToken },
      })
      if (res.ok) {
        const playersData = await res.json()
        setPlayers(playersData)
        window.__VTT_PLAYERS__ = playersData
        window.dispatchEvent(new CustomEvent('vtt-players-update', { detail: playersData }))
      }
    } catch {
      // silently retry
    }
  }, [hostToken])

  useEffect(() => {
    if (!hostToken) {
      setStatus('error')
      return
    }

    let ws: WebSocket | null = null;
    let reconnectTimeout: any;

    const connect = () => {
      ws = new WebSocket(WS_URL(hostToken))
      wsRef.current = ws

      ws.onopen = () => {
        setStatus('connected')
        appendLog({ type: 'system', text: 'Connected to game session.' })
        fetchPlayers()
        
        while (messageQueue.current.length > 0) {
          const msg = messageQueue.current.shift()
          ws.send(JSON.stringify(msg))
        }
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
                text: data.secret ? `[SECRET] rolled ${data.result}` : `rolled ${data.result}`,
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
            case 'combat_init':
              if (data.state && Object.keys(data.state).length > 0) {
                setInitialCombatState(data.state)
              }
              break
          }
        } catch {}
      }

      ws.onclose = () => {
        setStatus('disconnected')
        appendLog({ type: 'system', text: 'Disconnected. Reconnecting in 3s...' })
        reconnectTimeout = setTimeout(() => {
          setStatus('connecting')
          connect()
        }, 3000)
      }

      ws.onerror = () => {
        setStatus('error')
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimeout)
      if (ws) ws.close()
      wsRef.current = null
    }
  }, [hostToken, appendLog, fetchPlayers])

  useEffect(() => {
    const handleSendWs = (event: any) => {
      if (!wsRef.current) return
      
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(event.detail))
      } else if (wsRef.current.readyState === WebSocket.CONNECTING) {
        messageQueue.current.push(event.detail)
      }
    }
    window.addEventListener('send-ws', handleSendWs as EventListener)
    return () => window.removeEventListener('send-ws', handleSendWs as EventListener)
  }, [])

  const sendChat = useCallback(() => {
    if (!chatInput.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'chat', message: chatInput.trim() }))
    setChatInput('')
  }, [chatInput])

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

  if (!hostToken) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="glass-panel p-8 text-center" style={{ maxWidth: '400px' }}>
          <h1 className="text-2xl font-display text-error mb-4">No Host Token</h1>
          <p>The DM window must be opened by the application.</p>
        </div>
      </div>
    )
  }

  const statusClass = status === 'connected' ? 'badge-connected' : status === 'error' ? 'badge-disconnected' : 'badge-waiting'
  const statusLabel = status === 'connected' ? 'Online' : status === 'error' ? 'Error' : 'Connecting…'

  return (
    <div className="layout-full flex items-center justify-center p-6">
      
      <div className="glass-panel-deep flex flex-col w-full h-full overflow-hidden" style={{ borderRadius: '1rem', boxShadow: '0 30px 60px rgba(0,0,0,0.9)' }}>
        
        <header className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)', background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0.4))' }}>
          <div className="flex items-center gap-3">
            <span className="text-gold text-xl">🐉</span>
            <span className="font-display text-lg tracking-wider text-gold-bright">OPEN VTT</span>
          </div>
          
          <div className="flex gap-2">
            <button className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
            <button className="btn btn-ghost text-muted">Campaigns</button>
            <button className="btn btn-ghost text-muted">Maps</button>
            <button className={`btn ${activeTab === 'combat' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('combat')}>Combat</button>
            <button className="btn btn-ghost text-muted">Rules</button>
            <button className="btn btn-ghost text-muted">Community</button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative glass-panel-light px-3 py-1 flex items-center gap-2">
              <span className="text-muted">🔍</span>
              <input type="text" placeholder="Dark Iron" className="bg-transparent border-none outline-none text-sm w-32 text-muted" disabled style={{ background: 'transparent', border: 'none' }} />
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="font-display text-sm text-gold">DM Elara</div>
              <div className={`badge ${statusClass} mt-1`}>{statusLabel}</div>
            </div>
            <div className="w-10 h-10 rounded-full border overflow-hidden" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid var(--color-gold-muted)', backgroundColor: 'black' }}>
              <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Elara&backgroundColor=transparent" alt="DM" style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
        </header>

        <div className="flex flex-row flex-1 overflow-hidden p-8 gap-8">
          
          <aside className="flex flex-col ornate-frame glass-panel-deep overflow-hidden flex-shrink-0" style={{ width: '320px' }}>
            <div className="py-3 px-4 text-center glass-panel-light" style={{ borderBottom: '1px solid var(--color-border)', borderRadius: '0' }}>
              <h3 className="font-display text-sm text-gold-bright tracking-widest uppercase">Party Chat & Rolls</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {log.map((entry) => (
                <div key={entry.id} className={`chat-message ${entry.type === 'roll' ? 'is-roll' : entry.type === 'secret' ? 'is-secret' : ''}`}>
                  <span className={`chat-sender ${entry.sender === 'DM' ? 'is-dm' : entry.type === 'system' ? 'is-system' : ''}`}>
                    {entry.type === 'system' ? 'System' : entry.sender}
                  </span>
                  <span className="chat-text">{entry.text}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
            
            <div className="p-3 flex gap-2 glass-panel-deep" style={{ borderTop: '1px solid var(--color-border)', borderRadius: '0' }}>
              <input
                type="text"
                placeholder="Message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                className="flex-1"
                disabled={status !== 'connected'}
              />
              <button className="btn btn-primary px-3" onClick={sendChat} disabled={!chatInput.trim() || status !== 'connected'}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </div>
          </aside>

          <main className="flex-1 flex flex-col min-w-0">
            {activeTab === 'dashboard' ? (
              <>
                <div className="mb-4 flex items-end justify-between pb-2 px-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <h2 className="font-display text-2xl text-primary tracking-wide">DM DASHBOARD <span className="text-muted">- The Shadowed Halls</span></h2>
                </div>

                <div className="flex flex-row gap-6 h-full min-h-0">
                  
                  <div className="flex-1 flex flex-col min-w-0 glass-panel-light p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-display text-sm text-gold uppercase tracking-wider">Connected Players</h3>
                    </div>

                    <div className="flex gap-2 mb-4">
                      <input
                        type="text"
                        placeholder="Invite new player..."
                        value={newPlayerName}
                        onChange={(e) => setNewPlayerName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && createPlayer()}
                        className="flex-1"
                      />
                      <button className="btn btn-ghost text-xs px-4" onClick={createPlayer} disabled={creatingPlayer || !newPlayerName.trim()}>
                        Add
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3">
                      {players.length === 0 ? (
                        <div className="text-center p-8 text-muted italic text-sm">
                          The tavern is empty. Invite players to begin.
                        </div>
                      ) : (
                        players.map(p => (
                          <div key={p.token} className="glass-panel-deep flex items-center p-3">
                            <div className="relative flex-shrink-0 mr-4" style={{ width: '48px', height: '48px', borderRadius: '50%', border: '1px solid var(--color-gold-muted)', backgroundColor: '#0a0a0a' }}>
                               <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${p.name}&backgroundColor=transparent`} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                               <div className="absolute" style={{ bottom: 0, right: 0, width: '14px', height: '14px', borderRadius: '50%', border: '2px solid black', backgroundColor: p.connected ? 'var(--color-success)' : 'var(--color-error)' }}></div>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                               <div className="flex justify-between items-center">
                                  <span className="font-display text-lg text-primary truncate">{p.name}</span>
                                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: p.connected ? 'var(--color-success)' : 'var(--color-error)' }}>
                                    {p.connected ? 'Online' : 'Offline'}
                                  </span>
                               </div>
                               <div className="mt-2">
                                 <button
                                   className="btn btn-ghost flex justify-center items-center gap-2 w-full text-xs py-1 px-3"
                                   onClick={() => {
                                     navigator.clipboard.writeText(p.join_url);
                                     appendLog({ type: 'system', text: `Enlace de ${p.name} copiado al portapapeles.` });
                                   }}
                                   title="Copiar enlace de invitación"
                                 >
                                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                   Copiar Link
                                 </button>
                               </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <main className="flex-1 flex flex-col min-w-0 glass-panel p-8">
                    <div className="flex justify-between items-center mb-6 pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <h3 className="font-display text-sm text-gold uppercase tracking-wider">Active Plugins & Tools</h3>
                      <button className="btn btn-ghost">⚙️ Manage</button>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                      <PluginSlot role="dm" />
                    </div>
                  </main>
                  
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                <CombatEngine players={players} initialState={initialCombatState} />
              </div>
            )}
          </main>

        </div>
      </div>
    </div>
  )
}
