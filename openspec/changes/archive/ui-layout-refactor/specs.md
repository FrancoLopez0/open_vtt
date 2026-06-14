# Specs: UI Layout Refactor

## Requirements
- **FR1**: The layout hierarchy must be inverted so the PluginSlot (Character Sheet, dice, etc.) is the primary focal point (`flex-1`).
- **FR2**: The chat component must be resized to be smaller and moved to the right side (or float), toggled by the existing button.
- **FR3**: The DM view must display players as "cards", replacing the generic text list.
- **FR4**: Tailwind utility classes should be used to construct the new flex/grid layouts in `DMView.jsx` and `PlayerView.jsx`.

## Technical Implementation
- Remove `className="layout-sidebar"` and `className="layout-main"` from the main wrappers, or override them with Tailwind.
- Use `flex flex-col h-screen` for the root, and `flex flex-1 overflow-hidden relative` for the content area.
- The PluginSlot will be `flex-1 overflow-y-auto p-4`.
- The Chat will be `w-80 border-l border-white/10 bg-black/50 flex flex-col`.
