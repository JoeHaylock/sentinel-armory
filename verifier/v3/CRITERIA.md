# Acceptance criteria v3 — CCTV panel + naming legends (video pending)

## Functional (new)
- [ ] Cage-scan radar replaced by a CCTV panel styled as CAM 03 with OSD (camera label + live clock), scanline grain, and a "CAMERA OFFLINE" placeholder until cage-cctv.mp4 exists
- [ ] Panel auto-plays /cage-cctv.mp4 (muted loop) when the file is present — no code change needed
- [ ] Naming-matrix legend in vitals panel: S-xx = rack slot, ARM-1xx = asset record, RQ-xxxx = movement request
- [ ] Rack matrix legend: in rack / deployed / AI check / hold / empty
- [ ] Movement queue has a one-line decoder of the row fields

## Technical
- [ ] fx.js radar import removed; build passes; previous v2 checks still pass
