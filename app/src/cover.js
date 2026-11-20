// Vice Cover Studio — the cover drawing engine.
//
// A cover is a set of photo panels in a multi-panel poster layout, a warm
// sunset / neon / noir colour grade over each photo, and bold caption
// lettering with an outline and a drop shadow. Everything drawn here is
// original: the panels, the gradients, the halftone dots and the sun badge
// are vector work, and the lettering is a system sans-serif — no game logos,
// artwork, characters or fonts anywhere.
//
// State shape (see main.js):
//   { layout: 'poster' | 'triptych' | 'single',
//     size: '1080x1080' | '1080x1350' | '1920x1080',
//     caption: string, subcaption: string, captionPos: 'top' | 'bottom',
//     grade: 'sunset' | 'neon' | 'noir',
//     panels: [{ photo, zoom, ox, oy }] }   // ox/oy are fractions of the panel
// `photos` is a Map from photo id to an HTMLImageElement (or null while loading).

export const LAYOUTS = {
  poster: { name: 'Poster', panels: 3 },
  triptych: { name: 'Triptych', panels: 3 },
  single: { name: 'Single', panels: 1 },
};

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square 1080 x 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait 1080 x 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Wide 1920 x 1080' },
};

export const GRADES = {
  sunset: { name: 'Sunset', filter: 'saturate(1.28) contrast(1.08) brightness(1.03)' },
  neon: { name: 'Neon', filter: 'saturate(1.45) contrast(1.12) hue-rotate(-12deg)' },
  noir: { name: 'Noir', filter: 'grayscale(1) contrast(1.16) brightness(0.96)' },
};

/** Panel rectangles for a layout, in canvas pixels. `g` is the gutter. */
export function panelRects(layout, w, h, g) {
  if (layout === 'triptych') {
    const pw = (w - 4 * g) / 3;
    return [0, 1, 2].map((i) => ({ x: g + i * (pw + g), y: g, w: pw, h: h - 2 * g }));
  }
  if (layout === 'single') {
    return [{ x: g, y: g, w: w - 2 * g, h: h - 2 * g }];
  }
  // poster: one hero across the top, two panels below it
  const heroH = Math.round(h * 0.6);
  const bottomY = heroH + g;
  const bottomH = h - bottomY - g;
  const halfW = (w - 3 * g) / 2;
  return [
    { x: g, y: g, w: w - 2 * g, h: heroH - g },
    { x: g, y: bottomY, w: halfW, h: bottomH },
    { x: g + halfW + g, y: bottomY, w: halfW, h: bottomH },
  ];
}

/** Clamp a panel's pan offsets so the photo still covers its panel. */
function clampPan(panel, photo, rect) {
  if (!photo) return;
  const base = Math.max(rect.w / photo.naturalWidth, rect.h / photo.naturalHeight);
  const sw = photo.naturalWidth * base * panel.zoom;
  const sh = photo.naturalHeight * base * panel.zoom;
  const maxOx = Math.max(0, (sw - rect.w) / 2 / rect.w);
  const maxOy = Math.max(0, (sh - rect.h) / 2 / rect.h);
  panel.ox = Math.max(-maxOx, Math.min(maxOx, panel.ox || 0));
  panel.oy = Math.max(-maxOy, Math.min(maxOy, panel.oy || 0));
  panel.zoom = Math.max(1, Math.min(4, panel.zoom || 1));
}

/** Draw one photo into its panel, cover-fit, with the grade's canvas filter. */
function drawPanelPhoto(ctx, photo, panel, rect, grade) {
  if (!photo) {
    ctx.fillStyle = '#3a2438';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    return;
  }
  clampPan(panel, photo, rect);
  const base = Math.max(rect.w / photo.naturalWidth, rect.h / photo.naturalHeight);
  const sw = photo.naturalWidth * base * panel.zoom;
  const sh = photo.naturalHeight * base * panel.zoom;
  const dx = rect.x + (rect.w - sw) / 2 + panel.ox * rect.w;
  const dy = rect.y + (rect.h - sh) / 2 + panel.oy * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.filter = GRADES[grade].filter;
  ctx.drawImage(photo, dx, dy, sw, sh);
  ctx.filter = 'none';
  ctx.restore();
}

/** The colour grade's light: warm wash, neon glow or noir vignette, per panel. */
function drawGradeOverlay(ctx, rect, grade, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (grade === 'sunset') {
    const wash = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    wash.addColorStop(0, 'rgba(255, 190, 90, 0.10)');
    wash.addColorStop(0.55, 'rgba(255, 120, 60, 0.05)');
    wash.addColorStop(1, 'rgba(200, 40, 110, 0.34)');
    ctx.fillStyle = wash;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    // Halftone dots rising from the foot of the panel, in the grade's pink.
    const dotGap = Math.max(10, rect.w * 0.028);
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col * dotGap < rect.w + dotGap; col++) {
        const r = (row + 1) * rect.w * 0.0032;
        const x = rect.x + col * dotGap + (row % 2 ? dotGap / 2 : 0);
        const y = rect.y + rect.h - 8 - row * dotGap * 0.9;
        ctx.fillStyle = `rgba(255, 120, 170, ${0.16 - row * 0.028})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (grade === 'neon') {
    const top = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h * 0.5);
    top.addColorStop(0, 'rgba(0, 229, 255, 0.22)');
    top.addColorStop(1, 'rgba(0, 229, 255, 0)');
    ctx.fillStyle = top;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h * 0.5);
    const bottom = ctx.createLinearGradient(0, rect.y + rect.h * 0.5, 0, rect.y + rect.h);
    bottom.addColorStop(0, 'rgba(255, 0, 128, 0)');
    bottom.addColorStop(1, 'rgba(255, 0, 128, 0.34)');
    ctx.fillStyle = bottom;
    ctx.fillRect(rect.x, rect.y + rect.h * 0.5, rect.w, rect.h * 0.5);
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.55)';
    ctx.lineWidth = Math.max(2, w * 0.0016);
    ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
  } else {
    const vig = ctx.createRadialGradient(
      rect.x + rect.w / 2, rect.y + rect.h / 2, Math.min(rect.w, rect.h) * 0.35,
      rect.x + rect.w / 2, rect.y + rect.h / 2, Math.max(rect.w, rect.h) * 0.72,
    );
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.fillStyle = vig;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
}

/** A small vector sun badge, drawn in the cover's top-right corner. */
function drawSunBadge(ctx, w, h, grade) {
  const cx = w * 0.06;
  const cy = h * 0.055;
  const r = Math.min(w, h) * 0.032;
  const core = grade === 'noir' ? '#f2f2f2' : '#ffd166';
  ctx.save();
  ctx.fillStyle = core;
  ctx.shadowColor = core;
  ctx.shadowBlur = r * 0.9;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = core;
  ctx.lineWidth = r * 0.16;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 1.35);
    ctx.lineTo(cx + Math.cos(a) * r * 1.8, cy + Math.sin(a) * r * 1.8);
    ctx.stroke();
  }
  ctx.restore();
}

/** Bold poster lettering: white fill, dark outline, drop shadow, slight slant. */
function drawCaption(ctx, w, h, state) {
  const text = (state.caption || '').trim().toUpperCase();
  const sub = (state.subcaption || '').trim().toUpperCase();
  if (!text && !sub) return;
  const bottom = state.captionPos !== 'top';
  const baseY = bottom ? h * 0.94 : h * 0.06;
  ctx.save();
  // A soft scrim under the lettering, so the caption reads over any photo.
  const scrim = bottom
    ? ctx.createLinearGradient(0, h * 0.78, 0, h)
    : ctx.createLinearGradient(0, 0, 0, h * 0.22);
  if (bottom) {
    scrim.addColorStop(0, 'rgba(20, 8, 20, 0)');
    scrim.addColorStop(1, 'rgba(20, 8, 20, 0.32)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
  } else {
    scrim.addColorStop(0, 'rgba(20, 8, 20, 0.32)');
    scrim.addColorStop(1, 'rgba(20, 8, 20, 0)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, w, h * 0.22);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = bottom ? 'alphabetic' : 'top';
  if (text) {
    let size = h * 0.105;
    const setFont = () => { ctx.font = `900 ${size}px 'Arial Black', 'Liberation Sans', 'DejaVu Sans', sans-serif`; };
    setFont();
    while (ctx.measureText(text).width > w * 0.9 && size > 14) { size -= 2; setFont(); }
    const ty = bottom ? baseY - (sub ? size * 0.42 : 0) : baseY;
    ctx.translate(w / 2, ty);
    ctx.transform(1, 0, -0.05, 1, 0, 0);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = size * 0.16;
    ctx.shadowOffsetY = size * 0.045;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(24, 8, 28, 0.9)';
    ctx.lineWidth = size * 0.14;
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = bottom ? 'alphabetic' : 'top';
  }
  if (sub) {
    const size = Math.max(12, h * 0.028);
    ctx.font = `700 ${size}px 'Liberation Sans', 'DejaVu Sans', sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.32)}px`;
    const sy = bottom ? baseY + size * 0.5 : baseY + h * 0.105;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = size * 0.4;
    ctx.fillText(sub, w / 2, sy);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  ctx.restore();
}

/** Draws the whole cover for `state` onto `canvas` at its own size. */
export function drawCover(canvas, state, photos) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const g = Math.max(6, Math.round(Math.min(w, h) * 0.009));
  ctx.fillStyle = '#f6f1e7';
  ctx.fillRect(0, 0, w, h);
  const rects = panelRects(state.layout, w, h, g);
  state.panels.forEach((panel, i) => {
    const rect = rects[i];
    if (!rect) return;
    const photo = photos.get(panel.photo) || null;
    drawPanelPhoto(ctx, photo, panel, rect, state.grade);
    drawGradeOverlay(ctx, rect, state.grade, w, h);
  });
  drawSunBadge(ctx, w, h, state.grade);
  drawCaption(ctx, w, h, state);
}

/** Hit-test: which panel index contains canvas point (x, y), or -1. */
export function panelAt(state, w, h, x, y) {
  const g = Math.max(6, Math.round(Math.min(w, h) * 0.009));
  const rects = panelRects(state.layout, w, h, g);
  return rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}
