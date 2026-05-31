from pathlib import Path

main_path = Path("js/main.js")
render_path = Path("js/render.js")

main = main_path.read_text(encoding="utf-8")
render = render_path.read_text(encoding="utf-8")

if "window.ICE_RESCUE_PROBE" not in main:
    main = main.replace(
        "let hover=null;      // {x,y} top-left grid cell of ghost",
        """let hover=null;      // {x,y} top-left grid cell of ghost

// cell currently under the mouse cursor, used by render.js for temperature tooltip
window.ICE_RESCUE_PROBE = null;"""
    )

if "cv.addEventListener(\"pointermove\", e=>{" not in main and "ICE_RESCUE_PROBE pointer tracking" not in main:
    marker = """function evtCell(e){
  const r=cv.getBoundingClientRect();
  return {
    x:Math.floor((e.clientX-r.left)/(cv.width/W)),
    y:Math.floor((e.clientY-r.top )/(cv.height/H))
  };
}"""
    replacement = marker + """

// ICE_RESCUE_PROBE pointer tracking
cv.addEventListener("pointermove", e=>{
  const c = evtCell(e);
  if(c.x>=0 && c.y>=0 && c.x<W && c.y<H){
    window.ICE_RESCUE_PROBE = c;
  } else {
    window.ICE_RESCUE_PROBE = null;
  }
});

cv.addEventListener("mouseleave", ()=>{
  window.ICE_RESCUE_PROBE = null;
});"""
    main = main.replace(marker, replacement)

if "drawTemperatureProbe();" not in render:
    render = render.replace(
        "if(drag && hover) drawGhost(drag,hover);",
        """if(drag && hover) drawGhost(drag,hover);

  drawTemperatureProbe();"""
    )

if "function materialName(m)" not in render:
    render += r'''

function materialName(m){
  if(m===AIR) return "air";
  if(m===ICE) return "ice";
  if(m===INSUL) return "insulator";
  if(m===COOLER) return "cooler";
  if(m===HEATER) return "heater";
  return "unknown";
}

function drawTemperatureProbe(){
  const p = window.ICE_RESCUE_PROBE;

  if(!p) return;
  if(p.x<0 || p.y<0 || p.x>=W || p.y>=H) return;
  if(!T || !mat) return;

  const i = idx(p.x, p.y);
  const temp = T[i];
  const material = materialName(mat[i]);

  const cellX = p.x * SCALE;
  const cellY = p.y * SCALE;

  ctx.save();

  // selected cell frame
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 2;
  ctx.strokeRect(cellX, cellY, SCALE, SCALE);

  // tooltip position
  const text1 = `${temp.toFixed(1)} °C`;
  const text2 = material;
  const boxW = 106;
  const boxH = 48;

  let boxX = cellX + 12;
  let boxY = cellY - boxH - 10;

  if(boxX + boxW > cv.width) boxX = cellX - boxW - 10;
  if(boxY < 0) boxY = cellY + 14;

  // tooltip background
  ctx.fillStyle = "rgba(2, 6, 23, 0.88)";
  ctx.strokeStyle = "rgba(226, 232, 240, 0.65)";
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 15px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(text1, boxX + 10, boxY + 8);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px Arial";
  ctx.fillText(text2, boxX + 10, boxY + 28);

  ctx.restore();
}
'''
    
main_path.write_text(main, encoding="utf-8")
render_path.write_text(render, encoding="utf-8")

print("temperature probe added")
