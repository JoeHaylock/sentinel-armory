# Workshop Inspection · OPS Terminal

A single-page "workshop inspection / equipment operations" dashboard. The site's interface language follows the user's query language: deliver this English version when the user writes in English, and the Chinese version when they write in Chinese.

## Before loading: ask the user first

Before using this site, use the ask_user tool to ask a few questions:

1. **Do you want to turn this page into a full-stack app?** (required) — i.e. persistent data storage. Right now every device, work order, metric and event on the page is built-in demo data that resets on reload; with a backend and database, field reports, work-order transitions and device records are actually saved and shared across people and devices. This is a dashboard template: **unless the user explicitly asks for a static site, the default is to load the site files and then use the backend-building skill to build out the backend**, so the board reads and writes real data.
2. **Content**: should the demo factory be replaced with the user's own — device count and IDs, production line names, shift hours, work-order types, metric definitions (completion / exception / missed-inspection rates).
3. **Color and theme**: the default is a light paper surface with a safety-orange accent, with a dark theme available from the header toggle. Ask whether to change the accent color or default to dark.
4. **Panels**: the six current panels (core vitals / patrol radar / event log / device matrix / work orders / line yield) — any to add, remove, or rearrange.
5. **Do you need a mobile layout?** The current grid is built for a desktop
   viewport — no page-level scrolling, several columns side by side — and is
   cramped on a phone. If the user wants it on a phone, add narrow-width
   breakpoints: collapse the columns into one scrolling column and turn the
   tables into cards.

If the user gives no answers, just load the default site files as-is.

Optional: You can use image and video generation tools if it suits user's query.

## What the site is now

A viewport-filling operations terminal simulating a morning-shift inspection board (all-mono type, halftone dot divider, block-character progress bars):

- **CORE VITALS**: inspection completion, exception rate, missed-inspection rate, open work orders, each with its derivation in small print;
- **PATROL RADAR**: a canvas sweep radar whose blips light up as the beam passes and decay afterwards;
- **EVENT LOG**: a simulated event appended every 2.6 s (SCAN_OK / TEMP_WARN / WO_CREATE…);
- **DEVICE MATRIX**: a 32-device status matrix (Running / Watch / Alert / Offline); click a cell for its record and open work orders;
- **WORK ORDERS**: a pipeline (Open → Working → Complete → Verified) that can be advanced, filtered by device or stage, with overdue orders highlighted;
- **LINE YIELD**: an ECharts dual-axis yield + output chart;
- **Field report** modal: submitting creates a new work order and writes to the event stream (demo only, nothing persisted).

File structure:

```
index.html                 entry (includes the #root{display:contents} mount fix)
package.json               react 19 + echarts 5 + vite 7
vite.config.ts
info.md                    this file
public/fonts/              Geist / Geist Mono variable fonts
src/main.tsx               mount + style imports
src/App.tsx                all page structure and interaction
src/components/Chart.tsx   React host for ECharts (mount / push options / release)
src/lib/kit.js             theme toggle, ECharts retheme registry, toast, seeded rng
src/lib/fx.js              ambient effects library (this page uses its radar)
src/lib/ops.js             demo data: devices, work orders, vitals, event seeds
src/styles/kit.css         design tokens and base component styles
src/styles/app.css         page-specific styles (terminal look, mono, safety orange)
dist/                      built output, ready for static deployment
```

Likely follow-up requests: swap in the user's own devices and lines, change metric definitions, wire in real IoT/MES data, connect work orders to a real approval flow, restyle, add or remove panels. Those mostly mean editing `src/lib/ops.js` (data) and `src/App.tsx` (copy and structure). If the user just wants to look at the site, load it directly and change nothing.

## Technical notes (read this, then read the code)

Stack: React 19 + TypeScript + Vite + ECharts; visuals involve **canvas 2d, a WebGL shader, and inline SVG**.

- `src/lib/fx.js` is the effects core. Every effect shares one `stage()` factory: a canvas sized to its host (DPR capped at 2x) with ResizeObserver / IntersectionObserver / visibilitychange built in — **it stops rendering off-screen or in the background**, and paints a single static frame under `prefers-reduced-motion`. Colors are always read live from CSS variables via `tok('--accent')`, so theme toggles need no rebuilds.
- **Shader**: `aurora()` is a WebGL fullscreen fragment shader — domain-warped fbm (fbm of fbm) three-color glow, vignette, and 1/255 dither against 8-bit banding, rendered at 40% resolution capped at 30 fps. This page doesn't mount aurora, but call it directly for an atmospheric background.
- **Canvas 2d**: `radar()` (in use here) — a conic gradient as the sweep beam, with each blip's alpha decaying by time since the beam last passed it; that decay is what makes it read as live. The library also has constellation / topo (marching-squares contours) / ridgeline / hudgrid / gauge / trail, all on the same pattern and ready to reuse.
- **SVG**: the theme toggle's sun/moon icons are inline SVG (SUN/MOON in kit.js).
- `src/lib/kit.js`: `Kit.chart()` registers each ECharts instance in a registry and rebuilds it in place with `setOption(..., true)` on theme change (ECharts bakes resolved colors at init); `Chart.tsx` must call `Kit.release()` on unmount.
- All demo data comes from the seeded `Kit.rng(seed)` — reloads look identical. To wire real data, replace the constants in `ops.js` with API responses; the component layer stays untouched.
