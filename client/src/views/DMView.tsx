import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PluginSlot from '../components/PluginSlot.tsx'

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

    const ws = new WebSocket(WS_URL(hostToken))
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
        }
      } catch {}
    }

    ws.onclose = () => {
      setStatus('disconnected')
      appendLog({ type: 'system', text: 'Disconnected. Reconnecting in 3s...' })
      setTimeout(() => {
        if (wsRef.current) {
          wsRef.current = null;
          setStatus('connecting')
        }
      }, 3000)
    }

    ws.onerror = () => {
      setStatus('error')
    }

    return () => {
      ws.close()
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
      <div className="flex items-center justify-center h-screen">
        <div className="glass-panel p-8 text-center max-w-md">
          <h1 className="text-2xl font-display text-[var(--color-error)] mb-4">No Host Token</h1>
          <p>The DM window must be opened by the application.</p>
        </div>
      </div>
    )
  }

  const statusClass = status === 'connected' ? 'badge-connected' : status === 'error' ? 'badge-disconnected' : 'badge-waiting'
  const statusLabel = status === 'connected' ? 'Online' : status === 'error' ? 'Error' : 'Connecting…'

  return (
    <div className="layout-full items-center justify-center p-6 lg:p-12 bg-transparent">
      
      <div className="glass-panel flex flex-col w-full h-full rounded-2xl overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.9)] border border-[var(--color-gold-dim)] bg-black/70 backdrop-blur-md">
        
        <header className="flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-black/40 border-b border-[var(--glass-border)]">
          <div className="flex items-center gap-3">
            <span className="text-[var(--color-gold)] text-xl">🐉</span>
            <span className="font-display text-lg tracking-wider text-[var(--color-gold-bright)]">OPEN VTT</span>
          </div>
          
          <div className="flex gap-2">
            <button className={`btn ${activeTab === 'dashboard' ? 'text-[var(--color-gold-bright)] border-b-2 border-[var(--color-gold)] rounded-none' : 'btn-ghost'}`} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
            <button className="btn btn-ghost text-gray-500 cursor-not-allowed">Campaigns</button>
            <button className="btn btn-ghost text-gray-500 cursor-not-allowed">Maps</button>
            <button className={`btn ${activeTab === 'combat' ? 'text-[var(--color-gold-bright)] border-b-2 border-[var(--color-gold)] rounded-none' : 'btn-ghost'}`} onClick={() => setActiveTab('combat')}>Combat</button>
            <button className="btn btn-ghost text-gray-500 cursor-not-allowed">Rules</button>
            <button className="btn btn-ghost text-gray-500 cursor-not-allowed">Community</button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative bg-black/40 border border-[var(--color-gold-dim)] rounded px-3 py-1.5 flex items-center gap-2">
              <span className="text-gray-500">🔍</span>
              <input type="text" placeholder="Dark Iron" className="bg-transparent border-none outline-none text-sm w-32 text-gray-300" disabled />
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="font-display text-sm text-[var(--color-gold)]">DM Elara</div>
              <div className={`badge ${statusClass} scale-90 origin-right mt-1`}>{statusLabel}</div>
            </div>
            <div className="w-10 h-10 rounded-full border border-[var(--color-gold-muted)] overflow-hidden bg-black">
              <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Elara&backgroundColor=transparent" alt="DM" />
            </div>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden p-6 lg:p-10 gap-8">
          
          <aside className="w-full lg:w-80 flex flex-col ornate-frame bg-black/60 overflow-hidden flex-shrink-0 shadow-2xl rounded-xl">
            <div className="py-3 px-4 border-b border-[var(--glass-border)] text-center bg-black/40">
              <h3 className="font-display text-sm text-[var(--color-gold-bright)] tracking-widest uppercase">Party Chat & Rolls</h3>
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
            
            <div className="p-3 border-t border-[var(--glass-border)] bg-black/60 flex gap-2">
              <input
                type="text"
                placeholder="Message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                className="flex-1 bg-black/40 border border-[var(--color-gold-dim)] rounded text-sm px-3 py-2 text-[var(--color-text-primary)] focus:border-[var(--color-gold)] outline-none transition-colors"
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
                <div className="mb-4 flex items-end justify-between border-b border-[var(--glass-border)] pb-2 px-2">
                  <h2 className="font-display text-xl lg:text-2xl text-[var(--color-text-primary)] tracking-wide">DM DASHBOARD <span className="text-[var(--color-text-muted)]">- The Shadowed Halls</span></h2>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
                  
                  <div className="flex-1 flex flex-col min-w-0 bg-black/20 rounded-lg border border-[var(--glass-border)] p-4 shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-display text-sm text-[var(--color-gold)] uppercase tracking-wider">Connected Players</h3>
                    </div>

                    <div className="flex gap-2 mb-4">
                      <input
                        type="text"
                        placeholder="Invite new player..."
                        value={newPlayerName}
                        onChange={(e) => setNewPlayerName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && createPlayer()}
                        className="flex-1 py-1.5 px-3 bg-black/50 border border-[var(--glass-border)] rounded text-sm outline-none focus:border-[var(--color-gold)] transition-colors"
                      />
                      <button className="btn btn-secondary text-xs px-4" onClick={createPlayer} disabled={creatingPlayer || !newPlayerName.trim()}>
                        Add
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3">
                      {players.length === 0 ? (
                        <div className="text-center p-8 text-[var(--color-text-muted)] italic text-sm">
                          The tavern is empty. Invite players to begin.
                        </div>
                      ) : (
                        players.map(p => (
                          <div key={p.token} className="premium-card flex items-center p-3 group">
                            <div className="relative w-12 h-12 rounded-full border border-[var(--color-gold-muted)] overflow-hidden bg-[#0a0a0a] flex-shrink-0 mr-4 shadow-[0_0_10px_rgba(207,170,102,0.2)]">
                               <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${p.name}&backgroundColor=transparent`} alt={p.name} className="w-full h-full object-cover" />
                               <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-black ${p.connected ? 'bg-[var(--color-success)]' : 'bg-[var(--color-error)]'}`}></div>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                               <div className="flex justify-between items-center">
                                  <span className="font-display text-lg text-[var(--color-text-primary)] truncate">{p.name}</span>
                                  <span className={`text-[10px] font-bold uppercase tracking-wider ${p.connected ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                                    {p.connected ? 'Online' : 'Offline'}
                                  </span>
                               </div>
                               <div className="mt-2">
                                 <button
                                   className="btn flex justify-center items-center gap-2 w-full text-xs py-1.5 px-3 bg-black/40 hover:bg-black/60 border border-[var(--color-gold-dim)] text-[var(--color-gold)] transition-colors rounded"
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

                  <main className="flex-1 flex flex-col min-w-0 bg-black/40 rounded-xl border border-[var(--glass-border)] p-8 shadow-2xl">
                    <div className="flex justify-between items-center mb-6 border-b border-[var(--glass-border)] pb-2">
                      <h3 className="font-display text-sm text-[var(--color-gold)] uppercase tracking-wider">Active Plugins & Tools</h3>
                      <button className="btn btn-small hover:text-[var(--color-gold-bright)]">⚙️ Manage</button>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                      <PluginSlot role="dm" />
                    </div>
                  </main>
                  
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-[var(--color-gold-dim)] rounded-lg bg-black/20">
                <h2 className="font-display text-3xl mb-4 text-[var(--color-gold)]">Combat Engine</h2>
                <p className="text-[var(--color-text-secondary)]">Initiative tracker and combat management system coming soon.</p>
              </div>
            )}
          </main>

        </div>
      </div>
    </div>
  )
}
