# Acceptance criteria v2 — adds catalog view + persistence on top of v1

## Functional (new)
- [ ] "Stock catalog" view: category list (Rifles, Sidearms, Clothing, Armour, Optics, Comms, Medical, Load, Stores), each clickable and expanding to its individual items
- [ ] Item detail card with photo (stock photo where available, blueprint glyph fallback), serial, class, condition, custodian, movement actions
- [ ] Item list is persistent across reloads (browser-local snapshot, honestly labelled)
- [ ] View switching between Ops board and Stock catalog
- [ ] 16 items across categories, all reachable by the 15s auto-cycle
- [ ] Clothing items present (shirt, smock, boots) with size info

## Technical (new)
- [ ] dist/icons contains: rifle, sidearm, plate, helmet, nvg, radio, medkit, optic, ruck, crate, shirt, smock, boots PNGs
- [ ] photo-rifle.jpg / photo-clothing.jpg / photo-kit.jpg in dist/icons (or documented fallback if generation was refused)
- [ ] Bundle contains "Stock catalog", "sentinel-armory-v1" (persistence key)
