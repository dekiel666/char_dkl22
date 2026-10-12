const CHARS = ["WS", "BS", "S", "T", "I", "Ag", "Dex", "Int", "WP", "Fel"];
const CHAR_NAMES = {
  WS: "Weapon Skill", BS: "Ballistic Skill", S: "Strength", T: "Toughness", I: "Initiative",
  Ag: "Agility", Dex: "Dexterity", Int: "Intelligence", WP: "Willpower", Fel: "Fellowship",
};

const SPECIES = {
  human: {
    name: "Human (Reiklander)", short: "Human", page: 26,
    mods: { WS: 20, BS: 20, S: 20, T: 20, I: 20, Ag: 20, Dex: 20, Int: 20, WP: 20, Fel: 20 },
    fate: 4, fortune: 3, move: 4,
    languages: ["Language (Reikspiel)"],
    skills: ["Animal Care", "Charm", "Cool", "Evaluate", "Gossip", "Haggle", "Language (Bretonnian)",
      "Language (Wastelander)", "Leadership", "Lore (Reikland)", "Melee (Basic)", "Ranged (Bow)"],
    talents: ["Doomed"], randomTalents: 4,
    age: [14, 2], height: [57, 2],
    eyes: ["Ice Blue", "Green", "Pale Blue", "Blue", "Pale Grey", "Grey", "Brown", "Hazel", "Dark Brown", "Black"],
    hair: ["White Blond", "Golden Blond", "Red Blond", "Golden Brown", "Light Brown", "Dark Brown", "Black", "Auburn", "Red", "Grey"],
    forenames: ["Adhemar", "Anders", "Artur", "Beatrijs", "Clementia", "Detlev", "Erika", "Frauke", "Frederich", "Gerner",
      "Gertraud", "Haletha", "Heinrich", "Helga", "Henryk", "Irmina", "Jehanne", "Karl", "Kruger", "Lorelay", "Marieke",
      "Sebastien", "Sigfreda", "Talther", "Talunda", "Ulrich", "Ulrika", "Viola", "Walther", "Werther", "Willelma", "Wilryn", "Xaver"],
    surnames: ["Augenlos", "Bauer", "Dunn", "Fleischer", "Lang", "Laut", "Meyer", "Müller", "Schmidt", "Schuster", "Stark"],
  },
  dwarf: {
    name: "Dwarf", short: "Dwarf", page: 28,
    mods: { WS: 30, BS: 20, S: 20, T: 30, I: 10, Ag: 10, Dex: 30, Int: 20, WP: 40, Fel: 10 },
    fate: 2, fortune: 2, move: 3, doubleEnc: true,
    languages: ["Language (Khazalid)", "Language (Reikspiel)"],
    skills: ["Consume Alcohol", "Cool", "Endurance", "Entertain (Storytelling)", "Evaluate", "Intimidate", "Lore (Dwarfs)",
      "Lore (Geology)", "Lore (Metallurgy)", "Melee (Basic)", "Trade (Any One)"],
    talents: ["Magic Resistance", "Night Vision", "Read/Write or Relentless", "Resolute or Strong-minded", "Sturdy"], randomTalents: 0,
    option: "Animosity (Elves) psychology trait is common among dwarfs (page 183). You may ignore it between party members.",
    age: [15, 10], height: [51, 1],
    eyes: ["Coal", "Lead", "Steel", "Blue", "Earth Brown", "Bronze", "Hazel", "Green", "Copper", "Gold"],
    hair: ["White", "Grey", "Pale Blond", "Golden", "Copper", "Bronze", "Brown", "Dark Brown", "Reddish Brown", "Black"],
    forenames: ["Alaeric", "Bori", "Bardlin", "Belorn", "Ergrim", "Fenna", "Galazil", "Gnoldok", "Grufbad", "Gottri", "Gudrin",
      "Kargrim", "Okri", "Thymbrin", "Ulfar"],
    surnames: ["Alriksniz", "Alriksnev", "Anvilhalm", "Bardinsniz", "Goreksson", "Goreksdottir", "Gottrisson", "Gudrunsniz",
      "Okrisnev", "Orc-render", "Snorrisson", "Snorrisdottir", "Stoutbelly", "Sturnfast", "Ulfarsson", "Ulfarsdottir"],
  },
  halfling: {
    name: "Halfling", short: "Halfling", page: 30,
    mods: { WS: 10, BS: 30, S: 10, T: 10, I: 40, Ag: 20, Dex: 30, Int: 20, WP: 30, Fel: 30 },
    fate: 2, fortune: 3, move: 3,
    languages: ["Language (Haffennaff)", "Language (Reikspiel)"],
    skills: ["Charm", "Consume Alcohol", "Dodge", "Gamble", "Haggle", "Intuition", "Lore (Reikland)", "Perception",
      "Sleight of Hand", "Stealth (Any One)", "Trade (Cook)"],
    talents: ["Acute Sense (Taste)", "Night Vision", "Resistant (Chaos)"], randomTalents: 2,
    age: [15, 5], height: [37, 1],
    eyes: ["Light Grey", "Grey", "Pale Blue", "Blue", "Green", "Hazel", "Brown", "Copper", "Dark Brown", "Dark Brown"],
    hair: ["Grey", "Flaxen", "Russet", "Honey", "Chestnut", "Ginger", "Mustard", "Almond", "Chocolate", "Liquorice"],
    forenames: ["Antinnerra (Anni)", "Augustus (Gus)", "Esmerelda (Esme)", "Ferdinand (Fred)", "Heironymus (Hiro)",
      "Maximilian (Max)", "Theodosius (Theo)", "Thomasina (Tina)", "Seralinadara (Lin)", "Valentina (Val)"],
    surnames: ["Brandysnap", "Croop", "Greenthistle", "Fumbletoe", "Hamfist", "Lostpocket", "Lowhaven", "Rootbottom",
      "Stoutbarrel", "Thorncobble", "Willowpot"],
  },
  highelf: {
    name: "High Elf", short: "High Elf", page: 32,
    mods: { WS: 30, BS: 30, S: 20, T: 20, I: 40, Ag: 30, Dex: 30, Int: 30, WP: 30, Fel: 20 },
    fate: 1, fortune: 2, move: 5,
    languages: ["Language (Eltharin)", "Language (Reikspiel)"],
    skills: ["Cool", "Entertain (Sing)", "Evaluate", "Leadership", "Melee (Basic)", "Navigation", "Perception",
      "Play (Any One)", "Ranged (Bow)", "Sail", "Swim"],
    talents: ["Acute Sense (Sight)", "Coolheaded or Savvy", "Night Vision", "Second Sight or Sixth Sense", "Read/Write"], randomTalents: 0,
    age: [30, 10], height: [71, 1],
    eyes: ["Jet", "Amethyst", "Aquamarine", "Sapphire", "Turquoise", "Emerald", "Amber", "Copper", "Citrine", "Gold"],
    hair: ["Silver", "White", "Pale Blond", "Blond", "Yellow Blond", "Copper Blond", "Red Blond", "Auburn", "Red", "Black"],
    forenames: ["Aesdiaric", "Athsoranel", "Dorolmor", "Farolandril", "Gythael", "Irandyl", "Linmarfin", "Mirealiath", "Morolric", "Ulliadiaellion"],
    surnames: ["Arrowshaper", "Echostrider", "Fallowhair", "Falconsinger", "Foamheart", "Goldenhair", "Hopestrider", "Lightprow", "Silverspray", "Spellsign"],
  },
  woodelf: {
    name: "Wood Elf", short: "Wood Elf", page: 34,
    mods: { WS: 30, BS: 30, S: 20, T: 20, I: 40, Ag: 30, Dex: 30, Int: 30, WP: 30, Fel: 20 },
    fate: 1, fortune: 2, move: 5,
    languages: ["Language (Eltharin)", "Language (Reikspiel)"],
    skills: ["Athletics", "Climb", "Endurance", "Entertain (Sing)", "Intimidate", "Melee (Basic)", "Outdoor Survival",
      "Perception", "Ranged (Bow)", "Stealth (Rural)", "Track"],
    talents: ["Acute Sense (Sight)", "Hardy or Second Sight", "Night Vision", "Read/Write or Very Resilient", "Rover"], randomTalents: 0,
    age: [30, 10], height: [71, 1],
    eyes: ["Ivory", "Charcoal", "Ivy Green", "Mossy Green", "Chestnut", "Dark Brown", "Tan", "Sandy Brown", "Violet", "Violet"],
    hair: ["Birch Silver", "Ash Blond", "Rose Gold", "Honey Blond", "Brown", "Mahogany Brown", "Dark Brown", "Sienna", "Ebony", "Blue-Black"],
    forenames: ["Aeslornoc", "Athmarddu", "Dornilstra", "Farsorhan", "Gynferth", "Imilanhu", "Linerianryn", "Malmarstra", "Morandrilwyth", "Ullifinarha"],
    surnames: ["Barkdweller", "Boughshaker", "Birdcaller", "Fleetriver", "Larkcaller", "Stagsinger", "Spitetamer", "Weavecaller", "Willowlimb", "Waspwend"],
  },
};
const SPECIES_ORDER = ["human", "dwarf", "halfling", "highelf", "woodelf"];
const SPECIES_TABLE = [[90, "human"], [94, "halfling"], [98, "dwarf"], [99, "highelf"], [100, "woodelf"]];
const SPECIES_SHORT_TO_ID = { Human: "human", Dwarf: "dwarf", Halfling: "halfling", "High Elf": "highelf", "Wood Elf": "woodelf" };

const RANDOM_TALENTS = [
  [2, "Acute Sense (Sight)"], [5, "Ambidextrous"], [7, "Artistic (Any One)"], [10, "Attractive"], [12, "Briber"],
  [15, "Cardsharp"], [17, "Catfall"], [20, "Coolheaded"], [22, "Contortionist"], [25, "Flee!"], [27, "Gregarious"],
  [30, "Iron Jaw"], [32, "Lightning Reflexes"], [35, "Linguistics"], [37, "Marksman"], [40, "Mimic"], [42, "Night Vision"],
  [45, "Nimble-fingered"], [47, "Noble Blood"], [50, "Nose for Trouble"], [52, "Orientation"], [55, "Perfect Pitch"],
  [57, "Pure Soul"], [60, "Read/Write"], [62, "Resistant (Poison)"], [65, "Rover"], [67, "Savvy"], [70, "Sea Legs"],
  [72, "Sharp"], [75, "Stone Soup"], [77, "Strong Back"], [80, "Sturdy"], [82, "Suave"], [85, "Super Numerate"],
  [87, "Supportive"], [90, "Tinker"], [92, "Tunnel Fighter"], [95, "Very Resilient"], [97, "Very Strong"], [100, "Warrior Born"],
];

/** Doomings table (page 118) — roll when your Character has the Doomed Talent. */
const DOOMINGS = [
  [3, "The witch’s word shall write your doom."],
  [6, "Beware the sign of the crimson sun."],
  [9, "Thine mind lingers overlong in the land of dreams."],
  [12, "Tread not upon the tender roots of sleeping trees."],
  [15, "Trust not the signs of Ranald."],
  [18, "Hold thine breath under Morrslieb’s light, lest darkness take root in thine soul."],
  [21, "Fear the land bereft of the seagull’s cry."],
  [24, "Be thou impious upon a Mondstille night and thou wilt never see another."],
  [28, "Trust not in the strength of bridges if the day be a Festag."],
  [31, "The children of Ulric call, with haste thou wilt fall."],
  [34, "A night without song precedes a morning without waking."],
  [38, "For the want of a key, that’s the ending of thee."],
  [41, "An ogre may name you his most valuable boon and yet remain an ogre."],
  [44, "It ringeth once: peace. It ringeth twice: pleasure. It ringeth thrice: death."],
  [47, "The Twisted Puppeteer doth pull thy strings and thus conjure up the end of things."],
  [50, "Ottokar dared to court the divine, but to do so is no right of thine."],
  [52, "Recall young Tomas and provoke not the beast of the woods."],
  [55, "Be thou circumspect when carousing with dwarfs."],
  [58, "Plague and dark disease shall bring thee quickly to thy knees."],
  [62, "The sword shalt deliver no justice, only thine end."],
  [65, "The sticky bun! The pork pasty! The eel and leek pie! Lo, they are Morr’s dishes!"],
  [68, "Strain thou not the patience of the weary Shallyan."],
  [71, "A lurker in goblin shape waits to waylay every treasure seeker."],
  [74, "Recall Baron Trister and honour thy debts."],
  [78, "Keep the relic of a crow’s skull upon thee, lest thee drink poison and perish."],
  [81, "When thou wager with elves, win thou may, lose thou may, but cheat thou not."],
  [84, "Laugh not in the face of the flatulent lest thine own guts fester."],
  [87, "Never was there one such as thee, who drowned on land and not at sea."],
  [91, "As new life cries out, Father Morr shall welcome thee."],
  [94, "Heed the siren’s trilling, or soon your heart lies still."],
  [97, "Rise not before Cacklefax’s calling, for thine death is early indeed."],
  [100, "Morr sends a maiden."],
];

// Random Class and Career table (pages 36-37): ranges per species, in order human, dwarf, halfling, highelf, woodelf.
const CAREER_TABLE = {
  Apothecary: ["1", "1", "1", "1-2", ""], Engineer: ["2", "2-4", "2", "", ""], Lawyer: ["3", "5-6", "3-4", "3-6", ""],
  Nun: ["4-5", "", "", "", ""], Physician: ["6", "7", "5-6", "7-8", ""], Priest: ["7-11", "", "", "", ""],
  Scholar: ["12-13", "8-9", "7-8", "9-12", "1"], Wizard: ["14", "", "", "13-16", "2-5"],
  Agitator: ["15", "10-11", "9-10", "", ""], Artisan: ["16-17", "12-17", "11-15", "17-19", "6-10"],
  Beggar: ["18-19", "18", "16-19", "", ""], Investigator: ["20", "19-20", "20-21", "20-21", ""],
  Merchant: ["21", "21-24", "22-25", "22-26", ""], "Rat Catcher": ["22-23", "25", "26-28", "", ""],
  Townsman: ["24-26", "26-31", "29-31", "27-28", ""], Watchman: ["27", "32-34", "32-33", "29", ""],
  Adviser: ["28", "35-36", "34", "30-31", "11-14"], Artist: ["29", "37", "35-36", "32", "15-18"],
  Duellist: ["30", "38", "", "33-34", ""], Envoy: ["31", "39-40", "37", "35-37", "19-25"],
  Noble: ["32", "41", "", "38-40", "26-31"], Servant: ["33-35", "42", "38-43", "", ""],
  Spy: ["36", "43", "44", "41-43", "32-35"], Warden: ["37", "44-45", "45-46", "44-45", ""],
  Bailiff: ["38", "46-47", "47", "", ""], "Hedge Witch": ["39", "", "", "", ""],
  Herbalist: ["40", "", "48-50", "46-47", "36-42"], Hunter: ["41-42", "48-49", "51-52", "48-50", "43-52"],
  Miner: ["43", "50-54", "53", "", ""], Mystic: ["44", "", "", "", "53-57"],
  Scout: ["45", "55", "54", "51-56", "58-68"], Villager: ["46-50", "56", "55-57", "", ""],
  "Bounty Hunter": ["51", "57-60", "58", "57-59", "69-70"], Coachman: ["52", "61", "59-60", "", ""],
  Entertainer: ["53-54", "62-63", "61-63", "60-62", "71-75"], Flagellant: ["55-56", "", "", "", ""],
  Messenger: ["57", "64-65", "64-65", "63", "76-78"], Pedlar: ["58", "66-67", "66-67", "", ""],
  Roadwarden: ["59", "", "68", "", ""], "Witch Hunter": ["60", "", "", "", ""],
  Boatman: ["61-62", "68-69", "69", "64", ""], Pilot: ["63", "70", "70", "", ""],
  Riverwarden: ["64-65", "", "71", "", ""], Riverwoman: ["66-68", "71-72", "72-74", "", ""],
  Sailor: ["69-70", "73", "75", "65-79", ""], Smuggler: ["71", "74-75", "76-79", "80", ""],
  Stevedore: ["72-73", "76-77", "80-82", "", ""], Wrecker: ["74", "78", "", "", "79"],
  Charlatan: ["75", "", "83", "81-83", ""], Fence: ["76", "79", "84", "", ""],
  "Grave Robber": ["77", "", "85", "", ""], Knave: ["78-79", "", "86-88", "84-85", ""],
  Outlaw: ["80-83", "80-82", "89", "86-88", "80-85"], Racketeer: ["84", "83", "90", "", ""],
  Thief: ["85-87", "84", "91-94", "", ""], Witch: ["88", "", "", "", ""],
  Cavalryman: ["89-90", "", "", "89-92", "86-90"], Guard: ["91-92", "85-87", "95-96", "93-94", "91-92"],
  Knight: ["93", "", "", "95", "93-94"], "Pit Fighter": ["94", "88-90", "97", "96-97", "95-96"],
  Protagonist: ["95", "91-93", "", "98", ""], Soldier: ["96-99", "94-96", "98-100", "99-100", "97-100"],
  Slayer: ["", "97-100", "", "", ""], "Warrior Priest": ["100", "", "", "", ""],
};

const CLASS_TRAPPINGS = {
  Academic: ["Sling Bag", "Writing Kit", "Parchment (1d10 sheets)"],
  Burgher: ["Cloak", "Hat", "Sling Bag", "Lunch"],
  Courtier: ["Fine Clothing", "Tweezers", "Ear Pick", "Comb"],
  Peasant: ["Cloak", "Sling Bag", "Rations (1 day)"],
  Ranger: ["Cloak", "Backpack", "Tinderbox", "Blanket", "Rations (1 day)"],
  Riverfolk: ["Cloak", "Sling Bag", "Flask of Spirits"],
  Rogue: ["Sling Bag", "Candles (2)", "Matches (1d10)", "Hood or Mask"],
  Warrior: ["Hand Weapon"],
};
const BASE_TRAPPINGS = ["Clothing", "Dagger", "Pouch"];

// XP tables (page 191): cost of the Nth advance (index 0 = first advance).
const CHAR_XP = [125, 175, 250, 350, 500, 700, 950, 1300, 1800, 2550, 3600, 5025, 6950, 9000, 11250];
const SKILL_XP = [50, 75, 100, 150, 250, 400, 600, 850, 850, 1700, 2500, 3500, 4750, 6500, 8500];
const SPELL_XP = [[5, 100], [10, 200], [15, 300], [20, 400], [Infinity, 500]];
const PETTY_XP = [[5, 50], [10, 100], [15, 150], [20, 200], [Infinity, 250]];
const LEVEL_TICKS = { 2: 10, 3: 12, 4: 14 };
const TALENT_XP = 100;
const ADVANCE_CAREER_XP = 100;
const CHANGE_CAREER_XP = { same: 100, other: 200 };

const DEITIES = ["Manann", "Morr", "Myrmidia", "Ranald", "Rhya", "Shallya", "Sigmar", "Taal", "Ulric", "Verena"];
const BLESSINGS_BY_CULT = {
  Manann: ["Battle", "Breath", "Courage", "Hardiness", "Savagery", "Tenacity"],
  Morr: ["Breath", "Courage", "Fortune", "Righteousness", "Tenacity", "Wisdom"],
  Myrmidia: ["Battle", "Conscience", "Courage", "Fortune", "Protection", "Righteousness"],
  Ranald: ["Charisma", "Conscience", "Finesse", "Fortune", "Protection", "Wit"],
  Rhya: ["Breath", "Conscience", "Grace", "Healing", "Protection", "Recuperation"],
  Shallya: ["Breath", "Conscience", "Healing", "Protection", "Recuperation", "Tenacity"],
  Sigmar: ["Battle", "Courage", "Hardiness", "Might", "Protection", "Righteousness"],
  Taal: ["Battle", "Breath", "Conscience", "Hardiness", "The Hunt", "Savagery"],
  Ulric: ["Battle", "Courage", "Hardiness", "Might", "Savagery", "Tenacity"],
  Verena: ["Conscience", "Courage", "Fortune", "Righteousness", "Wisdom", "Wit"],
};
const COLOUR_LORES = { Beasts: "Ghur", Death: "Shyish", Fire: "Aqshy", Heavens: "Azyr", Life: "Ghyran", Light: "Hysh", Metal: "Chamon", Shadows: "Ulgu" };
const OTHER_LORES = ["Hedgecraft", "Witchcraft", "Daemonology", "Necromancy"];
const CHAOS_LORES = ["Nurgle", "Slaanesh", "Tzeentch"];

const BACKGROUND_QUESTIONS = [
  ["origin", "Where are you from?"],
  ["family", "What is your family like?"],
  ["friends", "Who are your best friends?"],
  ["memories", "What are your best and worst memories?"],
  ["religion", "What are your religious beliefs?"],
  ["loyalty", "To whom, or what, are you loyal?"],
  ["lately", "What have you been doing lately?"],
];
