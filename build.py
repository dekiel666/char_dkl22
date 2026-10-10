import json
import pathlib
import re
import shutil
import subprocess

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
RAW = ROOT.parent / "wfrp_extract" / "data_raw.json"
OUT = ROOT / "WFRP5e_Character_Creator.html"
PAGES = ROOT / "docs"
TEMPLATE_SRC = ROOT.parent / "wfrp_xlsx" / "WFRP5e_Character_Template.xlsx"
JS_FILES = ("rules.js", "engine.js", "export_xlsx.js", "ui.js")
EXCELJS = ROOT / "node_modules" / "exceljs" / "dist" / "exceljs.min.js"


def load_data():
    data = json.loads(RAW.read_text(encoding="utf-8"))
    for c in data["careers"]:
        c["name"] = c["name"].replace("'", "'")
        c["species"] = [s.strip() for s in c["species"]]
        for lvl in c["levels"]:
            for key in ("skills", "talents", "trappings"):
                lvl[key] = [re.sub(r"(\w)([-/]) (\w)", r"\1\2\3", re.sub(r"\s+", " ", x)).strip(" .")
                            for x in lvl[key] if x.strip(" .")]
    for t in data["gear"]:
        for r in t["rows"]:
            for k, v in list(r.items()):
                if isinstance(v, str):
                    r[k] = v.strip()
    return data


def check(data):
    """Cross-check names used by the hand-written rules against extracted data, using node to read rules.js."""
    script = (SRC / "rules.js").read_text(encoding="utf-8") + """
console.log(JSON.stringify({species: SPECIES, careerTable: Object.keys(CAREER_TABLE), classes: Object.keys(CLASS_TRAPPINGS),
  random: RANDOM_TALENTS.map(r => r[1])}));"""
    try:
        out = subprocess.run(["node", "-e", script], capture_output=True, text=True, encoding="utf-8", check=True).stdout
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        print("skipping cross-check (node unavailable):", exc)
        return
    rules = json.loads(out)
    careers = {c["name"] for c in data["careers"]}
    talents = {t["base"] for t in data["talents"]}
    skills = {s["name"] for s in data["skills"]}
    base = lambda n: re.sub(r"\s*\(.*\)$", "", n)
    top_or = lambda s: re.split(r"\s+or\s+(?![^(]*\))", s)
    problems = []
    problems += [f"career table: {n}" for n in rules["careerTable"] if n not in careers]
    problems += [f"career missing from table: {n}" for n in careers if n not in rules["careerTable"]]
    problems += [f"class: {c['class']}" for c in data["careers"] if c["class"] not in rules["classes"]]
    for sid, sp in rules["species"].items():
        for t in sp["talents"]:
            for opt in t.split(" or "):
                if base(opt) not in talents:
                    problems.append(f"{sid} talent: {opt}")
        for s in sp["skills"] + sp["languages"]:
            if base(s) not in skills:
                problems.append(f"{sid} skill: {s}")
    problems += [f"random talent: {n}" for n in rules["random"] if base(n) not in talents]
    for c in data["careers"]:
        for i, lvl in enumerate(c["levels"]):
            for s in lvl["skills"]:
                for opt in top_or(s):
                    if base(opt) not in skills:
                        problems.append(f"{c['name']} L{i + 1} skill: {s}")
            for t in lvl["talents"]:
                for opt in top_or(t):
                    if base(opt) not in talents:
                        problems.append(f"{c['name']} L{i + 1} talent: {t}")
    print(f"cross-check: {len(problems)} problem(s)")
    for p in sorted(set(problems)):
        print("  ", p)


def build_html(data, for_site=False):
    js = "\n".join((SRC / f).read_text(encoding="utf-8") for f in JS_FILES)
    css = (SRC / "style.css").read_text(encoding="utf-8")
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = (SRC / "template.html").read_text(encoding="utf-8")
    if not for_site:
        html = html.replace('<script src="lib/exceljs.min.js"></script>\n', "")
    return html.replace("/*__CSS__*/", css).replace("/*__DATA__*/", payload).replace(
        "/*__JS__*/", js.replace("</script", "<\\/script"))


def build_pages(data):
    """GitHub Pages only publishes from / (root) or /docs — not /site."""
    if not TEMPLATE_SRC.is_file():
        raise SystemExit(f"Missing Excel template: {TEMPLATE_SRC}\nRun: python wfrp_xlsx/build_xlsx.py")
    if not EXCELJS.is_file():
        raise SystemExit(f"Missing ExcelJS — run: npm install (in {ROOT})")
    PAGES.mkdir(exist_ok=True)
    (PAGES / "index.html").write_text(build_html(data, for_site=True), encoding="utf-8")
    shutil.copy2(TEMPLATE_SRC, PAGES / "WFRP5e_Character_Template.xlsx")
    lib = PAGES / "lib"
    lib.mkdir(exist_ok=True)
    shutil.copy2(EXCELJS, lib / "exceljs.min.js")
    (PAGES / ".nojekyll").write_text("", encoding="utf-8")
    print(f"wrote {PAGES / 'index.html'}")
    print(f"wrote {PAGES / 'WFRP5e_Character_Template.xlsx'}")
    print(f"wrote {lib / 'exceljs.min.js'}")


def main():
    data = load_data()
    check(data)
    OUT.write_text(build_html(data), encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")
    build_pages(data)


def build_pages_only(data=None):
    build_pages(data or load_data())


if __name__ == "__main__":
    main()
