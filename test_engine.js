const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = (f) => fs.readFileSync(path.join(__dirname, "src", f), "utf8");
const dataPkg = String.fromCharCode(119, 102, 114, 112) + "_extract";
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "..", dataPkg, "data_raw.json"), "utf8"));
const html = fs.readFileSync(path.join(__dirname, "Character_Creator.html"), "utf8");
const dataJson = html.match(/const DATA = (.*?);<\/script>/s)[1];
const ctx = { console, Math, JSON };
vm.createContext(ctx);
vm.runInContext(`const DATA = ${dataJson};\n${src("rules.js")}\n${src("engine.js")}\nthis.api = {DATA, SPECIES, SPECIES_ORDER, CHARS, careerFromRoll, parseChoice, newState, derive, findCareer, findTalent, findSkill, parsePrice, fmtMoney, gearIndex, findGear, startingTrappings, speciesFromRoll, randomTalentFromRoll, doomingFromRoll, canAddCreationTalent, creationTalentDuplicateIssues, isCareerSkill, allTalents, hasTalent};`, ctx);
const A = ctx.api;
let fails = 0;
const check = (cond, msg) => { if (!cond) { fails++; console.log("FAIL", msg); } };

for (const sid of A.SPECIES_ORDER) {
  for (let r = 1; r <= 100; r++) {
    const name = A.careerFromRoll(sid, r);
    check(name, `${sid} roll ${r} has no career`);
    const c = name && A.findCareer(name);
    check(c, `${sid} roll ${r} → ${name} not found`);
    if (c) check(c.species.includes(A.SPECIES[sid].short), `${name} not listed for ${sid}`);
  }
}
for (let r = 1; r <= 100; r++) {
  check(A.speciesFromRoll(r), `species roll ${r}`);
  check(A.randomTalentFromRoll(r), `talent roll ${r}`);
  check(A.doomingFromRoll(r), `dooming roll ${r}`);
}

let unresolved = 0;
for (const c of A.DATA.careers) for (const l of c.levels) for (const e of [...l.skills, ...l.talents, ...l.trappings]) {
  const ch = A.parseChoice(e);
  if (!ch.fixed && !ch.options && !ch.any) unresolved++;
}
check(unresolved === 0, `${unresolved} unparseable entries`);
console.log("sample choices:", JSON.stringify(A.parseChoice("Language (Classical, Guilder, or Thieves Tongue)")),
  JSON.stringify(A.parseChoice("Lore (Any One)")).slice(0, 80), JSON.stringify(A.parseChoice("Read/Write or Relentless")));

check(A.parsePrice("1 GC 2/6") === 240 + 30, "price 1 GC 2/6");
check(A.parsePrice("16/–") === 192, "price 16/–");
check(A.parsePrice("4d") === 4, "price 4d");
check(A.parsePrice("–") === null, "price –");
check(A.fmtMoney(270) === "1 GC 2s 6d", `fmt ${A.fmtMoney(270)}`);

// Sebastien, Human Boatman (rulebook page 24 example)
const S = A.newState();
Object.assign(S, { species: "human", speciesMode: "choose", career: "Boatman", careerMode: "choose", charMethod: "A",
  rollsA: [16, 13, 12, 16, 4, 12, 11, 22, 13, 20] });
S.randomTalents = [{ name: "Acute Sense (Sight)" }, { name: "Attractive" }, { name: "Briber" }, { name: "Savvy" }];
S.careerTalent = "Strong Back";
S.adv.chars.T = 1;
const D = A.derive(S);
console.log("Sebastien chars:", A.CHARS.map((c) => `${c}${D.chars[c].current}`).join(" "));
console.log("wounds", D.wounds, "move", D.move, "enc", D.enc, "fate", D.fate, "fortune", D.fortune, "status", D.status);
check(D.wounds === 14, `wounds ${D.wounds} (expected 14)`);
check(D.move === 4, "move 4");
check(D.chars.Int.current === 47, `Int with Savvy ${D.chars.Int.current} (expected 47)`);
check(D.enc === 8, `enc ${D.enc} (expected 8 with Strong Back)`);
check(D.status === "Brass 3", `status ${D.status}`);
const dup = A.newState();
Object.assign(dup, { species: "human", career: "Soldier", careerTalent: "Warrior Born" });
dup.randomTalents = [{ name: "Warrior Born" }];
check(A.creationTalentDuplicateIssues(dup).length > 0, "Warrior Born duplicate flagged");
check(!A.canAddCreationTalent(dup, "Warrior Born", { skipRandomIndex: 1 }), "cannot add third WB slot");
const stack = A.newState();
Object.assign(stack, { species: "human", career: "Boatman", careerTalent: "Strong Back" });
check(A.canAddCreationTalent(stack, "Strong Back", { skipCareer: true }), "Strong Back second allowed");
stack.randomTalents = [{ name: "Strong Back" }];
check(!A.canAddCreationTalent(stack, "Strong Back"), "Strong Back capped at 2");
const art = A.newState();
Object.assign(art, { species: "human", career: "Boatman", careerTalent: "Strong Back" });
art.boughtTalents = ["Artistic (Poetry)"];
check(A.isCareerSkill(art, "Art"), "Artistic grants Art as career skill");
console.log("starting trappings:", A.startingTrappings(S).map((t) => t.name).join(", "));
const missingGear = A.startingTrappings(S).filter((t) => !A.findGear(t.name)).map((t) => t.name);
console.log("trappings without shop entry:", missingGear.join(", "));

const allTrap = new Set();
A.DATA.careers.forEach((c) => c.levels[0].trappings.forEach((t) => allTrap.add(t)));
const notFound = [...allTrap].filter((t) => A.parseChoice(t).fixed && !A.findGear(t));
console.log(`level-1 trappings not in shop (${notFound.length}/${allTrap.size}):`, notFound.slice(0, 40).join("; "));
console.log(fails ? `${fails} FAILURES` : "ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
