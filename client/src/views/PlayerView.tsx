import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PluginSlot from '../components/PluginSlot.jsx'

// ── Character Sheet Schema ────────────────────────────────────────────────
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

const defaultSheet: CharacterSheet = {
  character_name: '',
  char_class: '',
  level: 1,
  race: '',
  hp: 10,
  max_hp: 10,
  armor_class: 10,
  speed: 30,
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
  proficiency_bonus: 2,
  background: '',
  traits: '',
  equipment: '',
  conditions: [],
}

const ABILITY_KEYS = [
  { key: 'strength',     label: 'STR' },
  { key: 'dexterity',   label: 'DEX' },
  { key: 'constitution',label: 'CON' },
  { key: 'intelligence',label: 'INT' },
  { key: 'wisdom',      label: 'WIS' },
  { key: 'charisma',    label: 'CHA' },
] as const

const modifier = (score: number) => {
  const m = Math.floor((score - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
}

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
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [sheet, setSheet] = useState<CharacterSheet>(defaultSheet)

  const wsRef = useRef<WebSocket | null>(null)
  const messageQueue = useRef<any[]>([])
  const logEndRef = useRef<HTMLDivElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  const appendLog = useCallback((entry: any) => {
    setLog((prev) => [...prev, { id: Date.now() + Math.random(), ...entry }])
  }, [])

  // ── Debounced sheet send ──────────────────────────────────────────────
  const updateSheet = useCallback((patch: Partial<CharacterSheet>) => {
    setSheet((prev) => {
      const next = { ...prev, ...patch }
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'character_sheet_update', sheet: next }))
        }
      }, 500)
      return next
    })
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
          const msg = messageQueue.current.shift()
          ws!.send(JSON.stringify(msg))
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
            case 'request_character_sheet':
              // DM requests our sheet — send immediately
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'character_sheet_update', sheet }))
              }
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

  const hpPct = sheet.max_hp > 0 ? Math.min(100, Math.round((sheet.hp / sheet.max_hp) * 100)) : 0
  const hpClass = hpPct >= 60 ? 'hp-high' : hpPct >= 30 ? 'hp-mid' : 'hp-low'

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
            onClick={() => { setIsSheetOpen(!isSheetOpen); setIsChatOpen(false) }}
          >
            📜 My Character
          </button>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px 10px', fontSize: '11px' }}
            onClick={() => { setIsChatOpen(!isChatOpen); setIsSheetOpen(false) }}
          >
            {isChatOpen ? 'Hide Chat' : '💬 Chat'}
          </button>
          <span className={`badge ${statusClass}`}>{statusLabel}</span>
        </div>
      </div>

      {/* Main layout */}
      <div className="relative flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-8">
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

        {/* Character Sheet editor panel */}
        {isSheetOpen && (
          <div className="sheet-editor-panel">
            <div className="sheet-editor-header">
              <span className="sheet-editor-title">📜 Character Sheet</span>
              <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '12px' }} onClick={() => setIsSheetOpen(false)}>✕</button>
            </div>
            <div className="sheet-editor-body">

              {/* HP mini-bar at top */}
              <div className="hero-hp-section">
                <div className="hero-hp-labels">
                  <span className="hero-hp-label">Vida Acumulada</span>
                  <span className="hero-hp-value">{sheet.hp} / {sheet.max_hp}</span>
                </div>
                <div className="hero-hp-bar">
                  <div className={`hp-fill ${hpClass}`} style={{ width: `${hpPct}%` }} />
                </div>
              </div>

              {/* Identity */}
              <div className="sheet-section">
                <div className="sheet-section-title">Identity</div>
                <div className="sheet-field-row">
                  <div className="sheet-field">
                    <label className="sheet-field-label">Character Name</label>
                    <input type="text" value={sheet.character_name} onChange={e => updateSheet({ character_name: e.target.value })} placeholder="Aurelia Solís" />
                  </div>
                  <div className="sheet-field">
                    <label className="sheet-field-label">Race</label>
                    <input type="text" value={sheet.race} onChange={e => updateSheet({ race: e.target.value })} placeholder="Human" />
                  </div>
                </div>
                <div className="sheet-field-row">
                  <div className="sheet-field">
                    <label className="sheet-field-label">Class</label>
                    <input type="text" value={sheet.char_class} onChange={e => updateSheet({ char_class: e.target.value })} placeholder="Paladin" />
                  </div>
                  <div className="sheet-field">
                    <label className="sheet-field-label">Level</label>
                    <input type="number" value={sheet.level} min={1} max={20} onChange={e => updateSheet({ level: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="sheet-field">
                  <label className="sheet-field-label">Background</label>
                  <input type="text" value={sheet.background} onChange={e => updateSheet({ background: e.target.value })} placeholder="Noble" />
                </div>
              </div>

              {/* Core Stats */}
              <div className="sheet-section">
                <div className="sheet-section-title">Core Stats</div>
                <div className="sheet-field-row">
                  <div className="sheet-field">
                    <label className="sheet-field-label">HP</label>
                    <input type="number" value={sheet.hp} min={0} onChange={e => updateSheet({ hp: Number(e.target.value) })} />
                  </div>
                  <div className="sheet-field">
                    <label className="sheet-field-label">Max HP</label>
                    <input type="number" value={sheet.max_hp} min={1} onChange={e => updateSheet({ max_hp: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="sheet-field-row">
                  <div className="sheet-field">
                    <label className="sheet-field-label">Armor Class</label>
                    <input type="number" value={sheet.armor_class} min={0} onChange={e => updateSheet({ armor_class: Number(e.target.value) })} />
                  </div>
                  <div className="sheet-field">
                    <label className="sheet-field-label">Speed (ft)</label>
                    <input type="number" value={sheet.speed} min={0} step={5} onChange={e => updateSheet({ speed: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="sheet-field">
                  <label className="sheet-field-label">Proficiency Bonus</label>
                  <input type="number" value={sheet.proficiency_bonus} min={2} max={6} onChange={e => updateSheet({ proficiency_bonus: Number(e.target.value) })} />
                </div>
              </div>

              {/* Ability Scores */}
              <div className="sheet-section">
                <div className="sheet-section-title">Ability Scores</div>
                <div className="sheet-attr-grid">
                  {ABILITY_KEYS.map(({ key, label }) => (
                    <div className="sheet-attr-cell" key={key}>
                      <span className="sheet-attr-label">{label}</span>
                      <input
                        type="number"
                        className="sheet-attr-input"
                        value={sheet[key]}
                        min={1}
                        max={30}
                        onChange={e => updateSheet({ [key]: Number(e.target.value) } as any)}
                      />
                      <span className="sheet-attr-mod">{modifier(sheet[key])}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Free Text */}
              <div className="sheet-section">
                <div className="sheet-section-title">Notes</div>
                <div className="sheet-field">
                  <label className="sheet-field-label">Traits & Features</label>
                  <textarea value={sheet.traits} onChange={e => updateSheet({ traits: e.target.value })} placeholder="Divine Smite, Aura of Protection…" />
                </div>
                <div className="sheet-field">
                  <label className="sheet-field-label">Equipment</label>
                  <textarea value={sheet.equipment} onChange={e => updateSheet({ equipment: e.target.value })} placeholder="Longsword, Holy Shield…" />
                </div>
                <div className="sheet-field">
                  <label className="sheet-field-label">Conditions (comma-separated)</label>
                  <input
                    type="text"
                    value={sheet.conditions.join(', ')}
                    onChange={e => updateSheet({ conditions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="Inspired, Hidden…"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
