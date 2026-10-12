/* global DATA, CHARS, SPECIES, SPECIES_TABLE, RANDOM_TALENTS, DOOMINGS, CAREER_TABLE, SPECIES_ORDER, CLASS_TRAPPINGS,
   BASE_TRAPPINGS, CHAR_XP, SKILL_XP, SPELL_XP, PETTY_XP, LEVEL_TICKS, COLOUR_LORES */

const rnd = (sides) => 1 + Math.floor(Math.random() * sides);
const rollDice = (n, sides) => Array.from({ length: n }, () => rnd(sides)).reduce((a, b) => a + b, 0);
const d100 = () => rnd(100);
const bonus = (v) => Math.floor(v / 10);

function newState() {
  return {
    version: 4, name: "", appearance: { age: "", height: "", eyes: "", hair: "", desc: "" },
    species: null, speciesMode: null, speciesRoll: null,
    career: null, careerMode: null, careerRolls: [], l2Trappings: [],
    charMethod: null, rollsA: null, rollsC: null, assign: null, points: null, charBonus: {}, charOther: {}, manualChars: false,
    speciesSkills: [], careerSkillChoice: {}, careerAdv: {},
    speciesTalentChoice: {}, randomTalents: [], manualRandom: false,
    dooming: null, manualDooming: false, careerTalent: null, talentChoice: {},
    trappingChoice: {}, wealth: null, moneyAdded: [], moneyLost: [], inventory: [], customItems: [],
    itemLoc: {}, removedGear: [], gearDiscardedSpend: 0, discardedLog: [], purse: null,
    lore: null, deity: null, spells: [], miracles: [],
    ambition: "", partyAmbition: "", bg: {}, notes: "", characterNotes: "",
    xp: { total: 0, log: [] }, adv: { chars: {}, skills: {} }, boughtTalents: [],
    careerLevel: 1, ticks: 0, careerHistory: [], allowNonCareer: false,
  };
}

/* ---------- lookups ---------- */
const skillBase = (name) => name.replace(/\s*\(.*\)\s*$/, "").trim();
const skillSpec = (name) => { const m = name.match(/\((.+)\)\s*$/); return m ? m[1] : null; };
const findSkill = (name) => DATA.skills.find((s) => s.name === skillBase(name));
const TALENT_ALIASES = { "Nimble Fingered": "Nimble-fingered", Resistance: "Resistant", "Hunters Eye": "Hunter’s Eye" };
function findTalent(name) {
  let base = skillBase(name);
  base = TALENT_ALIASES[base] || base;
  return DATA.talents.find((t) => t.base === base) || DATA.talents.find((t) => t.base.toLowerCase() === base.toLowerCase());
}
const findCareer = (name) => DATA.careers.find((c) => c.name === name);
const speciesCareers = (sid) => DATA.careers.filter((c) => c.species.includes(SPECIES[sid].short));

/* Split a string on a separator regex, ignoring separators inside parentheses. */
function splitTop(str, sepRe) {
  const out = []; let depth = 0; let cur = ""; let i = 0;
  while (i < str.length) {
    const ch = str[i];
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth === 0) {
      const m = str.slice(i).match(sepRe);
      if (m && m.index === 0) { out.push(cur.trim()); cur = ""; i += m[0].length; continue; }
    }
    cur += ch; i++;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/* Describe the choice embedded in a career/species entry.
   Returns {fixed} | {options:[...]} | {any: base, specs:[...]} */
function parseChoice(entry) {
  const top = splitTop(entry, /^\s+or\s+/);
  if (top.length > 1) return { options: top };
  const m = entry.match(/^(.+?)\s*\((.+)\)$/);
  if (!m) return { fixed: entry };
  const [, base, inner] = m;
  if (/^any( one)?$/i.test(inner.trim()) || /\bany\b/i.test(inner) && !/,|\bor\b/.test(inner)) {
    if (["Bless", "Invoke"].includes(base)) return { any: base, specs: DEITIES.slice() };
    if (base === "Arcane Magic") return { any: base, specs: Object.keys(COLOUR_LORES).concat(OTHER_LORES) };
    if (base === "Chaos Magic") return { any: base, specs: CHAOS_LORES.slice() };
    const sk = DATA.skills.find((s) => s.name === base);
    const specs = sk && sk.specs ? sk.specs.map((s) => s.replace(/\*$/, "")) : [];
    return { any: base, specs };
  }
  if (/,|\bor\b/.test(inner)) {
    const opts = inner.split(/,\s*(?:or\s+)?|\s+or\s+/).map((s) => s.trim()).filter(Boolean);
    return { options: opts.map((o) => `${base} (${o})`) };
  }
  return { fixed: entry };
}
const isResolved = (name) => !!name && !!parseChoice(name).fixed;

/* ---------- species & career ---------- */
function speciesFromRoll(r) { return SPECIES_TABLE.find(([max]) => r <= max)[1]; }
function careerFromRoll(sid, r) {
  const col = SPECIES_ORDER.indexOf(sid);
  for (const [name, ranges] of Object.entries(CAREER_TABLE)) {
    const rg = ranges[col];
    if (!rg) continue;
    const [lo, hi] = rg.split("-").map(Number);
    if (r >= lo && r <= (hi || lo)) return name;
  }
  return null;
}
/** Roll d100 until the career differs from careers already represented in rolls (rulebook: reroll duplicates). */
function rollUniqueCareer(sid, rollsSoFar) {
  const taken = new Set(rollsSoFar.map((r) => careerFromRoll(sid, r)).filter(Boolean));
  let guard = 0;
  do {
    const r = d100();
    const name = careerFromRoll(sid, r);
    guard++;
    if (name && !taken.has(name)) return r;
  } while (guard < 200);
  return d100();
}
function randomTalentFromRoll(r) { return RANDOM_TALENTS.find(([max]) => r <= max)[1]; }
function doomingFromRoll(r) { return DOOMINGS.find(([max]) => r <= max)[1]; }

/* ---------- characteristics ---------- */
function baseChars(st) {
  const sp = SPECIES[st.species];
  const out = {};
  if (!sp || !st.charMethod) return null;
  for (const c of CHARS) {
    let roll = null;
    if (st.charMethod === "A") roll = st.rollsA && st.rollsA[CHARS.indexOf(c)];
    else if (st.charMethod === "B") roll = st.rollsA && st.assign && st.rollsA[st.assign[c]];
    else if (st.charMethod === "C") roll = st.rollsC && st.assign && st.rollsC[st.assign[c]];
    else if (st.charMethod === "P") roll = st.points ? st.points[c] : null;
    if (roll == null) return null;
    out[c] = roll + sp.mods[c];
  }
  return out;
}
const charBonusLimit = (st) => ({ A: 6, B: 3 }[st.charMethod] || 0);
function characteristicRollPool(st) {
  if (!st.charMethod || st.charMethod === "P") return null;
  return st.charMethod === "C" ? st.rollsC : st.rollsA;
}
function manualCharRollsValid(st) {
  if (!st.manualChars || st.charMethod === "P") return true;
  const pool = characteristicRollPool(st);
  return !!(pool && pool.length === 10 && pool.every((r) => r >= 2 && r <= 20));
}

/* ---------- talents ---------- */
function talentStackLimit(nameOrInfo) {
  const info = typeof nameOrInfo === "string" ? findTalent(nameOrInfo) : nameOrInfo;
  return info?.multi ? 2 : 1;
}

function countCreationTalentBase(st, base, opts = {}) {
  let n = 0;
  const sp = SPECIES[st.species];
  if (sp) {
    sp.talents.forEach((t, i) => {
      const ch = parseChoice(t);
      const nm = ch.fixed || st.speciesTalentChoice[i];
      if (nm && skillBase(nm) === base) n++;
    });
    (st.randomTalents || []).forEach((rt, ri) => {
      if (opts.skipRandomIndex === ri) return;
      if (rt?.name && skillBase(rt.name) === base) n++;
    });
  }
  if (!opts.skipCareer && st.careerTalent && skillBase(st.careerTalent) === base) n++;
  return n;
}

function canAddCreationTalent(st, name, opts = {}) {
  if (!name) return false;
  const base = skillBase(name);
  return countCreationTalentBase(st, base, opts) < talentStackLimit(base);
}

function creationTalentDuplicateIssues(st) {
  const tally = new Map();
  creationTalents(st).forEach((t) => {
    const b = skillBase(t.name);
    tally.set(b, (tally.get(b) || 0) + 1);
  });
  const out = [];
  tally.forEach((count, base) => {
    const limit = talentStackLimit(base);
    if (count > limit) out.push(`Talent “${base}” is taken ${count} times (maximum ${limit} at creation).`);
  });
  return out;
}

function creationTalents(st) {
  const list = [];
  const sp = SPECIES[st.species];
  if (sp) {
    sp.talents.forEach((t, i) => {
      const ch = parseChoice(t);
      const name = ch.fixed || st.speciesTalentChoice[i];
      if (name) list.push({ name, source: "Species" });
    });
    st.randomTalents.forEach((rt) => rt.name && list.push({ name: rt.name, source: "Random" }));
  }
  if (st.careerTalent) list.push({ name: st.careerTalent, source: "Career" });
  return list;
}
function allTalents(st) {
  return creationTalents(st).concat(st.boughtTalents.map((name) => ({ name, source: "XP" })));
}
const talentCount = (st, base) => allTalents(st).filter((t) => skillBase(t.name) === base).length;
const hasTalent = (st, base) => talentCount(st, base) > 0;

/* ---------- skills ---------- */
function careerLevelSkills(career, level) {
  const out = [];
  career.levels.slice(0, level).forEach((lv, li) => lv.skills.forEach((s, si) => out.push({ entry: s, level: li + 1, index: si })));
  return out;
}
function resolvedCareerSkills(st) {
  const c = findCareer(st.career);
  if (!c) return [];
  return c.levels[0].skills.map((s, i) => {
    const ch = parseChoice(s);
    return { entry: s, name: ch.fixed || st.careerSkillChoice[i] || null, index: i };
  });
}
/* Skill advances gained at creation, keyed by concrete skill name. */
function creationSkillAdv(st) {
  const adv = {};
  const add = (n, v) => { if (n) adv[n] = (adv[n] || 0) + v; };
  const sp = SPECIES[st.species];
  if (sp) sp.languages.forEach((l) => add(l, 6));
  st.speciesSkills.forEach((s) => add(s.name, 1));
  Object.entries(st.careerAdv).forEach(([n, v]) => add(n, v));
  return adv;
}
function totalSkillAdv(st) {
  const adv = creationSkillAdv(st);
  Object.entries(st.adv.skills).forEach(([n, v]) => { adv[n] = (adv[n] || 0) + v; });
  return adv;
}
function skillMatchesEntry(name, entry) {
  const ch = parseChoice(entry);
  if (ch.fixed) return ch.fixed === name;
  if (ch.options) return ch.options.some((o) => skillMatchesEntry(name, o));
  if (ch.any) return skillBase(name) === ch.any;
  return false;
}
function talentAdvanceCareerSkills(st) {
  const out = [];
  if (hasTalent(st, "Artistic")) out.push("Art");
  return out;
}
function careerListsSkill(st, name, level = st.careerLevel) {
  const c = findCareer(st.career);
  if (!c) return false;
  if (level === 1 && resolvedCareerSkills(st).some((s) => s.name === name)) return true;
  for (let lv = 1; lv <= level; lv++) {
    if (careerLevelSkills(c, lv).some((s) => skillMatchesEntry(name, s.entry))) return true;
  }
  return false;
}
function isCareerSkill(st, name, level = st.careerLevel) {
  if (talentAdvanceCareerSkills(st).includes(name)) return true;
  return careerListsSkill(st, name, level);
}

/* ---------- derived ---------- */
function derive(st) {
  const sp = SPECIES[st.species];
  const career = findCareer(st.career);
  const base = baseChars(st);
  const talents = allTalents(st);
  const chars = {};
  for (const c of CHARS) {
    const talentBonus = talents.filter((t) => { const i = findTalent(t.name); return i && i.bonus === c; }).length * 5;
    const initial = base ? base[c] + (st.charBonus[c] || 0) + talentBonus : null;
    const adv = st.adv.chars[c] || 0;
    const other = st.charOther?.[c] || 0;
    const current = initial == null ? null : initial + adv * 5 + other;
    chars[c] = { initial, adv, other, current, bonus: current == null ? null : bonus(current) };
  }
  const B = (c) => chars[c].bonus || 0;
  const skillAdv = totalSkillAdv(st);
  const skills = {};
  for (const sk of DATA.skills) {
    if (!sk.grouped && !sk.advanced) skills[sk.name] = 0;
    if (sk.grouped && !sk.advanced && sk.name !== "Melee") skills[sk.name] = skills[sk.name] || 0;
  }
  skills["Melee (Basic)"] = 0;
  delete skills.Melee;
  Object.keys(skillAdv).forEach((n) => { skills[n] = skillAdv[n]; });
  const skillRows = Object.keys(skills).map((n) => {
    const info = findSkill(n);
    const ch = info ? info.char : "Int";
    const adv = skills[n];
    return {
      name: n, char: ch, adv, advanced: info ? info.advanced : true, grouped: info ? info.grouped : false,
      value: chars[ch].current == null ? null : chars[ch].current + adv * 5, career: isCareerSkill(st, n),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const hardy = talents.filter((t) => skillBase(t.name) === "Hardy").length;
  const wounds = B("S") + B("WP") + 2 * B("T") + hardy * B("T");
  let enc = B("S") * (hasTalent(st, "Sturdy") ? 2 : 1) + B("T");
  if (sp && sp.doubleEnc) enc *= 2;
  const strongBack = talentCount(st, "Strong Back");
  enc += strongBack >= 2 ? 3 : strongBack;
  const move = sp ? sp.move + (hasTalent(st, "Fleet-footed") ? 1 : 0) : null;
  const firstKept = st.speciesMode === "first" && st.careerMode === "first" && st.charMethod === "A";
  const fate = sp ? sp.fate + (firstKept ? 1 : 0) : null;
  const fortune = sp ? sp.fortune + (st.speciesMode === "first" ? 1 : 0) + Math.min(3, talentCount(st, "Luck")) : null;
  const level = career ? career.levels[st.careerLevel - 1] : null;
  return {
    sp, career, level, chars, skills: skillRows, talents, wounds, enc, move, walk: move * 2, run: move * 4,
    fate, fortune, firstKept, status: level ? `${level.status} ${level.standing}` : "",
  };
}

/* ---------- money ---------- */
const GC = 240, SS = 12;
function parsePrice(str) {
  if (!str) return null;
  const s = str.replace(/\s+/g, " ").trim();
  let total = 0; let matched = false;
  const gc = s.match(/(\d+)\s*GC?\b/i);
  if (gc) { total += +gc[1] * GC; matched = true; }
  const sd = s.match(/(\d+|–|-)\/(\d+|–|-)/);
  if (sd) {
    total += (/\d/.test(sd[1]) ? +sd[1] : 0) * SS + (/\d/.test(sd[2]) ? +sd[2] : 0);
    matched = true;
  }
  const d = !sd && s.match(/^(\d+)d$/);
  if (d) { total += +d[1]; matched = true; }
  return matched ? total : null;
}
function fmtMoney(p) {
  if (p == null) return "–";
  const neg = p < 0; p = Math.abs(p);
  const gc = Math.floor(p / GC), s = Math.floor((p % GC) / SS), d = p % SS;
  const parts = [];
  if (gc) parts.push(`${gc} GC`);
  if (s) parts.push(`${s}/–`.replace("/–", "s"));
  if (d || !parts.length) parts.push(`${d}d`);
  return (neg ? "−" : "") + parts.join(" ");
}
function rollWealth(level) {
  const n = level.standing;
  if (level.status === "Brass") { const r = rollDice(2 * n, 10); return { pennies: 20 + r, text: `20 + ${2 * n}d10 (${r}) brass pennies` }; }
  if (level.status === "Silver") { const r = rollDice(n, 10); return { pennies: (10 + r) * SS, text: `10 + ${n}d10 (${r}) silver shillings` }; }
  return { pennies: (2 + n) * GC, text: `2 + ${n} gold crowns` };
}

/* ---------- gear ---------- */
let GEAR_INDEX = null;
function gearIndex() {
  if (GEAR_INDEX) return GEAR_INDEX;
  GEAR_INDEX = [];
  for (const t of DATA.gear) {
    for (const r of t.rows) {
      const raw = r[t.cols[0]];
      const name = raw.replace(/^\(2H\)\s*/, "").replace(/\*+$/, "").trim();
      const item = {
        name, table: t.title, group: r.group, twoHanded: /^\(2H\)/.test(raw),
        priceText: r.Price || r.Cost, price: parsePrice(r.Price || r.Cost), enc: r.Enc ?? r["Enc when worn"],
        avail: r.Availability, page: r.page,
      };
      ["Reach", "Range", "Damage", "Qualities and Flaws", "Penalty", "Locations", "AP"].forEach((k) => {
        if (r[k] != null) item[k.toLowerCase().split(" ")[0]] = r[k];
      });
      if (r.Carries != null) item.carries = r.Carries;
      GEAR_INDEX.push(item);
    }
  }
  return GEAR_INDEX;
}
function findGear(name) {
  const n = name.toLowerCase().replace(/\s*\(.*\)$/, "").trim();
  const idx = gearIndex();
  const inner = (name.match(/\(([^)]+)\)\s*$/) || [])[1];
  const lower = (g) => g.name.toLowerCase();
  const comma = inner ? `${n}, ${inner.toLowerCase()}` : null;
  const stripped = n.replace(/^(\d+d?\d*|a|an|\d+ sets of)\s+/, "").replace(/s$/, "");
  const prefix = idx.filter((g) => n.startsWith(lower(g)) && /^[\s,]|^$/.test(n.slice(lower(g).length)))
    .sort((a, b) => b.name.length - a.name.length)[0];
  return idx.find((g) => lower(g) === name.toLowerCase())
    || idx.find((g) => lower(g) === n)
    || (comma && idx.find((g) => lower(g) === comma))
    || idx.find((g) => lower(g).replace(/\s*\(.*\)$/, "") === n)
    || (inner && idx.find((g) => lower(g) === inner.toLowerCase()))
    || idx.find((g) => lower(g).startsWith(`${n},`))
    || prefix
    || idx.find((g) => lower(g) === stripped || lower(g).replace(/s$/, "") === stripped);
}
const encOf = (name) => { const g = findGear(name); const v = g ? parseInt(g.enc, 10) : NaN; return Number.isFinite(v) ? v : 0; };

function extraMoneyPennies(st) {
  const add = (st.moneyAdded || []).reduce((a, m) => a + (m.pennies || 0), 0);
  const lost = (st.moneyLost || []).reduce((a, m) => a + (m.pennies || 0), 0);
  return add - lost;
}
function gearSpent(st) {
  const inv = (st.inventory || []).reduce((a, it) => a + (it.price || 0), 0);
  return inv + (st.gearDiscardedSpend || 0);
}
function purseTotal(st) {
  return (st.wealth ? st.wealth.pennies : 0) + extraMoneyPennies(st) - gearSpent(st);
}

function remapIndexedItemLoc(st, prefix, removedIndex) {
  const re = new RegExp(`^${prefix}:(\\d+)$`);
  const next = {};
  Object.entries(st.itemLoc || {}).forEach(([k, v]) => {
    const m = k.match(re);
    if (!m) { next[k] = v; return; }
    const idx = +m[1];
    if (idx === removedIndex) return;
    next[idx > removedIndex ? `${prefix}:${idx - 1}` : k] = v;
  });
  st.itemLoc = next;
}

function returnBuyItem(st, i) {
  if (!(st.inventory || [])[i]) return;
  st.inventory.splice(i, 1);
  remapIndexedItemLoc(st, "buy", i);
}

function allInventoryItemRows(st) {
  return startingTrappings(st).map((t, i) => ({
    key: `start:${i}:${t.name}`, name: t.name, source: t.source, enc: encOf(t.name), price: null, kind: "start",
  })).concat((st.inventory || []).map((it, i) => ({
    key: `buy:${i}`, name: it.name, source: "Bought", enc: it.enc, price: it.price, idx: i, kind: "buy",
  }))).concat((st.customItems || []).map((it, i) => ({
    key: `custom:${i}`, name: it.name, source: "Custom", enc: it.enc, price: null, category: it.category || "trap",
    idx: i, kind: "custom",
  })));
}

function pushDiscardedLog(st, entry) {
  st.discardedLog = st.discardedLog || [];
  st.discardedLog.push({ ...entry, at: Date.now() });
}

function discardGearByKey(st, key) {
  const row = allInventoryItemRows(st).find((it) => it.key === key);
  if (!row || (st.removedGear || []).includes(key)) return;
  const loc = itemStorageLoc(st, key);
  const entry = { kind: row.kind, name: row.name };
  if (row.source) entry.source = row.source;
  if (row.kind === "start") entry.startKey = key;
  if (row.kind === "buy") { entry.price = row.price; entry.enc = row.enc; }
  if (row.kind === "custom") { entry.enc = row.enc; entry.category = row.category; }
  if (loc && loc !== "Carried") entry.storageLoc = loc;

  st.removedGear = st.removedGear || [];
  if (key.startsWith("start:")) {
    if (!st.removedGear.includes(key)) st.removedGear.push(key);
    if (st.itemLoc) delete st.itemLoc[key];
    pushDiscardedLog(st, entry);
    return;
  }
  if (key.startsWith("buy:")) {
    const i = +key.slice(4);
    const it = (st.inventory || [])[i];
    if (!it) return;
    if (it.price) st.gearDiscardedSpend = (st.gearDiscardedSpend || 0) + it.price;
    st.inventory.splice(i, 1);
    remapIndexedItemLoc(st, "buy", i);
    pushDiscardedLog(st, entry);
    return;
  }
  if (key.startsWith("custom:")) {
    const i = +key.slice(7);
    if (!(st.customItems || [])[i]) return;
    st.customItems.splice(i, 1);
    remapIndexedItemLoc(st, "custom", i);
    pushDiscardedLog(st, entry);
  }
}

function restoreDiscardedGear(st, index) {
  const entry = (st.discardedLog || [])[index];
  if (!entry) return;
  st.removedGear = st.removedGear || [];
  if (entry.kind === "start") {
    const keys = new Set([entry.startKey]);
    allInventoryItemRows(st).forEach((it) => {
      if (it.kind === "start" && it.name === entry.name && (!entry.source || it.source === entry.source)) keys.add(it.key);
    });
    st.removedGear = st.removedGear.filter((k) => !keys.has(k));
    const row = allInventoryItemRows(st).find((it) => keys.has(it.key));
    if (row && entry.storageLoc) {
      st.itemLoc = st.itemLoc || {};
      st.itemLoc[row.key] = entry.storageLoc;
    }
  } else if (entry.kind === "buy") {
    st.inventory = st.inventory || [];
    st.inventory.push({ name: entry.name, price: entry.price, enc: entry.enc });
    if (entry.price) st.gearDiscardedSpend = Math.max(0, (st.gearDiscardedSpend || 0) - entry.price);
    const newKey = `buy:${st.inventory.length - 1}`;
    if (entry.storageLoc) {
      st.itemLoc = st.itemLoc || {};
      st.itemLoc[newKey] = entry.storageLoc;
    }
  } else if (entry.kind === "custom") {
    st.customItems = st.customItems || [];
    st.customItems.push({ name: entry.name, enc: entry.enc, category: entry.category || "trap" });
    const newKey = `custom:${st.customItems.length - 1}`;
    if (entry.storageLoc) {
      st.itemLoc = st.itemLoc || {};
      st.itemLoc[newKey] = entry.storageLoc;
    }
  }
  st.discardedLog.splice(index, 1);
}
function itemEnc(it) {
  if (it.enc != null && it.enc !== "") return parseInt(it.enc, 10) || 0;
  return encOf(it.name);
}

function inventoryItems(st) {
  const removed = new Set(st.removedGear || []);
  return allInventoryItemRows(st).filter((it) => !removed.has(it.key));
}

function containerCarryCapacity(name) {
  const g = findGear(name);
  if (!g?.carries) return null;
  const n = parseInt(String(g.carries).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function containerStorageLabel(name) {
  if (containerCarryCapacity(name) == null) return null;
  const n = name.toLowerCase();
  if (n.includes("backpack")) return "Backpack";
  if (n.includes("sling bag") || n.includes("sling")) return "Sling Bag";
  if (n.includes("saddlebag")) return "Saddlebags";
  if (n.includes("large") && n.includes("sack")) return "Large Sack";
  if (n.includes("sack")) return "Sack";
  if (n.includes("pouch")) return "Pouch";
  return name;
}

function itemStorageLoc(st, key) {
  st.itemLoc = st.itemLoc || {};
  if (st.itemLoc[key]) return st.itemLoc[key];
  if (st.worn?.[key]) return "Worn";
  return "Carried";
}

function ownedStorageLocations(st) {
  const set = new Set(["Carried", "Worn"]);
  inventoryItems(st).forEach((it) => {
    const label = containerStorageLabel(it.name);
    if (label) set.add(label);
  });
  return [...set];
}

function computeEncumbrance(st) {
  const items = inventoryItems(st);
  const containers = {};
  items.forEach((it) => {
    const label = containerStorageLabel(it.name);
    if (!label) return;
    containers[label] = {
      label, name: it.name, capacity: containerCarryCapacity(it.name), used: 0, items: [], containerKey: it.key,
    };
  });
  let personTotal = 0;
  items.forEach((it) => {
    const loc = itemStorageLoc(st, it.key);
    const enc = itemEnc(it);
    const isContainer = containerStorageLabel(it.name) != null;
    if (isContainer && (loc === "Worn" || loc === "Carried")) {
      personTotal += Math.max(0, enc - (loc === "Worn" ? 1 : 0));
      return;
    }
    if (containers[loc]) {
      containers[loc].used += enc;
      containers[loc].items.push(it);
      return;
    }
    if (loc === "Worn") personTotal += Math.max(0, enc - 1);
    else personTotal += enc;
  });
  return { items, personTotal, containers: Object.values(containers) };
}

function migrateState(st) {
  if (!st.moneyLost) st.moneyLost = [];
  if (!st.itemLoc) st.itemLoc = {};
  if (!st.removedGear) st.removedGear = [];
  if (st.gearDiscardedSpend == null) st.gearDiscardedSpend = 0;
  if (!st.discardedLog) st.discardedLog = [];
  if (st.manualChars == null) st.manualChars = false;
  if (st.worn) {
    Object.entries(st.worn).forEach(([k, on]) => {
      if (on && !st.itemLoc[k]) st.itemLoc[k] = "Worn";
    });
  }
}

function startingTrappings(st) {
  const c = findCareer(st.career);
  const out = BASE_TRAPPINGS.map((n) => ({ name: n, source: "All Characters" }));
  if (!c) return out;
  (CLASS_TRAPPINGS[c.class] || []).forEach((n) => out.push({ name: n, source: `${c.class} Class` }));
  c.levels[0].trappings.forEach((t, i) => {
    const ch = parseChoice(t);
    out.push({ name: ch.fixed || st.trappingChoice[i] || t, source: `${c.name} (level 1)`, pending: !ch.fixed && !st.trappingChoice[i] });
  });
  st.l2Trappings.forEach((t) => out.push({ name: t, source: `${c.name} (level 2 bonus)` }));
  return out;
}

/* ---------- XP ---------- */
const advCost = (table, already) => table[Math.min(already, table.length - 1)];
const spellCost = (table, known) => table.find(([max]) => known < max + 1)[1];
function charAvailable(st, c) {
  const car = findCareer(st.career);
  const lvl = car && car.advance_scheme[c];
  return !!lvl && lvl <= st.careerLevel;
}
function careerTalentEntries(st) {
  const c = findCareer(st.career);
  if (!c) return [];
  const out = [];
  c.levels.slice(0, st.careerLevel).forEach((lv, li) => lv.talents.forEach((t) => out.push({ entry: t, level: li + 1 })));
  return out;
}
const ticksNeeded = (st) => LEVEL_TICKS[st.careerLevel + 1] || null;
const xpSpent = (st) => st.xp.log.reduce((a, e) => a + e.cost, 0);

/* ---------- magic ---------- */
function magicProfile(st, D) {
  const casters = ["Petty Magic", "Arcane Magic", "Chaos Magic", "Witch!"];
  const isCaster = casters.some((t) => hasTalent(st, t));
  const isPriest = hasTalent(st, "Bless") || hasTalent(st, "Invoke");
  const adv = (pred) => D.skills.some((s) => pred(s.name) && s.adv > 0);
  const casterReq = [
    ["Second Sight talent", hasTalent(st, "Second Sight")],
    ["Language (Magick) advance", adv((n) => n === "Language (Magick)")],
    ["Channelling advance (any wind)", adv((n) => skillBase(n) === "Channelling")],
    ["Petty Magic talent", hasTalent(st, "Petty Magic")],
  ];
  const priestReq = [["Bless (Deity) talent", hasTalent(st, "Bless")], ["Pray advance", adv((n) => n === "Pray")]];
  const arcane = allTalents(st).find((t) => ["Arcane Magic", "Chaos Magic"].includes(skillBase(t.name)));
  let lore = st.lore;
  const fixedLore = arcane && skillSpec(arcane.name) && !/any|lore/i.test(skillSpec(arcane.name)) ? skillSpec(arcane.name) : null;
  if (fixedLore) lore = fixedLore;
  const deityTalent = allTalents(st).find((t) => ["Bless", "Invoke"].includes(skillBase(t.name)));
  let deity = st.deity;
  if (deityTalent) { const sp = skillSpec(deityTalent.name); if (sp && DEITIES.includes(sp)) deity = sp; }
  return { isCaster, isPriest, casterReq, priestReq, arcane, lore, fixedLore, deity, hasBless: hasTalent(st, "Bless"), hasInvoke: hasTalent(st, "Invoke") };
}
const spellsOfLore = (lore) => DATA.spells.filter((s) => s.lore === lore);
const findSpell = (name) => DATA.spells.find((s) => s.name === name);
const findMiracle = (name) => DATA.miracles.find((m) => m.name === name);
