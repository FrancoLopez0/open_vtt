import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PluginSlot from '../components/PluginSlot.tsx'
import { CombatEngine } from '../components/CombatEngine.tsx'

// ── Types ─────────────────────────────────────────────────────────────────
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

interface CharacterSheet {
  character_name: string
  char_class: string
  level: number
  race: string
  hp: number
  max_hp: number
  armor_class: number
  speed: number
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
  proficiency_bonus: number
  background: string
  traits: string
  equipment: string
  conditions: string[]
}

interface PluginMeta {
  name: string
  version?: string
  description?: string
  dm_widget?: string | null
  player_widget?: string | null
}

type ActiveTab = 'dashboard' | 'combat' | 'plugins'

const ABILITY_KEYS = [
  { key: 'strength',      label: 'STR' },
  { key: 'dexterity',    label: 'DEX' },
  { key: 'constitution', label: 'CON' },
  { key: 'intelligence', label: 'INT' },
  { key: 'wisdom',       label: 'WIS' },
  { key: 'charisma',     label: 'CHA' },
] as const

const modifier = (score: number) => {
  const m = Math.floor((score - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
}

const CONDITION_CLASS: Record<string, string> = {
  saludable: 'healthy', healthy: 'healthy',
  inspirado: 'inspired', inspired: 'inspired',
  escondido: 'hidden', hidden: 'hidden',
  encantado: 'charmed', charmed: 'charmed',
  aturdido: 'stunned', stunned: 'stunned',
  cegado: 'blinded', blinded: 'blinded',
  envenenado: 'poisoned', poisoned: 'poisoned',
}
const conditionClass = (c: string) => CONDITION_CLASS[c.toLowerCase()] ?? 'default'

const WS_URL = (token: string) =>
  `ws://${window.location.host}/ws/host?token=${encodeURIComponent(token)}`

// ── Sandbox default JSON ─────────────────────────────────────────────────
const SANDBOX_DEFAULT = `{
  "id": "my-plugin",
  "name": "My Plugin",
  "description": "Custom plugin manifest.",
  "version": "1.0.0",
  "category": "Custom"
}`

// ─────────────────────────────────────────────────────────────────────────
export default function DMView() {
  const [searchParams] = useSearchParams()
  const hostToken = searchParams.get('token') ?? (import.meta.env.DEV ? 'dev_host' : '')

  const [status, setStatus] = useState('disconnected')
  const [log, setLog] = useState<ChatEntry[]>([])
  const [chatInput, setChatInput] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [newPlayerName, setNewPlayerName] = useState('')
  const [creatingPlayer, setCreatingPlayer] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard')
  const [initialCombatState, setInitialCombatState] = useState<any>(null)

  // Sheet state
  const [selectedPlayerToken, setSelectedPlayerToken] = useState<string | null>(null)
  const [playerSheets, setPlayerSheets] = useState<Record<string, CharacterSheet>>({})

  // Plugins state
  const [plugins, setPlugins] = useState<PluginMeta[]>([])
  const [sandboxJson, setSandboxJson] = useState(SANDBOX_DEFAULT)
  const [sandboxMsg, setSandboxMsg] = useState('')

  const wsRef = useRef<WebSocket | null>(null)
  const messageQueue = useRef<any[]>([])
  const logEndRef = useRef<HTMLDivElement>(null!)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  const appendLog = useCallback((entry: Omit<ChatEntry, 'id'>) => {
    setLog((prev) => [...prev, { id: Date.now() + Math.random(), ...entry }])
  }, [])

  const fetchPlayers = useCallback(async () => {
    try {
      const res = await fetch('/api/players', { headers: { 'X-Host-Token': hostToken } })
      if (res.ok) {
        const playersData = await res.json()
        setPlayers(playersData)
        window.__VTT_PLAYERS__ = playersData
        window.dispatchEvent(new CustomEvent('vtt-players-update', { detail: playersData }))
      }
    } catch { /* silently retry */ }
  }, [hostToken])

  const fetchPlugins = useCallback(async () => {
    try {
      const res = await fetch('/api/plugins')
      if (res.ok) setPlugins(await res.json())
    } catch { /* ignore */ }
  }, [])

  // ── Fetch plugins when tab becomes active ────────────────────────────
  useEffect(() => {
    if (activeTab === 'plugins') fetchPlugins()
  }, [activeTab, fetchPlugins])

  // ── Request sheet when player is selected ────────────────────────────
  useEffect(() => {
    if (!selectedPlayerToken) return
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'request_character_sheet', token: selectedPlayerToken }))
    }
  }, [selectedPlayerToken])

  // ── WebSocket lifecycle ───────────────────────────────────────────────
  useEffect(() => {
    if (!hostToken) { setStatus('error'); return }

    let ws: WebSocket | null = null
    let reconnectTimeout: any

    const connect = () => {
      ws = new WebSocket(WS_URL(hostToken))
      wsRef.current = ws

      ws.onopen = () => {
        setStatus('connected')
        appendLog({ type: 'system', text: 'Connected to game session.' })
        fetchPlayers()
        while (messageQueue.current.length > 0) {
          ws!.send(JSON.stringify(messageQueue.current.shift()))
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
              appendLog({ type: 'system', text: `${data.name} ${data.type === 'player_connected' ? 'joined' : 'left'}.` })
              fetchPlayers()
              break
            case 'plugin_message':
              window.dispatchEvent(new CustomEvent('plugin-message', { detail: data }))
              break
            case 'combat_init':
              if (data.state && Object.keys(data.state).length > 0) setInitialCombatState(data.state)
              break
            case 'character_sheet_data':
              setPlayerSheets((prev) => ({ ...prev, [data.token]: data.sheet }))
              break
          }
        } catch {}
      }

      ws.onclose = () => {
        setStatus('disconnected')
        appendLog({ type: 'system', text: 'Disconnected. Reconnecting in 3s…' })
        reconnectTimeout = setTimeout(() => { setStatus('connecting'); connect() }, 3000)
      }

      ws.onerror = () => setStatus('error')
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
        headers: { 'Content-Type': 'application/json', 'X-Host-Token': hostToken },
        body: JSON.stringify({ name: newPlayerName.trim() }),
      })
      if (res.ok) { setNewPlayerName(''); fetchPlayers() }
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

  const selectedSheet = selectedPlayerToken ? playerSheets[selectedPlayerToken] : null
  const selectedPlayer = selectedPlayerToken ? players.find(p => p.token === selectedPlayerToken) : null

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="layout-full">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 20px', borderBottom: '1px solid var(--color-border)',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(6,6,14,0.8))',
        flexShrink: 0, gap: '16px',
      }}>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: '22px' }}>🐉</span>
          <div>
            <div style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>DM Workspace</div>
            <div className="font-display" style={{ fontSize: '15px', color: 'var(--color-amber-bright)', letterSpacing: '0.04em' }}>Open VTT</div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="tab-switcher">
          {(['dashboard', 'combat', 'plugins'] as ActiveTab[]).map(tab => (
            <button
              key={tab}
              className={`tab-switcher-item${activeTab === tab ? ' active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'dashboard' ? '⚡ Dashboard' : tab === 'combat' ? '⚔️ Combat' : '🔌 Plugins'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-display text-sm" style={{ color: 'var(--color-amber)' }}>Dungeon Master</div>
            <div className={`badge ${statusClass} mt-1`}>{statusLabel}</div>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid var(--color-amber-dim)', overflow: 'hidden', background: '#06060e' }}>
            <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=DM&backgroundColor=transparent" alt="DM" style={{ width: '100%', height: '100%' }} />
          </div>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <div className="flex flex-row flex-1 overflow-hidden">

        {/* ── Left sidebar: Chat ──────────────────────────────────── */}
        <aside className="flex flex-col flex-shrink-0 overflow-hidden" style={{ width: '280px', background: 'var(--color-bg-deep)', borderRight: '1px solid var(--color-border)' }}>
          <div className="py-2 px-3" style={{ borderBottom: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.4)' }}>
            <h3 className="font-display text-xs tracking-widest uppercase" style={{ color: 'var(--color-amber-bright)' }}>Party Chat</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
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
          <div className="p-2 flex gap-2" style={{ borderTop: '1px solid var(--color-border)' }}>
            <input
              type="text"
              placeholder="Message…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              className="flex-1"
              disabled={status !== 'connected'}
            />
            <button className="btn btn-primary px-3" onClick={sendChat} disabled={!chatInput.trim() || status !== 'connected'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </aside>

        {/* ── Main content ────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* ── DASHBOARD TAB ─────────────────────────────────────── */}
          {activeTab === 'dashboard' && (
            <div className="flex flex-row flex-1 overflow-hidden p-4 gap-4">

              {/* Player list + invite */}
              <div className="flex flex-col gap-3 flex-shrink-0 overflow-hidden" style={{ width: '260px' }}>
                <div className="panel-widget flex-1 overflow-hidden">
                  <div className="panel-widget-header">
                    <span className="size-badge">1x2</span>
                    <span className="panel-widget-title">Connected Players</span>
                  </div>
                  <div className="flex gap-2 p-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <input
                      type="text"
                      placeholder="Invite player…"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && createPlayer()}
                      className="flex-1"
                    />
                    <button className="btn btn-ghost text-xs px-3" onClick={createPlayer} disabled={creatingPlayer || !newPlayerName.trim()}>
                      Add
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
                    {players.length === 0 ? (
                      <div className="text-center p-6 text-muted italic text-xs">The tavern is empty. Invite players to begin.</div>
                    ) : (
                      players.map(p => {
                        const sheet = playerSheets[p.token]
                        const hpPct = sheet?.max_hp ? Math.min(100, Math.round((sheet.hp / sheet.max_hp) * 100)) : 0
                        const hpClass = hpPct >= 60 ? 'hp-high' : hpPct >= 30 ? 'hp-mid' : 'hp-low'
                        return (
                          <div key={p.token} style={{
                            background: 'var(--color-bg-raised)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '10px',
                            cursor: 'pointer',
                            transition: 'border-color var(--transition-fast)',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-border-amber)')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div style={{ position: 'relative', flexShrink: 0 }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', border: `2px solid ${p.connected ? 'var(--color-green-active)' : 'var(--color-error)'}`, background: '#06060e' }}>
                                  <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${p.name}&backgroundColor=transparent`} alt={p.name} style={{ width: '100%', height: '100%' }} />
                                </div>
                                <div style={{ position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', borderRadius: '50%', border: '2px solid var(--color-bg-deep)', backgroundColor: p.connected ? 'var(--color-green-active)' : 'var(--color-error)' }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-display truncate" style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{p.name}</div>
                                {sheet?.char_class && (
                                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{sheet.char_class} • Lv {sheet.level}</div>
                                )}
                              </div>
                            </div>
                            {sheet && (
                              <div className="hero-hp-bar mb-2">
                                <div className={`hp-fill ${hpClass}`} style={{ width: `${hpPct}%` }} />
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button
                                className="btn btn-ghost text-xs flex-1"
                                style={{ padding: '3px 6px' }}
                                onClick={() => setSelectedPlayerToken(p.token === selectedPlayerToken ? null : p.token)}
                              >
                                📋 View Sheet
                              </button>
                              <button
                                className="btn btn-ghost text-xs"
                                style={{ padding: '3px 6px' }}
                                onClick={() => {
                                  navigator.clipboard.writeText(p.join_url)
                                  appendLog({ type: 'system', text: `Link for ${p.name} copied.` })
                                }}
                                title="Copy invite link"
                              >
                                🔗
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Plugins area */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div className="panel-widget flex-1 overflow-hidden">
                  <div className="panel-widget-header">
                    <span className="size-badge">2x2</span>
                    <span className="panel-widget-title">Active Plugins & Tools</span>
                    <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '11px' }}>⚙️ Manage</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <PluginSlot role="dm" />
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* ── COMBAT TAB ────────────────────────────────────────── */}
          {activeTab === 'combat' && (
            <div className="flex-1 flex flex-col min-h-0 p-4">
              <CombatEngine players={players} initialState={initialCombatState} />
            </div>
          )}

          {/* ── PLUGINS TAB ───────────────────────────────────────── */}
          {activeTab === 'plugins' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Tab header */}
              <div className="p-5 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-3 mb-1">
                  <span style={{ fontSize: '22px' }}>🔌</span>
                  <div>
                    <h2 className="font-display" style={{ fontSize: '17px', color: 'var(--color-text-primary)' }}>Plugin Manager & Store</h2>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Install and activate modules that extend the game kernel at runtime.</p>
                  </div>
                </div>
              </div>

              <div className="plugin-manager-layout flex-1 overflow-hidden">
                {/* Plugin list */}
                <div className="plugin-list-panel">
                  <div className="p-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                      Extension Repository
                    </div>
                  </div>
                  <div className="plugin-list-scroll">
                    {plugins.length === 0 ? (
                      <div className="text-center text-muted italic p-8" style={{ fontSize: '12px' }}>No plugins installed.</div>
                    ) : (
                      plugins.map((plugin, i) => (
                        <div className="plugin-entry" key={i}>
                          <div className="plugin-entry-info">
                            <div className="plugin-entry-title">
                              <span className="plugin-entry-name">{plugin.name}</span>
                              {plugin.version && <span className="version-badge">v{plugin.version}</span>}
                              {plugin.dm_widget && <span className="category-tag">DM Widget</span>}
                              {plugin.player_widget && <span className="category-tag">Player Widget</span>}
                            </div>
                            <div className="plugin-entry-desc">{plugin.description || 'No description provided.'}</div>
                            <div className="plugin-entry-meta">
                              {plugin.dm_widget ? 'Has DM UI' : ''}
                              {plugin.dm_widget && plugin.player_widget ? ' · ' : ''}
                              {plugin.player_widget ? 'Has Player UI' : ''}
                              {!plugin.dm_widget && !plugin.player_widget ? 'Backend-only plugin' : ''}
                            </div>
                          </div>
                          <div className="btn-active">✓ Loaded</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Sandbox */}
                <div className="plugin-sandbox-panel">
                  <div className="plugin-sandbox-header">
                    <div className="plugin-sandbox-title">⚗️ Plugin Injection (Sandbox)</div>
                    <div className="plugin-sandbox-desc">
                      Write a valid JSON manifest to dynamically hook a new module into the DM Dashboard Core.
                    </div>
                  </div>
                  <textarea
                    className="plugin-sandbox-editor"
                    value={sandboxJson}
                    onChange={e => { setSandboxJson(e.target.value); setSandboxMsg('') }}
                    spellCheck={false}
                  />
                  {sandboxMsg && (
                    <div style={{ padding: '6px 14px', fontSize: '10px', color: sandboxMsg.startsWith('✓') ? 'var(--color-green-active)' : 'var(--color-error)' }}>
                      {sandboxMsg}
                    </div>
                  )}
                  <div className="plugin-sandbox-footer">
                    <button
                      className="btn-inject"
                      onClick={() => {
                        try {
                          JSON.parse(sandboxJson)
                          setSandboxMsg('✓ Valid manifest. Injection would happen here.')
                        } catch {
                          setSandboxMsg('✗ Invalid JSON. Check syntax and try again.')
                        }
                      }}
                    >
                      🔌 Inject into Kernel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
