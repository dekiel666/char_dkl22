/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const src = path.join(__dirname, "src");
const dataPkg = String.fromCharCode(119, 102, 114, 112) + "_extract";
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "..", dataPkg, "data_raw.json"), "utf8"));
const js = ["rules.js", "engine.js", "export_xlsx.js"].map((f) => fs.readFileSync(path.join(src, f), "utf8")).join("\n");

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const { window } = dom;
global.window = window;
global.document = window.document;
global.DATA = raw;
eval(js);

const st = Object.assign(newState(), {
  name: "Human Artist (example)",
  species: "human",
  speciesMode: "first",
  career: "Artist",
  careerMode: "first",
  careerLevel: 1,
  charMethod: "A",
  rollsA: [30, 26, 26, 28, 30, 29, 35, 25, 28, 21],
  charBonus: {},
  speciesSkills: [
    { opt: "Art (Any One)", name: "Art" },
    { opt: "Charm", name: "Charm" },
    { opt: "Cool", name: "Cool" },
    { opt: "Gossip", name: "Gossip" },
    { opt: "Haggle", name: "Haggle" },
  ],
  careerSkillChoice: {},
  careerAdv: { Art: 3, Charm: 1, Cool: 1, Gossip: 1, Haggle: 1 },
  careerTalent: "Nose for Trouble",
  randomTalents: [
    { name: "Marksman" }, { name: "Very Resilient" }, { name: "Briber" },
    { name: "Doomed" }, { name: "Sharp" },
  ],
  trappingChoice: {},
  l2Trappings: [],
  wealth: { pennies: 120, text: "Brass 2" },
  inventory: [],
  worn: { "start:0:Dagger": false },
  ambition: "Own a gallery",
  partyAmbition: "",
  bg: { origin: "Altdorf" },
  notes: "Test export",
  xp: { total: 0, log: [] },
  adv: { chars: {}, skills: {} },
  boughtTalents: [],
  careerHistory: [],
  spells: [],
  miracles: [],
});

const cells = toExcelPayload(st);
const expect = {
  "Character!B3": "Human Artist (example)",
  "Character!H3": "Human (Reiklander)",
  "Character!O3": "Artist",
  "Character!B11": 50,
  "Character!D27": 20,
  "Character!E27": 20,
  "Character!M27": "Doomed",
  "Character!A81": "Artist",
  "Character!E81": "Starting career",
};

let fails = 0;
for (const [ref, val] of Object.entries(expect)) {
  if (cells[ref] !== val) {
    console.error(`FAIL ${ref}: got ${cells[ref]}, expected ${val}`);
    fails++;
  }
}
const careerTal = Object.entries(cells).find(([k, v]) => k.startsWith("Character!M") && v === "Nose for Trouble");
if (!careerTal) {
  console.error("FAIL: career talent Nose for Trouble not exported");
  fails++;
}
console.log(`export payload: ${Object.keys(cells).length} cells, ${fails} failure(s)`);
process.exit(fails ? 1 : 0);
