from pathlib import Path


path = Path("frontend/simulation.js")
text = path.read_text(encoding="utf-8")

start = text.index("function drawObject(o) {")
end = text.index("\nfunction drawAllObjects()", start)

replacement = r'''
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
'''

new_text = text[:start] + replacement + text[end:]
path.write_text(new_text, encoding="utf-8")

print("updated figure rendering")
