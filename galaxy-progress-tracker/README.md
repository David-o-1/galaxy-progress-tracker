# Galaxy Progress Tracker

Log your workouts and watch them become a 3D constellation — the healthier your training routine, the brighter and more stable your galaxy gets.

<!--
  Add a screenshot or short demo GIF here once you have one, e.g.:
  ![Galaxy Progress Tracker demo](docs/demo.gif)
  A GIF of logging a session and watching the scene react (stars, stability score,
  shooting stars) shows off the project far better than a static screenshot.
-->
**[ screenshot / demo GIF placeholder ]**

## Overview

Galaxy Progress Tracker turns a training log into a living 3D scene, built with Three.js. Every logged session (activity, duration, intensity) becomes a star. As you train more consistently, the galaxy fills in: the star field thickens, a Milky Way band brightens, and shooting stars start streaking across the sky. Skip training for too long, and a black hole slowly forms at the center.

It's a single-page app with no backend — everything is computed client-side and saved to `localStorage`, so your data stays on your own machine.

I built this mainly to combine two things I wanted more practice with: WebGL/shader work in Three.js, and turning a fairly dry personal-analytics problem (a workout log) into something visual and a little more fun to look at.

## Features

- **3D constellation view** — each session renders as a glowing star, sized and colored by workout intensity (RPE), and connected chronologically by constellation lines
- **Stability score (0–100)** — a rolling score computed from recent training load, day-to-day consistency, and how long it's been since your last session
- **"Why?" breakdown** — a panel that shows exactly how your stability score was calculated
- **Reactive scene** — star density, Milky Way band width, nebula glow, and shooting-star frequency all scale with your current stability; a black hole appears and grows if stability drops below 40
- **Achievements** — four unlockable badges for milestones like your first session, consistent training across multiple days, and taking recovery days when they're actually needed
- **Session management** — log, delete individual sessions, clear everything, and export your session history as JSON
- **Persistent, local-only storage** — sessions are saved to `localStorage`; nothing leaves your browser

## Tech stack

- **Three.js** (r158) for the 3D scene, custom GLSL shaders for stars, the Milky Way band, nebulae, and the black hole
- **Vanilla JavaScript** (ES modules) — no framework, no build step
- **HTML/CSS** for the UI overlay (forms, panels, badges)
- Fonts loaded from Google Fonts; Three.js loaded via an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap) pointing at a CDN — no `npm install` required

## Setup / installation

There's no build step and no dependencies to install. You just need to serve the files over HTTP (opening `index.html` directly as a `file://` URL won't work, since ES modules and import maps require a real server).

**Option 1 — Node's `npx serve` (no install needed):**
```bash
npx serve .
```

**Option 2 — Python:**
```bash
python3 -m http.server 8000
```

**Option 3 — VS Code:**
Use the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension and click "Go Live."

Then open the printed local URL (e.g. `http://localhost:3000` or `http://localhost:8000`) in a modern browser. Requires an internet connection on first load, since Three.js and the fonts are pulled from a CDN.

## Usage

1. Click **+ Log Session**, fill in activity, duration, intensity (RPE 1–10), and date, then save.
2. Watch your session appear as a new star, connected to your previous session by a constellation line.
3. Click **Why?** in the bottom panel to see exactly how your current stability score breaks down.
4. Open the **⚙ Settings** panel to delete individual sessions, clear everything, reset the camera, toggle constellation lines, or export your sessions as JSON.
5. Click the **?** guide button any time for an in-app explanation of what stars, lines, and the stability meter represent.

## Project structure

```
galaxy-progress-tracker/
├── index.html   # Page structure and UI panels
├── app.js       # App logic, stability scoring, and all Three.js/shader code
├── styles.css   # Styling for the UI overlay
└── badges/      # Achievement badge images
```

## Notes

- This started life as a personal project under a different working name — you may still spot the string `boomCycle` in a couple of internal `localStorage` key names. It's purely a storage key and doesn't affect functionality, so it was left as-is (renaming it would reset saved data for anyone who already has sessions logged) — see the comment in `app.js` if you'd like to change it.
- No API keys, credentials, or environment variables are used anywhere in this project.

## License

MIT — see [LICENSE](LICENSE).
