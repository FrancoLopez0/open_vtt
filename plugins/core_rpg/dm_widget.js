/**
 * core-rpg-dm — DM View for Character Sheets
 */
class CoreRPGDm extends HTMLElement {
  constructor() {
    super()
    this.sheets = {} // Map of playerName -> sheetData
    this.players = [] // List of player objects
  }

  connectedCallback() {
    this._render()

    this._msgHandler = (e) => {
      const data = e.detail
      if (data.plugin === "core_rpg") {
        const payload = data.payload
        if (payload.action === "sheet_data" || payload.action === "sheet_updated") {
          this.sheets[payload.player] = payload.sheet
          this._render()
        }
      }
    }
    
    this._playersHandler = (e) => {
      this.players = e.detail || []
      
      // Request sheets for all players whenever the list updates
      for (const p of this.players) {
        this._requestSheet(p.token) // Request using token, not name
      }
      
      this._render()
    }

    window.addEventListener('plugin-message', this._msgHandler)
    window.addEventListener('vtt-players-update', this._playersHandler)

    // Check if we missed the initial event due to async loading
    if (window.__VTT_PLAYERS__) {
      this._playersHandler({ detail: window.__VTT_PLAYERS__ })
    }
  }

  disconnectedCallback() {
    window.removeEventListener('plugin-message', this._msgHandler)
    window.removeEventListener('vtt-players-update', this._playersHandler)
  }

  _requestSheet(playerToken) {
    window.dispatchEvent(new CustomEvent('send-ws', {
      detail: { type: "plugin_message", plugin: "core_rpg", payload: { action: "get_sheet", target_player: playerToken } }
    }))
  }

  _render() {
    // Calculate total HP
    let hpCurrentTotal = 0;
    let hpMaxTotal = 0;
    for (const p of this.players) {
      const sheet = this.sheets[p.token];
      if (sheet) {
        hpCurrentTotal += sheet.hp_current || 0;
        hpMaxTotal += sheet.hp_max || 0;
      }
    }

    // Party Health
    const partyHealthHtml = `
      <section class="bg-[#13131f] border border-[#b38135]/30 rounded-xl p-6 shadow-lg flex items-center justify-between mb-8">
        <div>
          <h2 class="text-xl font-cinzel text-[#e8c46a] uppercase tracking-widest mb-1">Party Health</h2>
          <p class="text-sm text-white/60">Total combined HP of connected heroes</p>
        </div>
        <div class="text-right">
          <div class="text-4xl font-bold text-white">
            ${hpCurrentTotal}
            <span class="text-lg text-white/50 ml-1">/ ${hpMaxTotal}</span>
          </div>
        </div>
      </section>
    `;

    // Players Grid
    let gridHtml = '';
    if (this.players.length === 0) {
      gridHtml = `<div class="text-white/40 italic text-sm">No players added yet.</div>`;
    } else {
      const cardsHtml = this.players.map(p => {
        const sheet = this.sheets[p.token];
        
        let sheetHtml = '';
        if (sheet) {
          const hpPercent = Math.max(0, Math.min(100, (sheet.hp_current / Math.max(1, sheet.hp_max)) * 100));
          sheetHtml = `
            <div class="bg-[#080810] border border-white/5 rounded-lg p-3">
              <div class="flex justify-between items-center mb-2">
                <span class="text-xs uppercase text-white/60">Health</span>
                <span class="text-sm font-bold text-white">${sheet.hp_current} / ${sheet.hp_max}</span>
              </div>
              <div class="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div class="bg-green-500 h-full transition-all" style="width: ${hpPercent}%"></div>
              </div>
            </div>
          `;
        } else {
          sheetHtml = `
            <div class="text-xs text-white/50 italic py-2 bg-[#080810] border border-white/5 rounded-lg text-center">
              No character sheet data yet.
            </div>
          `;
        }

        const subtitleHtml = sheet 
          ? `<span class="text-sm text-[#b38135] uppercase tracking-wider font-semibold">${sheet.race} ${sheet.class_name} • Lvl ${sheet.level}</span>`
          : '';

        const badgeClass = p.connected ? 'badge-connected' : 'badge-disconnected';
        const badgeText = p.connected ? 'Online' : 'Offline';

        return `
          <div class="bg-[#13131f] border border-[#b38135]/30 p-5 rounded-xl flex flex-col gap-4 shadow-lg relative">
            <div class="flex justify-between items-start">
              <div>
                <span class="font-bold text-xl text-white block">${p.name}</span>
                ${subtitleHtml}
              </div>
              <span class="badge ${badgeClass}">${badgeText}</span>
            </div>
            
            ${sheetHtml}

            <div class="mt-auto pt-3 flex justify-between items-center border-t border-white/5">
              <button class="btn btn-ghost text-xs py-1 px-2" onclick="navigator.clipboard.writeText('${p.join_url}')">
                Copy Join Link
              </button>
            </div>
          </div>
        `;
      }).join('');

      gridHtml = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${cardsHtml}</div>`;
    }

    this.innerHTML = `
      <div class="w-full">
        ${partyHealthHtml}
        <section>${gridHtml}</section>
      </div>
    `;
  }
}

customElements.define('core-rpg-dm', CoreRPGDm)
