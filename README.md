# Sentinel Armory

A browser-based equipment and firearm inventory operations demo. It visualises rack status, issue and return requests, simulated AI-assisted photo checks, flagged-item workflows, issue records, and an audit-style activity log.

> This is a front-end portfolio demonstration. The AI checks, operators, inventory events, and records are simulated; it is not a production armory-control system.

## Run locally

Requires a current Node.js release.

```bash
npm ci
npm run dev
```

Vite prints the local development URL. For a production build:

```bash
npm run build
npm run preview
```

## Behaviour

- The dashboard runs a 15-second automatic request cycle that exercises deploy, retrieve, pass, and hold paths.
- Manual item actions open the simulated photo-check flow.
- Browser-local state preserves demo changes between reloads.
- The Catalog view exposes the tracked inventory and status details.

## Stack

React 19, TypeScript, Vite, and Apache ECharts.

## Lab branch (`lab/qm-ops`)

Quartermaster desk: Due / Out board, class-only condition (Good / Flagged / OOA), staff-gated AI proposals, request/return photos on the item file.

Live review (does not replace production): https://joehaylock.github.io/sentinel-armory/lab/

Vite `base` on this branch is `/sentinel-armory/lab/`.
