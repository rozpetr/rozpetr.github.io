const canvas = document.getElementById("field");
const ctx = canvas.getContext("2d");

const N = 90;
const BOARD_PX = 720;
const CANVAS_W = 960;
const CANVAS_H = 720;
const S = BOARD_PX / N;
const TOTAL_CELLS_X = CANVAS_W / S;
const ambient = -5.0;
const dt = 0.05;

let temperature = new Float32Array(N * N);
let nextTemperature = new Float32Array(N * N);
let iceMass = 1.0;
let simulatedTime = 0.0;
let setupMode = true;
let running = false;
let paused = false;
let dragging = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

let objects = [];

const typeStyle = {
    ice: { fill: "#38bdf8", stroke: "#e0f2fe" },
    heater: { fill: "#ef4444", stroke: "#fee2e2" },
    insulator: { fill: "#8b5cf6", stroke: "#ede9fe" },
    conductor: { fill: "#f59e0b", stroke: "#fffbeb" },
    cooler: { fill: "#06b6d4", stroke: "#cffafe" }
};

function idx(x, y) {
    return y * N + x;
}

function resetTemperature() {
    for (let i = 0; i < temperature.length; i++) {
        temperature[i] = ambient;
        nextTemperature[i] = ambient;
    }
    iceMass = 1.0;
    simulatedTime = 0.0;
}

function resetLayout() {
    objects = [
        { type: "ice", x: 11, y: 36, w: 13, h: 18 },
        { type: "heater", x: 76, y: 42, w: 6, h: 6 },

        { type: "insulator", x: 96, y: 7, w: 8, h: 36 },
        { type: "insulator", x: 107, y: 7, w: 8, h: 36 },
        { type: "insulator", x: 96, y: 48, w: 19, h: 7 },

        { type: "conductor", x: 96, y: 63, w: 19, h: 7 },
        { type: "conductor", x: 96, y: 75, w: 7, h: 28 },

        { type: "cooler", x: 107, y: 75, w: 12, h: 12 }
    ];
    setupMode = true;
    running = false;
    paused = false;
    resetTemperature();
}

function goodLayout() {
    objects = [
        { type: "ice", x: 11, y: 36, w: 13, h: 18 },
        { type: "heater", x: 76, y: 42, w: 6, h: 6 },

        { type: "insulator", x: 41, y: 19, w: 8, h: 48 },
        { type: "insulator", x: 30, y: 31, w: 8, h: 30 },
        { type: "cooler", x: 22, y: 14, w: 18, h: 8 },

        { type: "insulator", x: 96, y: 48, w: 19, h: 7 },
        { type: "conductor", x: 96, y: 63, w: 19, h: 7 },
        { type: "conductor", x: 96, y: 75, w: 7, h: 28 }
    ];
    setupMode = true;
    running = false;
    paused = false;
    resetTemperature();
}

function badLayout() {
    objects = [
        { type: "ice", x: 11, y: 36, w: 13, h: 18 },
        { type: "heater", x: 76, y: 42, w: 6, h: 6 },

        { type: "conductor", x: 30, y: 39, w: 42, h: 8 },
        { type: "conductor", x: 24, y: 42, w: 8, h: 12 },
        { type: "insulator", x: 65, y: 12, w: 8, h: 30 },

        { type: "insulator", x: 96, y: 7, w: 8, h: 36 },
        { type: "cooler", x: 96, y: 75, w: 12, h: 12 },
        { type: "insulator", x: 107, y: 7, w: 8, h: 36 }
    ];
    setupMode = true;
    running = false;
    paused = false;
    resetTemperature();
}

function inBoard(o) {
    return o.x >= 0 && o.y >= 0 && o.x + o.w <= N && o.y + o.h <= N;
}

function getValue(id) {
    return Number(document.getElementById(id).value);
}

function pointerToCell(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * TOTAL_CELLS_X;
    const y = (event.clientY - rect.top) / rect.height * N;
    return { x, y };
}

function objectAtCell(cx, cy) {
    for (let i = objects.length - 1; i >= 0; i--) {
        const o = objects[i];
        if (cx >= o.x && cx <= o.x + o.w && cy >= o.y && cy <= o.y + o.h) {
            return o;
        }
    }
    return null;
}

canvas.addEventListener("pointerdown", (event) => {
    if (!setupMode) return;

    const p = pointerToCell(event);
    const selected = objectAtCell(p.x, p.y);

    if (selected) {
        dragging = selected;
        dragOffsetX = p.x - selected.x;
        dragOffsetY = p.y - selected.y;
        canvas.setPointerCapture(event.pointerId);
    }
});

canvas.addEventListener("pointermove", (event) => {
    if (!dragging || !setupMode) return;

    const p = pointerToCell(event);
    dragging.x = Math.max(0, Math.min(TOTAL_CELLS_X - dragging.w, p.x - dragOffsetX));
    dragging.y = Math.max(0, Math.min(N - dragging.h, p.y - dragOffsetY));
});

canvas.addEventListener("pointerup", () => {
    dragging = null;
});

function getIceObject() {
    return objects.find((o) => o.type === "ice");
}

function getMeltedIceRect() {
    const ice = getIceObject();

    if (!ice) {
        return null;
    }

    const scale = Math.sqrt(Math.max(0.0, iceMass));
    const w = ice.w * scale;
    const h = ice.h * scale;
    const x = ice.x + (ice.w - w) / 2;
    const y = ice.y + (ice.h - h) / 2;

    return { x, y, w, h };
}

function buildFields() {
    const alpha = new Float32Array(N * N);
    const cooling = new Float32Array(N * N);
    const source = new Float32Array(N * N);

    const baseAlpha = getValue("alphaInput");
    const heaterPower = getValue("powerInput");

    for (let i = 0; i < alpha.length; i++) {
        alpha[i] = baseAlpha;
        cooling[i] = 0.0007;
        source[i] = 0.0;
    }

    for (const o of objects) {
        if (!inBoard(o)) continue;

        const x0 = Math.floor(o.x);
        const y0 = Math.floor(o.y);
        const x1 = Math.ceil(o.x + o.w);
        const y1 = Math.ceil(o.y + o.h);

        if (o.type === "insulator") {
            for (let y = y0; y < y1; y++) {
                for (let x = x0; x < x1; x++) {
                    alpha[idx(x, y)] *= 0.018;
                }
            }
        }

        if (o.type === "conductor") {
            for (let y = y0; y < y1; y++) {
                for (let x = x0; x < x1; x++) {
                    alpha[idx(x, y)] = Math.max(alpha[idx(x, y)], 1.12);
                }
            }
        }

        if (o.type === "cooler") {
            for (let y = y0; y < y1; y++) {
                for (let x = x0; x < x1; x++) {
                    cooling[idx(x, y)] += 0.12;
                }
            }
        }

        if (o.type === "heater") {
            const cx = o.x + o.w / 2;
            const cy = o.y + o.h / 2;
            const radius = 15.0;

            for (let y = 0; y < N; y++) {
                for (let x = 0; x < N; x++) {
                    const dx = x - cx;
                    const dy = y - cy;
                    const d2 = dx * dx + dy * dy;
                    source[idx(x, y)] += heaterPower * Math.exp(-d2 / (2.0 * radius * radius));
                }
            }
        }
    }

    return { alpha, cooling, source };
}

function stepSimulation(fields) {
    let meltSignal = 0.0;
    let iceCellCount = 0;
    const iceRect = getMeltedIceRect();

    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            const i = idx(x, y);
            const xl = Math.max(0, x - 1);
            const xr = Math.min(N - 1, x + 1);
            const yd = Math.max(0, y - 1);
            const yu = Math.min(N - 1, y + 1);

            const lap =
                temperature[idx(xl, y)] +
                temperature[idx(xr, y)] +
                temperature[idx(x, yd)] +
                temperature[idx(x, yu)] -
                4.0 * temperature[i];

            const t =
                temperature[i] +
                fields.alpha[i] * lap * dt +
                fields.source[i] * dt -
                fields.cooling[i] * (temperature[i] - ambient) * dt;

            nextTemperature[i] = t;
        }
    }

    if (iceRect && iceMass > 0 && inBoard(getIceObject())) {
        const x0 = Math.floor(iceRect.x);
        const y0 = Math.floor(iceRect.y);
        const x1 = Math.ceil(iceRect.x + iceRect.w);
        const y1 = Math.ceil(iceRect.y + iceRect.h);

        for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
                if (x >= 0 && x < N && y >= 0 && y < N) {
                    const i = idx(x, y);
                    iceCellCount += 1;

                    if (nextTemperature[i] > 0) {
                        meltSignal += nextTemperature[i];
                        nextTemperature[i] = Math.min(nextTemperature[i], 0.0);
                    }
                }
            }
        }
    }

    if (iceCellCount > 0 && iceMass > 0) {
        const averageHeatOnIce = meltSignal / iceCellCount;
        iceMass = Math.max(0.0, iceMass - averageHeatOnIce * 0.012 * dt);
    }

    const tmp = temperature;
    temperature = nextTemperature;
    nextTemperature = tmp;
    simulatedTime += dt;
}

function mix(a, b, t) {
    return Math.round(a + (b - a) * t);
}

function colorForTemperature(temp) {
    const v = Math.max(0, Math.min(1, (temp + 5) / 95));

    const stops = [
        [0.00, [30, 64, 175]],
        [0.25, [34, 211, 238]],
        [0.50, [250, 204, 21]],
        [0.72, [249, 115, 22]],
        [1.00, [220, 38, 38]]
    ];

    for (let i = 0; i < stops.length - 1; i++) {
        const a = stops[i];
        const b = stops[i + 1];

        if (v >= a[0] && v <= b[0]) {
            const t = (v - a[0]) / (b[0] - a[0]);
            return [
                mix(a[1][0], b[1][0], t),
                mix(a[1][1], b[1][1], t),
                mix(a[1][2], b[1][2], t)
            ];
        }
    }

    return stops[stops.length - 1][1];
}

function drawHeatMap() {
    const image = ctx.createImageData(N, N);

    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            const i = idx(x, y);
            const c = colorForTemperature(temperature[i]);
            const p = i * 4;

            image.data[p + 0] = c[0];
            image.data[p + 1] = c[1];
            image.data[p + 2] = c[2];
            image.data[p + 3] = 255;
        }
    }

    const tiny = document.createElement("canvas");
    tiny.width = N;
    tiny.height = N;

    const tctx = tiny.getContext("2d");
    tctx.putImageData(image, 0, 0);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tiny, 0, 0, BOARD_PX, BOARD_PX);
}

function drawBoard() {
    drawHeatMap();

    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, BOARD_PX, BOARD_PX);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;

    for (let k = 0; k <= N; k += 10) {
        ctx.beginPath();
        ctx.moveTo(k * S, 0);
        ctx.lineTo(k * S, BOARD_PX);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, k * S);
        ctx.lineTo(BOARD_PX, k * S);
        ctx.stroke();
    }

    ctx.restore();
}

function drawInventoryArea() {
    ctx.save();

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(BOARD_PX, 0, CANVAS_W - BOARD_PX, CANVAS_H);

    ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(BOARD_PX + 1, 0);
    ctx.lineTo(BOARD_PX + 1, CANVAS_H);
    ctx.stroke();

    ctx.fillStyle = "#e5e7eb";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "left";
    ctx.fillText("available figures", BOARD_PX + 20, 35);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px Arial";
    ctx.fillText("drag them onto the field", BOARD_PX + 20, 60);
    ctx.fillText("unused figures may stay here", BOARD_PX + 20, 80);

    if (!setupMode) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
        ctx.fillRect(BOARD_PX, 0, CANVAS_W - BOARD_PX, CANVAS_H);
        ctx.fillStyle = "#f8fafc";
        ctx.font = "bold 18px Arial";
        ctx.fillText("simulation started", BOARD_PX + 20, 45);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "13px Arial";
        ctx.fillText("objects are locked", BOARD_PX + 20, 70);
    }

    ctx.restore();
}


function getObjectPixels(o) {
    let drawX = o.x * S;
    let drawY = o.y * S;
    let drawW = o.w * S;
    let drawH = o.h * S;

    if (o.type === "ice") {
        const scale = Math.sqrt(Math.max(0.0, iceMass));
        drawW = o.w * S * scale;
        drawH = o.h * S * scale;
        drawX = (o.x * S) + (o.w * S - drawW) / 2;
        drawY = (o.y * S) + (o.h * S - drawH) / 2;
    }

    return { x: drawX, y: drawY, w: drawW, h: drawH };
}

function drawBody(p, fill, stroke, radius = 10) {
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.w, p.h, radius);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = stroke;
    ctx.stroke();
}

function drawInsulator(p) {
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 5;

    const gradient = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
    gradient.addColorStop(0, "#6d28d9");
    gradient.addColorStop(0.5, "#8b5cf6");
    gradient.addColorStop(1, "#4c1d95");

    drawBody(p, gradient, "#ede9fe", 10);

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(237, 233, 254, 0.55)";
    ctx.lineWidth = 2;

    const rows = Math.max(2, Math.floor(p.h / 20));
    const rowH = p.h / rows;

    for (let r = 1; r < rows; r++) {
        const y = p.y + r * rowH;
        ctx.beginPath();
        ctx.moveTo(p.x + 4, y);
        ctx.lineTo(p.x + p.w - 4, y);
        ctx.stroke();
    }

    for (let r = 0; r < rows; r++) {
        const y0 = p.y + r * rowH;
        const offset = r % 2 === 0 ? 0 : p.w / 4;
        const columns = Math.max(2, Math.floor(p.w / 24));

        for (let c = 1; c < columns; c++) {
            const x = p.x + c * p.w / columns + offset;
            if (x > p.x + 5 && x < p.x + p.w - 5) {
                ctx.beginPath();
                ctx.moveTo(x, y0 + 4);
                ctx.lineTo(x, y0 + rowH - 4);
                ctx.stroke();
            }
        }
    }

    ctx.fillStyle = "rgba(15, 23, 42, 0.35)";
    for (let i = 0; i < 4; i++) {
        const y = p.y + 8 + i * (p.h - 16) / 4;
        ctx.fillRect(p.x + 7, y, p.w - 14, 3);
    }

    ctx.restore();
}

function drawConductor(p) {
    ctx.save();
    ctx.shadowColor = "rgba(251, 146, 60, 0.45)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 3;

    const gradient = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
    gradient.addColorStop(0, "#92400e");
    gradient.addColorStop(0.35, "#f59e0b");
    gradient.addColorStop(0.65, "#fbbf24");
    gradient.addColorStop(1, "#b45309");

    drawBody(p, gradient, "#fffbeb", 10);

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 251, 235, 0.45)";
    ctx.lineWidth = 2;

    const stripeCount = 4;
    for (let i = 1; i <= stripeCount; i++) {
        const y = p.y + i * p.h / (stripeCount + 1);
        ctx.beginPath();
        ctx.moveTo(p.x + 7, y);
        ctx.lineTo(p.x + p.w - 7, y);
        ctx.stroke();
    }

    ctx.fillStyle = "rgba(255, 251, 235, 0.85)";
    const horizontal = p.w >= p.h;

    if (horizontal) {
        const count = Math.max(2, Math.floor(p.w / 35));
        for (let i = 0; i < count; i++) {
            const cx = p.x + 16 + i * (p.w - 32) / Math.max(1, count - 1);
            const cy = p.y + p.h / 2;
            ctx.beginPath();
            ctx.moveTo(cx - 7, cy - 8);
            ctx.lineTo(cx + 9, cy);
            ctx.lineTo(cx - 7, cy + 8);
            ctx.closePath();
            ctx.fill();
        }
    } else {
        const count = Math.max(2, Math.floor(p.h / 35));
        for (let i = 0; i < count; i++) {
            const cx = p.x + p.w / 2;
            const cy = p.y + 16 + i * (p.h - 32) / Math.max(1, count - 1);
            ctx.beginPath();
            ctx.moveTo(cx - 8, cy - 7);
            ctx.lineTo(cx, cy + 9);
            ctx.lineTo(cx + 8, cy - 7);
            ctx.closePath();
            ctx.fill();
        }
    }

    ctx.restore();
}

function drawCooler(p) {
    ctx.save();
    ctx.shadowColor = "rgba(6, 182, 212, 0.45)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;

    const gradient = ctx.createRadialGradient(
        p.x + p.w / 2,
        p.y + p.h / 2,
        2,
        p.x + p.w / 2,
        p.y + p.h / 2,
        Math.max(p.w, p.h)
    );

    gradient.addColorStop(0, "#ecfeff");
    gradient.addColorStop(0.45, "#06b6d4");
    gradient.addColorStop(1, "#164e63");

    drawBody(p, gradient, "#cffafe", 10);

    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const r = Math.min(p.w, p.h) * 0.28;

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(236, 254, 255, 0.85)";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(236, 254, 255, 0.92)";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2 + Math.PI / 5;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(r * 0.65, 0, r * 0.75, r * 0.22, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(236, 254, 255, 0.78)";
        ctx.fill();
        ctx.restore();
    }

    ctx.strokeStyle = "rgba(207, 250, 254, 0.65)";
    ctx.lineWidth = 2;

    for (let i = 0; i < 3; i++) {
        const y = p.y + p.h * (0.22 + i * 0.22);
        ctx.beginPath();
        ctx.moveTo(p.x + 8, y);
        ctx.bezierCurveTo(
            p.x + p.w * 0.32,
            y - 8,
            p.x + p.w * 0.62,
            y + 8,
            p.x + p.w - 8,
            y
        );
        ctx.stroke();
    }

    ctx.restore();
}

function drawIce(p) {
    ctx.save();
    ctx.shadowColor = "rgba(56, 189, 248, 0.5)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 5;

    const gradient = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
    gradient.addColorStop(0, `rgba(224, 242, 254, ${0.38 + 0.45 * iceMass})`);
    gradient.addColorStop(0.5, `rgba(56, 189, 248, ${0.25 + 0.55 * iceMass})`);
    gradient.addColorStop(1, `rgba(14, 165, 233, ${0.20 + 0.45 * iceMass})`);

    drawBody(p, gradient, "#e0f2fe", 10);

    ctx.shadowBlur = 0;

    if (iceMass > 0.03) {
        ctx.strokeStyle = "rgba(240, 249, 255, 0.65)";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(p.x + p.w * 0.2, p.y + p.h * 0.32);
        ctx.lineTo(p.x + p.w * 0.78, p.y + p.h * 0.26);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(p.x + p.w * 0.28, p.y + p.h * 0.70);
        ctx.lineTo(p.x + p.w * 0.82, p.y + p.h * 0.60);
        ctx.stroke();

        ctx.font = `${Math.max(14, Math.floor(p.h * 0.45))}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("❄️", p.x + p.w / 2, p.y + p.h / 2);
    } else {
        ctx.fillStyle = "rgba(125, 211, 252, 0.35)";
        ctx.beginPath();
        ctx.ellipse(
            p.x + p.w / 2,
            p.y + p.h / 2,
            p.w * 0.75,
            Math.max(5, p.h * 0.32),
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }

    ctx.restore();
}

function drawHeater(p) {
    ctx.save();
    ctx.shadowColor = "rgba(239, 68, 68, 0.75)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 4;

    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const r = Math.max(p.w, p.h) * 0.72;

    const gradient = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
    gradient.addColorStop(0, "#fef3c7");
    gradient.addColorStop(0.35, "#f97316");
    gradient.addColorStop(1, "#dc2626");

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = "#fee2e2";
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🔥", cx, cy);

    ctx.restore();
}

function drawObject(o) {
    const p = getObjectPixels(o);

    if (o.type === "ice") {
        drawIce(p);
        return;
    }

    if (o.type === "heater") {
        drawHeater(p);
        return;
    }

    if (o.type === "insulator") {
        drawInsulator(p);
        return;
    }

    if (o.type === "conductor") {
        drawConductor(p);
        return;
    }

    if (o.type === "cooler") {
        drawCooler(p);
    }
}

function drawAllObjects() {
    for (const o of objects) {
        drawObject(o);
    }
}

function updateMetrics() {
    let maxT = -1000;

    for (let i = 0; i < temperature.length; i++) {
        if (temperature[i] > maxT) {
            maxT = temperature[i];
        }
    }

    document.getElementById("iceMetric").textContent = `${(iceMass * 100).toFixed(1)}%`;
    document.getElementById("tempMetric").textContent = `${maxT.toFixed(1)} °C`;
    document.getElementById("timeMetric").textContent = `${simulatedTime.toFixed(1)} s`;

    const modeMetric = document.getElementById("modeMetric");
    const adviceBox = document.getElementById("adviceBox");

    if (setupMode) {
        modeMetric.textContent = "Setup";
        adviceBox.textContent = "Setup mode: place figures on the field, then press Start simulation. Unused figures can stay outside.";
        return;
    }

    if (paused) {
        modeMetric.textContent = "Paused";
        adviceBox.textContent = "Simulation is paused. Press Pause again to continue.";
        return;
    }

    if (iceMass <= 0.03) {
        modeMetric.textContent = "Melted";
        adviceBox.textContent = "The ice has melted. Go back to Edit layout and try a better defense.";
    } else if (iceMass < 0.45) {
        modeMetric.textContent = "Critical";
        adviceBox.textContent = "The ice is melting quickly. The heat path reaches it too directly.";
    } else if (iceMass < 0.80) {
        modeMetric.textContent = "Melting";
        adviceBox.textContent = "The ice is melting. A better insulator position may slow down the heat.";
    } else {
        modeMetric.textContent = "Running";
        adviceBox.textContent = "Simulation is running. Objects are locked until you return to Edit layout.";
    }
}

function draw() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    drawBoard();
    drawInventoryArea();
    drawAllObjects();
}

function loop() {
    document.getElementById("speedLabel").textContent = String(getValue("speedInput"));
    document.getElementById("powerLabel").textContent = String(getValue("powerInput"));
    document.getElementById("alphaLabel").textContent = getValue("alphaInput").toFixed(2);

    if (running && !paused && iceMass > 0.03) {
        const fields = buildFields();
        const speed = getValue("speedInput");

        for (let k = 0; k < speed; k++) {
            stepSimulation(fields);
        }
    }

    draw();
    updateMetrics();
    requestAnimationFrame(loop);
}

document.getElementById("startBtn").addEventListener("click", () => {
    setupMode = false;
    running = true;
    paused = false;
    resetTemperature();
});

document.getElementById("pauseBtn").addEventListener("click", () => {
    if (!running) return;

    paused = !paused;
    document.getElementById("pauseBtn").textContent = paused ? "Resume" : "Pause";
});

document.getElementById("editBtn").addEventListener("click", () => {
    setupMode = true;
    running = false;
    paused = false;
    document.getElementById("pauseBtn").textContent = "Pause";
    resetTemperature();
});

document.getElementById("resetHeatBtn").addEventListener("click", () => {
    resetTemperature();
});

document.getElementById("resetLayoutBtn").addEventListener("click", () => {
    resetLayout();
});

document.getElementById("goodBtn").addEventListener("click", () => {
    goodLayout();
});

document.getElementById("badBtn").addEventListener("click", () => {
    badLayout();
});

if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        this.beginPath();
        this.moveTo(x + r, y);
        this.lineTo(x + w - r, y);
        this.quadraticCurveTo(x + w, y, x + w, y + r);
        this.lineTo(x + w, y + h - r);
        this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.lineTo(x + r, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r);
        this.lineTo(x, y + r);
        this.quadraticCurveTo(x, y, x + r, y);
        this.closePath();
        return this;
    };
}

resetLayout();
loop();
