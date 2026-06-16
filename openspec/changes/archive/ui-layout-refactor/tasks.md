# Tasks: UI Layout Refactor

## Phase 1: Player View Refactor
- [x] In `PlayerView.jsx`, replace the main layout container with Tailwind flexbox classes (`flex flex-row flex-1 overflow-hidden`).
- [x] Move the `PluginSlot` into the main `flex-1` space (replacing the old `sidebar` wrapper).
- [x] Refactor the chat area to be a smaller, fixed-width right panel (`w-80 border-l`) that only renders when `isChatOpen` is true.

## Phase 2: DM View Refactor
- [x] In `DMView.jsx`, apply the same layout inversion (Plugins in main area, Chat on the right).
- [x] Convert the DM's player list into a grid of visually distinct "Cards" using Tailwind (e.g. `grid grid-cols-2 md:grid-cols-3 gap-4`).
- [x] Move the "Add Player" input into a cleaner UI position, perhaps at the top of the cards grid.

## Phase 3: Verification
- [x] Run `npm run build` to compile the new Tailwind classes.
- [x] Visually verify the UI from both DM and Player perspectives.
