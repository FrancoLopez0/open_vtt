/**
 * core-rpg-player — Generic Character Sheet Widget
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
      hp_current: 0,
      hp_max: 0,
      stats: [],
      inventory: ""
    }
    this._saveTimeout = null
  }

  connectedCallback() {
    this._render()
    
    // We get our player name from the main app or assume it's sent to us.
    // The main app dispatches "plugin-message" events on the window.
    this._msgHandler = (e) => {
      const data = e.detail
      if (data.plugin === "core_rpg") {
        const payload = data.payload
        if (payload.action === "sheet_data" || payload.action === "sheet_updated") {
          // If it's my sheet, update
          // We can just accept it for now
          this.sheet = payload.sheet
          this.playerName = payload.player
          this._updateDOM()
        }
      }
    }
    window.addEventListener('plugin-message', this._msgHandler)

    // Request our sheet from the backend
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
    // Gather data from DOM
    this.sheet.name = this.shadowRoot.getElementById('char-name').value
    this.sheet.race = this.shadowRoot.getElementById('char-race').value
    this.sheet.class_name = this.shadowRoot.getElementById('char-class').value
    this.sheet.level = Number(this.shadowRoot.getElementById('char-level').value)
    this.sheet.hp_current = Number(this.shadowRoot.getElementById('hp-curr').value)
    this.sheet.hp_max = Number(this.shadowRoot.getElementById('hp-max').value)
    this.sheet.inventory = this.shadowRoot.getElementById('inventory').value
    
    const statRows = this.shadowRoot.querySelectorAll('.stat-row')
    this.sheet.stats = Array.from(statRows).map(row => ({
      name: row.querySelector('.stat-name').value,
      value: row.querySelector('.stat-val').value
    }))

    this._send({ action: "save_sheet", sheet: this.sheet })
    
    const saveBtn = this.shadowRoot.getElementById('save-btn')
    saveBtn.textContent = "Saved!"
    setTimeout(() => saveBtn.textContent = "Save Sheet", 2000)
  }

  _addStat() {
    this.sheet.stats.push({ name: "New Stat", value: "10" })
    this._updateDOM()
  }

  _removeStat(index) {
    this.sheet.stats.splice(index, 1)
    this._updateDOM()
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: 'Inter', system-ui, sans-serif;
          color: #e8e4dc;
        }
        .widget {
          background: #13131f;
          border: 1px solid rgba(179, 129, 53, 0.2);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        h4 {
          font-family: 'Cinzel', Georgia, serif;
          color: #e8c46a;
          font-size: 14px;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          border-bottom: 1px solid rgba(179, 129, 53, 0.2);
          padding-bottom: 8px;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .row {
          display: flex;
          gap: 12px;
        }
        label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #b38135;
        }
        input, textarea {
          background: #080810;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          padding: 8px;
          border-radius: 6px;
          font-family: inherit;
        }
        input:focus, textarea:focus {
          outline: none;
          border-color: #b38135;
        }
        .stat-row {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-bottom: 8px;
        }
        .stat-name { flex: 1; }
        .stat-val { width: 60px; text-align: center; }
        button {
          background: #1a1a2e;
          border: 1px solid rgba(179, 129, 53, 0.4);
          color: #e8c46a;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          font-family: 'Cinzel', serif;
        }
        button:hover { background: #b38135; color: #000; }
        .btn-small { padding: 4px 8px; font-size: 12px; font-family: 'Inter', sans-serif;}
      </style>

      <div class="widget">
        <h4>Character Sheet</h4>
        
        <div class="field">
          <label>Character Name</label>
          <input type="text" id="char-name" />
        </div>

        <div class="row">
          <div class="field" style="flex:1">
            <label>Race</label>
            <input type="text" id="char-race" />
          </div>
          <div class="field" style="flex:1">
            <label>Class</label>
            <input type="text" id="char-class" />
          </div>
          <div class="field" style="width:60px">
            <label>Level</label>
            <input type="number" id="char-level" />
          </div>
        </div>
        
        <div class="row">
          <div class="field" style="flex:1">
            <label>HP Current</label>
            <input type="number" id="hp-curr" />
          </div>
          <div class="field" style="flex:1">
            <label>HP Max</label>
            <input type="number" id="hp-max" />
          </div>
        </div>

        <div class="field">
          <label style="display:flex; justify-content:space-between">
            <span>Attributes / Skills</span>
            <button class="btn-small" id="add-stat-btn">+ Add</button>
          </label>
          <div id="stats-container"></div>
        </div>

        <div class="field">
          <label>Inventory / Notes</label>
          <textarea id="inventory" rows="4"></textarea>
        </div>

        <button id="save-btn">Save Sheet</button>
      </div>
    `

    this.shadowRoot.getElementById('save-btn').addEventListener('click', () => this._save())
    this.shadowRoot.getElementById('add-stat-btn').addEventListener('click', () => this._addStat())

    // Auto-save when user types, with a 500ms debounce
    this.shadowRoot.addEventListener('input', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        clearTimeout(this._saveTimeout)
        this._saveTimeout = setTimeout(() => this._save(), 500)
      }
    })
  }

  _updateDOM() {
    this.shadowRoot.getElementById('char-name').value = this.sheet.name || ""
    this.shadowRoot.getElementById('char-race').value = this.sheet.race || ""
    this.shadowRoot.getElementById('char-class').value = this.sheet.class_name || ""
    this.shadowRoot.getElementById('char-level').value = this.sheet.level || 1
    this.shadowRoot.getElementById('hp-curr').value = this.sheet.hp_current || 0
    this.shadowRoot.getElementById('hp-max').value = this.sheet.hp_max || 0
    this.shadowRoot.getElementById('inventory').value = this.sheet.inventory || ""

    const container = this.shadowRoot.getElementById('stats-container')
    container.innerHTML = ""
    
    this.sheet.stats.forEach((stat, idx) => {
      const row = document.createElement('div')
      row.className = "stat-row"
      row.innerHTML = `
        <input type="text" class="stat-name" value="${stat.name}" />
        <input type="text" class="stat-val" value="${stat.value}" />
        <button class="btn-small remove-stat-btn" data-idx="${idx}">X</button>
      `
      container.appendChild(row)
    })

    this.shadowRoot.querySelectorAll('.remove-stat-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this._removeStat(Number(e.target.dataset.idx)))
    })
  }
}

customElements.define('core-rpg-player', CoreRPGPlayer)
