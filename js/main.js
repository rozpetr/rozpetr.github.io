"use strict";
/* Entry: UI tray, drag-drop placement, buttons, level lifecycle.
   Physics runs in setInterval (not rAF) so it continues in background tabs.
   Timer uses Date.now() wall-clock, independent of frame rate or tab visibility. */

let running = false, finished = false;
let startRealTime = 0;   // Date.now() when Start pressed; 0 = not started yet
let finishTime    = 0;   // Date.now() when finished; freezes the timer display

let physicsAccumulator = 0;
let lastPhysicsTime    = 0;   // performance.now() at last physics tick
const REAL_STEP = 1 / 60;    // seconds per physics step

let inv  = [];
let drag = null;
let hover = null;

const el = id => document.getElementById(id);

// ---------- physics ticker ----------
// setInterval is less throttled than rAF in background tabs.
// Chrome limits it to ~1 call/s when hidden, but it still fires — so physics
// keeps running and catches up when the player returns to the tab.
setInterval(function () {
  if (!running || finished) return;

  const now = performance.now();
  let dt = lastPhysicsTime > 0 ? (now - lastPhysicsTime) / 1000 : 0;
  lastPhysicsTime = now;
  if (dt > 30) dt = 30;   // cap: never try to catch up more than 30 s at once

  physicsAccumulator += dt;
  while (physicsAccumulator >= REAL_STEP) {
    step();
    physicsAccumulator -= REAL_STEP;
    if (iceRemaining() <= 0.001) {
      if (!finished) finish(false);
      return;
    }
  }
}, 8);

// ---------- helpers ----------
function elapsedSeconds(){
  if (!startRealTime) return 0;
  // finishTime freezes the clock the moment the game ended
  return ((finishTime || Date.now()) - startRealTime) / 1000;
}
function evtCell(e){
  const r = cv.getBoundingClientRect();
  return {
    x: Math.floor((e.clientX - r.left) / (cv.width  / W)),
    y: Math.floor((e.clientY - r.top)  / (cv.height / H))
  };
}

// ---------- tray ----------
function renderTray(){
  const L    = LEVELS[levelIndex];
  const list = el("toolList"); list.innerHTML = "";
  L.tools.forEach((t, slot) => {
    const empty = inv[slot] <= 0 || running || finished;
    const col   = t.type === COOLER ? "#3fd2ff" : "#9a7b4f";
    const div   = document.createElement("div");
    div.className = "tool" + (empty ? " empty" : "");
    div.innerHTML = `<div class="swatch" style="background:${col}"></div>
      <div class="meta"><div class="name">${t.name}</div>
      <div class="desc">${t.desc} · ${t.w}×${t.h}</div></div>
      <div class="count">×${inv[slot]}</div>`;
    if (!empty){
      div.addEventListener("pointerdown", e => {
        e.preventDefault();
        drag = { type: t.type, w: t.w, h: t.h, slot };
        window.addEventListener("pointermove", onDragMove);
        window.addEventListener("pointerup",   onDragUp, { once: true });
      });
    }
    list.appendChild(div);
  });
}

// ---------- HUD ----------
function refreshHUD(){
  const L = LEVELS[levelIndex];
  el("levelName").textContent = L.name;
  el("levelNo").textContent   = `${levelIndex + 1}/${LEVELS.length}`;
  el("needPct").textContent   = Math.round(L.need * 100) + "%";
  el("hint").textContent      = L.hint;
  const remain = iceRemaining();
  el("icePct").textContent    = Math.round(remain * 100) + "%";
  el("iceBar").style.width    = (remain * 100) + "%";
  const tleft = Math.max(0, L.timer - elapsedSeconds());
  el("timeLeft").textContent  = (running || finished) ? tleft.toFixed(1) + "s" : L.timer + "s";
  el("startBtn").disabled     = running;
}

// ---------- drag / placement ----------
function onDragMove(e){
  if (!drag) return;
  const c = evtCell(e);
  hover = { x: c.x - (drag.w >> 1), y: c.y - (drag.h >> 1) };
}
function onDragUp(){
  window.removeEventListener("pointermove", onDragMove);
  if (drag && hover && canPlace(hover.x, hover.y, drag.w, drag.h) && inv[drag.slot] > 0){
    const p = { type: drag.type, x: hover.x, y: hover.y, w: drag.w, h: drag.h, slot: drag.slot };
    placed.push(p); applyTool(p); inv[drag.slot]--;
    renderTray();
  }
  drag = null; hover = null;
}
// rotate while dragging
window.addEventListener("keydown", e => {
  if ((e.key === "r" || e.key === "R") && drag){ const t = drag.w; drag.w = drag.h; drag.h = t; }
});
// click a placed tool (before start) to pick it back up
cv.addEventListener("pointerdown", e => {
  if (running || finished || drag) return;
  const c = evtCell(e);
  for (let k = placed.length - 1; k >= 0; k--){
    const p = placed[k];
    if (c.x >= p.x && c.x < p.x + p.w && c.y >= p.y && c.y < p.y + p.h){
      for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++)
        if (inBounds(x, y)){ const i = idx(x, y); if (mat[i] === p.type){ mat[i] = AIR; T[i] = AMBIENT; } }
      inv[p.slot]++; placed.splice(k, 1); renderTray();
      return;
    }
  }
});

// ---------- buttons ----------
el("startBtn").onclick = () => {
  if (!running && !finished){
    running            = true;
    startRealTime      = Date.now();
    lastPhysicsTime    = performance.now();
    physicsAccumulator = 0;
    renderTray();
  }
};
el("resetBtn").onclick  = () => loadLevel(levelIndex);
el("bannerBtn").onclick = () => {
  el("banner").classList.remove("show");
  if (el("bannerText").classList.contains("win")) levelIndex = (levelIndex + 1) % LEVELS.length;
  loadLevel(levelIndex);
};
el("showHint").onclick = () => {
  el("hint").classList.toggle("active");
};

// ---------- lifecycle ----------
function loadLevel(li){
  levelIndex = li; running = false; finished = false;
  startRealTime = 0; finishTime = 0;
  physicsAccumulator = 0; lastPhysicsTime = 0;
  placed = []; inv = LEVELS[li].tools.map(t => t.count);
  buildLevel(li);
  el("banner").classList.remove("show");
  el("hint").classList.remove("active");
  renderTray(); refreshHUD();
}
function finish(win){
  if (finished) return;
  finished = true; running = false;
  finishTime = Date.now();
  el("bannerText").textContent = win ? "SAVED! ❄️" : "MELTED 💧";
  el("bannerText").className   = "big " + (win ? "win" : "lose");
  el("bannerSub").textContent  = win
    ? `Ice remaining ${Math.round(iceRemaining() * 100)}%`
    : "The cube melted away. Try a different placement.";
  el("bannerBtn").textContent  = win ? "Next level ▶" : "Retry ↺";
  el("banner").classList.add("show");
}

// ---------- main loop (render + timer check only — physics is in setInterval above) ----------
function loop(){
  if (running && !finished){
    const L = LEVELS[levelIndex];
    if (elapsedSeconds() >= L.timer) finish(iceRemaining() >= L.need);
  }
  render(drag, hover);
  refreshHUD();
  requestAnimationFrame(loop);
}

loadLevel(0);
loop();
