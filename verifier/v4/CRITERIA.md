# Acceptance criteria v4 — flagged issue records

## Functional (new)
- [ ] FLAG verdicts create a structured issue record (ISS-xxx): defect type, location, severity, score, evidence frames, requester, timestamp
- [ ] Issues persist in the browser snapshot and are seeded with one example on first load
- [ ] Flagged movement-queue rows show a dashed flag box: "ISS-xxx · Returned 75/100 · Tear — lower hem · REVIEW ▸" and are clickable
- [ ] "Flagged" filter column added to the queue pipeline
- [ ] AI_FLAG / WO_RAISE / override log rows link to the issue record (clickable, underlined on hover)
- [ ] Issue detail modal: score hero, severity chip, defect/location/note/evidence rows, item state, actions (Close / Repair work order / Return to rack / Override & deploy)
- [ ] Actions mutate state: return-to-rack resolves + unholds; work order marks status; override deploys the item and logs
- [ ] Catalog item card + rack detail show issue history linking to the same modal

## Technical
- [ ] Build passes, bundle contains ISS-, "Issue record", "REVIEW", "Flagged"
- [ ] All v3 checks still pass
