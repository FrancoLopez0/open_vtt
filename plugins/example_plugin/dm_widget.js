/**
 * example-plugin-dm — DM dice roller widget.
 *
 * Provides d4/d6/d8/d10/d12/d20 buttons with a "Secret Roll" toggle.
 * Secret rolls are sent to the server as { secret: true } so only the
 * DM WebSocket receives the result.
 *
 * Custom element: <example-plugin-dm>
 */
class ExamplePluginDM extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .widget {
          background: #13131f;
          border: 1px solid rgba(179, 129, 53, 0.2);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        h4 {
          font-family: 'Cinzel', Georgia, serif;
          color: #e8c46a;
          font-size: 12px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin: 0;
        }

        .dice-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }

        .dice-btn {
          background: #1a1a2e;
          border: 1px solid rgba(179, 129, 53, 0.25);
          border-radius: 8px;
          color: #e8e4dc;
          font-size: 12px;
          font-weight: 500;
          padding: 8px 4px;
          cursor: pointer;
          transition: all 120ms ease;
          font-family: inherit;
        }

        .dice-btn:hover {
          background: #1f1f36;
          border-color: #b38135;
          color: #e8c46a;
          transform: translateY(-1px);
        }

        .dice-btn:active { transform: translateY(0); }

        .secret-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #9a95a0;
          cursor: pointer;
          user-select: none;
        }

        input[type="checkbox"] {
          accent-color: #e85a5a;
          width: 14px;
          height: 14px;
          cursor: pointer;
        }

        .result {
          text-align: center;
          font-size: 28px;
          font-weight: 700;
          font-family: 'Cinzel', Georgia, serif;
          color: #e8c46a;
          min-height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 200ms ease;
        }

        .result.secret-result { color: #e85a5a; }

        .result-label {
          font-size: 10px;
          color: #5a5560;
          text-align: center;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
      </style>

      <div class="widget">
        <h4>⚔ Dice Roller</h4>

        <div class="dice-grid">
          <button class="dice-btn" data-sides="4">d4</button>
          <button class="dice-btn" data-sides="6">d6</button>
          <button class="dice-btn" data-sides="8">d8</button>
          <button class="dice-btn" data-sides="10">d10</button>
          <button class="dice-btn" data-sides="12">d12</button>
          <button class="dice-btn" data-sides="20">d20</button>
        </div>

        <label class="secret-row">
          <input type="checkbox" id="secret-toggle" />
          Secret Roll (DM only)
        </label>

        <div class="result" id="result">—</div>
        <div class="result-label" id="result-label"></div>
      </div>
    `

    this.shadowRoot.querySelectorAll('.dice-btn').forEach((btn) => {
      btn.addEventListener('click', () => this._roll(Number(btn.dataset.sides)))
    })
  }

  _roll(sides) {
    const result = Math.floor(Math.random() * sides) + 1
    const secret = this.shadowRoot.getElementById('secret-toggle').checked
    const resultEl = this.shadowRoot.getElementById('result')
    const labelEl = this.shadowRoot.getElementById('result-label')

    resultEl.textContent = result
    resultEl.className = `result ${secret ? 'secret-result' : ''}`
    labelEl.textContent = secret ? `d${sides} — secret` : `d${sides}`

    // Dispatch custom event so the parent app can forward to the WS
    this.dispatchEvent(
      new CustomEvent('dice-roll', {
        bubbles: true,
        composed: true,
        detail: { sides, result, secret },
      })
    )
  }
}

customElements.define('example-plugin-dm', ExamplePluginDM)
