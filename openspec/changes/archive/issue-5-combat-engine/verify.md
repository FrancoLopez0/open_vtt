# Verification: Combat Engine

## Status
- **Result:** SUCCESS
- **Verification Strategy:** Manual testing and logic review

## Findings
1. **Frontend UI:** The `CombatEngine` component successfully replaces the static placeholder in `DMView`. It properly maps the connected players and provides a form to add NPCs.
2. **Turn Tracking Bug:** Discovered that tracking the active turn by an array index caused the turn to skip or crash when combatants were reordered (e.g. initiative edited) or when entities were added/removed during combat.
3. **Resolution:** Changed the state to track `activeTurnId` instead of `currentTurn` index. The UI now reliably highlights the active turn even if the sorted list changes dynamically.
4. **Build:** Client build (`npm run build`) passes successfully with no TypeScript errors.
5. **Backend Tests:** The backend websocket tests pass completely.
6. **Persistence:** Backend persistence is deliberately deferred to Issue #9 as part of the initial MVP design decision.
