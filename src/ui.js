/* global DATA, CHARS, CHAR_NAMES, SPECIES, SPECIES_ORDER, RANDOM_TALENTS, CLASS_TRAPPINGS, CHAR_XP, SKILL_XP, SPELL_XP,
   PETTY_XP, TALENT_XP, ADVANCE_CAREER_XP, CHANGE_CAREER_XP, DEITIES, BLESSINGS_BY_CULT, COLOUR_LORES, OTHER_LORES,
   CHAOS_LORES, BACKGROUND_QUESTIONS, newState, rnd, rollDice, d100, bonus, skillBase, skillSpec, findSkill, findTalent,
   findCareer, speciesCareers, parseChoice, isResolved, speciesFromRoll, careerFromRoll, randomTalentFromRoll, baseChars,
   charBonusLimit, creationTalents, allTalents, talentCount, hasTalent, resolvedCareerSkills, creationSkillAdv,
   isCareerSkill, careerLevelSkills, derive, parsePrice, fmtMoney, rollWealth, gearIndex, findGear, encOf,
   purseTotal, extraMoneyPennies, itemEnc, inventoryItems, computeEncumbrance, itemStorageLoc,
   ownedStorageLocations, containerStorageLabel, migrateState,
   startingTrappings, advCost, spellCost, charAvailable, careerTalentEntries, ticksNeeded, xpSpent, magicProfile,
   spellsOfLore, findSpell, findMiracle, skillMatchesEntry, exportToExcel */

const STORE_KEY = "wfrp5e-character-v1";
let S = load() || newState();
let step = sessionStorage.getItem("wfrp5e-step") || "species";
const undoStack = [];
let shopFilter = { q: "", table: "" };

const STEPS = [
  ["species", "1 · Species"], ["career", "2 · Career"], ["chars", "3 · Characteristics"], ["skills", "4 · Skills"],
  ["talents", "5 · Talents & Trappings"], ["magic", "Magic & Prayers"], ["gear", "Gear Shop"],
  ["background", "6 · Personality"], ["sheet", "Character Sheet"], ["advance", "Advancement (XP)"],
  ["modifiers", "Modifiers & Notes"],
];

/* ---------- persistence ---------- */
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!s) return null;
    const st = Object.assign(newState(), s);
    migrateState(st);
    return st;
  } catch { return null; }
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }

/* ---------- helpers ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const opt = (v, label, sel) => `<option value="${esc(v)}"${sel ? " selected" : ""}>${esc(label ?? v)}</option>`;
const pg = (p) => (p ? `<span class="pg">p.${p}</span>` : "");
const btn = (act, label, arg = "", cls = "", dis = false) =>
  `<button class="btn ${cls}" data-act="${act}" data-arg="${esc(arg)}"${dis ? " disabled" : ""}>${label}</button>`;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function getPath(obj, path) { return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj); }
function setPath(obj, path, val) {
  const keys = path.split("."); const last = keys.pop();
  const tgt = keys.reduce((o, k) => (o[k] == null ? (o[k] = {}) : o[k]), obj);
  if (val === null || val === undefined) delete tgt[last]; else tgt[last] = val;
}
function talentTip(name) {
  const t = findTalent(name);
  return t ? `${t.desc} (p.${t.page})` : "";
}
function talentLabel(name) {
  return `<span class="tip" title="${esc(talentTip(name))}">${esc(name)}</span>`;
}

/* A control that resolves a choice entry ("A or B", "Lore (Any One)") into a concrete name stored at `path`. */
function choiceWidget(entry, path, opts = {}) {
  const ch = parseChoice(entry);
  const val = getPath(S, path);
  if (ch.fixed) return esc(ch.fixed);
  if (ch.options) {
    const inner = ch.options.map((o) => {
      const sub = parseChoice(o);
      return opt(o, sub.any ? `${o} …` : o, val === o || (sub.any && val && skillBase(val) === sub.any));
    }).join("");
    const sel = `<select data-bind="${path}" data-rerender ${opts.disabled ? "disabled" : ""}>${opt("", `Choose: ${entry}`, !val)}${inner}</select>`;
    const chosenSub = val && parseChoice(val).any ? parseChoice(val) : null;
    return chosenSub ? sel + " " + anyInput(chosenSub, path, null) : sel;
  }
  return anyInput(ch, path, val);
}
function anyInput(ch, path, val) {
  const id = `dl-${ch.any.replace(/\W/g, "")}`;
  const cur = val && skillBase(val) === ch.any && isResolved(val) ? skillSpec(val) || "" : "";
  const list = ch.specs.length ? `<datalist id="${id}">${ch.specs.map((s) => opt(s)).join("")}</datalist>` : "";
  return `<span class="any">${esc(ch.any)} (<input class="spec" list="${id}" placeholder="choose…" value="${esc(cur)}"
    data-bind="${path}" data-wrap="${esc(ch.any)}" data-rerender>)${list}</span>`;
}

/* ---------- validation ---------- */
function bonusTrappingsNeeded(st) {
  const c = findCareer(st.career);
  const need = st.careerMode === "first" ? 2 : st.careerMode === "three" ? 1 : 0;
  return c ? Math.min(need, c.levels[1].trappings.length) : need;
}
function issues(st, key) {
  const out = [];
  const D = derive(st);
  if (key === "species") { if (!st.species) out.push("Choose or roll a Species."); }
  if (key === "career") {
    if (!st.career) out.push("Choose or roll a Career.");
    const need = bonusTrappingsNeeded(st);
    if (st.career && st.l2Trappings.length < need) out.push(`Pick ${need} bonus Trapping(s) from Career level 2.`);
  }
  if (key === "chars") {
    if (!baseChars(st)) out.push("Determine all ten Characteristics.");
    if (st.charMethod === "P") {
      const sum = CHARS.reduce((a, c) => a + ((st.points || {})[c] || 0), 0);
      if (sum !== 100) out.push(`Point-buy must total exactly 100 (currently ${sum}).`);
    }
    const used = Object.values(st.charBonus).reduce((a, b) => a + b, 0);
    if (["A", "B"].includes(st.charMethod) && used < charBonusLimit(st)) out.push(`You still have ${charBonusLimit(st) - used} Career Characteristic point(s) to assign.`);
  }
  if (key === "skills") {
    if (st.speciesSkills.length !== 5) out.push("Pick exactly 5 Species Skills.");
    if (st.speciesSkills.some((s) => !isResolved(s.name))) out.push("Choose a specialisation for every Species Skill.");
    const rc = resolvedCareerSkills(st);
    if (rc.some((s) => !s.name || !isResolved(s.name))) out.push("Resolve every Career Skill choice.");
    const used = Object.values(st.careerAdv).reduce((a, b) => a + b, 0);
    if (used !== 8) out.push(`Assign exactly 8 Career Skill Advances (currently ${used}).`);
  }
  if (key === "talents") {
    const sp = SPECIES[st.species];
    if (sp) {
      sp.talents.forEach((t, i) => { if (!parseChoice(t).fixed && !st.speciesTalentChoice[i]) out.push(`Choose: ${t}.`); });
      if (st.randomTalents.filter((r) => r.name && isResolved(r.name)).length < sp.randomTalents) out.push(`Roll ${sp.randomTalents} Random Talent(s) and resolve specialisations.`);
    }
    if (!st.careerTalent || !isResolved(st.careerTalent)) out.push("Choose one Talent from your Career's first level.");
    if (startingTrappings(st).some((t) => t.pending)) out.push("Resolve Trapping choices.");
    if (!st.wealth) out.push("Roll your starting wealth.");
  }
  if (key === "magic") {
    const M = magicProfile(st, D);
    if (M.isCaster) M.casterReq.forEach(([l, ok]) => !ok && out.push(`Spellcaster missing: ${l}.`));
    if (M.isPriest) M.priestReq.forEach(([l, ok]) => !ok && out.push(`Priest missing: ${l}.`));
    if ((M.hasBless || M.hasInvoke) && !M.deity) out.push("Choose your deity.");
  }
  if (key === "background") {
    if (!st.name) out.push("Give your Character a name.");
    if (!st.ambition) out.push("Choose a personal Ambition.");
  }
  return out;
}

/* ---------- step: species ---------- */
function viewSpecies() {
  const sel = S.species;
  let rollBox = "";
  if (S.speciesRoll == null) {
    rollBox = `<p>Roll on the Species Table and keep the first result to gain <b>+1 Fortune</b> (and towards the Fickle Fate bonus).</p>
      ${btn("rollSpecies", "Roll d100 on Species Table", "", "primary")}`;
  } else {
    const rolled = speciesFromRoll(S.speciesRoll);
    rollBox = `<p>You rolled <b>${S.speciesRoll}</b>: <b>${SPECIES[rolled].name}</b>.
      ${S.speciesMode === "first" ? "<span class='ok'>Kept — +1 Fortune.</span>" : ""}</p>
      ${S.speciesMode !== "first" ? btn("keepSpecies", `Keep ${SPECIES[rolled].short} (+1 Fortune)`, "", "primary") : ""}`;
  }
  const cards = SPECIES_ORDER.map((id) => {
    const sp = SPECIES[id];
    const lockedByRoll = S.speciesMode === "first";
    return `<div class="card ${sel === id ? "selected" : ""}">
      <h3>${esc(sp.name)} ${pg(sp.page)}</h3>
      <div class="stats"><span>Fate <b>${sp.fate}</b></span><span>Fortune <b>${sp.fortune}</b></span><span>Move <b>${sp.move}</b></span></div>
      <p><b>Languages:</b> ${sp.languages.map((l) => esc(skillSpec(l))).join(", ")} (+30)</p>
      <p><b>Talents:</b> ${sp.talents.map(esc).join(", ")}${sp.randomTalents ? `, ${sp.randomTalents} Random` : ""}</p>
      <p class="small"><b>Skill options:</b> ${sp.skills.map(esc).join(", ")}</p>
      ${sp.option ? `<p class="small note">${esc(sp.option)}</p>` : ""}
      ${sel === id ? "<b class='ok'>Selected</b>" : btn("chooseSpecies", "Choose", id, "", lockedByRoll)}
    </div>`;
  }).join("");
  const sp = SPECIES[sel];
  const look = sp ? `<h2>Name and Appearance</h2>
    <div class="grid2">
      <label>Name <input data-bind="name" value="${esc(S.name)}"> ${btn("randomName", "Random")}</label>
      <label>Age <input data-bind="appearance.age" value="${esc(S.appearance.age)}"> ${btn("rollAge", `Roll ${sp.age[0]}+${sp.age[1]}d10`)}</label>
      <label>Height <input data-bind="appearance.height" value="${esc(S.appearance.height)}"> ${btn("rollHeight", "Roll")}</label>
      <label>Eyes <select data-bind="appearance.eyes">${opt("", "—")}${sp.eyes.map((e) => opt(e, e, S.appearance.eyes === e)).join("")}</select> ${btn("rollEyes", "Roll")}</label>
      <label>Hair <select data-bind="appearance.hair">${opt("", "—")}${sp.hair.map((e) => opt(e, e, S.appearance.hair === e)).join("")}</select> ${btn("rollHair", "Roll")}</label>
      <label class="wide">Description <input data-bind="appearance.desc" value="${esc(S.appearance.desc)}" placeholder="Scars, clothing, mannerisms…"></label>
    </div>` : "";
  return `<h1>1. Species ${pg(23)}</h1><div class="box">${rollBox}</div><div class="cards">${cards}</div>${look}`;
}

/* ---------- step: career ---------- */
function careerCard(c, compact) {
  const lv = c.levels[0];
  const scheme = CHARS.map((ch) => {
    const l = c.advance_scheme[ch];
    return `<td class="lv${l || 0}">${l ? (l === 1 ? "★" : l) : ""}</td>`;
  }).join("");
  return `<div class="career">
    <h3>${esc(c.name)} <span class="muted">— ${esc(c.class)}</span> ${pg(c.page)}</h3>
    <p class="muted">${esc(c.summary)}</p>
    <table class="scheme"><tr>${CHARS.map((ch) => `<th>${ch}</th>`).join("")}</tr><tr>${scheme}</tr></table>
    <p class="small">★ advanceable at level 1; numbers show the level where the Characteristic opens.</p>
    ${(compact ? [lv] : c.levels).map((l, i) => `<div class="level"><b>${i + 1}. ${esc(l.title)}</b> — ${l.status} ${l.standing}
      <div><i>Skills:</i> ${l.skills.map((s) => (s === c.income_skill ? `<u title="Income skill">${esc(s)}</u>` : esc(s))).join(", ")}</div>
      <div><i>Talents:</i> ${l.talents.map(talentLabel).join(", ")}</div>
      <div><i>Trappings:</i> ${l.trappings.map(esc).join(", ")}</div></div>`).join("")}
  </div>`;
}
function viewCareer() {
  if (!S.species) return `<h1>2. Class and Career</h1><p class="warn">Choose a Species first.</p>`;
  const avail = speciesCareers(S.species);
  let rollBox;
  const rolls = S.careerRolls;
  if (!rolls.length) {
    rollBox = `<p>Roll on your Species' Career table. Keep the first result to start with <b>two</b> Trappings from Career level 2;
      otherwise roll twice more and pick any of the three for <b>one</b> level-2 Trapping.</p>
      ${btn("rollCareer", "Roll d100 for Career", "", "primary")}`;
  } else {
    const names = rolls.map((r) => careerFromRoll(S.species, r));
    rollBox = `<p>Rolls: ${rolls.map((r, i) => `<b>${r}</b> → ${esc(names[i])}`).join("; ")}</p>`;
    if (!S.careerMode) {
      if (rolls.length === 1) rollBox += btn("keepCareer", `Keep ${names[0]} (+2 level-2 Trappings)`, "0", "primary") + " " + btn("rollCareer2", "Roll twice more");
      else rollBox += names.map((n, i) => btn("pickCareerRoll", `Take ${n} (+1 level-2 Trapping)`, String(i), "primary")).join(" ");
    } else if (S.careerMode === "first") rollBox += "<p class='ok'>First result kept: pick 2 Trappings from level 2.</p>";
    else if (S.careerMode === "three") rollBox += "<p class='ok'>Picked from three rolls: pick 1 Trapping from level 2.</p>";
  }
  const byClass = {};
  avail.forEach((c) => (byClass[c.class] = byClass[c.class] || []).push(c));
  const chooser = `<label>Or choose freely (no bonus Trappings):
    <select data-act-change="chooseCareer">${opt("", "— choose a career —")}
    ${Object.entries(byClass).map(([cls, cs]) => `<optgroup label="${esc(cls)}">${cs.map((c) => opt(c.name, `${c.name} (${c.levels[0].status} ${c.levels[0].standing})`, S.career === c.name)).join("")}</optgroup>`).join("")}
    </select></label>`;
  const c = findCareer(S.career);
  let bonusBox = "";
  const need = bonusTrappingsNeeded(S);
  if (c && need) {
    bonusBox = `<div class="box"><h3>Bonus Trappings from ${esc(c.levels[1].title)} (pick ${need})</h3>
      ${c.levels[1].trappings.map((t) => `<label class="chk"><input type="checkbox" data-act="toggleL2" data-arg="${esc(t)}"
        ${S.l2Trappings.includes(t) ? "checked" : ""} ${!S.l2Trappings.includes(t) && S.l2Trappings.length >= need ? "disabled" : ""}> ${esc(t)}</label>`).join("")}
      <p class="small">Each bonus Trapping ticks a box on your Career Advancement Tracker.</p></div>`;
  }
  return `<h1>2. Class and Career ${pg(36)}</h1><div class="box">${rollBox}<hr>${chooser}</div>${bonusBox}${c ? careerCard(c) : ""}`;
}

/* ---------- step: characteristics ---------- */
function viewChars() {
  if (!S.species || !S.career) return `<h1>3. Characteristics</h1><p class="warn">Choose Species and Career first.</p>`;
  const sp = SPECIES[S.species];
  const c = findCareer(S.career);
  const careerChars = CHARS.filter((ch) => c.advance_scheme[ch] === 1);
  if (!S.rollsA) {
    return `<h1>3. Characteristics ${pg(38)}</h1><div class="box">
      <p>Roll 2d10 for each Characteristic in order. You can then keep them (A, +6 Career points, counts for Fickle Fate),
      rearrange them (B, +3 Career points), or roll a new set / use 100-point buy (C, no bonus).</p>
      ${btn("rollChars", "Roll 2d10 × 10", "", "primary")}</div>`;
  }
  const m = S.charMethod;
  const methods = [
    ["A", "A · Keep in order (+6)"], ["B", "B · Rearrange (+3)"], ["C", "C · Roll new set & assign"], ["P", "C · 100-point buy"],
  ].map(([k, l]) => btn("charMethod", l, k, m === k ? "primary" : "")).join(" ");
  const rolls = m === "C" ? S.rollsC : S.rollsA;
  const base = baseChars(S) || {};
  const limit = charBonusLimit(S);
  const used = Object.values(S.charBonus).reduce((a, b) => a + b, 0);
  const D = derive(S);
  const rows = CHARS.map((ch, i) => {
    let rollCell;
    if (m === "A") rollCell = S.rollsA[i];
    else if (m === "P") rollCell = `<input type="number" min="4" max="16" class="num" data-bind="points.${ch}" data-num data-rerender value="${S.points[ch]}">`;
    else if (rolls) {
      rollCell = `<select data-act-change="assignRoll" data-arg="${ch}">${rolls.map((r, ri) => opt(ri, `${r}`, S.assign[ch] === ri)).join("")}</select>`;
    } else rollCell = "–";
    const isCareer = careerChars.includes(ch);
    const b = S.charBonus[ch] || 0;
    const bonusCell = isCareer && limit ? `${btn("charBonus", "−", `${ch}|-1`, "sm", b <= 0)} <b>${b}</b> ${btn("charBonus", "+", `${ch}|1`, "sm", used >= limit)}` : "";
    return `<tr class="${isCareer ? "hl" : ""}"><th title="${CHAR_NAMES[ch]}">${ch}</th><td>${rollCell}</td><td>+${sp.mods[ch]}</td>
      <td>${bonusCell}</td><td><b>${D.chars[ch].initial ?? "–"}</b></td><td>${D.chars[ch].bonus ?? ""}</td></tr>`;
  }).join("");
  const pointsSum = m === "P" ? CHARS.reduce((a, ch) => a + (S.points[ch] || 0), 0) : null;
  return `<h1>3. Characteristics ${pg(38)}</h1>
    <div class="box">${methods}
    <p class="small">${m === "A" ? "Rolls kept in order. Distribute up to 6 points among your highlighted Career Characteristics." :
      m === "B" ? "Assign the rolled values as you like (each value once), then distribute up to 3 Career points." :
      m === "C" ? "A brand new set, assigned as you like. No other increases." : "Distribute 100 points, minimum 4 and maximum 16 each. No other increases."}
      Talent bonuses (e.g. Savvy) are included in the total.</p>
    ${m === "C" && !S.rollsC ? `<p>${btn("rollCharsC", "Roll a new set of 2d10 × 10", "", "primary")}</p>` : ""}
    ${pointsSum != null ? `<p>Points used: <b class="${pointsSum === 100 ? "ok" : "warn"}">${pointsSum} / 100</b></p>` : ""}
    ${limit ? `<p>Career points used: <b>${used} / ${limit}</b> (Career Characteristics: ${careerChars.join(", ")})</p>` : ""}
    <table class="grid"><tr><th></th><th>2d10</th><th>Species</th><th>Career bonus</th><th>Total</th><th>Bonus</th></tr>${rows}</table></div>`;
}

/* ---------- step: skills ---------- */
function viewSkills() {
  if (!baseChars(S)) return `<h1>4. Skills</h1><p class="warn">Determine Characteristics first.</p>`;
  const sp = SPECIES[S.species];
  const D = derive(S);
  const val = (n) => { const r = D.skills.find((s) => s.name === n); return r ? r.value : null; };
  const speciesRows = sp.skills.map((opt0, i) => {
    const picked = S.speciesSkills.find((s) => s.opt === opt0);
    const idx = S.speciesSkills.indexOf(picked);
    const ch = parseChoice(opt0);
    const control = picked && !ch.fixed ? choiceWidget(opt0, `speciesSkills.${idx}.name`) : esc(opt0);
    return `<tr><td><input type="checkbox" data-act="toggleSpeciesSkill" data-arg="${i}" ${picked ? "checked" : ""}
      ${!picked && S.speciesSkills.length >= 5 ? "disabled" : ""}></td><td>${control}</td><td>${picked && picked.name ? val(picked.name) ?? "" : ""}</td></tr>`;
  }).join("");
  const rc = resolvedCareerSkills(S);
  const used = Object.values(S.careerAdv).reduce((a, b) => a + b, 0);
  const speciesAdv = (n) => S.speciesSkills.filter((s) => s.name === n).length;
  const careerRows = rc.map((s) => {
    const n = s.name;
    const a = n ? S.careerAdv[n] || 0 : 0;
    const cap = n ? 3 - speciesAdv(n) : 0;
    const info = n ? findSkill(n) : null;
    return `<tr><td>${choiceWidget(s.entry, `careerSkillChoice.${s.index}`)}</td>
      <td>${info ? info.char : ""}${info && info.advanced ? " <span class='tag'>adv</span>" : ""}</td>
      <td>${btn("careerAdv", "−", `${n}|-1`, "sm", !n || a <= 0)} <b>${a}</b> ${btn("careerAdv", "+", `${n}|1`, "sm", !n || !isResolved(n) || a >= cap || used >= 8)}</td>
      <td>${n && isResolved(n) ? val(n) ?? "" : ""}</td></tr>`;
  }).join("");
  const langs = sp.languages.map((l) => `${esc(l)} <b>${val(l)}</b>`).join(", ");
  return `<h1>4. Skills ${pg(38)}</h1>
    <div class="box"><p><b>Fluent languages</b> (+30): ${langs}</p></div>
    <div class="cols">
      <div class="box"><h3>Species Skills — pick 5 (+5 each): ${S.speciesSkills.length}/5</h3>
        <table class="grid">${speciesRows}</table></div>
      <div class="box"><h3>Career Skills — assign 8 Advances: ${used}/8</h3>
        <p class="small">Max 3 Advances (+15) per Skill at creation, including Species Advances.</p>
        <table class="grid"><tr><th>Skill</th><th>Char</th><th>Advances</th><th>Value</th></tr>${careerRows}</table></div>
    </div>`;
}

/* ---------- step: talents & trappings ---------- */
function viewTalents() {
  if (!S.species || !S.career) return `<h1>5. Talents & Trappings</h1><p class="warn">Choose Species and Career first.</p>`;
  const sp = SPECIES[S.species];
  const c = findCareer(S.career);
  const spTal = sp.talents.map((t, i) => {
    const ch = parseChoice(t);
    if (ch.fixed) return `<li>${talentLabel(t)}</li>`;
    return `<li>${ch.options.map((o) => `<label class="chk"><input type="radio" name="spt${i}" data-act="speciesTalent" data-arg="${i}|${esc(o)}"
      ${S.speciesTalentChoice[i] === o ? "checked" : ""}> ${talentLabel(o)}</label>`).join(" or ")}</li>`;
  }).join("");
  let rnd = "";
  if (sp.randomTalents) {
    const slots = Array.from({ length: sp.randomTalents }, (_, i) => {
      const rt = S.randomTalents[i];
      if (!rt) return `<li>${S.manualRandom ? `<select data-act-change="manualRandom" data-arg="${i}">${opt("", "— choose —")}${RANDOM_TALENTS.map(([, n]) => opt(n)).join("")}</select>` : btn("rollRandomTalent", "Roll d100", String(i))}</li>`;
      const ch = parseChoice(rt.name);
      const label = ch.any ? choiceWidget(rt.base || rt.name, `randomTalents.${i}.name`) : talentLabel(rt.name);
      return `<li>${rt.roll ? `<span class="muted">${rt.roll}:</span> ` : ""}${label} ${btn("clearRandomTalent", "×", String(i), "sm")}</li>`;
    }).join("");
    rnd = `<h3>Random Talents (${sp.randomTalents}) ${pg(23)}</h3><ul>${slots}</ul>
      <label class="chk small"><input type="checkbox" data-bind="manualRandom" data-bool data-rerender ${S.manualRandom ? "checked" : ""}> Choose instead of rolling (with GM permission)</label>`;
  }
  const careerTal = c.levels[0].talents.map((t) => {
    const ch = parseChoice(t);
    const selected = S.careerTalentEntry === t;
    return `<li><label class="chk"><input type="radio" name="ct" data-act="careerTalent" data-arg="${esc(t)}" ${selected ? "checked" : ""}>
      ${ch.fixed ? talentLabel(t) : esc(t)}</label> ${selected && !ch.fixed ? choiceWidget(t, "careerTalent") : ""}</li>`;
  }).join("");
  const trap = c.levels[0].trappings.map((t, i) => {
    const ch = parseChoice(t);
    return ch.fixed ? "" : `<li>${choiceWidget(t, `trappingChoice.${i}`)}</li>`;
  }).join("");
  const D = derive(S);
  const lvl = c.levels[0];
  return `<h1>5. Talents, Trappings, and Final Details ${pg(39)}</h1>
    <div class="cols">
      <div class="box"><h3>Species Talents</h3><ul>${spTal}</ul>${rnd}
        <h3>Career Talent — choose 1 from ${esc(lvl.title)}</h3><ul>${careerTal}</ul>
        <p class="small">Hover a Talent to read its summary.</p></div>
      <div class="box"><h3>Starting Trappings</h3>
        ${trap ? `<ul>${trap}</ul>` : ""}
        <ul class="small">${startingTrappings(S).map((t) => `<li>${esc(t.name)} <span class="muted">— ${esc(t.source)}</span></li>`).join("")}</ul>
        <h3>Starting Wealth (${lvl.status} ${lvl.standing})</h3>
        ${S.wealth ? `<p><b>${fmtMoney(S.wealth.pennies)}</b> <span class="muted">(${esc(S.wealth.text)})</span></p>` : btn("rollWealth", "Roll starting wealth", "", "primary")}
        <h3>Final details</h3>
        <table class="grid"><tr><th>Wounds</th><td>${D.wounds}</td><td class="small">SB + WPB + 2×TB${hasTalent(S, "Hardy") ? " + TB (Hardy)" : ""}</td></tr>
        <tr><th>Movement</th><td>${D.move}</td><td class="small">Walk ${D.walk} yd, Run ${D.run} yd</td></tr>
        <tr><th>Max Enc</th><td>${D.enc}</td><td class="small">SB + TB${D.sp.doubleEnc ? ", doubled (Dwarf)" : ""}</td></tr>
        <tr><th>Fate</th><td>${D.fate}</td><td class="small">${D.firstKept ? "+1 Fickle Fate (kept all first results)" : "Keep first Species, Career and Characteristic results for +1"}</td></tr>
        <tr><th>Fortune</th><td>${D.fortune}</td><td class="small">${S.speciesMode === "first" ? "+1 for keeping rolled Species" : ""}</td></tr></table>
      </div></div>`;
}

/* ---------- step: magic ---------- */
function viewMagic() {
  const D = derive(S);
  const M = magicProfile(S, D);
  const req = (list) => `<ul class="req">${list.map(([l, ok]) => `<li class="${ok ? "ok" : "warn"}">${ok ? "✔" : "✘"} ${esc(l)}</li>`).join("")}</ul>`;
  if (!M.isCaster && !M.isPriest) {
    return `<h1>Magic & Prayers ${pg(40)}</h1><div class="box"><p>Your Character has no magical or divine Talents yet.</p>
      <p class="small">A starting spellcaster needs Second Sight, Language (Magick), Channelling and Petty Magic.
      A priest needs Bless (Deity) and the Pray Skill. These may be bought later in the Advancement tab.</p>
      <h3>Spellcaster checklist</h3>${req(M.casterReq)}<h3>Priest checklist</h3>${req(M.priestReq)}</div>`;
  }
  let html = `<h1>Magic & Prayers ${pg(40)}</h1>`;
  if (M.isCaster) {
    const wpb = D.chars.WP.bonus || 0;
    const petty = S.spells.filter((n) => (findSpell(n) || {}).lore === "Petty");
    const loreSpells = S.spells.filter((n) => (findSpell(n) || {}).lore !== "Petty");
    const loreSlots = (M.arcane ? 1 : 0) + (hasTalent(S, "Witch!") ? 1 : 0);
    const spellList = (lore, limit, current) => `<div class="spells">${spellsOfLore(lore).map((sp) => {
      const on = S.spells.includes(sp.name);
      return `<label class="spell ${on ? "on" : ""}" title="${esc(sp.desc)}"><input type="checkbox" data-act="toggleSpell" data-arg="${esc(sp.name)}"
        ${on ? "checked" : ""} ${!on && current >= limit ? "disabled" : ""}> <b>${esc(sp.name)}</b> <span class="muted">CN ${esc(sp.cn)} · ${esc(sp.range)} · ${esc(sp.duration)}</span></label>`;
    }).join("")}</div>`;
    html += `<div class="box"><h3>Spellcaster checklist</h3>${req(M.casterReq)}</div>`;
    if (hasTalent(S, "Petty Magic")) html += `<div class="box"><h3>Petty Spells — choose ${wpb} (Willpower Bonus): ${petty.length}/${wpb} ${pg(240)}</h3>${spellList("Petty", wpb, petty.length)}</div>`;
    if (loreSlots) {
      const lores = M.arcane && skillBase(M.arcane.name) === "Chaos Magic" ? CHAOS_LORES : Object.keys(COLOUR_LORES).concat(OTHER_LORES);
      const loreSel = M.fixedLore
        ? `<p>Lore: <b>${esc(M.lore)}</b></p>`
        : `<label>Lore: <select data-bind="lore" data-rerender>${opt("", "— choose —")}${lores.map((l) => opt(l, l, S.lore === l)).join("")}</select></label>`;
      html += `<div class="box"><h3>Lore Spells — choose ${loreSlots}: ${loreSpells.length}/${loreSlots}</h3>
        <p class="small">Arcane Magic grants one Spell from your Lore; Witch! grants one from any Colour Lore or Witchcraft.
        General Arcane Spells (p.242) are open to any Arcane Lore.</p>${loreSel}
        ${M.lore ? `<h4>Lore of ${esc(M.lore)}</h4>${spellList(M.lore, loreSlots, loreSpells.length)}<h4>Arcane Spells</h4>${spellList("Arcane", loreSlots, loreSpells.length)}` : ""}</div>`;
    }
  }
  if (M.isPriest) {
    html += `<div class="box"><h3>Priest checklist</h3>${req(M.priestReq)}
      <label>Deity: <select data-bind="deity" data-rerender>${opt("", "— choose —")}${DEITIES.map((d) => opt(d, d, M.deity === d)).join("")}</select></label>`;
    if (M.deity && M.hasBless) {
      html += `<h4>Blessings of ${esc(M.deity)} ${pg(220)}</h4><ul>${(BLESSINGS_BY_CULT[M.deity] || []).map((b) => {
        const bl = DATA.blessings.find((x) => x.name === `Blessing of ${b}`);
        return `<li title="${esc(bl ? bl.desc : "")}"><b>Blessing of ${esc(b)}</b> <span class="muted">${bl ? `${esc(bl.range)} · ${esc(bl.duration)}` : ""}</span></li>`;
      }).join("")}</ul>`;
    }
    if (M.deity && M.hasInvoke) {
      const mir = DATA.miracles.filter((m) => m.god === M.deity);
      const limit = 1;
      html += `<h4>Miracles of ${esc(M.deity)} — choose ${limit} ${pg(222)}</h4><div class="spells">${mir.map((m) => {
        const on = S.miracles.includes(m.name);
        return `<label class="spell ${on ? "on" : ""}" title="${esc(m.desc)}"><input type="checkbox" data-act="toggleMiracle" data-arg="${esc(m.name)}" ${on ? "checked" : ""}
          ${!on && S.miracles.length >= limit ? "disabled" : ""}> <b>${esc(m.name)}</b> <span class="muted">${esc(m.range)} · ${esc(m.duration)}</span></label>`;
      }).join("")}</div>`;
    }
    html += "</div>";
  }
  return html;
}

/* ---------- step: gear ---------- */
function encTotals() {
  const enc = computeEncumbrance(S);
  return { items: enc.items, total: enc.personTotal, containers: enc.containers };
}
function storageSelect(it, locations) {
  const loc = itemStorageLoc(S, it.key);
  const isCont = containerStorageLabel(it.name) != null;
  const opts = locations.filter((l) => !isCont || l === "Carried" || l === "Worn");
  return `<select data-act-change="setItemStorage" data-arg="${esc(it.key)}">${opts.map((l) => opt(l, l, loc === l)).join("")}</select>`;
}
function containerPanels(containers) {
  if (!containers.length) return "";
  return `<h3>Containers</h3>
    <p class="small">Items stowed in a bag count against that container's capacity, not yours. Only the container's Enc counts on your person (Worn −1 Enc). ${pg(299)}</p>
    ${containers.map((c) => `<div class="box container-box"><b>${esc(c.label)}</b> <span class="muted">(${esc(c.name)})</span>
      — <span class="${c.used > c.capacity ? "warn" : "ok"}">${c.used} / ${c.capacity} Enc inside</span>
      <ul class="small">${c.items.length ? c.items.map((i) => `<li>${esc(i.name)} (${itemEnc(i)} Enc)</li>`).join("") : "<li class='muted'>Empty</li>"}</ul></div>`).join("")}`;
}
function purse() { return purseTotal(S); }
function viewGear() {
  if (!S.career) return `<h1>Gear Shop</h1><p class="warn">Choose a Career first.</p>`;
  const D = derive(S);
  const { items, total, containers } = encTotals();
  const storageLocs = ownedStorageLocations(S);
  const money = purse();
  const inv = items.map((it) => `<tr><td>${esc(it.name)}</td><td class="muted small">${esc(it.source)}</td><td>${itemEnc(it)}</td>
    <td>${storageSelect(it, storageLocs)}</td>
    <td>${it.kind === "buy" ? btn("sellItem", "Return", String(it.idx), "sm") : ""}${it.kind === "custom" ? btn("removeCustomItem", "Remove", String(it.idx), "sm") : ""}</td></tr>`).join("");
  const cashIn = (S.moneyAdded || []).map((m, i) => `<li>+ ${fmtMoney(m.pennies)}${m.note ? ` — ${esc(m.note)}` : ""} ${btn("removeMoney", "×", String(i), "sm")}</li>`).join("");
  const cashOut = (S.moneyLost || []).map((m, i) => `<li>− ${fmtMoney(m.pennies)}${m.note ? ` — ${esc(m.note)}` : ""} ${btn("removeMoneyLost", "×", String(i), "sm")}</li>`).join("");
  const tables = [...new Set(gearIndex().map((g) => g.table))];
  const q = shopFilter.q.toLowerCase();
  const rows = gearIndex().filter((g) => (!shopFilter.table || g.table === shopFilter.table) && (!q || g.name.toLowerCase().includes(q) || (g.group || "").toLowerCase().includes(q)))
    .map((g) => {
      const gi = gearIndex().indexOf(g);
      const extra = [g.reach && `Reach ${g.reach}`, g.range && `Range ${g.range}`, g.damage && `Dmg ${g.damage}`, g.locations && `${g.locations}`,
        g.ap && `AP ${g.ap}`, g.penalty && g.penalty !== "–" && g.penalty, g.carries && `Carries ${g.carries}`, g.qualities && g.qualities !== "–" && g.qualities]
        .filter(Boolean).join(" · ");
      return `<tr><td><b>${esc(g.name)}</b>${g.twoHanded ? " <span class='tag'>2H</span>" : ""}<div class="small muted">${esc(g.group || "")} ${esc(extra)}</div></td>
        <td>${esc(g.priceText)}</td><td>${esc(g.enc)}</td><td class="small">${esc(g.avail)}</td>
        <td>${g.price != null ? btn("buyItem", "Buy", String(gi), "sm", g.price > money) : ""}</td></tr>`;
    }).join("");
  return `<h1>Gear Shop ${pg(296)}</h1>
    <div class="cols">
      <div class="box"><h3>Purse: <span class="${money < 0 ? "warn" : "ok"}">${fmtMoney(money)}</span></h3>
        <p class="small">1 GC = 20 shillings (s) = 240 pennies (d). Starting wealth from your career roll; add loot or pay later below.</p>
        ${S.wealth ? `<p class="small muted">Starting roll: ${fmtMoney(S.wealth.pennies)} (${esc(S.wealth.text)})</p>` : `<p class="small warn">Roll starting wealth on the Talents step, or add cash manually.</p>`}
        ${cashIn || cashOut ? `<ul class="small cash-log">${cashIn}${cashOut}</ul>` : ""}
        <div class="row add-money">
          <label>GC <input data-bind="_addGC" data-num min="0" value="${esc(S._addGC ?? "")}" size="3"></label>
          <label>s <input data-bind="_addSS" data-num min="0" value="${esc(S._addSS ?? "")}" size="3"></label>
          <label>d <input data-bind="_addDD" data-num min="0" value="${esc(S._addDD ?? "")}" size="3"></label>
          <label class="grow">Note <input data-bind="_addMoneyNote" value="${esc(S._addMoneyNote || "")}" placeholder="e.g. loot from bandits"></label>
          ${btn("addMoney", "Add cash", "", "sm")}
        </div>
        <div class="row add-money">
          <label>GC <input data-bind="_loseGC" data-num min="0" value="${esc(S._loseGC ?? "")}" size="3"></label>
          <label>s <input data-bind="_loseSS" data-num min="0" value="${esc(S._loseSS ?? "")}" size="3"></label>
          <label>d <input data-bind="_loseDD" data-num min="0" value="${esc(S._loseDD ?? "")}" size="3"></label>
          <label class="grow">Note <input data-bind="_loseMoneyNote" value="${esc(S._loseMoneyNote || "")}" placeholder="e.g. stolen purse"></label>
          ${btn("loseMoney", "Record loss", "", "sm")}
        </div>
        <h3>Custom item</h3>
        <p class="small">For gear not in the rulebook list (homebrew, gifts, odd trappings).</p>
        <div class="row add-custom">
          <label class="grow">Name <input data-bind="_customName" value="${esc(S._customName || "")}" placeholder="e.g. Lucky charm"></label>
          <label>Enc <input data-bind="_customEnc" data-num min="0" value="${esc(S._customEnc ?? "")}" size="3"></label>
          <label>Type <select data-bind="_customCat">${opt("trap", "Trapping", (S._customCat || "trap") === "trap")}${opt("weapon", "Weapon", S._customCat === "weapon")}${opt("armour", "Armour", S._customCat === "armour")}</select></label>
          ${btn("addCustomItem", "Add", "", "sm")}
        </div>
        <h3>On your person — Enc <span class="${total > D.enc ? "warn" : "ok"}">${total} / ${D.enc}</span></h3>
        <p class="small">Set location to <b>Worn</b> (−1 Enc on you) or stow items inside a container you carry.</p>
        <table class="grid"><tr><th>Item</th><th>Source</th><th>Enc</th><th>Location</th><th></th></tr>${inv}</table>
        ${containerPanels(containers)}</div>
      <div class="box shop"><h3>Market</h3>
        <input placeholder="Search…" value="${esc(shopFilter.q)}" data-shop="q">
        <select data-shop="table">${opt("", "All tables")}${tables.map((t) => opt(t, t, shopFilter.table === t)).join("")}</select>
        <table class="grid"><tr><th>Item</th><th>Price</th><th>Enc</th><th>Avail.</th><th></th></tr>${rows}</table></div>
    </div>`;
}

/* ---------- step: background ---------- */
function viewBackground() {
  return `<h1>6. Personality and Background ${pg(41)}</h1>
    <div class="box"><label class="wide">Name <input data-bind="name" value="${esc(S.name)}"></label>
    <label class="wide">Personal Ambition <input data-bind="ambition" value="${esc(S.ambition)}" placeholder="e.g. Owning your own coaching inn"></label>
    <p class="small">Real progress earns +50 XP per session; achieving it earns +250 XP.</p>
    <label class="wide">Party Ambition <input data-bind="partyAmbition" value="${esc(S.partyAmbition)}" placeholder="Agree this with your group and GM"></label>
    <p class="small">Completing the Party Ambition grants every Character +1 Fate.</p></div>
    <div class="box"><h3>Questions</h3>${BACKGROUND_QUESTIONS.map(([k, q]) => `<label class="wide">${esc(q)}
      <textarea rows="2" data-bind="bg.${k}">${esc(S.bg[k] || "")}</textarea></label>`).join("")}
    <label class="wide">Background notes <textarea rows="3" data-bind="notes" placeholder="Creation-time notes">${esc(S.notes)}</textarea></label>
    <label class="wide">Character notes <textarea rows="4" data-bind="characterNotes" placeholder="Ongoing campaign notes (edit under Modifiers & Notes)">${esc(S.characterNotes || "")}</textarea></label></div>`;
}

/* ---------- other modifiers & notes ---------- */
function charOtherEditor() {
  return `<div class="box"><h3>Other characteristic modifiers</h3>
    <p class="small">Point changes from mutations, amputations, deformities, or GM rulings (negative values allowed). Matches the Excel <i>Other modifier</i> row.</p>
    <table class="grid char-other"><tr>${CHARS.map((ch) => `<th>${ch}</th>`).join("")}</tr>
    <tr>${CHARS.map((ch) => `<td><input type="number" class="num" data-bind="charOther.${ch}" value="${S.charOther?.[ch] ?? ""}" placeholder="0"></td>`).join("")}</tr></table></div>`;
}
function characterNotesEditor() {
  return `<div class="box"><h3>Character notes</h3>
    <p class="small">Ongoing notes for your character (campaign events, injuries, reminders). Included on the printed Character Sheet.</p>
    <textarea rows="8" class="wide" data-bind="characterNotes">${esc(S.characterNotes || "")}</textarea></div>`;
}
function viewModifiers() {
  if (!baseChars(S)) return `<h1>Modifiers & Notes</h1><p class="warn">Finish character creation first.</p>`;
  return `<h1>Modifiers & Notes</h1>
    <p class="small">Track mutations, injuries, and other changes after creation. Values here update your Character Sheet and Excel export.</p>
    ${charOtherEditor()}
    ${characterNotesEditor()}`;
}

/* ---------- character sheet ---------- */
function weaponRows(D) {
  const names = inventoryItems(S).map((i) => i.name);
  const sb = D.chars.S.bonus || 0;
  return names.map(findGear).filter((g) => g && g.damage && /WEAPONS|AMMUNITION/.test(g.table)).map((g) => {
    const dmg = g.damage.replace(/\+?SB/, "").replace(/\s+/g, "");
    const total = /SB/.test(g.damage) ? sb + (parseInt(dmg, 10) || 0) : g.damage;
    return `<tr><td>${esc(g.name)}</td><td>${esc(g.group || "")}</td><td>${esc(g.enc)}</td><td>${esc(g.reach || g.range || "")}</td>
      <td>${esc(g.damage)} (${esc(total)})</td><td class="small">${esc(g.qualities || "")}</td></tr>`;
  }).join("");
}
function armourByLocation() {
  const locs = { Head: 0, Arms: 0, Body: 0, Legs: 0 };
  const rows = [];
  inventoryItems(S).forEach((it) => {
    const g = findGear(it.name);
    if (!g || g.table !== "ARMOUR" || !g.ap) return;
    rows.push(g);
    (g.locations || "").split(/,\s*/).forEach((l) => { if (locs[l] != null) locs[l] += parseInt(g.ap, 10) || 0; });
  });
  return { locs, rows };
}
function viewSheet() {
  const D = derive(S);
  const c = D.career;
  if (!D.sp || !c || !baseChars(S)) return `<h1>Character Sheet</h1><p class="warn">Complete Species, Career and Characteristics first.</p>`;
  const lv = D.level;
  const charRow = (k) => CHARS.map((ch) => `<td>${D.chars[ch][k] ?? ""}</td>`).join("");
  const skillsShown = D.skills.filter((s) => !s.advanced || s.adv > 0);
  const half = Math.ceil(skillsShown.length / 2);
  const skillTable = (list) => `<table class="grid sk"><tr><th>Skill</th><th>Char</th><th>Adv</th><th>Value</th></tr>${list.map((s) =>
    `<tr class="${s.career ? "career-sk" : ""}"><td>${esc(s.name)}${s.grouped && !skillSpec(s.name) ? " (any)" : ""}</td><td>${s.char}</td><td>${s.adv || ""}</td><td><b>${s.value ?? ""}</b></td></tr>`).join("")}</table>`;
  const { locs, rows: armour } = armourByLocation();
  const { items, total, containers } = encTotals();
  const M = magicProfile(S, D);
  const spells = S.spells.map(findSpell).filter(Boolean);
  const blessings = M.hasBless && M.deity ? BLESSINGS_BY_CULT[M.deity] : [];
  const miracles = S.miracles.map(findMiracle).filter(Boolean);
  const scheme = CHARS.map((ch) => `<td class="lv${c.advance_scheme[ch] || 0}">${c.advance_scheme[ch] ? (c.advance_scheme[ch] === 1 ? "★" : c.advance_scheme[ch]) : ""}</td>`).join("");
  const need = ticksNeeded(S);
  const otherRow = CHARS.map((ch) => {
    const o = D.chars[ch].other;
    return `<td>${o ? (o > 0 ? `+${o}` : o) : ""}</td>`;
  }).join("");
  return `<div class="toolbar no-print">${btn("print", "Print / Save as PDF", "", "primary")}</div>
  <div class="sheet">
    <div class="sheet-head">
      <div><span class="lbl">Name</span><b class="big">${esc(S.name || "—")}</b></div>
      <div><span class="lbl">Species</span>${esc(D.sp.name)}</div>
      <div><span class="lbl">Class</span>${esc(c.class)}</div>
      <div><span class="lbl">Career</span>${esc(c.name)} (${esc(lv.title)})</div>
      <div><span class="lbl">Status</span>${esc(D.status)}</div>
      <div class="wide"><span class="lbl">Appearance</span>${esc([S.appearance.age && `Age ${S.appearance.age}`, S.appearance.height, S.appearance.eyes && `${S.appearance.eyes} eyes`, S.appearance.hair && `${S.appearance.hair} hair`, S.appearance.desc].filter(Boolean).join(", "))}</div>
    </div>
    <table class="grid chars"><tr><th></th>${CHARS.map((ch) => `<th>${ch}</th>`).join("")}</tr>
      <tr><th>Initial</th>${charRow("initial")}</tr><tr><th>Advances</th>${CHARS.map((ch) => `<td>${D.chars[ch].adv ? "+" + D.chars[ch].adv * 5 : ""}</td>`).join("")}</tr>
      <tr><th>Other</th>${otherRow}</tr>
      <tr><th>Current</th>${charRow("current")}</tr><tr><th>Scheme</th>${scheme}</tr></table>
    <div class="sheet-stats">
      <div><span class="lbl">Wounds</span><b class="big">${D.wounds}</b></div>
      <div><span class="lbl">Fate</span><b class="big">${D.fate}</b></div>
      <div><span class="lbl">Fortune</span><b class="big">${D.fortune}</b></div>
      <div><span class="lbl">Move</span><b class="big">${D.move}</b><span class="small">Walk ${D.walk} · Run ${D.run}</span></div>
      <div><span class="lbl">Enc</span><b class="big">${total}/${D.enc}</b></div>
      <div><span class="lbl">XP</span>${S.xp.total - xpSpent(S)} / spent ${xpSpent(S)} / total ${S.xp.total}</div>
    </div>
    <h3>Skills <span class="small muted">(highlighted = Career Skill at current level)</span></h3>
    <div class="cols tight">${skillTable(skillsShown.slice(0, half))}${skillTable(skillsShown.slice(half))}</div>
    <h3>Talents</h3>
    <table class="grid"><tr><th>Talent</th><th>Description</th><th>pg</th></tr>${D.talents.map((t) => {
      const info = findTalent(t.name);
      return `<tr><td><b>${esc(t.name)}</b></td><td class="small">${esc(info ? info.desc : "")}</td><td>${info ? info.page : ""}</td></tr>`;
    }).join("")}</table>
    <div class="cols tight">
      <div><h3>Weapons</h3><table class="grid"><tr><th>Name</th><th>Group</th><th>Enc</th><th>Reach/Range</th><th>Damage</th><th>Qualities</th></tr>${weaponRows(D)}</table></div>
      <div><h3>Armour</h3><table class="grid"><tr><th>Name</th><th>Locations</th><th>AP</th><th>Qualities</th></tr>${armour.map((a) =>
        `<tr><td>${esc(a.name)}</td><td>${esc(a.locations)}</td><td>${esc(a.ap)}</td><td class="small">${esc(a.qualities || "")}</td></tr>`).join("")}</table>
        <p>AP — Head ${locs.Head} · Arms ${locs.Arms} · Body ${locs.Body} · Legs ${locs.Legs}</p>
        <p class="small">Hit locations: Head 01–09, Left Arm 10–24, Right Arm 25–44, Body 45–79, Left Leg 80–89, Right Leg 90–00.</p></div>
    </div>
    <div class="cols tight">
      <div><h3>Trappings</h3><p class="small">${items.map((i) => `${esc(i.name)} (${esc(itemStorageLoc(S, i.key))})`).join(", ")}</p>
        ${containers.length ? `<p class="small"><b>Containers:</b> ${containers.map((c) => `${c.label} ${c.used}/${c.capacity}`).join(" · ")}</p>` : ""}
        <p><b>Wealth:</b> ${fmtMoney(purse())}</p></div>
      <div><h3>Ambitions</h3><p><b>Personal:</b> ${esc(S.ambition)}</p><p><b>Party:</b> ${esc(S.partyAmbition)}</p></div>
    </div>
    ${spells.length || blessings.length || miracles.length ? `<h3>Spells and Prayers</h3><table class="grid"><tr><th>Name</th><th>CN</th><th>Range</th><th>Target</th><th>Duration</th><th>Effect</th></tr>
      ${spells.map((s) => `<tr><td><b>${esc(s.name)}</b> <span class="muted small">${esc(s.lore)}</span></td><td>${esc(s.cn)}</td><td>${esc(s.range)}</td><td>${esc(s.target)}</td><td>${esc(s.duration)}</td><td class="small">${esc(s.desc)}</td></tr>`).join("")}
      ${blessings.map((b) => { const bl = DATA.blessings.find((x) => x.name === `Blessing of ${b}`) || {}; return `<tr><td><b>Blessing of ${esc(b)}</b></td><td>–</td><td>${esc(bl.range)}</td><td>${esc(bl.target)}</td><td>${esc(bl.duration)}</td><td class="small">${esc(bl.desc)}</td></tr>`; }).join("")}
      ${miracles.map((m) => `<tr><td><b>${esc(m.name)}</b> <span class="muted small">${esc(m.god)}</span></td><td>–</td><td>${esc(m.range)}</td><td>${esc(m.target)}</td><td>${esc(m.duration)}</td><td class="small">${esc(m.desc)}</td></tr>`).join("")}</table>` : ""}
    <h3>Career Path</h3>
    <p class="small">${c.levels.map((l, i) => `${i + 1 === S.careerLevel ? "<b>" : ""}${i + 1}. ${esc(l.title)} (${l.status} ${l.standing})${i + 1 === S.careerLevel ? "</b>" : ""}`).join(" → ")}
      · Advancement ticks: ${S.ticks}${need ? ` / ${need}` : ""}${S.careerHistory.length ? ` · Previous careers: ${S.careerHistory.map(esc).join(", ")}` : ""}</p>
    ${S.bg && Object.values(S.bg).some(Boolean) ? `<h3>Background</h3>${BACKGROUND_QUESTIONS.filter(([k]) => S.bg[k]).map(([k, q]) => `<p class="small"><b>${esc(q)}</b> ${esc(S.bg[k])}</p>`).join("")}` : ""}
    ${S.characterNotes ? `<h3>Character notes</h3><p class="small sheet-notes">${esc(S.characterNotes)}</p>` : ""}
    ${S.notes ? `<h3>Background notes</h3><p class="small">${esc(S.notes)}</p>` : ""}
  </div>`;
}

/* ---------- advancement ---------- */
function viewAdvance() {
  const D = derive(S);
  const c = D.career;
  if (!c || !baseChars(S)) return `<h1>Advancement</h1><p class="warn">Finish character creation first.</p>`;
  const spent = xpSpent(S);
  const avail = S.xp.total - spent;
  const mult = (career) => (career ? 1 : 2);
  const charRows = CHARS.map((ch) => {
    const career = charAvailable(S, ch);
    const n = S.adv.chars[ch] || 0;
    const cost = advCost(CHAR_XP, n) * mult(career);
    const can = (career || S.allowNonCareer) && cost <= avail;
    return `<tr class="${career ? "hl" : ""}"><th>${ch}</th><td>${D.chars[ch].current}</td><td>${n ? "+" + n * 5 : ""}</td><td>${cost}${career ? "" : " (×2)"}</td>
      <td>${btn("buyChar", "+5", ch, "sm", !can)}</td></tr>`;
  }).join("");
  const careerEntries = careerLevelSkills(c, S.careerLevel);
  const seen = new Set();
  const skillRows = careerEntries.map((e) => {
    const ch = parseChoice(e.entry);
    const key = `${e.level}.${e.index}`;
    const chosen = S._advChoice && S._advChoice[key];
    let name = ch.fixed || (e.level === 1 ? resolvedCareerSkills(S)[e.index]?.name : null) || chosen;
    if (seen.has(e.entry + e.level)) return "";
    seen.add(e.entry + e.level);
    const adv = name && isResolved(name) ? D.skills.find((s) => s.name === name)?.adv || 0 : 0;
    const cost = advCost(SKILL_XP, adv);
    const ctrl = ch.fixed || (e.level === 1 && name) ? esc(name) : choiceWidget(e.entry, `_advChoice.${key}`);
    const val = name && isResolved(name) ? (D.skills.find((s) => s.name === name)?.value ?? (D.chars[(findSkill(name) || {}).char || "Int"].current)) : "";
    return `<tr><td>${e.level}</td><td>${ctrl}</td><td>${adv || ""}</td><td>${val}</td><td>${cost}</td>
      <td>${btn("buySkill", "+5", name || "", "sm", !name || !isResolved(name) || cost > avail)}</td></tr>`;
  }).join("");
  const nonCareer = S.allowNonCareer ? `<p>Non-career Skill: <input list="dl-allskills" data-bind="_ncSkill" value="${esc(S._ncSkill || "")}" placeholder="e.g. Swim, Lore (Law)">
    <datalist id="dl-allskills">${DATA.skills.map((s) => opt(s.grouped ? `${s.name} ()` : s.name)).join("")}</datalist>
    ${btn("buyNonCareerSkill", "Buy (×2 cost)", "", "sm")}</p>
    <p>Non-career Talent: <input list="dl-alltalents" data-bind="_ncTalent" value="${esc(S._ncTalent || "")}">
    <datalist id="dl-alltalents">${DATA.talents.map((t) => opt(t.name)).join("")}</datalist> ${btn("buyNonCareerTalent", `Buy (${TALENT_XP})`, "", "sm")}</p>` : "";
  const talentRows = careerTalentEntries(S).map((e, i) => {
    const ch = parseChoice(e.entry);
    const key = `t${i}`;
    const name = ch.fixed || (S._advChoice && S._advChoice[key]);
    const count = name ? talentCount(S, skillBase(name)) : 0;
    const info = findTalent(e.entry);
    const owned = name && allTalents(S).some((t) => t.name === name);
    const blocked = owned && !(info && info.multi);
    return `<tr><td>${e.level}</td><td>${ch.fixed ? talentLabel(e.entry) : choiceWidget(e.entry, `_advChoice.${key}`)}</td><td>${count || ""}</td>
      <td>${btn("buyTalent", `Buy (${TALENT_XP})`, name || "", "sm", !name || !isResolved(name) || blocked || TALENT_XP > avail)}</td></tr>`;
  }).join("");
  const M = magicProfile(S, D);
  let magic = "";
  if (M.isCaster || M.hasInvoke) {
    const petty = S.spells.filter((n) => (findSpell(n) || {}).lore === "Petty").length;
    const lore = S.spells.length - petty;
    const pc = spellCost(PETTY_XP, petty), lc = spellCost(SPELL_XP, lore), mc = spellCost(SPELL_XP, S.miracles.length);
    const learnable = [];
    if (hasTalent(S, "Petty Magic")) spellsOfLore("Petty").forEach((s) => learnable.push([s, pc]));
    if (M.arcane && M.lore) spellsOfLore(M.lore).concat(skillBase(M.arcane.name) === "Arcane Magic" ? spellsOfLore("Arcane") : []).forEach((s) => learnable.push([s, lc]));
    magic = `<div class="box"><h3>Spells & Miracles</h3>
      <p class="small">Petty spells known ${petty} (next ${pc} XP) · Lore spells known ${lore} (next ${lc} XP) · Miracles known ${S.miracles.length} (next ${mc} XP)</p>
      <select data-bind="_newSpell">${opt("", "— learn a spell —")}${learnable.filter(([s]) => !S.spells.includes(s.name)).map(([s, cost]) => opt(s.name, `${s.name} (${s.lore}, ${cost} XP)`, S._newSpell === s.name)).join("")}</select>
      ${btn("buySpell", "Learn", "", "sm")}
      ${M.hasInvoke && M.deity ? `<select data-bind="_newMiracle">${opt("", "— learn a miracle —")}${DATA.miracles.filter((m) => m.god === M.deity && !S.miracles.includes(m.name)).map((m) => opt(m.name, `${m.name} (${mc} XP)`, S._newMiracle === m.name)).join("")}</select> ${btn("buyMiracle", "Learn", "", "sm")}` : ""}</div>`;
  }
  const need = ticksNeeded(S);
  const sameClass = DATA.careers.filter((x) => x.species.includes(D.sp.short) && x.name !== c.name);
  return `<h1>Advancement (XP) ${pg(191)}</h1>
    <div class="box xpbar"><b>XP:</b> current <b class="big">${avail}</b> · spent ${spent} · total ${S.xp.total}
      <span class="right"><input type="number" class="num" id="xpAdd" placeholder="XP"> <input id="xpNote" placeholder="reason"> ${btn("addXp", "Award XP", "", "primary")}</span></div>
    <div class="box"><h3>Career: ${esc(c.name)} — level ${S.careerLevel}: ${esc(D.level.title)} (${esc(D.status)})</h3>
      <p>Advancement ticks: <b>${S.ticks}</b>${need ? ` / ${need} needed for level ${S.careerLevel + 1}` : " (top level)"}
      ${btn("tick", "+1 tick: acquired next-level Trapping", "", "sm", !need)}
      ${need ? btn("advanceCareer", `Advance to ${esc(c.levels[S.careerLevel].title)} (${ADVANCE_CAREER_XP} XP)`, "", "primary", S.ticks < need || avail < ADVANCE_CAREER_XP) : ""}</p>
      <p>Change Career (${CHANGE_CAREER_XP.same} XP same Class / ${CHANGE_CAREER_XP.other} XP other Class, GM permitting):
      <select data-bind="_newCareer">${opt("", "— choose —")}${sameClass.map((x) => opt(x.name, `${x.name} (${x.class}, ${x.class === c.class ? CHANGE_CAREER_XP.same : CHANGE_CAREER_XP.other} XP)`, S._newCareer === x.name)).join("")}</select>
      ${btn("changeCareer", "Change", "", "sm")}</p>
      <label class="chk small"><input type="checkbox" data-bind="allowNonCareer" data-bool data-rerender ${S.allowNonCareer ? "checked" : ""}>
      Allow non-career purchases (double cost for Characteristics/Skills; normally via Training / Unusual Learning Endeavours)</label></div>
    <div class="cols">
      <div class="box"><h3>Characteristics</h3><table class="grid"><tr><th></th><th>Value</th><th>Adv</th><th>Cost</th><th></th></tr>${charRows}</table></div>
      <div class="box"><h3>Career Skills (levels 1–${S.careerLevel})</h3><table class="grid"><tr><th>Lvl</th><th>Skill</th><th>Adv</th><th>Value</th><th>Cost</th><th></th></tr>${skillRows}</table>${nonCareer}</div>
    </div>
    <div class="cols">
      <div class="box"><h3>Career Talents</h3><table class="grid"><tr><th>Lvl</th><th>Talent</th><th>Owned</th><th></th></tr>${talentRows}</table></div>
      ${magic}
    </div>
    <div class="box"><h3>Log ${btn("undo", "Undo last", "", "sm", !undoStack.length)}</h3>
      <table class="grid small">${S.xp.log.slice().reverse().map((e) => `<tr><td>${esc(e.label)}</td><td>${e.cost > 0 ? "−" + e.cost : "+" + -e.cost}</td></tr>`).join("")}</table></div>`;
}

/* ---------- side summary ---------- */
function viewSummary() {
  const D = derive(S);
  const ch = CHARS.map((c) => `<div><span>${c}</span><b>${D.chars[c].current ?? "–"}</b></div>`).join("");
  return `<h3>${esc(S.name || "Unnamed")}</h3>
    <p class="small">${D.sp ? esc(D.sp.name) : "No species"} · ${D.career ? `${esc(D.career.name)} (${esc(D.level.title)})` : "No career"}<br>${esc(D.status)}</p>
    <div class="mini">${ch}</div>
    <div class="mini2"><div>Wounds <b>${D.sp && baseChars(S) ? D.wounds : "–"}</b></div><div>Fate <b>${D.fate ?? "–"}</b></div>
      <div>Fortune <b>${D.fortune ?? "–"}</b></div><div>Move <b>${D.move ?? "–"}</b></div></div>
    <p class="small">XP ${S.xp.total - xpSpent(S)} · Purse ${fmtMoney(purse())}</p>
    ${STEPS.map(([k]) => issues(S, k)).flat().slice(0, 6).map((i) => `<p class="small warn">• ${esc(i)}</p>`).join("")}`;
}

/* ---------- render ---------- */
const VIEWS = { species: viewSpecies, career: viewCareer, chars: viewChars, skills: viewSkills, talents: viewTalents,
  magic: viewMagic, gear: viewGear, background: viewBackground, sheet: viewSheet, advance: viewAdvance, modifiers: viewModifiers };
function render() {
  const nav = STEPS.map(([k, l]) => {
    const n = issues(S, k).length;
    const mark = ["sheet", "advance", "gear", "modifiers"].includes(k) ? "" : n ? `<span class="badge">${n}</span>` : "<span class='done'>✔</span>";
    return `<button class="step ${k === step ? "active" : ""}" data-act="go" data-arg="${k}">${l} ${mark}</button>`;
  }).join("");
  const idx = STEPS.findIndex(([k]) => k === step);
  const stepIssues = issues(S, step);
  document.getElementById("nav").innerHTML = nav;
  document.getElementById("main").innerHTML = VIEWS[step]()
    + (stepIssues.length ? `<div class="box issues">${stepIssues.map((i) => `<p class="warn">• ${esc(i)}</p>`).join("")}</div>` : "")
    + `<div class="pager no-print">${idx > 0 ? btn("go", "← Back", STEPS[idx - 1][0]) : ""}${idx < STEPS.length - 1 ? btn("go", "Next →", STEPS[idx + 1][0], "primary") : ""}</div>`;
  document.getElementById("summary").innerHTML = viewSummary();
  save();
}

/* ---------- actions ---------- */
function snapshot(label) { undoStack.push(JSON.stringify(S)); if (undoStack.length > 50) undoStack.shift(); return label; }
function spend(cost, label, careerTick) {
  const D = derive(S);
  if (S.xp.total - xpSpent(S) < cost) { alert("Not enough XP."); return false; }
  snapshot();
  S.xp.log.push({ label, cost });
  if (careerTick) S.ticks += 1;
  return !!D;
}
function resetCareerDependent() {
  Object.assign(S, { careerSkillChoice: {}, careerAdv: {}, careerTalent: null, careerTalentEntry: null, trappingChoice: {}, l2Trappings: [], wealth: null, charBonus: {} });
}
function resetSpeciesDependent() {
  Object.assign(S, { speciesSkills: [], speciesTalentChoice: {}, randomTalents: [], career: null, careerMode: null, careerRolls: [] });
  resetCareerDependent();
}
const ACTIONS = {
  go: (k) => { step = k; sessionStorage.setItem("wfrp5e-step", k); window.scrollTo(0, 0); },
  rollSpecies: () => { S.speciesRoll = d100(); },
  keepSpecies: () => { const id = speciesFromRoll(S.speciesRoll); if (S.species !== id) resetSpeciesDependent(); S.species = id; S.speciesMode = "first"; },
  chooseSpecies: (id) => { if (S.species !== id) resetSpeciesDependent(); S.species = id; S.speciesMode = "choose"; },
  randomName: () => { const sp = SPECIES[S.species]; S.name = `${pick(sp.forenames)} ${pick(sp.surnames)}`; },
  rollAge: () => { const sp = SPECIES[S.species]; S.appearance.age = String(sp.age[0] + rollDice(sp.age[1], 10)); },
  rollHeight: () => {
    const sp = SPECIES[S.species]; const n = S.species === "human" ? 2 : 1;
    const inches = sp.height[0] + rollDice(n, 10);
    S.appearance.height = `${Math.floor(inches / 12)}'${inches % 12}"`;
  },
  rollEyes: () => { S.appearance.eyes = pick(SPECIES[S.species].eyes); },
  rollHair: () => { S.appearance.hair = pick(SPECIES[S.species].hair); },
  rollCareer: () => { if (!S.careerRolls.length) { S.careerRolls = [d100()]; } },
  keepCareer: () => { const n = careerFromRoll(S.species, S.careerRolls[0]); resetCareerDependent(); S.career = n; S.careerMode = "first"; S.ticks = 0; },
  rollCareer2: () => { S.careerRolls.push(d100(), d100()); },
  pickCareerRoll: (i) => { resetCareerDependent(); S.career = careerFromRoll(S.species, S.careerRolls[+i]); S.careerMode = "three"; S.ticks = 0; },
  chooseCareer: (name) => { if (!name) return; resetCareerDependent(); S.career = name; S.careerMode = null; S.ticks = 0; if (!S.careerRolls.length) S.careerRolls = []; },
  toggleL2: (t) => {
    const i = S.l2Trappings.indexOf(t);
    if (i >= 0) S.l2Trappings.splice(i, 1); else S.l2Trappings.push(t);
    S.ticks = S.l2Trappings.length;
  },
  rollChars: () => { S.rollsA = CHARS.map(() => rollDice(2, 10)); S.charMethod = "A"; S.charBonus = {}; },
  charMethod: (m) => {
    S.charMethod = m; S.charBonus = {};
    if (m === "B") S.assign = Object.fromEntries(CHARS.map((c, i) => [c, i]));
    if (m === "C") S.assign = S.rollsC ? Object.fromEntries(CHARS.map((c, i) => [c, i])) : null;
    if (m === "P" && !S.points) S.points = Object.fromEntries(CHARS.map((c) => [c, 10]));
  },
  rollCharsC: () => { S.rollsC = CHARS.map(() => rollDice(2, 10)); S.assign = Object.fromEntries(CHARS.map((c, i) => [c, i])); },
  assignRoll: (ch, el) => {
    const idx = +el.value;
    const other = CHARS.find((c) => S.assign[c] === idx);
    if (other) S.assign[other] = S.assign[ch];
    S.assign[ch] = idx;
  },
  charBonus: (arg) => {
    const [ch, d] = arg.split("|"); const v = (S.charBonus[ch] || 0) + +d;
    const used = Object.values(S.charBonus).reduce((a, b) => a + b, 0) + +d;
    if (v < 0 || used > charBonusLimit(S)) return;
    S.charBonus[ch] = v;
  },
  toggleSpeciesSkill: (i) => {
    const o = SPECIES[S.species].skills[+i];
    const idx = S.speciesSkills.findIndex((s) => s.opt === o);
    if (idx >= 0) S.speciesSkills.splice(idx, 1);
    else if (S.speciesSkills.length < 5) S.speciesSkills.push({ opt: o, name: parseChoice(o).fixed || null });
    clampCareerAdv();
  },
  careerAdv: (arg) => {
    const [n, d] = arg.split("|");
    const v = (S.careerAdv[n] || 0) + +d;
    if (v <= 0) delete S.careerAdv[n]; else S.careerAdv[n] = v;
  },
  speciesTalent: (arg) => { const [i, n] = arg.split("|"); S.speciesTalentChoice[i] = n; },
  rollRandomTalent: (i) => {
    const owned = creationTalents(S).map((t) => skillBase(t.name));
    let r, name, guard = 0;
    do { r = d100(); name = randomTalentFromRoll(r); guard++; } while (owned.includes(skillBase(name)) && guard < 100);
    S.randomTalents[+i] = { roll: r, name, base: name };
  },
  manualRandom: (i, el) => { if (el.value) S.randomTalents[+i] = { roll: null, name: el.value, base: el.value }; },
  clearRandomTalent: (i) => { S.randomTalents[+i] = null; },
  careerTalent: (t) => { S.careerTalentEntry = t; S.careerTalent = parseChoice(t).fixed || null; },
  rollWealth: () => { const c = findCareer(S.career); S.wealth = rollWealth(c.levels[0]); },
  toggleSpell: (n) => { const i = S.spells.indexOf(n); if (i >= 0) S.spells.splice(i, 1); else S.spells.push(n); },
  toggleMiracle: (n) => { const i = S.miracles.indexOf(n); if (i >= 0) S.miracles.splice(i, 1); else S.miracles.push(n); },
  setItemStorage: (key, el) => {
    S.itemLoc = S.itemLoc || {};
    S.itemLoc[key] = el.value;
    if (S.worn) delete S.worn[key];
  },
  buyItem: (gi) => { const g = gearIndex()[+gi]; S.inventory.push({ name: g.name, price: g.price, enc: g.enc }); },
  sellItem: (i) => { S.inventory.splice(+i, 1); },
  addCustomItem: () => {
    const name = (S._customName || "").trim();
    if (!name) { alert("Enter a name for the custom item."); return; }
    S.customItems = S.customItems || [];
    S.customItems.push({ name, enc: S._customEnc == null || S._customEnc === "" ? 0 : +S._customEnc, category: S._customCat || "trap" });
    S._customName = ""; S._customEnc = ""; S._customCat = "trap";
  },
  removeCustomItem: (i) => { S.customItems.splice(+i, 1); },
  addMoney: () => {
    const gc = +S._addGC || 0; const ss = +S._addSS || 0; const dd = +S._addDD || 0;
    const pennies = gc * 240 + ss * 12 + dd;
    if (pennies <= 0) { alert("Enter an amount (GC, s, or d)."); return; }
    S.moneyAdded = S.moneyAdded || [];
    S.moneyAdded.push({ pennies, note: (S._addMoneyNote || "").trim() });
    S._addGC = ""; S._addSS = ""; S._addDD = ""; S._addMoneyNote = "";
  },
  removeMoney: (i) => { S.moneyAdded.splice(+i, 1); },
  loseMoney: () => {
    const gc = +S._loseGC || 0; const ss = +S._loseSS || 0; const dd = +S._loseDD || 0;
    const pennies = gc * 240 + ss * 12 + dd;
    if (pennies <= 0) { alert("Enter an amount lost (GC, s, or d)."); return; }
    S.moneyLost = S.moneyLost || [];
    S.moneyLost.push({ pennies, note: (S._loseMoneyNote || "").trim() });
    S._loseGC = ""; S._loseSS = ""; S._loseDD = ""; S._loseMoneyNote = "";
  },
  removeMoneyLost: (i) => { S.moneyLost.splice(+i, 1); },
  print: () => { if (step !== "sheet") ACTIONS.go("sheet"); render(); setTimeout(() => window.print(), 50); },
  addXp: () => {
    const v = parseInt(document.getElementById("xpAdd").value, 10);
    if (!v) return;
    snapshot();
    S.xp.total += v;
    S.xp.log.push({ label: `Awarded: ${document.getElementById("xpNote").value || "XP"}`, cost: 0, award: v });
  },
  buyChar: (ch) => {
    const career = charAvailable(S, ch);
    const n = S.adv.chars[ch] || 0;
    const cost = advCost(CHAR_XP, n) * (career ? 1 : 2);
    if (spend(cost, `${ch} +5 (${cost} XP)`, career)) S.adv.chars[ch] = n + 1;
  },
  buySkill: (name) => {
    const D = derive(S);
    const adv = D.skills.find((s) => s.name === name)?.adv || 0;
    const cost = advCost(SKILL_XP, adv);
    if (spend(cost, `${name} +5 (${cost} XP)`, true)) S.adv.skills[name] = (S.adv.skills[name] || 0) + 1;
  },
  buyNonCareerSkill: () => {
    const name = (S._ncSkill || "").replace(/\s*\(\)\s*$/, "").trim();
    if (!name || !findSkill(name)) { alert("Unknown skill."); return; }
    const D = derive(S);
    const career = isCareerSkill(S, name);
    const adv = D.skills.find((s) => s.name === name)?.adv || 0;
    const cost = advCost(SKILL_XP, adv) * (career ? 1 : 2);
    if (spend(cost, `${name} +5 (${cost} XP${career ? "" : ", non-career"})`, career)) S.adv.skills[name] = (S.adv.skills[name] || 0) + 1;
  },
  buyTalent: (name) => { if (spend(TALENT_XP, `Talent: ${name} (${TALENT_XP} XP)`, true)) S.boughtTalents.push(name); },
  buyNonCareerTalent: () => {
    const name = (S._ncTalent || "").trim();
    if (!name || !findTalent(name)) { alert("Unknown talent."); return; }
    if (spend(TALENT_XP, `Talent: ${name} (${TALENT_XP} XP, non-career)`, false)) S.boughtTalents.push(name);
  },
  buySpell: () => {
    const sp = findSpell(S._newSpell);
    if (!sp) return;
    const petty = S.spells.filter((n) => (findSpell(n) || {}).lore === "Petty").length;
    const cost = sp.lore === "Petty" ? spellCost(PETTY_XP, petty) : spellCost(SPELL_XP, S.spells.length - petty);
    if (spend(cost, `Spell: ${sp.name} (${cost} XP)`, false)) { S.spells.push(sp.name); S._newSpell = ""; }
  },
  buyMiracle: () => {
    const m = findMiracle(S._newMiracle);
    if (!m) return;
    const cost = spellCost(SPELL_XP, S.miracles.length);
    if (spend(cost, `Miracle: ${m.name} (${cost} XP)`, false)) { S.miracles.push(m.name); S._newMiracle = ""; }
  },
  tick: () => { snapshot(); S.ticks += 1; S.xp.log.push({ label: "Acquired next-level Trapping (+1 tick)", cost: 0 }); },
  advanceCareer: () => {
    const c = findCareer(S.career);
    if (spend(ADVANCE_CAREER_XP, `Advanced to ${c.levels[S.careerLevel].title} (${ADVANCE_CAREER_XP} XP)`, false)) { S.careerLevel += 1; S.ticks = 0; }
  },
  changeCareer: () => {
    const nc = findCareer(S._newCareer); const c = findCareer(S.career);
    if (!nc) return;
    const cost = nc.class === c.class ? CHANGE_CAREER_XP.same : CHANGE_CAREER_XP.other;
    if (!confirm(`Change career to ${nc.name} for ${cost} XP?`)) return;
    if (spend(cost, `Changed career: ${c.name} → ${nc.name} (${cost} XP)`, false)) {
      S.careerHistory.push(`${c.name} (${c.levels[S.careerLevel - 1].title})`);
      S.career = nc.name; S.careerLevel = 1; S.ticks = 0; S._newCareer = "";
    }
  },
  undo: () => {
    const s = undoStack.pop();
    if (s) { S = Object.assign(newState(), JSON.parse(s)); migrateState(S); }
  },
  newChar: () => { if (confirm("Discard the current character and start over?")) { S = newState(); step = "species"; } },
  saveJson: () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(S.name || "character").replace(/[^\w-]+/g, "_")}.wfrp5e.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },
  loadJson: () => document.getElementById("fileIn").click(),
  exportExcel: async () => {
    if (!baseChars(S)) { alert("Complete Species, Career and Characteristics before exporting."); return; }
    try {
      await exportToExcel(S);
    } catch (err) {
      alert(`Excel export failed: ${err.message || err}`);
    }
  },
};
function clampCareerAdv() {
  Object.keys(S.careerAdv).forEach((n) => {
    const cap = 3 - S.speciesSkills.filter((s) => s.name === n).length;
    if (S.careerAdv[n] > cap) S.careerAdv[n] = cap;
    if (S.careerAdv[n] <= 0) delete S.careerAdv[n];
  });
}
function onCareerSkillChoiceChanged() {
  const valid = new Set(resolvedCareerSkills(S).map((s) => s.name).filter(Boolean));
  Object.keys(S.careerAdv).forEach((n) => { if (!valid.has(n)) delete S.careerAdv[n]; });
  clampCareerAdv();
}

/* ---------- events ---------- */
document.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-act]");
  if (!el || el.tagName === "SELECT") return;
  if (el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (!fn) return;
  fn(el.dataset.arg, el);
  render();
});
function applyBind(el) {
  let v = el.type === "checkbox" && el.dataset.bool !== undefined ? el.checked : el.value;
  if (el.dataset.num !== undefined) v = v === "" ? null : Math.max(+el.min || -Infinity, Math.min(+el.max || Infinity, +v));
  if (el.dataset.bind?.startsWith("charOther.")) {
    const ch = el.dataset.bind.slice("charOther.".length);
    if (v === "" || v == null) {
      if (S.charOther) delete S.charOther[ch];
      return;
    }
    if (!S.charOther) S.charOther = {};
    S.charOther[ch] = +v;
    return;
  }
  if (el.dataset.wrap !== undefined) v = v.trim() ? `${el.dataset.wrap} (${v.trim()})` : null;
  if (v === "") v = el.tagName === "SELECT" ? null : "";
  setPath(S, el.dataset.bind, v);
  if (el.dataset.bind.startsWith("careerSkillChoice") || el.dataset.bind.startsWith("speciesSkills")) onCareerSkillChoiceChanged();
}
document.addEventListener("input", (ev) => {
  const el = ev.target;
  if (el.dataset.shop) { shopFilter[el.dataset.shop] = el.value; const pos = el.selectionStart; render(); const n = document.querySelector(`[data-shop="${el.dataset.shop}"]`); if (n && n.focus) { n.focus(); if (n.setSelectionRange) n.setSelectionRange(pos, pos); } return; }
  if (el.dataset.bind && el.dataset.rerender === undefined && el.tagName !== "SELECT") { applyBind(el); save(); }
});
document.addEventListener("change", (ev) => {
  const el = ev.target;
  if (el.dataset.actChange) { ACTIONS[el.dataset.actChange](el.dataset.arg ?? el.value, el); render(); return; }
  if (el.dataset.bind) { applyBind(el); if (el.dataset.rerender !== undefined || el.tagName === "SELECT") render(); else save(); }
});
document.getElementById("fileIn").addEventListener("change", (ev) => {
  const f = ev.target.files[0];
  if (!f) return;
  f.text().then((t) => {
    try {
      S = Object.assign(newState(), JSON.parse(t));
      migrateState(S);
      step = "sheet";
      render();
    } catch { alert("Could not read that file."); }
  });
  ev.target.value = "";
});
render();
