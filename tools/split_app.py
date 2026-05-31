from pathlib import Path
import re


base_dir = Path(__file__).resolve().parent.parent
app_path = base_dir / "app.py"
frontend_dir = base_dir / "frontend"

text = app_path.read_text(encoding="utf-8")

component_match = re.search(
    r'components\.html\(\s*r?"""(?P<html>.*)"""\s*,\s*height\s*=\s*(?P<height>\d+)\s*,\s*scrolling\s*=\s*(?P<scrolling>True|False)\s*,?\s*\)',
    text,
    re.DOTALL,
)

if not component_match:
    raise RuntimeError("could not find components.html block in app.py")

html = component_match.group("html")
height = component_match.group("height")
scrolling = component_match.group("scrolling")

style_match = re.search(r"<style>\s*(?P<css>.*?)\s*</style>", html, re.DOTALL)
script_match = re.search(r"<script>\s*(?P<js>.*?)\s*</script>", html, re.DOTALL)

if not style_match:
    raise RuntimeError("could not find style block")

if not script_match:
    raise RuntimeError("could not find script block")

css = style_match.group("css").strip()
js = script_match.group("js").strip()

html_template = re.sub(
    r"<style>.*?</style>",
    "<style>\n{{ styles }}\n</style>",
    html,
    count=1,
    flags=re.DOTALL,
)

html_template = re.sub(
    r"<script>.*?</script>",
    "<script>\n{{ script }}\n</script>",
    html_template,
    count=1,
    flags=re.DOTALL,
)

frontend_dir.mkdir(exist_ok=True)

(frontend_dir / "index.html").write_text(html_template.strip() + "\n", encoding="utf-8")
(frontend_dir / "styles.css").write_text(css + "\n", encoding="utf-8")
(frontend_dir / "simulation.js").write_text(js + "\n", encoding="utf-8")

new_app = f'''from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components


BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"


def load_frontend() -> str:
    html = (FRONTEND_DIR / "index.html").read_text(encoding="utf-8")
    styles = (FRONTEND_DIR / "styles.css").read_text(encoding="utf-8")
    script = (FRONTEND_DIR / "simulation.js").read_text(encoding="utf-8")

    return html.replace("{{{{ styles }}}}", styles).replace("{{{{ script }}}}", script)


st.set_page_config(
    page_title="Ice Defense Simulator",
    page_icon="🧊",
    layout="wide",
)

components.html(
    load_frontend(),
    height={height},
    scrolling={scrolling},
)
'''

app_path.write_text(new_app, encoding="utf-8")

print("done")
print("created frontend/index.html")
print("created frontend/styles.css")
print("created frontend/simulation.js")
print("rewritten app.py")
