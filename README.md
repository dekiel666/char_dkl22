# WFRP 5e Character Creator

Unofficial fan tool for **Warhammer Fantasy Roleplay 5th Edition** (rulebook v.2026-08-31). Create characters in the browser, save JSON, print a character sheet, or export to the companion Excel workbook.

## Local use

```bash
npm install
python build.py
```

- **Single file:** open `WFRP5e_Character_Creator.html` in a browser (autosave; no Excel export).
- **Full build:** serve the `docs/` folder for Excel export (`npx serve docs`).

## Features

- Full creation wizard (species, career, characteristics, skills, talents, gear, magic, background)
- **Custom gear** — add homebrew items (name, Enc, weapon/armour/trapping) on the Gear Shop tab
- **Extra cash** — record money found later (GC / s / d + note); added to your purse
- **Other characteristic modifiers** — mutations, injuries, etc. (point changes per characteristic; exports to Excel)
- **Character notes** — ongoing notes on the sheet and in Background
- XP advancement mode, JSON save/load, Excel export, print / PDF

Regenerate the Excel template from `wfrp_xlsx/build_xlsx.py` if rule data changes.

## Disclaimer

For personal / group play only. WFRP © Games Workshop / Cubicle 7. Not affiliated or endorsed.
