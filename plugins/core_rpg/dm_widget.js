/**
 * core-rpg-dm — DM View: party overview with HP bars and status conditions
 */
class CoreRPGDm extends HTMLElement {
  constructor() {
    super()
    this.sheets  = {}   // playerToken -> sheetData
    this.players = []   // [{token, name, connected, join_url}]
    this.selected = null // token of expanded card
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────
  connectedCallback() {
    this._render()

    this._msgHandler = (e) => {
      const data = e.detail
      if (data.plugin !== 'core_rpg') return
      const payload = data.payload
      if (payload.action === 'sheet_data' || payload.action === 'sheet_updated') {
        this.sheets[payload.player] = payload.sheet
        this._render()
      }
    }

    this._playersHandler = (e) => {
      this.players = e.detail || []
      for (const p of this.players) this._requestSheet(p.token)
      this._render()
    }

    window.addEventListener('plugin-message',      this._msgHandler)
    window.addEventListener('vtt-players-update',  this._playersHandler)

    if (window.__VTT_PLAYERS__) this._playersHandler({ detail: window.__VTT_PLAYERS__ })
  }

  disconnectedCallback() {
    window.removeEventListener('plugin-message',     this._msgHandler)
    window.removeEventListener('vtt-players-update', this._playersHandler)
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  _requestSheet(token) {
    window.dispatchEvent(new CustomEvent('send-ws', {
      detail: { type: 'plugin_message', plugin: 'core_rpg', payload: { action: 'get_sheet', target_player: token } }
    }))
  }

  _hpColor(curr, max) {
    const pct = max > 0 ? curr / max : 1
    if (pct >= 0.6) return '#22c55e'
    if (pct >= 0.3) return '#eab308'
    return '#ef4444'
  }

  _conditionColor(c) {
    const map = {
      'Poisoned':   '#22c55e', 'Blinded':    '#94a3b8',
      'Stunned':    '#f59e0b', 'Paralyzed':  '#ef4444',
      'Frightened': '#a855f7', 'Charmed':    '#ec4899',
      'Exhaustion': '#64748b', 'Grappled':   '#f97316',
      'Incapacitated': '#dc2626', 'Invisible': '#c8b4e8',
      'Petrified':  '#78716c', 'Prone':      '#b45309',
      'Restrained': '#92400e', 'Deafened':   '#475569',
      'Unconscious':'#1e293b',
    }
    return map[c] || '#64748b'
  }

  _mod(score) {
    const m = Math.floor((score - 10) / 2)
    return m >= 0 ? `+${m}` : `${m}`
  }

  // ── Render ─────────────────────────────────────────────────────────────
  _render() {
    // Party totals
    let hpTotalCurr = 0, hpTotalMax = 0
    for (const p of this.players) {
      const sh = this.sheets[p.token]
      if (sh) { hpTotalCurr += (sh.hp_current || 0); hpTotalMax += (sh.hp_max || 0) }
    }

    const STATS = ['STR','DEX','CON','INT','WIS','CHA']

    const condBadge = (c) => {
      const col = this._conditionColor(c)
      return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:9px;font-weight:700;letter-spacing:.05em;background:${col}22;color:${col};border:1px solid ${col}55;">${c}</span>`
    }

    const playerCards = this.players.map(p => {
      const sh = this.sheets[p.token]
      const isSelected = this.selected === p.token
      const hpCurr = sh?.hp_current ?? null
      const hpMax  = sh?.hp_max     ?? null
      const hpPct  = hpCurr !== null && hpMax ? Math.min(100, Math.round((hpCurr / hpMax) * 100)) : null
      const hpColor = hpCurr !== null ? this._hpColor(hpCurr, hpMax) : '#4b5563'
      const conditions = sh?.conditions || []
      const hasConditions = conditions.length > 0

      const hpBar = hpPct !== null ? `
        <div style="background:rgba(255,255,255,0.10);border-radius:4px;height:7px;overflow:hidden;margin:6px 0;border:1px solid rgba(255,255,255,0.07);">
          <div style="height:100%;border-radius:4px;width:${hpPct}%;background:${hpColor};box-shadow:0 0 6px ${hpColor}66;transition:width .5s,background .3s;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-bottom:6px;">
          <span>HP ${hpCurr} / ${hpMax}</span>
          ${sh?.armor_class ? `<span>AC ${sh.armor_class}</span>` : ''}
          ${sh?.speed ? `<span>${sh.speed} ft</span>` : ''}
        </div>
      ` : `<div style="font-size:10px;color:#4b5563;font-style:italic;padding:6px 0;">Awaiting character data…</div>`

      const conditionsRow = hasConditions ? `
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">
          ${conditions.map(c => condBadge(c)).join('')}
        </div>
      ` : ''

      const expandedStats = isSelected && sh ? `
        <div style="border-top:1px solid rgba(179,129,53,0.15);margin-top:8px;padding-top:10px;">
          <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-bottom:10px;">
            ${(sh.stats || []).map(st => `
              <div style="text-align:center;background:rgba(0,0,0,0.4);border:1px solid rgba(179,129,53,0.2);border-radius:8px;padding:6px 2px;">
                <div style="font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:#a39c8e;">${st.name}</div>
                <div style="font-size:16px;font-weight:700;color:#e8c46a;">${st.value}</div>
                <div style="font-size:10px;color:#94a3b8;">${this._mod(st.value)}</div>
              </div>
            `).join('')}
          </div>
          ${sh.class_name ? `<div style="font-size:11px;color:#a39c8e;margin-bottom:4px;">🎭 ${sh.class_name} ${sh.subclass ? `• ${sh.subclass}` : ''}</div>` : ''}
          ${sh.background ? `<div style="font-size:11px;color:#a39c8e;margin-bottom:4px;">📜 Background: ${sh.background}</div>` : ''}
          ${sh.equipment  ? `<div style="font-size:11px;color:#a39c8e;max-height:60px;overflow:hidden;">🎒 ${sh.equipment}</div>` : ''}
        </div>
      ` : ''

      const statusDot = `<div style="width:9px;height:9px;border-radius:50%;background:${p.connected ? '#22c55e' : '#ef4444'};border:2px solid #080810;flex-shrink:0;"></div>`

      return `
        <div class="player-card" data-token="${p.token}" style="background:rgba(20,20,30,0.8);border:1px solid ${isSelected ? 'rgba(179,129,53,0.6)' : 'rgba(179,129,53,0.2)'};border-radius:12px;padding:14px;cursor:pointer;transition:border-color .2s,box-shadow .2s;box-shadow:${isSelected ? '0 0 20px rgba(179,129,53,0.15)' : 'none'};">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(p.name)}&backgroundColor=transparent" style="width:36px;height:36px;border-radius:50%;border:2px solid rgba(179,129,53,0.4);flex-shrink:0;" />
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:6px;">
                ${statusDot}
                <span style="font-weight:700;font-size:14px;color:#e8e4dc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sh?.name || p.name}</span>
              </div>
              ${sh ? `<div style="font-size:10px;color:#b38135;margin-top:1px;">${[sh.race, sh.class_name, sh.level ? `Lv${sh.level}` : ''].filter(Boolean).join(' • ')}</div>` : ''}
            </div>
            <button class="copy-link-btn btn btn-ghost" data-url="${p.join_url}" style="flex-shrink:0;padding:3px 7px;font-size:10px;" title="Copy join link">🔗</button>
          </div>
          ${hpBar}
          ${conditionsRow}
          ${expandedStats}
          ${isSelected ? '<div style="text-align:center;font-size:10px;color:#555;margin-top:4px;">▲ Click to collapse</div>' : '<div style="text-align:center;font-size:10px;color:#555;">▼ Click to expand stats</div>'}
        </div>
      `
    }).join('')

    this.innerHTML = `
<style>
  :host, core-rpg-dm { display:block; width:100%; font-family:'Inter',system-ui,sans-serif; }
  .player-card:hover { border-color:rgba(179,129,53,0.5) !important; }
</style>

<!-- Party Health Banner -->
<div style="background:linear-gradient(135deg,rgba(20,20,30,0.95),rgba(15,15,25,0.95));border:1px solid rgba(179,129,53,0.3);border-radius:14px;padding:18px 24px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;">
  <div>
    <div style="font-family:'Cinzel',serif;font-size:12px;text-transform:uppercase;letter-spacing:.15em;color:#b38135;margin-bottom:2px;">Party Health</div>
    <div style="font-size:11px;color:#64748b;">${this.players.length} hero${this.players.length !== 1 ? 'es' : ''} in session</div>
  </div>
  ${hpTotalMax > 0 ? `
    <div style="text-align:right;">
      <div style="font-family:'Cinzel',serif;font-size:28px;font-weight:700;color:${this._hpColor(hpTotalCurr, hpTotalMax)};">${hpTotalCurr}<span style="font-size:14px;color:#4b5563;"> / ${hpTotalMax}</span></div>
      <div style="background:rgba(255,255,255,0.08);border-radius:4px;height:6px;width:160px;overflow:hidden;margin-top:4px;">
        <div style="height:100%;width:${Math.min(100, Math.round((hpTotalCurr / hpTotalMax) * 100))}%;background:${this._hpColor(hpTotalCurr, hpTotalMax)};transition:width .5s;"></div>
      </div>
    </div>
  ` : '<div style="color:#4b5563;font-size:12px;font-style:italic;">No sheet data yet</div>'}
</div>

<!-- Player Cards Grid -->
${this.players.length === 0
  ? '<div style="text-align:center;color:#4b5563;font-style:italic;padding:40px 0;">No players connected. Share join links from the Dashboard.</div>'
  : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">${playerCards}</div>`
}
`
    // Bind events after render
    this.querySelectorAll('.player-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.copy-link-btn')) return
        const token = card.dataset.token
        this.selected = this.selected === token ? null : token
        this._render()
      })
    })

    this.querySelectorAll('.copy-link-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(btn.dataset.url).catch(() => {})
      })
    })
  }
}

customElements.define('core-rpg-dm', CoreRPGDm)
