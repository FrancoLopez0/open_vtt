# Specs: Tailwind Integration

## Overview
Install and configure Tailwind v4 for the Open VTT frontend.

## Requirements
- **FR1**: The `client` directory must have `@tailwindcss/vite` and `tailwindcss` installed as dev dependencies.
- **FR2**: `vite.config.js` must be updated to use the `@tailwindcss/vite` plugin.
- **FR3**: `index.css` must include `@import "tailwindcss";` at the top.
- **FR4**: `DMView.jsx` must include at least one Tailwind utility class to verify functionality.

## Out of Scope
- Full migration of existing vanilla CSS to Tailwind utility classes. This will be done incrementally in future features.
