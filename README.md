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
- **Cash ledger** — add money found later or **record losses** (stolen, spent off-book, etc.); purse = starting wealth + additions − losses − shop purchases
- **Containers & encumbrance** — assign each item **Worn**, **Carried**, or stowed in a container you own (Backpack, Pouch, Sack, …). Stowed items use the container’s **Carries** capacity from the rulebook; only the container’s Enc counts on your person. Gear Shop shows contents per bag and warns when over capacity
- **Discard gear** — remove trappings, custom items, or bought gear (**Discard** → **discarded log**). **Restore** from the log to put items back; bought items can **Return** to the shop for an immediate refund instead
- **Other characteristic modifiers** — mutations, injuries, etc. (point changes per characteristic; exports to Excel)
- **Character notes** — ongoing notes on the sheet and in Background
- **Doomings table** — humans (and anyone with the **Doomed** Talent) roll d100 on the rulebook Doomings table on the Talents step, with optional GM pick
- XP advancement mode, JSON save/load, Excel export, print / PDF

Regenerate the Excel template from `wfrp_xlsx/build_xlsx.py` if rule data changes.

## Disclaimer

For personal / group play only. WFRP © Games Workshop / Cubicle 7. Not affiliated or endorsed.
