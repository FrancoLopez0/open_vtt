/**
 * core-rpg-player — Premium Dark Fantasy Character Sheet
 */
class CoreRPGPlayer extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this.playerName = ""
    this.sheet = {
      name: "",
      race: "",
      class_name: "",
      level: 1,
      hp_current: 28,
      hp_max: 45,
      mana_current: 15,
      mana_max: 22,
      stats: [
        { name: "STR", value: 15 },
        { name: "DEX", value: 10 },
        { name: "CON", value: 13 },
        { name: "INT", value: 19 },
        { name: "WIS", value: 16 },
        { name: "CHA", value: 18 }
      ],
      skills: [
        { name: "Athletics", val: "+3" }, { name: "Stealth", val: "+6" },
        { name: "Acrobatics", val: "+5" }, { name: "Nature", val: "+2" },
        { name: "Arcana", val: "+6" }, { name: "History", val: "+3" },
        { name: "Insight", val: "+3" }, { name: "Religion", val: "+4" }
      ],
      inventory: ""
    }
    this._saveTimeout = null
  }

  connectedCallback() {
    this._render()
    
    this._msgHandler = (e) => {
      const data = e.detail
      if (data.plugin === "core_rpg") {
        const payload = data.payload
        if (payload.action === "sheet_data" || payload.action === "sheet_updated") {
          // Merge data
          this.sheet = { ...this.sheet, ...payload.sheet }
          this.playerName = payload.player || this.sheet.name
          this._updateDOM()
        }
      }
    }
    window.addEventListener('plugin-message', this._msgHandler)
    this._send({ action: "get_sheet" })
  }

  disconnectedCallback() {
    window.removeEventListener('plugin-message', this._msgHandler)
  }

  _send(payload) {
    window.dispatchEvent(new CustomEvent('send-ws', {
      detail: { type: "plugin_message", plugin: "core_rpg", payload }
    }))
  }

  _save() {
    this.sheet.hp_current = Number(this.shadowRoot.getElementById('hp-curr').value)
    this.sheet.hp_max = Number(this.shadowRoot.getElementById('hp-max').value)
    // Send update
    this._send({ action: "save_sheet", sheet: this.sheet })
  }

  _scheduleSave() {
    clearTimeout(this._saveTimeout)
    this._saveTimeout = setTimeout(() => this._save(), 500)
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: 'Inter', system-ui, sans-serif;
          color: #e8e4dc;
          width: 100%;
          height: 100%;
        }
        * { box-sizing: border-box; }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 20px;
          border-bottom: 1px solid rgba(179,129,53,0.3);
          padding-bottom: 8px;
        }
        .header h2 {
          font-family: 'Cinzel', serif;
          font-size: 24px;
          color: #e8e4dc;
          margin: 0;
          letter-spacing: 0.05em;
        }
        .header h2 span { color: #a39c8e; }
        .header .font-tag { font-family: 'Cinzel', serif; color: #b38135; font-size: 14px; }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        
        /* Panel Styles */
        .panel {
          background: rgba(20,20,30,0.6);
          border: 1px solid rgba(179,129,53,0.2);
          border-radius: 12px;
          padding: 20px;
          box-shadow: inset 0 0 20px rgba(0,0,0,0.5), 0 4px 15px rgba(0,0,0,0.3);
          display: flex;
          flex-direction: column;
        }
        .panel h3 {
          font-family: 'Cinzel', serif;
          color: #cfaa66;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin: 0 0 16px 0;
          border-bottom: 1px solid rgba(179,129,53,0.2);
          padding-bottom: 8px;
        }

        /* Stat Grid */
        .stat-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        .stat-box {
          background: linear-gradient(180deg, #1f1f2e 0%, #13131f 100%);
          border: 1px solid #2a2a35;
          border-radius: 8px;
          box-shadow: inset 0 4px 10px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3);
          text-align: center;
          padding: 10px 4px;
        }
        .stat-box label {
          display: block;
          font-family: 'Cinzel', serif;
          font-size: 12px;
          color: #a39c8e;
          margin-bottom: 4px;
        }
        .stat-box input {
          background: transparent;
          border: none;
          color: #e8c46a;
          font-family: 'Cinzel', serif;
          font-size: 24px;
          text-align: center;
          width: 100%;
          outline: none;
          text-shadow: 0 0 10px rgba(232,196,106,0.2);
        }

        /* Skills */
        .skills-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          font-size: 14px;
          color: #a39c8e;
        }
        .skill-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .skill-input {
          background: transparent;
          border: none;
          color: #e8c46a;
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 14px;
          text-align: right;
          width: 50px;
          outline: none;
          transition: border-bottom 0.2s;
          border-bottom: 1px solid transparent;
        }
        .skill-input:focus {
          border-bottom: 1px solid #b38135;
        }

        /* Vitals */
        .vitals-container { margin-top: 24px; }
        .vital-row {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
        }
        .vital-label { width: 50px; font-weight: 500; font-family: 'Cinzel', serif; }
        .vital-inputs { display: flex; align-items: center; width: 80px; gap: 4px; }
        .vital-inputs input { width: 30px; background: transparent; border: none; color: #fff; text-align: right; outline: none; font-size: 14px; }
        .vital-inputs span { color: #666; }
        .vital-blocks {
          display: flex;
          gap: 4px;
          flex: 1;
        }
        .vital-block {
          width: 12px;
          height: 16px;
          border-radius: 2px;
          background: #1f1f2e;
          border: 1px solid #13131f;
          box-shadow: inset 0 0 4px rgba(0,0,0,0.8);
        }
        .vital-block.hp-filled {
          background: linear-gradient(180deg, #e87a7a 0%, #d14d59 100%);
          box-shadow: 0 0 8px rgba(209,77,89,0.5), inset 0 1px 0 rgba(255,255,255,0.3);
          border-color: #a33b45;
        }
        .vital-block.mana-filled {
          background: linear-gradient(180deg, #7ab4e8 0%, #4d96d1 100%);
          box-shadow: 0 0 8px rgba(77,150,209,0.5), inset 0 1px 0 rgba(255,255,255,0.3);
          border-color: #3b75a3;
        }

        /* Equipment */
        .equipment-box {
          background: #0a0a0f;
          border: 1px solid rgba(179,129,53,0.3);
          border-radius: 8px;
          height: 60px;
          margin-top: 16px;
          box-shadow: inset 0 2px 10px rgba(0,0,0,0.8);
        }

        /* Quick Actions */
        .actions-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .action-btn {
          background: transparent;
          border: none;
          color: #a39c8e;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: color 0.2s;
          padding: 8px 0;
        }
        .action-btn:hover { color: #e8c46a; }
        .action-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: linear-gradient(180deg, #2a2a35 0%, #13131f 100%);
          border: 1px solid rgba(179,129,53,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        }
      </style>

      <div class="header">
        <h2>PLAYER DASHBOARD <span id="dash-title">- The Shadowed Halls</span></h2>
        <span class="font-tag">Cinzel</span>
      </div>

      <div class="dashboard-grid">
        <!-- Left Column -->
        <div style="display:flex; flex-direction:column; gap:24px;">
          <div class="panel">
            <h3 id="char-title">CHARACTER SHEET</h3>
            
            <div class="stat-grid" id="stat-grid">
              <!-- Stats injected here -->
            </div>

            <div class="skills-section">
              <h3 style="margin-top:8px;">SKILLS</h3>
              <div class="skills-grid" id="skills-grid">
                <!-- Skills injected here -->
              </div>
            </div>

            <div class="vitals-container">
              <h3>DYNAMIC VITALS</h3>
              
              <div class="vital-row">
                <div class="vital-label">HP</div>
                <div class="vital-inputs">
                  <input type="number" id="hp-curr" value="28" /><span>/</span><input type="number" id="hp-max" value="45" />
                </div>
                <div class="vital-blocks" id="hp-blocks"></div>
              </div>
              
              <div class="vital-row">
                <div class="vital-label">Mana</div>
                <div class="vital-inputs">
                  <input type="number" id="mana-curr" value="15" readonly /><span>/</span><input type="number" id="mana-max" value="22" readonly />
                </div>
                <div class="vital-blocks" id="mana-blocks"></div>
              </div>
            </div>

            <div style="margin-top: 24px;">
              <h3>EQUIPMENT</h3>
              <div class="equipment-box"></div>
            </div>
          </div>
        </div>

        <!-- Right Column -->
        <div style="display:flex; flex-direction:column; gap:24px;">
          <!-- Party Status injected natively via React since it's global, but we mock it here if needed. Actually we'll leave this empty or put Quick Actions here -->
          <div class="panel">
            <h3>QUICK ACTIONS</h3>
            <div class="actions-grid">
              <button class="action-btn">
                <div class="action-icon">🗡️</div>
                <span>Primary Attack<br/><small style="color:#666">(Longsword)</small></span>
              </button>
              <button class="action-btn">
                <div class="action-icon">🔥</div>
                <span>Cast Spell</span>
              </button>
              <button class="action-btn">
                <div class="action-icon">🎒</div>
                <span>Use Item</span>
              </button>
              <button class="action-btn">
                <div class="action-icon">💨</div>
                <span>Disengage</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `

    this.shadowRoot.addEventListener('input', (e) => {
      const target = e.target;
      if (target.dataset.type === 'stat') {
        const idx = parseInt(target.dataset.idx, 10);
        if (!isNaN(idx) && this.sheet.stats[idx]) {
          this.sheet.stats[idx].value = target.value;
          this._scheduleSave();
        }
      } else if (target.dataset.type === 'skill') {
        const idx = parseInt(target.dataset.idx, 10);
        if (!isNaN(idx) && this.sheet.skills[idx]) {
          this.sheet.skills[idx].val = target.value;
          this._scheduleSave();
        }
      } else if (target.id === 'hp-curr' || target.id === 'hp-max') {
        this._scheduleSave();
      }
    })
    
    this._updateDOM()
  }

  _updateDOM() {
    if (!this.shadowRoot.getElementById('dash-title')) return

    const name = this.sheet.name || this.playerName || "Unknown"
    this.shadowRoot.getElementById('char-title').textContent = `CHARACTER SHEET: ${name}`

    // Stats
    const statGrid = this.shadowRoot.getElementById('stat-grid')
    statGrid.innerHTML = ''
    this.sheet.stats.forEach((s, idx) => {
      statGrid.innerHTML += `
        <div class="stat-box">
          <label>${s.name}</label>
          <input type="text" data-type="stat" data-idx="${idx}" value="${s.value}" />
        </div>
      `
    })

    // Skills
    const skillsGrid = this.shadowRoot.getElementById('skills-grid')
    skillsGrid.innerHTML = ''
    this.sheet.skills.forEach((s, idx) => {
      skillsGrid.innerHTML += `
        <div class="skill-item">
          <span>${s.name}</span>
          <input type="text" data-type="skill" data-idx="${idx}" value="${s.val}" class="skill-input" />
        </div>
      `
    })

    // Vitals
    this.shadowRoot.getElementById('hp-curr').value = this.sheet.hp_current || 0
    this.shadowRoot.getElementById('hp-max').value = this.sheet.hp_max || 1

    const hpBlocks = this.shadowRoot.getElementById('hp-blocks')
    hpBlocks.innerHTML = ''
    const maxBlocks = 10
    const hpRatio = (this.sheet.hp_current || 0) / Math.max(1, (this.sheet.hp_max || 1))
    const filledHpBlocks = Math.round(hpRatio * maxBlocks)
    for (let i = 0; i < maxBlocks; i++) {
      hpBlocks.innerHTML += `<div class="vital-block ${i < filledHpBlocks ? 'hp-filled' : ''}"></div>`
    }

    const manaBlocks = this.shadowRoot.getElementById('mana-blocks')
    manaBlocks.innerHTML = ''
    const manaRatio = (this.sheet.mana_current || 0) / Math.max(1, (this.sheet.mana_max || 1))
    const filledManaBlocks = Math.round(manaRatio * maxBlocks)
    for (let i = 0; i < maxBlocks; i++) {
      manaBlocks.innerHTML += `<div class="vital-block ${i < filledManaBlocks ? 'mana-filled' : ''}"></div>`
    }
  }
}

customElements.define('core-rpg-player', CoreRPGPlayer)
