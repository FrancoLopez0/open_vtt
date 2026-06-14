/**
 * core-rpg-dm — DM View for Character Sheets
 */
class CoreRPGDm extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this.sheets = {} // Map of playerName -> sheetData
  }

  connectedCallback() {
    this._render()

    this._msgHandler = (e) => {
      const data = e.detail
      if (data.plugin === "core_rpg") {
        const payload = data.payload
        if (payload.action === "sheet_data" || payload.action === "sheet_updated") {
          this.sheets[payload.player] = payload.sheet
          this._updateDOM()
        }
      }
    }
    window.addEventListener('plugin-message', this._msgHandler)
  }

  disconnectedCallback() {
    window.removeEventListener('plugin-message', this._msgHandler)
  }

  _requestSheet(playerName) {
    window.dispatchEvent(new CustomEvent('send-ws', {
      detail: { type: "plugin_message", plugin: "core_rpg", payload: { action: "get_sheet", target_player: playerName } }
    }))
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: 'Inter', system-ui, sans-serif;
          color: #e8e4dc;
          margin-top: 16px;
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
        .sheet-card {
          background: #080810;
          border: 1px solid rgba(255,255,255,0.1);
          padding: 8px;
          border-radius: 6px;
          font-size: 12px;
        }
        .sheet-title {
          font-weight: bold;
          color: #b38135;
          margin-bottom: 4px;
        }
        .hp-bar { color: #e74c3c; font-weight: bold; }
        .refresh-btn {
          background: #1a1a2e;
          border: 1px solid rgba(179, 129, 53, 0.4);
          color: #e8c46a;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 10px;
          margin-top: 8px;
        }
        .refresh-btn:hover { background: #b38135; color: #000; }
        input.dm-fetch {
          background: #000; color: #fff; border: 1px solid #333; padding: 4px; font-size: 10px; width: 80px;
        }
      </style>

      <div class="widget">
        <h4>Player Sheets</h4>
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
          <input type="text" id="fetch-name" class="dm-fetch" placeholder="Player Name" />
          <button id="fetch-btn" class="refresh-btn" style="margin:0;">Fetch</button>
        </div>
        <div id="sheets-container"></div>
      </div>
    `

    this.shadowRoot.getElementById('fetch-btn').addEventListener('click', () => {
      const name = this.shadowRoot.getElementById('fetch-name').value
      if (name) this._requestSheet(name)
    })
  }

  _updateDOM() {
    const container = this.shadowRoot.getElementById('sheets-container')
    container.innerHTML = ""

    for (const [playerName, sheet] of Object.entries(this.sheets)) {
      const card = document.createElement('div')
      card.className = "sheet-card"
      
      const statsStr = (sheet.stats || []).map(s => \`\${s.name}: \${s.value}\`).join(' | ')
      
      card.innerHTML = \`
        <div class="sheet-title">\${playerName} (\${sheet.name || 'Unnamed'})</div>
        <div class="hp-bar">HP: \${sheet.hp_current} / \${sheet.hp_max}</div>
        <div style="margin-top:4px; font-style:italic;">\${statsStr}</div>
      \`
      container.appendChild(card)
    }
  }
}

customElements.define('core-rpg-dm', CoreRPGDm)
