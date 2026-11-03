// HTML5 Canvas Drawing Engine for High-Resolution Festive Cards

export function drawFestiveCardToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  themeId: string,
  accentColor: string,
  cardFormat: 'square' | 'portrait'
) {
  // 1. Rich Multi-Stop Background Gradient
  const bgGrad = ctx.createRadialGradient(
    width / 2,
    cardFormat === 'portrait' ? height * 0.35 : height * 0.4,
    40,
    width / 2,
    height / 2,
    width * 0.8
  );

  if (themeId === 'diwali') {
    bgGrad.addColorStop(0, '#9a3412');
    bgGrad.addColorStop(0.4, '#7c1d1d');
    bgGrad.addColorStop(0.8, '#450a0a');
    bgGrad.addColorStop(1, '#1c0505');
  } else if (themeId === 'new_year') {
    bgGrad.addColorStop(0, '#1e1b4b');
    bgGrad.addColorStop(0.4, '#0f172a');
    bgGrad.addColorStop(0.8, '#020617');
    bgGrad.addColorStop(1, '#000000');
  } else if (themeId === 'holi') {
    bgGrad.addColorStop(0, '#831843');
    bgGrad.addColorStop(0.4, '#581c87');
    bgGrad.addColorStop(0.8, '#1e1b4b');
    bgGrad.addColorStop(1, '#0f172a');
  } else if (themeId === 'dussehra') {
    bgGrad.addColorStop(0, '#c2410c');
    bgGrad.addColorStop(0.4, '#991b1b');
    bgGrad.addColorStop(0.8, '#450a0a');
    bgGrad.addColorStop(1, '#1c0505');
  } else if (themeId === 'ganesh_chaturthi') {
    bgGrad.addColorStop(0, '#ea580c');
    bgGrad.addColorStop(0.4, '#9a3412');
    bgGrad.addColorStop(0.8, '#431407');
    bgGrad.addColorStop(1, '#1c0505');
  } else if (themeId === 'shivratri') {
    bgGrad.addColorStop(0, '#1e293b');
    bgGrad.addColorStop(0.4, '#0f172a');
    bgGrad.addColorStop(0.8, '#020617');
    bgGrad.addColorStop(1, '#000000');
  } else if (themeId === 'raksha_bandhan') {
    bgGrad.addColorStop(0, '#831843');
    bgGrad.addColorStop(0.4, '#701a75');
    bgGrad.addColorStop(0.8, '#3b0764');
    bgGrad.addColorStop(1, '#0f172a');
  } else if (themeId === 'eid') {
    bgGrad.addColorStop(0, '#064e3b');
    bgGrad.addColorStop(0.4, '#134e4a');
    bgGrad.addColorStop(0.8, '#062823');
    bgGrad.addColorStop(1, '#02120f');
  } else if (themeId === 'republic_day') {
    bgGrad.addColorStop(0, '#7c2d12');
    bgGrad.addColorStop(0.4, '#0f172a');
    bgGrad.addColorStop(0.8, '#064e3b');
    bgGrad.addColorStop(1, '#022c22');
  } else if (themeId === 'makar_sankranti') {
    bgGrad.addColorStop(0, '#b45309');
    bgGrad.addColorStop(0.4, '#c2410c');
    bgGrad.addColorStop(0.8, '#7c2d12');
    bgGrad.addColorStop(1, '#1c0505');
  } else if (themeId === 'birthday') {
    bgGrad.addColorStop(0, '#1d4ed8');
    bgGrad.addColorStop(0.4, '#4338ca');
    bgGrad.addColorStop(0.8, '#312e81');
    bgGrad.addColorStop(1, '#0f172a');
  } else {
    // lic_trust
    bgGrad.addColorStop(0, '#1e3a8a');
    bgGrad.addColorStop(0.4, '#0f172a');
    bgGrad.addColorStop(0.8, '#020617');
    bgGrad.addColorStop(1, '#000000');
  }

  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Festive Sparkles & Bokeh Lights
  drawSparkleBokeh(ctx, width, height);

  // 3. Ornate Golden Outer Frame Border
  drawGoldenBorder(ctx, width, height);

  // 4. Hanging Toran Festoon along the top
  drawHangingGarland(ctx, width);

  // 5. Draw Hero Festive Artwork Picture in Canvas
  const heroCenterY = cardFormat === 'portrait' ? 240 : 170;
  drawHeroArtwork(ctx, width / 2, heroCenterY, themeId, accentColor);
}

// Draw Bokeh particles
function drawSparkleBokeh(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  for (let i = 0; i < 45; i++) {
    const x = (i * 97) % width;
    const y = (i * 137) % (height - 320);
    const radius = ((i % 5) + 1) * 2;
    const alpha = ((i % 4) + 1) * 0.08;

    ctx.fillStyle = `rgba(254, 240, 138, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Draw Golden Border & 4 Corner Filigrees
function drawGoldenBorder(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  const margin = 24;

  // Outer primary gold line
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 3;
  ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);

  // Inner subtle secondary gold line
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(margin + 8, margin + 8, width - (margin + 8) * 2, height - (margin + 8) * 2);
  ctx.setLineDash([]);

  // Corner Accents (4 corners)
  const cornerSize = 40;
  const corners = [
    [margin, margin, 1, 1],
    [width - margin, margin, -1, 1],
    [margin, height - margin, 1, -1],
    [width - margin, height - margin, -1, -1],
  ];

  for (const [cx, cy, sx, sy] of corners) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, sy);

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(10, 10, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, cornerSize);
    ctx.lineTo(cornerSize, 0);
    ctx.stroke();

    ctx.restore();
  }

  ctx.restore();
}

// Draw Hanging Marigold Garland at Top
function drawHangingGarland(ctx: CanvasRenderingContext2D, width: number) {
  ctx.save();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.beginPath();

  const numScallops = 6;
  const scallopW = width / numScallops;

  for (let i = 0; i < numScallops; i++) {
    const xStart = i * scallopW;
    const xEnd = (i + 1) * scallopW;
    const xMid = xStart + scallopW / 2;
    ctx.moveTo(xStart, 30);
    ctx.quadraticCurveTo(xMid, 75, xEnd, 30);
  }
  ctx.stroke();

  // Hanging marigold bells
  for (let i = 0; i < numScallops; i++) {
    const xMid = i * scallopW + scallopW / 2;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xMid, 55);
    ctx.lineTo(xMid, 80);
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(xMid, 85, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.arc(xMid, 85, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Draw Theme Specific Hero Artwork Pictures directly in Canvas
function drawHeroArtwork(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  themeId: string,
  accentColor: string
) {
  ctx.save();

  if (themeId === 'diwali') {
    // 1. Radiant Rangoli Mandala in background
    ctx.save();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 90, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * 75, cy + Math.sin(angle) * 75, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
    }
    ctx.restore();

    // 2. Large Central Glowing Diya
    // Diya Brass Base
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 35, 75, 25, 0, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Diya Rim
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 35, 75, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Diya Flame Halo
    const flameHalo = ctx.createRadialGradient(cx, cy - 10, 5, cx, cy - 10, 50);
    flameHalo.addColorStop(0, 'rgba(254, 240, 138, 0.8)');
    flameHalo.addColorStop(0.5, 'rgba(249, 115, 22, 0.4)');
    flameHalo.addColorStop(1, 'rgba(220, 38, 38, 0)');
    ctx.fillStyle = flameHalo;
    ctx.beginPath();
    ctx.arc(cx, cy - 10, 50, 0, Math.PI * 2);
    ctx.fill();

    // Main Diya Flame
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 45);
    ctx.quadraticCurveTo(cx + 25, cy, cx, cy + 30);
    ctx.quadraticCurveTo(cx - 25, cy, cx, cy - 45);
    ctx.fill();

    // Inner Flame
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 30);
    ctx.quadraticCurveTo(cx + 14, cy + 5, cx, cy + 25);
    ctx.quadraticCurveTo(cx - 14, cy + 5, cx, cy - 30);
    ctx.fill();

    // Core White Light
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy + 12, 5, 0, Math.PI * 2);
    ctx.fill();

    // Side Mini Diyas
    drawMiniDiya(ctx, cx - 110, cy + 20);
    drawMiniDiya(ctx, cx + 110, cy + 20);
  } else if (themeId === 'new_year') {
    // Fireworks starbursts
    drawFireworkBurst(ctx, cx - 100, cy - 20, 55, '#f43f5e');
    drawFireworkBurst(ctx, cx + 100, cy - 20, 55, '#38bdf8');
    drawFireworkBurst(ctx, cx, cy - 35, 75, '#fbbf24');

    // Golden 2027 Plaque
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(cx - 90, cy + 30, 180, 50, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 36px "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('2027', cx, cy + 67);
  } else if (themeId === 'holi') {
    // Colorful Gulal clouds
    drawColorCloud(ctx, cx - 60, cy - 20, 50, 'rgba(244, 63, 94, 0.7)');
    drawColorCloud(ctx, cx + 60, cy - 20, 55, 'rgba(250, 204, 21, 0.7)');
    drawColorCloud(ctx, cx, cy + 30, 50, 'rgba(6, 182, 212, 0.7)');

    // Golden Pichkari
    ctx.save();
    ctx.translate(cx - 60, cy + 20);
    ctx.rotate((-30 * Math.PI) / 180);
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    ctx.fillRect(0, 0, 140, 22);
    ctx.strokeRect(0, 0, 140, 22);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(140, 5, 20, 12);
    ctx.restore();
  } else if (themeId === 'dussehra') {
    // Lord Rama's Bow & Flaming Arrow
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx - 40, cy, 75, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();

    // Bowstring
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy - 65);
    ctx.lineTo(cx - 15, cy + 65);
    ctx.stroke();

    // Arrow
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 40, cy);
    ctx.lineTo(cx + 80, cy);
    ctx.stroke();

    // Arrow tip
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(cx + 95, cy);
    ctx.lineTo(cx + 70, cy - 14);
    ctx.lineTo(cx + 70, cy + 14);
    ctx.closePath();
    ctx.fill();
  } else if (themeId === 'ganesh_chaturthi') {
    // Golden Ganesha Mukut & Aura
    ctx.fillStyle = 'rgba(254, 240, 138, 0.2)';
    ctx.beginPath();
    ctx.arc(cx, cy, 75, 0, Math.PI * 2);
    ctx.fill();

    // Golden Crown (Mukut)
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 60);
    ctx.lineTo(cx + 30, cy - 20);
    ctx.lineTo(cx - 30, cy - 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Ganesha Trunk
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 10);
    ctx.quadraticCurveTo(cx - 20, cy + 30, cx + 5, cy + 45);
    ctx.quadraticCurveTo(cx + 25, cy + 35, cx + 15, cy + 20);
    ctx.stroke();

    // Red Tilak
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(cx, cy - 10, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (themeId === 'shivratri') {
    // Lord Shiva Trishul & Crescent Moon
    // Crescent Moon
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(cx + 40, cy - 40, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(cx + 32, cy - 44, 24, 0, Math.PI * 2);
    ctx.fill();

    // Trishul Center Staff
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 70);
    ctx.lineTo(cx, cy + 70);
    ctx.stroke();

    // Prongs
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx - 35, cy - 50);
    ctx.quadraticCurveTo(cx - 35, cy - 10, cx, cy - 10);
    ctx.quadraticCurveTo(cx + 35, cy - 10, cx + 35, cy - 50);
    ctx.stroke();

    // Center spear tip
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 85);
    ctx.lineTo(cx + 12, cy - 65);
    ctx.lineTo(cx - 12, cy - 65);
    ctx.closePath();
    ctx.fill();
  } else if (themeId === 'raksha_bandhan') {
    // Traditional Ornate Rakhi
    // Red and Gold Threads
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx - 130, cy);
    ctx.lineTo(cx + 130, cy);
    ctx.stroke();

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 130, cy + 4);
    ctx.lineTo(cx + 130, cy + 4);
    ctx.stroke();

    // Center Golden Medallion
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(cx, cy, 48, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(cx, cy, 38, 0, Math.PI * 2);
    ctx.fill();

    // Ruby Center
    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (themeId === 'eid') {
    // Golden Crescent Moon & Hanging Lantern
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(cx, cy, 65, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.arc(cx + 24, cy - 10, 58, 0, Math.PI * 2);
    ctx.fill();

    // Star
    drawStar(ctx, cx + 35, cy - 15, 5, 18, 9, '#fef08a');

    // Hanging Lantern
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 70, cy - 80);
    ctx.lineTo(cx - 70, cy - 10);
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(cx - 82, cy - 10, 24, 30);
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(cx - 70, cy + 5, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (themeId === 'republic_day') {
    // Flowing Tiranga Waves
    ctx.fillStyle = '#f97316';
    ctx.fillRect(cx - 120, cy - 35, 240, 24);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 120, cy - 11, 240, 24);
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(cx - 120, cy + 13, 240, 24);

    // Ashoka Chakra
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy + 1, 10, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Generic Protective Symbol / Star
    drawStar(ctx, cx, cy, 5, 45, 22, accentColor || '#fbbf24');
  }

  ctx.restore();
}

// Helpers
function drawMiniDiya(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#d97706';
  ctx.beginPath();
  ctx.ellipse(x, y + 10, 22, 10, 0, 0, Math.PI);
  ctx.fill();

  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(x, y - 12);
  ctx.quadraticCurveTo(x + 10, y, x, y + 10);
  ctx.quadraticCurveTo(x - 10, y, x, y - 12);
  ctx.fill();

  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(x, y + 2, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawFireworkBurst(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawColorCloud(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerR: number, innerR: number, fill: string) {
  ctx.save();
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerR;
    y = cy + Math.sin(rot) * outerR;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerR;
    y = cy + Math.sin(rot) * innerR;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerR);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}
