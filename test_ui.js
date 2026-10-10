// Headless end-to-end test of the built HTML using jsdom: node test_ui.js
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "WFRP5e_Character_Creator.html"), "utf8");
const failures = [];
let runs = 0;

function boot() {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(e.message));
  vc.on("error", (e) => errors.push(String(e)));
  const dom = new JSDOM(html, {
    runScripts: "dangerously", url: "http://localhost/", virtualConsole: vc, pretendToBeVisual: true,
    beforeParse(w) {
      w.alert = (m) => errors.push("alert: " + m);
      w.confirm = () => true;
      w.print = () => {};
      w.scrollTo = () => {};
      w.URL.createObjectURL = () => "blob:x";
      w.URL.revokeObjectURL = () => {};
      w.addEventListener("error", (e) => errors.push(e.message));
    },
  });
  return { dom, w: dom.window, d: dom.window.document, errors };
}

function make(ctx) {
  const { w, d } = ctx;
  const q = (s) => d.querySelector(s);
  const qa = (s) => [...d.querySelectorAll(s)];
  const click = (s) => { const el = typeof s === "string" ? q(s) : s; if (!el) throw new Error("missing " + s); el.click(); };
  const change = (el, v) => { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); };
  const go = (k) => click(`#nav [data-act=go][data-arg="${k}"]`);
  const issues = (k) => w.eval(`issues(S, ${JSON.stringify(k)})`);
  const S = () => w.eval("S");
  function resolveAll() {
    for (let guard = 0; guard < 60; guard++) {
      const sel = qa("main select[data-bind]").find((s) => !s.disabled && !s.value && [...s.options].some((o) => o.value)
        && !/^_(newCareer|newSpell|newMiracle)/.test(s.dataset.bind));
      if (sel) { change(sel, [...sel.options].find((o) => o.value).value); continue; }
      const inp = qa("main input.spec").find((i) => !i.value);
      if (inp) {
        const dl = inp.getAttribute("list") && d.getElementById(inp.getAttribute("list"));
        const v = dl && dl.options.length ? dl.options[0].value : "Test";
        change(inp, v);
        continue;
      }
      return;
    }
    throw new Error("resolveAll did not converge");
  }
  function clickWhile(selector, done, max = 40) {
    for (let i = 0; i < max && !done(); i++) {
      const b = qa(selector).find((x) => !x.disabled);
      if (!b) return;
      b.click();
    }
  }
  return { q, qa, click, change, go, issues, S, resolveAll, clickWhile };
}

function createCharacter(species, career, opts = {}) {
  runs++;
  const ctx = boot();
  const t = make(ctx);
  const tag = `${species}/${career}${opts.label ? " " + opts.label : ""}`;
  const fail = (m) => failures.push(`${tag}: ${m}`);
  try {
    // species
    if (opts.rollSpecies) { t.click("[data-act=rollSpecies]"); t.click("[data-act=keepSpecies]"); }
    else t.click(`[data-act=chooseSpecies][data-arg="${species}"]`);
    species = t.S().species;
    // career
    t.go("career");
    if (opts.rollCareer) {
      t.click("[data-act=rollCareer]");
      if (opts.rollCareer === "three") { t.click("[data-act=rollCareer2]"); t.click("[data-act=pickCareerRoll][data-arg='2']"); }
      else t.click("[data-act=keepCareer]");
    } else {
      t.change(t.q("select[data-act-change=chooseCareer]"), career);
    }
    career = t.S().career;
    t.clickWhile("[data-act=toggleL2]:not(:checked)", () => !t.issues("career").length);
    if (t.issues("career").length) fail("career issues: " + t.issues("career"));
    // characteristics
    t.go("chars");
    t.click("[data-act=rollChars]");
    const method = opts.method || "A";
    if (method !== "A") t.click(`[data-act=charMethod][data-arg=${method}]`);
    if (method === "C") t.click("[data-act=rollCharsC]");
    if (method === "B") { const s = t.q("select[data-act-change=assignRoll]"); if (s) t.change(s, "3"); }
    t.clickWhile("[data-act=charBonus][data-arg$='|1']", () => !t.issues("chars").length);
    if (t.issues("chars").length) fail("chars issues: " + t.issues("chars"));
    // skills
    t.go("skills");
    t.clickWhile("[data-act=toggleSpeciesSkill]:not(:checked)", () => t.S().speciesSkills.length >= 5);
    t.resolveAll();
    for (const pre of ["Pray|", "Channelling", "Language (Magick)|"]) {
      const b = t.qa(`[data-act=careerAdv][data-arg^="${pre}"][data-arg$='|1']`).find((x) => !x.disabled);
      if (b) t.click(b);
    }
    t.clickWhile("[data-act=careerAdv][data-arg$='|1']", () => Object.values(t.S().careerAdv).reduce((a, b) => a + b, 0) >= 8, 20);
    t.resolveAll();
    if (t.issues("skills").length) fail("skills issues: " + t.issues("skills"));
    // talents & trappings
    t.go("talents");
    const groups = new Set(t.qa("[data-act=speciesTalent]").map((r) => r.name));
    groups.forEach((g) => t.click(t.q(`[data-act=speciesTalent][name="${g}"]`)));
    t.clickWhile("[data-act=rollRandomTalent]", () => false, 10);
    t.click(t.qa("[data-act=careerTalent]")[opts.talentIdx || 0]);
    t.resolveAll();
    if (t.q("[data-act=rollWealth]")) t.click("[data-act=rollWealth]");
    if (t.issues("talents").length) fail("talents issues: " + t.issues("talents") + " " + JSON.stringify(t.S().randomTalents));
    // magic
    t.go("magic");
    t.resolveAll();
    const sp = t.qa("[data-act=toggleSpell]").slice(0, 2);
    sp.forEach((_, i) => { const el = t.qa("[data-act=toggleSpell]:not(:checked)")[0]; if (el) t.click(el); });
    const mi = t.qa("[data-act=toggleMiracle]:not(:checked)")[0]; if (mi) t.click(mi);
    // gear
    t.go("gear");
    const buy = t.qa("[data-act=buyItem]").find((b) => !b.disabled);
    if (buy) t.click(buy);
    const worn = t.q("[data-act=toggleWorn]"); if (worn) t.click(worn);
    // background
    t.go("background");
    if (t.q("[data-act=randomName]")) t.click("[data-act=randomName]");
    ["rollAge", "rollHeight", "rollEyes", "rollHair"].forEach((a) => t.q(`[data-act=${a}]`) && t.click(`[data-act=${a}]`));
    const nm = t.q("main [data-bind=name]");
    if (nm && !nm.value) { nm.value = "Test Name"; nm.dispatchEvent(new ctx.w.Event("change", { bubbles: true })); }
    const amb = t.q("[data-bind=ambition]");
    if (amb) { amb.value = "Get rich"; amb.dispatchEvent(new ctx.w.Event("change", { bubbles: true })); }
    else fail("no ambition field");
    // everything resolved?
    for (const k of ["species", "career", "chars", "skills", "talents", "magic", "background"]) {
      const is = t.issues(k);
      if (is.length) fail(`${k} still has issues: ${is.join(" | ")}`);
    }
    // sheet
    t.go("sheet");
    const sheet = t.q("main").textContent;
    if (!sheet.includes(career)) fail("sheet lacks career name");
    if (/undefined|NaN|\[object Object\]/.test(sheet)) fail("sheet contains undefined/NaN: " + (sheet.match(/.{40}(undefined|NaN|\[object Object\]).{20}/) || [""])[0]);
    t.click("[data-act=print]");
    // advancement
    t.go("advance");
    t.q("#xpAdd").value = "2000";
    t.click("[data-act=addXp]");
    t.clickWhile("[data-act=buyChar]", () => false, 3);
    t.clickWhile("[data-act=buySkill]", () => false, 3);
    t.resolveAll();
    const bt = t.qa("[data-act=buyTalent]").find((b) => !b.disabled); if (bt) t.click(bt);
    t.clickWhile("[data-act=tick]", () => t.S().ticks >= 10, 12);
    const adv = t.q("[data-act=advanceCareer]"); if (adv && !adv.disabled) t.click(adv);
    if (t.S().careerLevel !== 2) fail("did not advance career level (ticks " + t.S().ticks + ")");
    t.click("[data-act=undo]");
    const nc = t.q("select[data-bind=_newCareer]");
    if (nc && nc.options.length > 1) { t.change(nc, nc.options[1].value); t.click("[data-act=changeCareer]"); }
    const advText = t.q("main").textContent;
    if (/undefined|NaN/.test(advText)) fail("advance view contains undefined/NaN: " + (advText.match(/.{40}(undefined|NaN).{20}/) || [""])[0]);
    // json round trip via localStorage reload
    const saved = ctx.w.localStorage.getItem("wfrp5e-character-v1");
    if (!saved || JSON.parse(saved).career !== t.S().career) fail("autosave mismatch");
  } catch (e) {
    fail("EXCEPTION " + e.stack.split("\n").slice(0, 3).join(" / "));
  }
  ctx.errors.filter((e) => !/Not implemented: navigation/.test(e)).forEach((e) => fail("runtime error: " + e));
  ctx.w.close();
}

const probe = boot();
const careers = probe.w.eval("DATA.careers.map(c => [c.name, c.species])");
const species = probe.w.eval("Object.entries(SPECIES).map(([id, s]) => [id, s.short])");
probe.w.close();

const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
for (const [name, allowed] of careers) {
  if (only && !only.test(name)) continue;
  species.filter(([, short]) => allowed.includes(short)).forEach(([id]) => createCharacter(id, name));
}
if (!only) {
  ["B", "C", "P"].forEach((m) => createCharacter("human", "Wizard", { method: m, label: "method " + m }));
  for (let i = 0; i < 30; i++) createCharacter(null, null, { rollSpecies: true, rollCareer: i % 2 ? "three" : "first", label: "random#" + i });
  createCharacter("human", "Priest", { talentIdx: 1, label: "talent2" });
}

console.log(`${runs} characters created, ${failures.length} problem(s)`);
const grouped = {};
failures.forEach((f) => { const k = f.replace(/^[^:]+: /, "").replace(/\d+/g, "#").slice(0, 120); (grouped[k] = grouped[k] || []).push(f.split(":")[0]); });
Object.entries(grouped).forEach(([k, v]) => console.log(`- [${v.length}] ${k}\n    e.g. ${v.slice(0, 4).join(", ")}`));
process.exit(failures.length ? 1 : 0);
