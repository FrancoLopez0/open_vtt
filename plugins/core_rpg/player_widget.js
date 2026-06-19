/**
 * core-rpg-player — Full D&D 5e Character Sheet Widget
 * Sends data via the `send-ws` custom event → WS → server.
 */
class CoreRPGPlayer extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this.playerName = ''
    this.sheet = {
      name: '',
      race: '',
      class_name: '',
      subclass: '',
      level: 1,
      background: '',
      alignment: '',
      experience: 0,
      hp_current: 10,
      hp_max: 10,
      hp_temp: 0,
      mana_current: 0,
      mana_max: 0,
      armor_class: 10,
      initiative: 0,
      speed: 30,
      hit_dice: '1d8',
      proficiency_bonus: 2,
      inspiration: false,
      death_saves_success: 0,
      death_saves_failure: 0,
      stats: [
        { name: 'STR', value: 10 },
        { name: 'DEX', value: 10 },
        { name: 'CON', value: 10 },
        { name: 'INT', value: 10 },
        { name: 'WIS', value: 10 },
        { name: 'CHA', value: 10 },
      ],
      skills: [
        { name: 'Acrobatics',     ability: 'DEX', proficient: false },
        { name: 'Animal Handling',ability: 'WIS', proficient: false },
        { name: 'Arcana',         ability: 'INT', proficient: false },
        { name: 'Athletics',      ability: 'STR', proficient: false },
        { name: 'Deception',      ability: 'CHA', proficient: false },
        { name: 'History',        ability: 'INT', proficient: false },
        { name: 'Insight',        ability: 'WIS', proficient: false },
        { name: 'Intimidation',   ability: 'CHA', proficient: false },
        { name: 'Investigation',  ability: 'INT', proficient: false },
        { name: 'Medicine',       ability: 'WIS', proficient: false },
        { name: 'Nature',         ability: 'INT', proficient: false },
        { name: 'Perception',     ability: 'WIS', proficient: false },
        { name: 'Performance',    ability: 'CHA', proficient: false },
        { name: 'Persuasion',     ability: 'CHA', proficient: false },
        { name: 'Religion',       ability: 'INT', proficient: false },
        { name: 'Sleight of Hand',ability: 'DEX', proficient: false },
        { name: 'Stealth',        ability: 'DEX', proficient: false },
        { name: 'Survival',       ability: 'WIS', proficient: false },
      ],
      saving_throws: [
        { ability: 'STR', proficient: false },
        { ability: 'DEX', proficient: false },
        { ability: 'CON', proficient: false },
        { ability: 'INT', proficient: false },
        { ability: 'WIS', proficient: false },
        { ability: 'CHA', proficient: false },
      ],
      conditions: [],        // e.g. ['Poisoned', 'Stunned', 'Blinded']
      languages: '',
      proficiencies: '',
      traits: '',
      ideals: '',
      bonds: '',
      flaws: '',
      features: '',
      equipment: '',
      inventory: '',
      spells: '',
      notes: '',
      portrait_url: '',
    }
    this._saveTimeout = null
    this._conditionInput = ''
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────
  connectedCallback() {
    this._render()
    this._msgHandler = (e) => {
      const data = e.detail
      if (data.plugin !== 'core_rpg') return
      const payload = data.payload
      if (payload.action === 'sheet_data' || payload.action === 'sheet_updated') {
        this.sheet = { ...this.sheet, ...payload.sheet }
        this.playerName = payload.player || this.sheet.name
        this._updateDOM()
      }
    }
    window.addEventListener('plugin-message', this._msgHandler)
    this._send({ action: 'get_sheet' })
  }

  disconnectedCallback() {
    window.removeEventListener('plugin-message', this._msgHandler)
  }

  // ── WS communication ──────────────────────────────────────────────────
  _send(payload) {
    window.dispatchEvent(new CustomEvent('send-ws', {
      detail: { type: 'plugin_message', plugin: 'core_rpg', payload }
    }))
  }

  _scheduleSave() {
    clearTimeout(this._saveTimeout)
    this._saveTimeout = setTimeout(() => this._save(), 600)
  }

  _save() {
    this._readInputsIntoSheet()
    this._send({ action: 'save_sheet', sheet: this.sheet })
  }

  _readInputsIntoSheet() {
    const s = this.shadowRoot
    const v = (id) => s.getElementById(id)?.value ?? ''
    const n = (id) => parseInt(s.getElementById(id)?.value ?? '0', 10) || 0
    const chk = (id) => s.getElementById(id)?.checked ?? false

    this.sheet.name        = v('f-name')
    this.sheet.race        = v('f-race')
    this.sheet.class_name  = v('f-class')
    this.sheet.subclass    = v('f-subclass')
    this.sheet.level       = n('f-level')
    this.sheet.background  = v('f-background')
    this.sheet.alignment   = v('f-alignment')
    this.sheet.experience  = n('f-xp')
    this.sheet.hp_current  = n('f-hp-curr')
    this.sheet.hp_max      = n('f-hp-max')
    this.sheet.hp_temp     = n('f-hp-temp')
    this.sheet.armor_class = n('f-ac')
    this.sheet.initiative  = n('f-init')
    this.sheet.speed       = n('f-speed')
    this.sheet.hit_dice    = v('f-hit-dice')
    this.sheet.inspiration = chk('f-inspiration')
    this.sheet.proficiency_bonus = n('f-prof')
    this.sheet.traits      = v('f-traits')
    this.sheet.ideals      = v('f-ideals')
    this.sheet.bonds       = v('f-bonds')
    this.sheet.flaws       = v('f-flaws')
    this.sheet.features    = v('f-features')
    this.sheet.equipment   = v('f-equipment')
    this.sheet.inventory   = v('f-inventory')
    this.sheet.spells      = v('f-spells')
    this.sheet.notes       = v('f-notes')
    this.sheet.languages   = v('f-languages')
    this.sheet.proficiencies = v('f-proficiencies')

    this.sheet.stats.forEach((st, i) => {
      st.value = n(`f-stat-${i}`)
    })
    this.sheet.skills.forEach((sk, i) => {
      sk.proficient = chk(`f-skill-prof-${i}`)
    })
    this.sheet.saving_throws.forEach((sv, i) => {
      sv.proficient = chk(`f-sv-prof-${i}`)
    })
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  _mod(score) {
    const m = Math.floor((score - 10) / 2)
    return m >= 0 ? `+${m}` : `${m}`
  }

  _skillBonus(skill) {
    const stat = this.sheet.stats.find(s => s.name === skill.ability)
    const base = stat ? Math.floor((stat.value - 10) / 2) : 0
    const prof = skill.proficient ? (this.sheet.proficiency_bonus || 2) : 0
    const total = base + prof
    return total >= 0 ? `+${total}` : `${total}`
  }

  _svBonus(sv) {
    const stat = this.sheet.stats.find(s => s.name === sv.ability)
    const base = stat ? Math.floor((stat.value - 10) / 2) : 0
    const prof = sv.proficient ? (this.sheet.proficiency_bonus || 2) : 0
    const total = base + prof
    return total >= 0 ? `+${total}` : `${total}`
  }

  _conditionColor(c) {
    const map = {
      'Poisoned':   '#22c55e',
      'Blinded':    '#94a3b8',
      'Stunned':    '#f59e0b',
      'Paralyzed':  '#ef4444',
      'Frightened': '#a855f7',
      'Charmed':    '#ec4899',
      'Exhaustion': '#64748b',
      'Grappled':   '#f97316',
      'Incapacitated': '#dc2626',
      'Invisible':  '#c8b4e8',
      'Petrified':  '#78716c',
      'Prone':      '#b45309',
      'Restrained': '#92400e',
      'Deafened':   '#475569',
      'Unconscious':'#1e293b',
    }
    return map[c] || '#64748b'
  }

  _hpColor(curr, max) {
    const pct = max > 0 ? curr / max : 1
    if (pct >= 0.6) return '#22c55e'
    if (pct >= 0.3) return '#eab308'
    return '#ef4444'
  }

  // ── Full render (first load or after sheet data arrives) ───────────────
  _render() {
    const s = this.sheet
    const hpPct = s.hp_max > 0 ? Math.min(100, Math.round((s.hp_current / s.hp_max) * 100)) : 0
    const hpColor = this._hpColor(s.hp_current, s.hp_max)
    const manaPct = s.mana_max > 0 ? Math.min(100, Math.round((s.mana_current / s.mana_max) * 100)) : 0

    this.shadowRoot.innerHTML = `
<style>
  :host { display:block; font-family:'Inter',system-ui,sans-serif; color:#e8e4dc; background:#080810; width:100%; min-height:100%; box-sizing:border-box; }
  * { box-sizing:border-box; margin:0; padding:0; }

  /* Layout */
  .sheet { display:grid; grid-template-columns:260px 1fr 220px; gap:16px; padding:20px; min-height:100%; }
  @media(max-width:900px) { .sheet { grid-template-columns:1fr; } }

  /* Cards */
  .card { background:rgba(20,20,30,0.7); border:1px solid rgba(179,129,53,0.25); border-radius:12px; padding:16px; }
  .card-title { font-family:'Cinzel',serif; font-size:11px; text-transform:uppercase; letter-spacing:.12em; color:#b38135; border-bottom:1px solid rgba(179,129,53,0.2); padding-bottom:6px; margin-bottom:12px; }

  /* Identity header */
  .identity-header { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px; }
  .identity-header input, input, select { background:rgba(0,0,0,0.4); border:1px solid rgba(179,129,53,0.18); border-radius:6px; color:#e8e4dc; font-size:13px; padding:5px 8px; width:100%; outline:none; font-family:inherit; transition:border-color .2s; }
  input:focus, select:focus { border-color:#b38135; }
  textarea { background:rgba(0,0,0,0.4); border:1px solid rgba(179,129,53,0.18); border-radius:6px; color:#e8e4dc; font-size:12px; padding:6px 8px; width:100%; outline:none; font-family:inherit; resize:vertical; min-height:60px; transition:border-color .2s; }
  textarea:focus { border-color:#b38135; }
  label { font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#a39c8e; display:block; margin-bottom:3px; }
  .field { margin-bottom:8px; }
  .field-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px; }
  .field-row-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:8px; }

  /* Ability scores */
  .ability-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:6px; margin-bottom:12px; }
  @media(max-width:600px) { .ability-grid { grid-template-columns:repeat(3,1fr); } }
  .ability-box { background:linear-gradient(180deg,#1f1f2e,#13131f); border:1px solid rgba(179,129,53,0.25); border-radius:10px; text-align:center; padding:8px 4px; }
  .ability-name { font-family:'Cinzel',serif; font-size:9px; letter-spacing:.1em; color:#a39c8e; text-transform:uppercase; }
  .ability-score { display:block; width:100%; background:transparent; border:none; color:#e8c46a; font-family:'Cinzel',serif; font-size:22px; text-align:center; outline:none; }
  .ability-mod { font-size:13px; font-weight:700; color:#e8e4dc; margin-top:2px; }

  /* HP bar */
  .hp-track { background:rgba(255,255,255,0.08); border-radius:4px; height:8px; overflow:hidden; margin:6px 0; border:1px solid rgba(255,255,255,0.06); }
  .hp-fill { height:100%; border-radius:4px; transition:width .5s ease, background .3s; }

  /* Vitals row */
  .vitals-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:10px; }
  .vital-box { background:rgba(0,0,0,0.4); border:1px solid rgba(179,129,53,0.18); border-radius:8px; text-align:center; padding:8px; }
  .vital-box label { margin-bottom:4px; }
  .vital-value { font-family:'Cinzel',serif; font-size:20px; color:#e8c46a; }

  /* Skills */
  .skill-list { display:flex; flex-direction:column; gap:3px; }
  .skill-item { display:grid; grid-template-columns:16px 1fr 36px; gap:6px; align-items:center; font-size:12px; color:#a39c8e; }
  .skill-item input[type=checkbox] { accent-color:#b38135; width:13px; height:13px; cursor:pointer; }
  .skill-bonus { text-align:right; font-weight:700; color:#e8c46a; font-size:11px; }

  /* Saving throws */
  .sv-list { display:flex; flex-direction:column; gap:4px; margin-bottom:10px; }
  .sv-item { display:grid; grid-template-columns:16px 40px 1fr; gap:6px; align-items:center; font-size:12px; }
  .sv-item input[type=checkbox] { accent-color:#b38135; width:13px; height:13px; cursor:pointer; }
  .sv-bonus { font-weight:700; color:#e8c46a; font-size:11px; }

  /* Conditions */
  .conditions-area { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:8px; min-height:28px; }
  .condition-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:999px; font-size:10px; font-weight:700; letter-spacing:.05em; cursor:pointer; border:1px solid rgba(255,255,255,0.15); }
  .condition-badge:hover { opacity:.8; }
  .condition-add { display:flex; gap:6px; }
  .condition-add input { flex:1; }
  .condition-add button { background:rgba(179,129,53,0.2); border:1px solid rgba(179,129,53,0.4); border-radius:6px; color:#e8c46a; padding:4px 10px; cursor:pointer; font-size:12px; white-space:nowrap; }
  .condition-add button:hover { background:rgba(179,129,53,0.35); }

  /* Death saves */
  .death-saves { display:flex; gap:12px; margin-top:8px; }
  .ds-group { display:flex; align-items:center; gap:4px; font-size:11px; color:#a39c8e; }
  .ds-pips { display:flex; gap:3px; }
  .ds-pip { width:12px; height:12px; border-radius:50%; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.4); cursor:pointer; transition:background .2s; }
  .ds-pip.success.active { background:#22c55e; border-color:#16a34a; }
  .ds-pip.failure.active { background:#ef4444; border-color:#dc2626; }

  /* Inspiration badge */
  .insp-row { display:flex; align-items:center; gap:8px; font-size:12px; color:#a39c8e; margin-bottom:8px; }
  .insp-box { width:20px; height:20px; border-radius:4px; border:1px solid rgba(179,129,53,0.4); background:rgba(0,0,0,0.4); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:14px; }
  .insp-box.active { background:rgba(179,129,53,0.3); border-color:#b38135; }

  /* Scrollable col */
  .col-scroll { overflow-y:auto; max-height:calc(100vh - 80px); }
</style>

<div class="sheet">

  <!-- ══ LEFT COL ══ -->
  <div class="col-scroll" style="display:flex;flex-direction:column;gap:12px;">

    <!-- Identity -->
    <div class="card">
      <div class="card-title">Identity</div>
      <div class="field"><label>Character Name</label><input id="f-name" value="${s.name}" placeholder="Aurelia Solís" /></div>
      <div class="field-row">
        <div class="field"><label>Race</label><input id="f-race" value="${s.race}" placeholder="Human" /></div>
        <div class="field"><label>Class</label><input id="f-class" value="${s.class_name}" placeholder="Paladin" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Subclass</label><input id="f-subclass" value="${s.subclass}" placeholder="Oath of Devotion" /></div>
        <div class="field"><label>Level</label><input id="f-level" type="number" value="${s.level}" min="1" max="20" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Background</label><input id="f-background" value="${s.background}" placeholder="Noble" /></div>
        <div class="field"><label>Alignment</label><input id="f-alignment" value="${s.alignment}" placeholder="Lawful Good" /></div>
      </div>
      <div class="field"><label>Experience Points</label><input id="f-xp" type="number" value="${s.experience}" /></div>
    </div>

    <!-- Saving throws -->
    <div class="card">
      <div class="card-title">Saving Throws</div>
      <div class="sv-list">
        ${s.saving_throws.map((sv, i) => `
          <div class="sv-item">
            <input type="checkbox" id="f-sv-prof-${i}" ${sv.proficient ? 'checked' : ''} />
            <span class="sv-bonus">${this._svBonus(sv)}</span>
            <span>${sv.ability}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Proficiencies & Languages -->
    <div class="card">
      <div class="card-title">Proficiencies & Languages</div>
      <div class="field"><label>Proficiencies</label><textarea id="f-proficiencies">${s.proficiencies}</textarea></div>
      <div class="field"><label>Languages</label><textarea id="f-languages" style="min-height:44px;">${s.languages}</textarea></div>
    </div>
  </div>

  <!-- ══ CENTER COL ══ -->
  <div class="col-scroll" style="display:flex;flex-direction:column;gap:12px;">

    <!-- Ability Scores -->
    <div class="card">
      <div class="card-title">Ability Scores</div>
      <div class="ability-grid">
        ${s.stats.map((st, i) => `
          <div class="ability-box">
            <div class="ability-name">${st.name}</div>
            <input class="ability-score" id="f-stat-${i}" type="number" value="${st.value}" min="1" max="30" />
            <div class="ability-mod" id="mod-${i}">${this._mod(st.value)}</div>
          </div>
        `).join('')}
      </div>

      <!-- Proficiency, Initiative, Speed -->
      <div class="field-row-3">
        <div class="vital-box"><label>Prof. Bonus</label><input id="f-prof" type="number" value="${s.proficiency_bonus}" min="2" max="6" style="text-align:center;background:transparent;border:none;font-size:20px;color:#e8c46a;font-family:'Cinzel',serif;" /></div>
        <div class="vital-box"><label>Initiative</label><input id="f-init" type="number" value="${s.initiative}" style="text-align:center;background:transparent;border:none;font-size:20px;color:#e8c46a;font-family:'Cinzel',serif;" /></div>
        <div class="vital-box"><label>Speed (ft)</label><input id="f-speed" type="number" value="${s.speed}" min="0" step="5" style="text-align:center;background:transparent;border:none;font-size:20px;color:#e8c46a;font-family:'Cinzel',serif;" /></div>
      </div>
    </div>

    <!-- HP -->
    <div class="card">
      <div class="card-title">Hit Points</div>
      <div class="hp-track"><div class="hp-fill" id="hp-fill" style="width:${hpPct}%;background:${hpColor};box-shadow:0 0 8px ${hpColor}66;"></div></div>
      <div class="field-row-3">
        <div class="field"><label>Current HP</label><input id="f-hp-curr" type="number" value="${s.hp_current}" min="0" /></div>
        <div class="field"><label>Max HP</label><input id="f-hp-max" type="number" value="${s.hp_max}" min="1" /></div>
        <div class="field"><label>Temp HP</label><input id="f-hp-temp" type="number" value="${s.hp_temp}" min="0" /></div>
      </div>
      <div class="field-row">
        <div class="vital-box"><label>Hit Dice</label><input id="f-hit-dice" value="${s.hit_dice}" placeholder="1d8" style="text-align:center;background:transparent;border:none;color:#e8c46a;font-family:'Cinzel',serif;font-size:16px;" /></div>
        <div class="vital-box"><label>Armor Class</label><input id="f-ac" type="number" value="${s.armor_class}" style="text-align:center;background:transparent;border:none;font-size:20px;color:#e8c46a;font-family:'Cinzel',serif;" /></div>
      </div>
      <div class="insp-row">
        <div class="insp-box ${s.inspiration ? 'active' : ''}" id="f-inspiration-btn">✦</div>
        <span>Inspiration</span>
        <input type="checkbox" id="f-inspiration" ${s.inspiration ? 'checked' : ''} style="display:none;" />
      </div>
      <!-- Death saves -->
      <div class="death-saves">
        <div class="ds-group">
          <span>Successes</span>
          <div class="ds-pips">
            ${[0,1,2].map(i => `<div class="ds-pip success ${i < s.death_saves_success ? 'active' : ''}" data-ds-type="success" data-ds-idx="${i}"></div>`).join('')}
          </div>
        </div>
        <div class="ds-group">
          <span>Failures</span>
          <div class="ds-pips">
            ${[0,1,2].map(i => `<div class="ds-pip failure ${i < s.death_saves_failure ? 'active' : ''}" data-ds-type="failure" data-ds-idx="${i}"></div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- Mana (optional) -->
    ${s.mana_max > 0 ? `
    <div class="card">
      <div class="card-title">Spell Points / Mana</div>
      <div class="hp-track"><div class="hp-fill" style="width:${manaPct}%;background:#818cf8;box-shadow:0 0 8px #818cf866;"></div></div>
      <div class="field-row">
        <div class="field"><label>Current</label><input id="f-mana-curr" type="number" value="${s.mana_current}" /></div>
        <div class="field"><label>Max</label><input id="f-mana-max" type="number" value="${s.mana_max}" /></div>
      </div>
    </div>
    ` : ''}

    <!-- Personality -->
    <div class="card">
      <div class="card-title">Personality</div>
      <div class="field"><label>Traits</label><textarea id="f-traits">${s.traits}</textarea></div>
      <div class="field"><label>Ideals</label><textarea id="f-ideals">${s.ideals}</textarea></div>
      <div class="field"><label>Bonds</label><textarea id="f-bonds">${s.bonds}</textarea></div>
      <div class="field"><label>Flaws</label><textarea id="f-flaws">${s.flaws}</textarea></div>
    </div>

    <!-- Features & Spells -->
    <div class="card">
      <div class="card-title">Features & Special Abilities</div>
      <div class="field"><textarea id="f-features" style="min-height:80px;">${s.features}</textarea></div>
      <div class="card-title" style="margin-top:8px;">Spells & Abilities</div>
      <div class="field"><textarea id="f-spells" style="min-height:80px;">${s.spells}</textarea></div>
    </div>

    <!-- Notes -->
    <div class="card">
      <div class="card-title">Notes</div>
      <textarea id="f-notes" style="min-height:80px;">${s.notes}</textarea>
    </div>
  </div>

  <!-- ══ RIGHT COL ══ -->
  <div class="col-scroll" style="display:flex;flex-direction:column;gap:12px;">

    <!-- Skills -->
    <div class="card">
      <div class="card-title">Skills</div>
      <div class="skill-list">
        ${s.skills.map((sk, i) => `
          <div class="skill-item">
            <input type="checkbox" id="f-skill-prof-${i}" ${sk.proficient ? 'checked' : ''} />
            <span>${sk.name} <span style="color:#555;font-size:10px;">${sk.ability}</span></span>
            <span class="skill-bonus" id="sk-bonus-${i}">${this._skillBonus(sk)}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Conditions / Status Effects -->
    <div class="card">
      <div class="card-title">⚡ Status Effects & Conditions</div>
      <div class="conditions-area" id="conditions-area">
        ${(s.conditions || []).map(c => `
          <span class="condition-badge" style="background:${this._conditionColor(c)}22;color:${this._conditionColor(c)};border-color:${this._conditionColor(c)}55;" data-condition="${c}" title="Click to remove">
            ${c} ✕
          </span>
        `).join('')}
      </div>
      <!-- Quick conditions -->
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">
        ${['Poisoned','Stunned','Blinded','Frightened','Charmed','Exhaustion','Grappled','Paralyzed','Prone','Restrained'].map(c => `
          <button class="quick-condition" data-qc="${c}" style="font-size:9px;padding:2px 7px;border-radius:999px;border:1px solid ${this._conditionColor(c)}55;background:${this._conditionColor(c)}18;color:${this._conditionColor(c)};cursor:pointer;">${c}</button>
        `).join('')}
      </div>
      <div class="condition-add">
        <input id="condition-input" placeholder="Custom condition…" />
        <button id="condition-add-btn">+ Add</button>
      </div>
    </div>

    <!-- Equipment & Inventory -->
    <div class="card">
      <div class="card-title">Equipment</div>
      <div class="field"><textarea id="f-equipment" style="min-height:60px;">${s.equipment}</textarea></div>
      <div class="card-title" style="margin-top:8px;">Inventory</div>
      <div class="field"><textarea id="f-inventory" style="min-height:60px;">${s.inventory}</textarea></div>
    </div>
  </div>
</div>
`
    this._bindEvents()
  }

  // ── Bind interactive events after render ───────────────────────────────
  _bindEvents() {
    const sr = this.shadowRoot

    // All inputs/textareas → schedule save
    sr.querySelectorAll('input:not([type=checkbox]), textarea').forEach(el => {
      el.addEventListener('input', () => this._scheduleSave())
    })
    sr.querySelectorAll('input[type=checkbox]').forEach(el => {
      el.addEventListener('change', () => this._scheduleSave())
    })

    // Ability score live modifiers
    this.sheet.stats.forEach((_, i) => {
      const inp = sr.getElementById(`f-stat-${i}`)
      const mod = sr.getElementById(`mod-${i}`)
      if (inp && mod) {
        inp.addEventListener('input', () => {
          mod.textContent = this._mod(parseInt(inp.value) || 10)
          this._updateSkillBonuses()
          this._scheduleSave()
        })
      }
    })

    // Proficiency changes → update skill bonuses
    sr.querySelectorAll('[id^="f-skill-prof-"]').forEach(el => {
      el.addEventListener('change', () => {
        this._updateSkillBonuses()
        this._scheduleSave()
      })
    })

    // HP live fill
    const hpCurr = sr.getElementById('f-hp-curr')
    const hpMax  = sr.getElementById('f-hp-max')
    const fill   = sr.getElementById('hp-fill')
    if (hpCurr && hpMax && fill) {
      const updateBar = () => {
        const curr = parseInt(hpCurr.value) || 0
        const max  = parseInt(hpMax.value)  || 1
        const pct  = Math.min(100, Math.round((curr / max) * 100))
        const col  = this._hpColor(curr, max)
        fill.style.width = pct + '%'
        fill.style.background = col
        fill.style.boxShadow = `0 0 8px ${col}66`
      }
      hpCurr.addEventListener('input', updateBar)
      hpMax.addEventListener('input', updateBar)
    }

    // Inspiration toggle
    const inspBtn = sr.getElementById('f-inspiration-btn')
    const inspCbx = sr.getElementById('f-inspiration')
    if (inspBtn && inspCbx) {
      inspBtn.addEventListener('click', () => {
        inspCbx.checked = !inspCbx.checked
        inspBtn.classList.toggle('active', inspCbx.checked)
        this._scheduleSave()
      })
    }

    // Conditions — remove on click
    sr.getElementById('conditions-area').addEventListener('click', (e) => {
      const badge = e.target.closest('.condition-badge')
      if (badge) {
        const cond = badge.dataset.condition
        this.sheet.conditions = (this.sheet.conditions || []).filter(c => c !== cond)
        this._refreshConditions()
        this._scheduleSave()
      }
    })

    // Quick conditions
    sr.querySelectorAll('.quick-condition').forEach(btn => {
      btn.addEventListener('click', () => {
        const cond = btn.dataset.qc
        if (!(this.sheet.conditions || []).includes(cond)) {
          this.sheet.conditions = [...(this.sheet.conditions || []), cond]
          this._refreshConditions()
          this._scheduleSave()
        }
      })
    })

    // Custom condition add
    const condInput = sr.getElementById('condition-input')
    const condAddBtn = sr.getElementById('condition-add-btn')
    const addCondition = () => {
      const val = condInput.value.trim()
      if (val && !(this.sheet.conditions || []).includes(val)) {
        this.sheet.conditions = [...(this.sheet.conditions || []), val]
        condInput.value = ''
        this._refreshConditions()
        this._scheduleSave()
      }
    }
    condAddBtn.addEventListener('click', addCondition)
    condInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addCondition() })

    // Death saves
    sr.querySelectorAll('[data-ds-type]').forEach(pip => {
      pip.addEventListener('click', () => {
        const type = pip.dataset.dsType
        const idx = parseInt(pip.dataset.dsIdx)
        if (type === 'success') {
          this.sheet.death_saves_success = this.sheet.death_saves_success === idx + 1 ? idx : idx + 1
        } else {
          this.sheet.death_saves_failure = this.sheet.death_saves_failure === idx + 1 ? idx : idx + 1
        }
        this._refreshDeathSaves()
        this._scheduleSave()
      })
    })
  }

  _updateSkillBonuses() {
    this._readInputsIntoSheet()
    this.sheet.skills.forEach((sk, i) => {
      const el = this.shadowRoot.getElementById(`sk-bonus-${i}`)
      if (el) el.textContent = this._skillBonus(sk)
    })
  }

  _refreshConditions() {
    const area = this.shadowRoot.getElementById('conditions-area')
    if (!area) return
    area.innerHTML = (this.sheet.conditions || []).map(c => `
      <span class="condition-badge" style="background:${this._conditionColor(c)}22;color:${this._conditionColor(c)};border-color:${this._conditionColor(c)}55;" data-condition="${c}" title="Click to remove">
        ${c} ✕
      </span>
    `).join('')
  }

  _refreshDeathSaves() {
    const sr = this.shadowRoot
    ;[0,1,2].forEach(i => {
      const sp = sr.querySelector(`[data-ds-type="success"][data-ds-idx="${i}"]`)
      const fp = sr.querySelector(`[data-ds-type="failure"][data-ds-idx="${i}"]`)
      if (sp) sp.classList.toggle('active', i < this.sheet.death_saves_success)
      if (fp) fp.classList.toggle('active', i < this.sheet.death_saves_failure)
    })
  }

  // ── Lightweight DOM update (when sheet data arrives from WS) ──────────
  _updateDOM() {
    // If not rendered yet, do a full render
    if (!this.shadowRoot.getElementById('f-name')) {
      this._render()
      return
    }
    const s = this.sheet
    const set = (id, val) => { const el = this.shadowRoot.getElementById(id); if (el) el.value = val }
    set('f-name', s.name); set('f-race', s.race); set('f-class', s.class_name)
    set('f-level', s.level); set('f-hp-curr', s.hp_current); set('f-hp-max', s.hp_max)
    set('f-hp-temp', s.hp_temp); set('f-ac', s.armor_class); set('f-speed', s.speed)
    set('f-prof', s.proficiency_bonus)

    s.stats.forEach((st, i) => {
      set(`f-stat-${i}`, st.value)
      const mod = this.shadowRoot.getElementById(`mod-${i}`)
      if (mod) mod.textContent = this._mod(st.value)
    })

    const fill = this.shadowRoot.getElementById('hp-fill')
    if (fill) {
      const pct = s.hp_max > 0 ? Math.min(100, Math.round((s.hp_current / s.hp_max) * 100)) : 0
      const col = this._hpColor(s.hp_current, s.hp_max)
      fill.style.width = pct + '%'
      fill.style.background = col
      fill.style.boxShadow = `0 0 8px ${col}66`
    }

    this._refreshConditions()
    this._updateSkillBonuses()
  }
}

customElements.define('core-rpg-player', CoreRPGPlayer)
