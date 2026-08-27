# Acceptance criteria v1 — Sentinel Armory (kit & firearm inventory ops demo)

## Functional
- [ ] Tracks inventory ins (retrieves) and outs (deploys) with full transaction info: item, serial, direction, requester, timestamp, AI check result
- [ ] Item theme is firearm / kit inspection (carbine, sidearm, plate carrier, helmet, NVG, radio, medkit, optic, ruck, crate)
- [ ] AI photo-check demo flow: scan animation, "turn the item" prompt, 2 captured angles, quality verdict before item is marked in the system
- [ ] Every 15s a demo request fires, cycling through ALL items one by one (round-robin), alternating deploy/retrieve based on item state; user can pause/resume
- [ ] Consistent-style generated icons for every item, shown in the rack matrix and AI scan viewfinder
- [ ] Rack matrix: click a slot for item detail; manual deploy/retrieve opens AI check
- [ ] Movement queue shows pipeline of requests (Requested → AI Check → Cleared → Logged)
- [ ] Transaction log streams events (DEPLOY_OUT / RETRIEVE_IN / AI_PASS / AI_FLAG / REQ_CREATE)
- [ ] Portfolio framing: clearly labelled demo/simulated data

## Technical
- [ ] `npm run build` exits 0
- [ ] dist/index.html exists; all 10 icons in dist/icons/
- [ ] No factory-demo leftovers (WO-, CNC, spindle, Field report) in shipped bundle
- [ ] Countdown to next auto request visible; cycle state survives re-render
