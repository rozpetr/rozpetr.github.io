"use strict";
/*
  Temperature probe overlay.
  This file is isolated to reduce merge conflicts:
  it does not modify physics, levels, drag-and-drop, or base rendering.
*/

(function(){
  let probeCell = null;

  function cellFromEvent(event){
    const rect = cv.getBoundingClientRect();

    const x = Math.floor((event.clientX - rect.left) / rect.width * W);
    const y = Math.floor((event.clientY - rect.top) / rect.height * H);

    if(x < 0 || y < 0 || x >= W || y >= H){
      return null;
    }

    return { x, y };
  }

  function materialName(value){
    if(value === AIR) return "air";
    if(value === ICE) return "ice";
    if(value === INSUL) return "insulator";
    if(value === COOLER) return "cooler";
    if(value === HEATER) return "heater";
    return "unknown";
  }

  function drawRoundRect(x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawTemperatureProbe(){
    if(!probeCell) return;
    if(!T || !mat) return;

    const x = probeCell.x;
    const y = probeCell.y;
    const i = idx(x, y);

    const temp = T[i];
    const material = materialName(mat[i]);

    const px = x * SCALE;
    const py = y * SCALE;

    ctx.save();

    // highlighted cell
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, SCALE, SCALE);

    // crosshair lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + SCALE / 2, 0);
    ctx.lineTo(px + SCALE / 2, cv.height);
    ctx.moveTo(0, py + SCALE / 2);
    ctx.lineTo(cv.width, py + SCALE / 2);
    ctx.stroke();

    const line1 = `${temp.toFixed(1)} °C`;
    const line2 = `${material} · cell (${x}, ${y})`;

    const boxW = 150;
    const boxH = 52;

    let boxX = px + 14;
    let boxY = py - boxH - 10;

    if(boxX + boxW > cv.width) boxX = px - boxW - 10;
    if(boxY < 0) boxY = py + 16;

    // tooltip
    ctx.fillStyle = "rgba(2, 6, 23, 0.90)";
    ctx.strokeStyle = "rgba(226, 232, 240, 0.65)";
    ctx.lineWidth = 1.5;

    drawRoundRect(boxX, boxY, boxW, boxH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(line1, boxX + 11, boxY + 8);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px Arial";
    ctx.fillText(line2, boxX + 11, boxY + 31);

    ctx.restore();
  }

  cv.addEventListener("pointermove", (event) => {
    probeCell = cellFromEvent(event);
  });

  cv.addEventListener("mouseleave", () => {
    probeCell = null;
  });

  // wrap existing render function without editing render.js
  const baseRender = window.render;

  if(typeof baseRender === "function"){
    window.render = function(drag, hover){
      baseRender(drag, hover);
      drawTemperatureProbe();
    };
  } else {
    console.warn("temperatureProbe.js: render function was not found");
  }
})();
