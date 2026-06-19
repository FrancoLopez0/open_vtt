/**
 * core-rpg-dm — DM View: party overview with real-time HP controls and status conditions
 */
class CoreRPGDm extends HTMLElement {
  constructor() {
    super()
    this.sheets   = {}    // playerToken -> sheetData
    this.players  = []    // [{token, name, connected, join_url}]
    this.selected = null  // expanded card token
    this.hpInputs = {}    // token -> pending HP delta value
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

    window.addEventListener('plugin-message',     this._msgHandler)
    window.addEventListener('vtt-players-update', this._playersHandler)

    if (window.__VTT_PLAYERS__) this._playersHandler({ detail: window.__VTT_PLAYERS__ })
  }

  disconnectedCallback() {
    window.removeEventListener('plugin-message',     this._msgHandler)
    window.removeEventListener('vtt-players-update', this._playersHandler)
  }

  // ── WS helpers ─────────────────────────────────────────────────────────
  _send(payload) {
    window.dispatchEvent(new CustomEvent('send-ws', {
      detail: { type: 'plugin_message', plugin: 'core_rpg', payload }
    }))
  }

  _requestSheet(token) {
    this._send({ action: 'get_sheet', target_player: token })
  }

  _adjustHp(token, delta) {
    this._send({ action: 'adjust_hp', target_player: token, delta })
  }

  _setHp(token, value) {
    this._send({ action: 'set_hp', target_player: token, value: parseInt(value) || 0 })
  }

  _addCondition(token, condition) {
    this._send({ action: 'add_condition', target_player: token, condition })
  }

  _removeCondition(token, condition) {
    this._send({ action: 'remove_condition', target_player: token, condition })
  }

  // ── Color helpers ──────────────────────────────────────────────────────
  _hpColor(curr, max) {
    const pct = max > 0 ? curr / max : 1
    if (pct >= 0.6) return '#22c55e'
    if (pct >= 0.3) return '#eab308'
    return '#ef4444'
  }

  _conditionColor(c) {
    const map = {
      'Poisoned':      '#22c55e', 'Blinded':       '#94a3b8',
      'Stunned':       '#f59e0b', 'Paralyzed':     '#ef4444',
      'Frightened':    '#a855f7', 'Charmed':       '#ec4899',
      'Exhaustion':    '#64748b', 'Grappled':      '#f97316',
      'Incapacitated': '#dc2626', 'Invisible':     '#c8b4e8',
      'Petrified':     '#78716c', 'Prone':         '#b45309',
      'Restrained':    '#92400e', 'Deafened':      '#475569',
      'Unconscious':   '#1e293b',
    }
    return map[c] || '#64748b'
  }

  _mod(score) {
    const m = Math.floor((score - 10) / 2)
    return m >= 0 ? `+${m}` : `${m}`
  }

  // ── Render ─────────────────────────────────────────────────────────────
  _render() {
    let hpTotalCurr = 0, hpTotalMax = 0
    for (const p of this.players) {
      const sh = this.sheets[p.token]
      if (sh) { hpTotalCurr += (sh.hp_current || 0); hpTotalMax += (sh.hp_max || 0) }
    }

    const QUICK_CONDITIONS = ['Poisoned','Stunned','Blinded','Frightened','Charmed',
                              'Exhaustion','Grappled','Paralyzed','Prone','Restrained']

    const condBadge = (token, c) => {
      const col = this._conditionColor(c)
      return `<span class="cond-badge" data-token="${token}" data-cond="${c}"
        style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:999px;
               font-size:9px;font-weight:700;letter-spacing:.04em;cursor:pointer;
               background:${col}22;color:${col};border:1px solid ${col}55;" title="Click to remove">
        ${c} <span style="opacity:.7;font-size:10px;">✕</span>
      </span>`
    }

    const playerCards = this.players.map(p => {
      const sh = this.sheets[p.token]
      const isSelected = this.selected === p.token
      const hpCurr  = sh?.hp_current ?? null
      const hpMax   = sh?.hp_max     ?? null
      const hpPct   = hpCurr !== null && hpMax ? Math.min(100, Math.round((hpCurr / hpMax) * 100)) : null
      const hpColor = hpCurr !== null ? this._hpColor(hpCurr, hpMax) : '#4b5563'
      const conditions = sh?.conditions || []

      // ── HP control bar (always visible if sheet exists) ────────────────
      const hpControls = sh ? `
        <div style="margin:6px 0 8px;">
          <!-- Bar -->
          <div style="background:rgba(255,255,255,0.10);border-radius:4px;height:8px;overflow:hidden;margin-bottom:5px;border:1px solid rgba(255,255,255,0.07);">
            <div style="height:100%;border-radius:4px;width:${hpPct}%;background:${hpColor};
                        box-shadow:0 0 6px ${hpColor}88;transition:width .4s,background .3s;"></div>
          </div>
          <!-- HP label + quick delta buttons -->
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span style="font-size:13px;font-weight:700;color:${hpColor};min-width:64px;">${hpCurr} <span style="color:#4b5563;font-size:10px;font-weight:400;">/ ${hpMax}</span></span>
            <!-- Quick damage buttons -->
            <button class="hp-quick" data-token="${p.token}" data-delta="-10" style="background:rgba(239,68,68,.18);border:1px solid rgba(239,68,68,.35);color:#f87171;">-10</button>
            <button class="hp-quick" data-token="${p.token}" data-delta="-5"  style="background:rgba(239,68,68,.18);border:1px solid rgba(239,68,68,.35);color:#f87171;">-5</button>
            <button class="hp-quick" data-token="${p.token}" data-delta="-1"  style="background:rgba(239,68,68,.18);border:1px solid rgba(239,68,68,.35);color:#f87171;">-1</button>
            <button class="hp-quick" data-token="${p.token}" data-delta="+1"  style="background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.35);color:#4ade80;">+1</button>
            <button class="hp-quick" data-token="${p.token}" data-delta="+5"  style="background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.35);color:#4ade80;">+5</button>
            <button class="hp-quick" data-token="${p.token}" data-delta="+10" style="background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.35);color:#4ade80;">+10</button>
          </div>
          <!-- Custom amount field -->
          <div style="display:flex;gap:5px;margin-top:6px;">
            <input type="number" class="hp-custom-input" data-token="${p.token}" placeholder="Amount…"
              style="flex:1;background:rgba(0,0,0,0.5);border:1px solid rgba(179,129,53,0.25);border-radius:6px;color:#e8e4dc;padding:4px 8px;font-size:12px;outline:none;" />
            <button class="hp-custom-dmg" data-token="${p.token}"
              style="padding:4px 10px;background:rgba(239,68,68,.2);border:1px solid rgba(239,68,68,.4);border-radius:6px;color:#f87171;font-size:11px;cursor:pointer;white-space:nowrap;">⚔ Damage</button>
            <button class="hp-custom-heal" data-token="${p.token}"
              style="padding:4px 10px;background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.4);border-radius:6px;color:#4ade80;font-size:11px;cursor:pointer;white-space:nowrap;">✦ Heal</button>
          </div>
        </div>
      ` : `<div style="font-size:10px;color:#4b5563;font-style:italic;padding:6px 0;margin-bottom:6px;">No sheet data — player must connect first.</div>`

      // ── Conditions row ─────────────────────────────────────────────────
      const conditionsRow = `
        <div style="margin-bottom:6px;">
          <div style="display:flex;flex-wrap:wrap;gap:4px;min-height:20px;margin-bottom:5px;" id="conds-${p.token}">
            ${conditions.length ? conditions.map(c => condBadge(p.token, c)).join('') : '<span style="font-size:10px;color:#4b5563;font-style:italic;">No active conditions</span>'}
          </div>
          <!-- Quick conditions -->
          <div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:4px;">
            ${QUICK_CONDITIONS.map(c => {
              const col = this._conditionColor(c)
              const active = conditions.includes(c)
              return `<button class="cond-quick" data-token="${p.token}" data-cond="${c}"
                style="font-size:9px;padding:2px 7px;border-radius:999px;cursor:pointer;
                border:1px solid ${col}55;background:${active ? col + '44' : col + '18'};
                color:${col};font-weight:${active ? '700' : '400'};">${c}</button>`
            }).join('')}
          </div>
        </div>
      `

      // ── Expanded stat grid ─────────────────────────────────────────────
      const expandedStats = isSelected && sh ? `
        <div style="border-top:1px solid rgba(179,129,53,0.15);margin-top:6px;padding-top:10px;">
          <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-bottom:8px;">
            ${(sh.stats || []).map(st => `
              <div style="text-align:center;background:rgba(0,0,0,0.4);border:1px solid rgba(179,129,53,0.2);border-radius:8px;padding:5px 2px;">
                <div style="font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:#a39c8e;">${st.name}</div>
                <div style="font-size:15px;font-weight:700;color:#e8c46a;">${st.value}</div>
                <div style="font-size:9px;color:#94a3b8;">${this._mod(st.value)}</div>
              </div>
            `).join('')}
          </div>
          <div style="display:flex;gap:12px;font-size:11px;color:#a39c8e;flex-wrap:wrap;">
            ${sh.armor_class ? `<span>🛡 AC ${sh.armor_class}</span>` : ''}
            ${sh.speed       ? `<span>💨 ${sh.speed} ft</span>`      : ''}
            ${sh.proficiency_bonus ? `<span>⭐ Prof +${sh.proficiency_bonus}</span>` : ''}
            ${sh.background  ? `<span>📜 ${sh.background}</span>`    : ''}
          </div>
          ${sh.features ? `<div style="font-size:10px;color:#64748b;margin-top:6px;max-height:48px;overflow:hidden;">${sh.features}</div>` : ''}
        </div>
      ` : ''

      const statusDot = p.connected
        ? '<div style="width:8px;height:8px;border-radius:50%;background:#22c55e;border:2px solid #080810;flex-shrink:0;box-shadow:0 0 6px #22c55e88;"></div>'
        : '<div style="width:8px;height:8px;border-radius:50%;background:#ef4444;border:2px solid #080810;flex-shrink:0;"></div>'

      return `
        <div class="player-card" data-token="${p.token}"
          style="background:rgba(20,20,30,0.85);border:1px solid ${isSelected ? 'rgba(179,129,53,0.55)' : 'rgba(179,129,53,0.2)'};
                 border-radius:12px;padding:14px;transition:border-color .2s,box-shadow .2s;
                 box-shadow:${isSelected ? '0 0 24px rgba(179,129,53,0.12)' : 'none'};">

          <!-- Header (click to expand) -->
          <div class="card-header" data-token="${p.token}" style="display:flex;align-items:center;gap:8px;margin-bottom:10px;cursor:pointer;">
            <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(p.name)}&backgroundColor=transparent"
              style="width:34px;height:34px;border-radius:50%;border:2px solid rgba(179,129,53,0.4);flex-shrink:0;" />
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:5px;">
                ${statusDot}
                <span style="font-weight:700;font-size:14px;color:#e8e4dc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sh?.name || p.name}</span>
              </div>
              ${sh ? `<div style="font-size:10px;color:#b38135;margin-top:1px;">${[sh.race, sh.class_name, sh.level ? `Lv${sh.level}` : ''].filter(Boolean).join(' • ')}</div>` : ''}
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0;">
              <button class="copy-link-btn" data-url="${p.join_url}"
                style="background:transparent;border:1px solid rgba(179,129,53,0.25);border-radius:6px;color:#a39c8e;padding:3px 7px;font-size:10px;cursor:pointer;" title="Copy join link">🔗</button>
              <span style="font-size:16px;color:#4b5563;user-select:none;">${isSelected ? '▲' : '▼'}</span>
            </div>
          </div>

          <!-- HP controls (always shown) -->
          ${hpControls}

          <!-- Conditions (always shown) -->
          ${conditionsRow}

          <!-- Expanded stats -->
          ${expandedStats}
        </div>
      `
    }).join('')

    this.innerHTML = `
<style>
  core-rpg-dm { display:block; width:100%; font-family:'Inter',system-ui,sans-serif; }
  .player-card { margin-bottom:0; }
  .player-card:hover { border-color:rgba(179,129,53,0.45) !important; }
  .hp-quick {
    padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;
    cursor:pointer;border-width:1px;border-style:solid;transition:opacity .15s;
  }
  .hp-quick:hover { opacity:.8; }
  .cond-quick:hover { opacity:.8; }
  .cond-badge:hover { opacity:.7; }
</style>

<!-- Party Health Banner -->
<div style="background:linear-gradient(135deg,rgba(20,20,30,.95),rgba(15,15,25,.95));
            border:1px solid rgba(179,129,53,.3);border-radius:14px;padding:16px 22px;
            margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;">
  <div>
    <div style="font-family:'Cinzel',serif;font-size:12px;text-transform:uppercase;letter-spacing:.15em;color:#b38135;margin-bottom:2px;">Party Health</div>
    <div style="font-size:11px;color:#64748b;">${this.players.length} hero${this.players.length !== 1 ? 'es' : ''} in session</div>
  </div>
  ${hpTotalMax > 0 ? `
    <div style="text-align:right;">
      <div style="font-family:'Cinzel',serif;font-size:26px;font-weight:700;color:${this._hpColor(hpTotalCurr, hpTotalMax)};">
        ${hpTotalCurr}<span style="font-size:13px;color:#4b5563;"> / ${hpTotalMax}</span>
      </div>
      <div style="background:rgba(255,255,255,.08);border-radius:4px;height:6px;width:150px;overflow:hidden;margin-top:4px;">
        <div style="height:100%;width:${Math.min(100, Math.round((hpTotalCurr / hpTotalMax) * 100))}%;
                    background:${this._hpColor(hpTotalCurr, hpTotalMax)};transition:width .5s;"></div>
      </div>
    </div>
  ` : '<div style="color:#4b5563;font-size:12px;font-style:italic;">No sheet data yet</div>'}
</div>

<!-- Player Cards Grid -->
${this.players.length === 0
  ? '<div style="text-align:center;color:#4b5563;font-style:italic;padding:40px 0;">No players connected.</div>'
  : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;">${playerCards}</div>`
}
`
    this._bindEvents()
  }

  // ── Event binding ──────────────────────────────────────────────────────
  _bindEvents() {
    // Expand/collapse on header click
    this.querySelectorAll('.card-header').forEach(header => {
      header.addEventListener('click', () => {
        const token = header.dataset.token
        this.selected = this.selected === token ? null : token
        this._render()
      })
    })

    // Copy link
    this.querySelectorAll('.copy-link-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(btn.dataset.url).catch(() => {})
      })
    })

    // Quick HP buttons (±1/5/10)
    this.querySelectorAll('.hp-quick').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const token = btn.dataset.token
        const delta = parseInt(btn.dataset.delta)
        this._adjustHp(token, delta)
      })
    })

    // Custom damage/heal
    this.querySelectorAll('.hp-custom-dmg').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const token = btn.dataset.token
        const input = this.querySelector(`.hp-custom-input[data-token="${token}"]`)
        const val = parseInt(input?.value) || 0
        if (val > 0) { this._adjustHp(token, -val); if (input) input.value = '' }
      })
    })

    this.querySelectorAll('.hp-custom-heal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const token = btn.dataset.token
        const input = this.querySelector(`.hp-custom-input[data-token="${token}"]`)
        const val = parseInt(input?.value) || 0
        if (val > 0) { this._adjustHp(token, val); if (input) input.value = '' }
      })
    })

    // Enter in HP input → damage
    this.querySelectorAll('.hp-custom-input').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const token = input.dataset.token
          const val = parseInt(input.value) || 0
          if (val !== 0) { this._adjustHp(token, -Math.abs(val)); input.value = '' }
        }
      })
    })

    // Quick condition toggle
    this.querySelectorAll('.cond-quick').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const token = btn.dataset.token
        const cond  = btn.dataset.cond
        const sh    = this.sheets[token]
        const has   = (sh?.conditions || []).includes(cond)
        if (has) this._removeCondition(token, cond)
        else     this._addCondition(token, cond)
      })
    })

    // Remove condition badge click
    this.querySelectorAll('.cond-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation()
        this._removeCondition(badge.dataset.token, badge.dataset.cond)
      })
    })
  }
}

customElements.define('core-rpg-dm', CoreRPGDm)
