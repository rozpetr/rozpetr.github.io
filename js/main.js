"use strict";
/* Entry: UI tray, drag-drop placement, buttons, level lifecycle, rAF loop. */

let running=false, finished=false, simTime=0;
let lastFrameMs = performance.now();
let physicsAccumulator = 0;
const REAL_STEP = 1 / 60;
let inv=[];          // remaining counts per tool slot
let drag=null;       // {type,w,h,slot} while dragging
let hover=null;      // {x,y} top-left grid cell of ghost

const el = id => document.getElementById(id);

// ---------- helpers ----------
function elapsedSeconds(){ return simTime; }
function evtCell(e){
  const r=cv.getBoundingClientRect();
  return {
    x:Math.floor((e.clientX-r.left)/(cv.width/W)),
    y:Math.floor((e.clientY-r.top )/(cv.height/H))
  };
}

// ---------- tray ----------
function renderTray(){
  const L=LEVELS[levelIndex];
  const list=el("toolList"); list.innerHTML="";
  L.tools.forEach((t,slot)=>{
    const empty = inv[slot]<=0 || running || finished;
    const col = t.type===COOLER ? "#3fd2ff" : "#9a7b4f";
    const div=document.createElement("div");
    div.className="tool"+(empty?" empty":"");
    div.innerHTML=`<div class="swatch" style="background:${col}"></div>
      <div class="meta"><div class="name">${t.name}</div>
      <div class="desc">${t.desc} · ${t.w}×${t.h}</div></div>
      <div class="count">×${inv[slot]}</div>`;
    if(!empty){
      div.addEventListener("pointerdown",e=>{
        e.preventDefault();
        drag={type:t.type,w:t.w,h:t.h,slot};
        window.addEventListener("pointermove",onDragMove);
        window.addEventListener("pointerup",onDragUp,{once:true});
      });
    }
    list.appendChild(div);
  });
}

// ---------- HUD ----------
function refreshHUD(){
  const L=LEVELS[levelIndex];
  el("levelName").textContent=L.name;
  el("levelNo").textContent=`${levelIndex+1}/${LEVELS.length}`;
  el("needPct").textContent=Math.round(L.need*100)+"%";
  el("hint").textContent=L.hint;
  const remain=iceRemaining();
  el("icePct").textContent=Math.round(remain*100)+"%";
  el("iceBar").style.width=(remain*100)+"%";
  const tleft=Math.max(0, L.timer - elapsedSeconds());
  el("timeLeft").textContent = (running||finished) ? tleft.toFixed(1)+"s" : L.timer+"s";
  el("startBtn").disabled = running;
}

// ---------- drag / placement ----------
function onDragMove(e){
  if(!drag) return;
  const c=evtCell(e);
  hover={ x:c.x-(drag.w>>1), y:c.y-(drag.h>>1) };
}
function onDragUp(){
  window.removeEventListener("pointermove",onDragMove);
  if(drag && hover && canPlace(hover.x,hover.y,drag.w,drag.h) && inv[drag.slot]>0){
    const p={type:drag.type,x:hover.x,y:hover.y,w:drag.w,h:drag.h,slot:drag.slot};
    placed.push(p); applyTool(p); inv[drag.slot]--;
    renderTray();
  }
  drag=null; hover=null;
}
// rotate while dragging
window.addEventListener("keydown",e=>{
  if((e.key==="r"||e.key==="R") && drag){ const t=drag.w; drag.w=drag.h; drag.h=t; }
});
// click a placed tool (before start) to pick it back up
cv.addEventListener("pointerdown",e=>{
  if(running||finished||drag) return;
  const c=evtCell(e);
  for(let k=placed.length-1;k>=0;k--){
    const p=placed[k];
    if(c.x>=p.x && c.x<p.x+p.w && c.y>=p.y && c.y<p.y+p.h){
      for(let y=p.y;y<p.y+p.h;y++) for(let x=p.x;x<p.x+p.w;x++)
        if(inBounds(x,y)){ const i=idx(x,y); if(mat[i]===p.type){ mat[i]=AIR; T[i]=AMBIENT; } }
      inv[p.slot]++; placed.splice(k,1); renderTray();
      return;
    }
  }
});

// ---------- buttons ----------
el("startBtn").onclick = ()=>{ if(!running&&!finished){ running=true; renderTray(); } };
el("resetBtn").onclick = ()=>loadLevel(levelIndex);
el("bannerBtn").onclick = ()=>{
  el("banner").classList.remove("show");
  if(el("bannerText").classList.contains("win")) levelIndex=(levelIndex+1)%LEVELS.length;
  loadLevel(levelIndex);
};

// ---------- lifecycle ----------
function loadLevel(li){
  levelIndex=li; running=false; finished=false; simTime=0;
  physicsAccumulator = 0;
  lastFrameMs = performance.now();
  placed=[]; inv=LEVELS[li].tools.map(t=>t.count);
  buildLevel(li);
  el("banner").classList.remove("show");
  renderTray(); refreshHUD();
}
function finish(win){
  finished=true; running=false;
  el("bannerText").textContent = win ? "SAVED! ❄️" : "MELTED 💧";
  el("bannerText").className = "big "+(win?"win":"lose");
  el("bannerSub").textContent = win
    ? `Ice remaining ${Math.round(iceRemaining()*100)}%`
    : "The cube melted away. Try a different placement.";
  el("bannerBtn").textContent = win ? "Next level ▶" : "Retry ↺";
  el("banner").classList.add("show");
}

// ---------- main loop ----------
function loop(){
  const now = performance.now();
  let realDt = (now - lastFrameMs) / 1000;
  lastFrameMs = now;

  if(realDt > 0.25) realDt = 0.25;

  if(running && !finished){
    physicsAccumulator += realDt;

    while(physicsAccumulator >= REAL_STEP && running && !finished){
      step();
      simTime += REAL_STEP;
      physicsAccumulator -= REAL_STEP;

      const L=LEVELS[levelIndex];
      const remain=iceRemaining();

      if(remain<=0.001) finish(false);
      else if(elapsedSeconds()>=L.timer) finish(remain>=L.need);
    }
  }

  render(drag,hover);
  refreshHUD();
  requestAnimationFrame(loop);
}

loadLevel(0);
loop();
