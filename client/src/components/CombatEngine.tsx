import React, { useState } from 'react';

interface PlayerProp {
  name: string;
  token: string;
}

interface Combatant {
  id: string;
  name: string;
  initiative: number;
  hp: number;
  max_hp: number;
  is_player: boolean;
}

interface CombatEngineProps {
  players: PlayerProp[];
  initialState?: any;
}

export function CombatEngine({ players, initialState }: CombatEngineProps) {
  const [combatants, setCombatants] = useState<Combatant[]>(initialState?.combatants || []);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(initialState?.activeTurnId || null);
  const [round, setRound] = useState<number>(initialState?.round || 1);
  const [isActive, setIsActive] = useState<boolean>(initialState?.isActive || false);

  // Form state
  const [npcName, setNpcName] = useState('');
  const [npcInit, setNpcInit] = useState('');
  const [npcHp, setNpcHp] = useState('');

  // Sync to server on state change
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('send-ws', { 
      detail: { 
        type: 'combat_update', 
        state: { combatants, activeTurnId, round, isActive } 
      } 
    }));
  }, [combatants, activeTurnId, round, isActive]);

  const sortedCombatants = [...combatants].sort((a, b) => b.initiative - a.initiative);

  const addNpc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!npcName) return;
    
    const newCombatant: Combatant = {
      id: `npc-${Date.now()}`,
      name: npcName,
      initiative: Number(npcInit) || 0,
      hp: Number(npcHp) || 10,
      max_hp: Number(npcHp) || 10,
      is_player: false,
    };
    
    setCombatants([...combatants, newCombatant]);
    setNpcName('');
    setNpcInit('');
    setNpcHp('');
  };

  const addPlayers = () => {
    const newCombatants = [...combatants];
    players.forEach(p => {
      // Don't add twice
      if (!newCombatants.find(c => c.name === p.name && c.is_player)) {
        newCombatants.push({
          id: `player-${p.token}`,
          name: p.name,
          initiative: 0,
          hp: 10, // Default, DM can edit
          max_hp: 10,
          is_player: true,
        });
      }
    });
    setCombatants(newCombatants);
  };

  const removeCombatant = (id: string) => {
    setCombatants(combatants.filter(c => c.id !== id));
  };

  const updateCombatant = (id: string, field: keyof Combatant, value: number) => {
    setCombatants(combatants.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const nextTurn = () => {
    if (combatants.length === 0) return;
    const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);
    const currentIndex = sorted.findIndex(c => c.id === activeTurnId);

    if (currentIndex === -1) {
      setActiveTurnId(sorted[0].id);
    } else if (currentIndex + 1 >= sorted.length) {
      setActiveTurnId(sorted[0].id);
      setRound(r => r + 1);
    } else {
      setActiveTurnId(sorted[currentIndex + 1].id);
    }
  };

  const startCombat = () => {
    if (combatants.length === 0) return;
    setIsActive(true);
    setRound(1);
    const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);
    setActiveTurnId(sorted[0].id);
  };

  const endCombat = () => {
    setIsActive(false);
    setRound(1);
    setActiveTurnId(null);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 glass-panel p-8">
      <div className="flex justify-between items-center mb-6 pb-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div>
          <h2 className="font-display text-2xl text-gold">Combat Engine</h2>
          <p className="text-sm text-secondary">
            {isActive ? `Round ${round} - Combat Active` : 'Setup Phase'}
          </p>
        </div>
        <div className="flex gap-2">
          {!isActive ? (
            <button className="btn btn-primary" onClick={startCombat} disabled={combatants.length === 0}>
              ⚔️ Start Combat
            </button>
          ) : (
            <>
              <button className="btn btn-danger" onClick={endCombat}>
                End Combat
              </button>
              <button className="btn btn-primary" onClick={nextTurn}>
                Next Turn ➔
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-row gap-6 h-full min-h-0">
        {/* Sidebar: Add entities */}
        <div className="flex flex-col gap-6" style={{ width: '33.333%' }}>
          <div className="p-4 glass-panel-deep">
            <h3 className="font-display text-sm text-gold-dim uppercase tracking-widest mb-3">Add Players</h3>
            <button className="btn btn-ghost w-full" onClick={addPlayers} disabled={players.length === 0}>
              + Import {players.length} Connected
            </button>
          </div>

          <div className="p-4 glass-panel-deep">
            <h3 className="font-display text-sm text-gold-dim uppercase tracking-widest mb-3">Add NPC</h3>
            <form onSubmit={addNpc} className="flex flex-col gap-3">
              <input 
                type="text" 
                placeholder="Name (e.g. Goblin)" 
                value={npcName}
                onChange={e => setNpcName(e.target.value)}
              />
              <div className="flex gap-2">
                <input 
                  type="number" 
                  placeholder="Init" 
                  style={{ width: '50%' }}
                  value={npcInit}
                  onChange={e => setNpcInit(e.target.value)}
                />
                <input 
                  type="number" 
                  placeholder="HP" 
                  style={{ width: '50%' }}
                  value={npcHp}
                  onChange={e => setNpcHp(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-ghost" disabled={!npcName}>
                + Add NPC
              </button>
            </form>
          </div>
        </div>

        {/* Main: Initiative List */}
        <div className="flex flex-col overflow-y-auto pr-2 custom-scrollbar" style={{ width: '66.666%' }}>
          {combatants.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-secondary italic" style={{ border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
              No combatants added yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sortedCombatants.map((c) => {
                const isTurn = isActive && activeTurnId === c.id;
                return (
                  <div 
                    key={c.id} 
                    className={`combatant-card ${isTurn ? 'is-active' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`init-badge ${c.is_player ? 'player' : 'npc'}`}>
                        {c.initiative}
                      </div>
                      <div className="flex flex-col">
                        <span className={`font-medium ${isTurn ? 'text-gold-bright' : 'text-primary'}`}>
                          {c.name} {c.is_player && <span className="text-xs ml-1" style={{ color: '#60a5fa' }}>(Player)</span>}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {/* Editable HP */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted">HP</span>
                        <input 
                          type="number" 
                          className="combat-input text-error font-bold"
                          value={c.hp}
                          onChange={(e) => updateCombatant(c.id, 'hp', Number(e.target.value))}
                        />
                        <span className="text-xs text-muted">/ {c.max_hp}</span>
                      </div>
                      
                      {/* Editable Init */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted">Init</span>
                        <input 
                          type="number" 
                          className="combat-input text-gold-dim"
                          value={c.initiative}
                          onChange={(e) => updateCombatant(c.id, 'initiative', Number(e.target.value))}
                        />
                      </div>
                      
                      <button 
                        className="btn btn-ghost px-2 py-1"
                        onClick={() => removeCombatant(c.id)}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
