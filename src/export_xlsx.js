/* global CHARS, SPECIES, derive, baseChars, creationSkillAdv, totalSkillAdv, allTalents,
   findCareer, findGear, magicProfile, BACKGROUND_QUESTIONS, startingTrappings, purseTotal, itemStorageLoc */

/** Writable cell layout — mirrors wfrp_xlsx/build_xlsx.py */
const XL = {
  R_INIT: 11,
  R_ADV: 12,
  R_OTHER: 15,
  SK_BASIC0: 27,
  BASIC_SKILLS: ["Art", "Athletics", "Bribery", "Charm", "Charm Animal", "Climb", "Consume Alcohol", "Cool", "Dodge",
    "Drive", "Endurance", "Entertain", "Gamble", "Gossip", "Haggle", "Intimidate", "Intuition", "Leadership",
    "Melee (Basic)", "Melee", "Navigation", "Outdoor Survival", "Perception", "Ride", "Row", "Stealth"],
  SK_ADV0: 53 + 1,
  SK_ADV_N: 24,
  SK_LAST: 53 + 1 + 24 - 1,
  TA0: 27,
  CAR0: 81,
  CAR_N: 6,
  W0: 5,
  W_N: 8,
  A0: 16,
  A_N: 8,
  T0: 30,
  T_N: 40,
  MON0: 73,
  S0: 8,
  S_N: 30,
  B0: 41,
  B_N: 6,
  M0: 50,
  M_N: 12,
  BG_Q0: 4,
  BG_SECTIONS: { psych: 13, cond: 19, contacts: 25, notes: 31 },
  TEMPLATE: "WFRP5e_Character_Template.xlsx",
};

const CHAR_COL = (i) => String.fromCharCode(66 + i);

function charCells(st) {
  const base = baseChars(st);
  const out = {};
  if (!base) return out;
  CHARS.forEach((ch, i) => {
    const col = CHAR_COL(i);
    out[`Character!${col}${XL.R_INIT}`] = base[ch] + (st.charBonus[ch] || 0);
    out[`Character!${col}${XL.R_ADV}`] = (st.adv.chars[ch] || 0) * 5;
    const o = st.charOther?.[ch];
    if (o != null && o !== "" && +o !== 0) out[`Character!${col}${XL.R_OTHER}`] = +o;
  });
  return out;
}

function skillCells(st) {
  const create = creationSkillAdv(st);
  const total = totalSkillAdv(st);
  const out = {};
  XL.BASIC_SKILLS.forEach((name, i) => {
    const r = XL.SK_BASIC0 + i;
    const t = total[name] || 0;
    if (!t) return;
    out[`Character!D${r}`] = (create[name] || 0) * 5;
    out[`Character!E${r}`] = t * 5;
  });
  const advanced = Object.keys(total).filter((n) => !XL.BASIC_SKILLS.includes(n) && total[n] > 0).sort();
  advanced.forEach((name, i) => {
    const r = XL.SK_ADV0 + i;
    if (r > XL.SK_LAST) return;
    out[`Character!A${r}`] = name;
    out[`Character!D${r}`] = (create[name] || 0) * 5;
    out[`Character!E${r}`] = total[name] * 5;
  });
  return out;
}

function talentCells(st) {
  const bought = new Set(st.boughtTalents);
  const tally = new Map();
  allTalents(st).forEach((t) => {
    const e = tally.get(t.name) || { count: 0, bought: false };
    e.count += 1;
    if (t.source === "XP" || bought.has(t.name)) e.bought = true;
    tally.set(t.name, e);
  });
  const out = {};
  let i = 0;
  tally.forEach((v, name) => {
    const r = XL.TA0 + i++;
    if (r > XL.SK_LAST) return;
    out[`Character!M${r}`] = name;
    if (v.count > 1) out[`Character!P${r}`] = v.count;
    if (v.bought) out[`Character!Q${r}`] = "Yes";
  });
  return out;
}

function careerPathCells(st) {
  const out = {};
  const rows = [];
  st.careerHistory.forEach((h) => {
    const m = h.match(/^(.+?) \((.+)\)$/);
    rows.push({ career: m ? m[1] : h, level: null, entry: h, note: "Previous career (from app)" });
  });
  if (st.career) {
    rows.push({
      career: st.career,
      level: st.careerLevel || 1,
      entry: st.careerHistory.length ? "Career change" : "Starting career",
      note: "Exported from WFRP 5e Character Creator",
    });
  }
  rows.slice(0, XL.CAR_N).forEach((row, i) => {
    const r = XL.CAR0 + i;
    out[`Character!A${r}`] = row.career;
    if (row.level != null) out[`Character!D${r}`] = row.level;
    if (row.entry) out[`Character!E${r}`] = row.entry;
    if (row.note) out[`Character!J${r}`] = row.note;
  });
  return out;
}

function gearCategory(g) {
  if (!g) return "trap";
  if (/WEAPON|AMMUNITION/i.test(g.table)) return "weapon";
  if (g.table === "ARMOUR") return "armour";
  return "trap";
}

function inventoryRows(st) {
  const items = startingTrappings(st).map((t, i) => ({
    key: `start:${i}:${t.name}`, name: t.name,
  })).concat(st.inventory.map((it, i) => ({ key: `buy:${i}`, name: it.name })))
    .concat((st.customItems || []).map((it, i) => ({
      key: `custom:${i}`, name: it.name, category: it.category || "trap", enc: it.enc,
    })));
  const weapons = [];
  const armour = [];
  const traps = [];
  items.forEach((it) => {
    const g = findGear(it.name);
    const loc = itemStorageLoc(st, it.key);
    const row = { name: it.name, loc };
    const cat = it.category || gearCategory(g);
    if (cat === "weapon") weapons.push(row);
    else if (cat === "armour") armour.push(row);
    else traps.push({ ...row, qty: 1, enc: it.enc });
  });
  return { weapons, armour, traps };
}

function equipmentCells(st) {
  const { weapons, armour, traps } = inventoryRows(st);
  const out = {};
  weapons.slice(0, XL.W_N).forEach((w, i) => {
    const r = XL.W0 + 1 + i;
    out[`Equipment!A${r}`] = w.name;
    out[`Equipment!I${r}`] = w.loc;
  });
  armour.slice(0, XL.A_N).forEach((a, i) => {
    const r = XL.A0 + 1 + i;
    out[`Equipment!A${r}`] = a.name;
    out[`Equipment!I${r}`] = a.loc;
  });
  traps.slice(0, XL.T_N).forEach((t, i) => {
    const r = XL.T0 + 1 + i;
    out[`Equipment!A${r}`] = t.name;
    out[`Equipment!B${r}`] = t.qty || 1;
    out[`Equipment!F${r}`] = t.loc;
    if (t.enc != null && t.enc !== "") out[`Equipment!D${r}`] = t.enc;
  });
  const pennies = purseTotal(st);
  if (pennies > 0) {
    out[`Equipment!B${XL.MON0}`] = Math.floor(pennies / 240);
    out[`Equipment!B${XL.MON0 + 1}`] = Math.floor((pennies % 240) / 12);
    out[`Equipment!B${XL.MON0 + 2}`] = pennies % 12;
  }
  return out;
}

function spellWasBought(st, name) {
  return st.xp.log.some((e) => e.label && e.label.includes(name) && e.cost > 0
    && (e.label.startsWith("Spell:") || e.label.startsWith("Miracle:")));
}

function spellCells(st) {
  const D = derive(st);
  const M = magicProfile(st, D);
  const out = {};
  if (M.lore) out["Spells & Prayers!B3"] = M.lore;
  if (M.deity) out["Spells & Prayers!J3"] = M.deity;
  st.spells.slice(0, XL.S_N).forEach((name, i) => {
    const r = XL.S0 + 1 + i;
    out[`Spells & Prayers!A${r}`] = name;
    if (!spellWasBought(st, name)) out[`Spells & Prayers!G${r}`] = "Yes";
  });
  st.miracles.slice(0, XL.M_N).forEach((name, i) => {
    const r = XL.M0 + 1 + i;
    out[`Spells & Prayers!A${r}`] = name;
    if (!spellWasBought(st, name)) out[`Spells & Prayers!G${r}`] = "Yes";
  });
  return out;
}

function backgroundCells(st) {
  const out = {};
  BACKGROUND_QUESTIONS.forEach(([k], i) => {
    const v = st.bg[k];
    if (v) out[`Background!B${XL.BG_Q0 + i}`] = v;
  });
  const notes = [st.characterNotes, st.notes].filter(Boolean).join("\n\n");
  if (notes) out[`Background!B${XL.BG_SECTIONS.notes}`] = notes;
  const app = [st.appearance.desc, st.appearance.age && `Age: ${st.appearance.age}`,
    st.appearance.height && `Height: ${st.appearance.height}`,
    st.appearance.eyes && `Eyes: ${st.appearance.eyes}`,
    st.appearance.hair && `Hair: ${st.appearance.hair}`].filter(Boolean).join("\n");
  if (app) out[`Background!B${XL.BG_SECTIONS.psych}`] = app;
  return out;
}

/** Flat map of "Sheet!A1" → value for every user-editable export cell. */
function toExcelPayload(st) {
  const D = derive(st);
  const sp = SPECIES[st.species];
  const cells = {};
  Object.assign(cells, charCells(st), skillCells(st), talentCells(st), careerPathCells(st),
    equipmentCells(st), spellCells(st), backgroundCells(st));

  if (st.name) cells["Character!B3"] = st.name;
  if (sp) cells["Character!H3"] = sp.name;
  if (st.career) cells["Character!O3"] = st.career;
  if (st.careerLevel) cells["Character!B4"] = st.careerLevel;
  if (st.appearance.age) cells["Character!O5"] = st.appearance.age;
  if (st.appearance.height) cells["Character!B6"] = st.appearance.height;
  if (st.appearance.eyes) cells["Character!H6"] = st.appearance.eyes;
  if (st.appearance.hair) cells["Character!O6"] = st.appearance.hair;
  if (st.ambition) cells["Character!B7"] = st.ambition;
  if (st.partyAmbition) cells["Character!O7"] = st.partyAmbition;
  if (D.fate != null) cells["Character!O12"] = D.fate;
  if (D.fortune != null) cells["Character!O13"] = D.fortune;
  if (st.ticks) cells["Character!O18"] = st.ticks;
  if (st.xp.total) cells["Character!B22"] = st.xp.total;
  return cells;
}

function parseRef(ref) {
  const m = ref.match(/^(.+)!([A-Z]+)(\d+)$/);
  if (!m) throw new Error(`Bad cell ref: ${ref}`);
  return { sheet: m[1], col: m[2], row: +m[3] };
}

async function exportToExcel(st, opts = {}) {
  if (!window.ExcelJS) throw new Error("ExcelJS is not loaded.");
  const template = opts.template || XL.TEMPLATE;
  const res = await fetch(template);
  if (!res.ok) throw new Error(`Could not load ${template} (${res.status}).`);
  const wb = new window.ExcelJS.Workbook();
  await wb.xlsx.load(await res.arrayBuffer());
  const payload = toExcelPayload(st);
  Object.entries(payload).forEach(([ref, value]) => {
    const { sheet, col, row } = parseRef(ref);
    const ws = wb.getWorksheet(sheet);
    if (!ws) return;
    ws.getCell(`${col}${row}`).value = value;
  });
  const buf = await wb.xlsx.writeBuffer();
  const name = (st.name || "character").replace(/[^\w-]+/g, "_");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  a.download = `${name}.wfrp5e.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
