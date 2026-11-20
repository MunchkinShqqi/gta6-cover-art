// Vice Cover Studio — wires the page: pick photos, arrange the panels, write
// the caption, pick a grade and an export size, export the cover as a PNG.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).
import { drawCover, panelAt, LAYOUTS, SIZES, GRADES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const captionInput = document.getElementById('caption');
const subcaptionInput = document.getElementById('subcaption');
const status = document.getElementById('status');
const tray = document.getElementById('tray');
const panelPhoto = document.getElementById('panel-photo');
const zoomSlider = document.getElementById('zoom');
const panXSlider = document.getElementById('pan-x');
const panYSlider = document.getElementById('pan-y');
const selectedLabel = document.getElementById('selected-panel');

const photos = new Map(); // id -> HTMLImageElement
let uploadCount = 0;

function defaultPanel(photo) {
  return { photo, zoom: 1, ox: 0, oy: 0 };
}

const state = {
  layout: 'poster',
  size: '1080x1080',
  caption: 'BOULEVARD QUEEN',
  subcaption: 'NEON NIGHTS',
  captionPos: 'bottom',
  grade: 'sunset',
  panels: [defaultPanel('boulevard'), defaultPanel('pier'), defaultPanel('boulevard')],
};
state.panels[0].zoom = 1.05;
state.panels[0].oy = 1.05;
state.panels[1].zoom = 1.2;
state.panels[1].oy = 1.07;
state.panels[2].zoom = 1.7;
state.panels[2].ox = 0.08;
state.panels[2].oy = 0.06;

let selected = 0;

function previewSize() {
  const { w, h } = SIZES[state.size];
  const long = 900;
  const scale = long / Math.max(w, h);
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

function redraw() {
  const { w, h } = previewSize();
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  drawCover(canvas, state, photos);
  syncPanelControls();
}

function syncPanelControls() {
  const panel = state.panels[selected];
  if (!panel) return;
  selectedLabel.textContent = `Panel ${selected + 1} / ${state.panels.length}`;
  panelPhoto.value = panel.photo;
  zoomSlider.value = String(panel.zoom);
  panXSlider.value = String(Math.round(panel.ox * 100));
  panYSlider.value = String(Math.round(panel.oy * 100));
  document.querySelectorAll('#tray [data-photo]').forEach((el) => {
    el.classList.toggle('active', el.dataset.photo === panel.photo);
  });
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function addPhoto(id, url) {
  const img = await loadImage(url);
  photos.set(id, img);
  return img;
}

function rebuildTray() {
  tray.querySelectorAll('[data-photo]').forEach((el) => el.remove());
  for (const [id, img] of photos) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'thumb';
    button.dataset.photo = id;
    button.title = id;
    const thumb = document.createElement('img');
    thumb.src = img.src;
    thumb.alt = id;
    button.appendChild(thumb);
    button.addEventListener('click', () => {
      state.panels[selected].photo = id;
      redraw();
    });
    tray.appendChild(button);
  }
  const options = [...photos.keys()].map((id) => `<option value="${id}">${id}</option>`).join('');
  panelPhoto.innerHTML = options;
  syncPanelControls();
}

function setLayout(layout) {
  const count = LAYOUTS[layout].panels;
  const keep = state.panels.slice(0, count);
  while (keep.length < count) keep.push(defaultPanel(state.panels[0]?.photo ?? 'boulevard'));
  state.layout = layout;
  state.panels = keep;
  selected = 0;
  document.querySelectorAll('[data-layout]').forEach((el) => {
    el.classList.toggle('active', el.dataset.layout === layout);
  });
  redraw();
}

function setGrade(grade) {
  state.grade = grade;
  document.querySelectorAll('[data-grade]').forEach((el) => {
    el.classList.toggle('active', el.dataset.grade === grade);
  });
  redraw();
}

function setSize(size) {
  state.size = size;
  document.querySelectorAll('[data-size]').forEach((el) => {
    el.classList.toggle('active', el.dataset.size === size);
  });
  redraw();
}

/** Renders the cover at exactly w x h and returns it as a PNG data URL. */
export function exportPNG(w, h) {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off, state, photos);
  return off.toDataURL('image/png');
}
window.__exportPNG = exportPNG;

function exportCurrentSize() {
  const { w, h } = SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off, state, photos);
  off.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cover-${w}x${h}.png`;
    a.click();
    status.textContent = `Saved cover-${w}x${h}.png`;
  }, 'image/png');
}

// --- canvas interaction: click a panel to select it, drag to pan, wheel to zoom
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const hit = panelAt(state, canvas.width, canvas.height, p.x, p.y);
  if (hit === -1) return;
  selected = hit;
  const panel = state.panels[hit];
  drag = { x: p.x, y: p.y, ox: panel.ox, oy: panel.oy, rect: null };
  canvas.setPointerCapture(e.pointerId);
  syncPanelControls();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const panel = state.panels[selected];
  const rect = { w: canvas.width, h: canvas.height };
  panel.ox = drag.ox + (p.x - drag.x) / rect.w;
  panel.oy = drag.oy + (p.y - drag.y) / rect.h;
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[selected];
  panel.zoom = Math.max(1, Math.min(4, panel.zoom * Math.exp(-e.deltaY * 0.0012)));
  redraw();
}, { passive: false });

// --- controls
document.querySelectorAll('[data-layout]').forEach((el) => {
  el.addEventListener('click', () => setLayout(el.dataset.layout));
});
document.querySelectorAll('[data-grade]').forEach((el) => {
  el.addEventListener('click', () => setGrade(el.dataset.grade));
});
document.querySelectorAll('[data-size]').forEach((el) => {
  el.addEventListener('click', () => setSize(el.dataset.size));
});
document.querySelectorAll('[data-pos]').forEach((el) => {
  el.addEventListener('click', () => {
    state.captionPos = el.dataset.pos;
    document.querySelectorAll('[data-pos]').forEach((b) => {
      b.classList.toggle('active', b.dataset.pos === state.captionPos);
    });
    redraw();
  });
});
captionInput.addEventListener('input', () => { state.caption = captionInput.value; redraw(); });
subcaptionInput.addEventListener('input', () => { state.subcaption = subcaptionInput.value; redraw(); });
panelPhoto.addEventListener('change', () => {
  state.panels[selected].photo = panelPhoto.value;
  redraw();
});
zoomSlider.addEventListener('input', () => {
  state.panels[selected].zoom = Number(zoomSlider.value);
  redraw();
});
panXSlider.addEventListener('input', () => {
  state.panels[selected].ox = Number(panXSlider.value) / 100;
  redraw();
});
panYSlider.addEventListener('input', () => {
  state.panels[selected].oy = Number(panYSlider.value) / 100;
  redraw();
});
document.getElementById('fill-all').addEventListener('click', () => {
  const photo = state.panels[selected].photo;
  state.panels.forEach((panel) => { panel.photo = photo; });
  redraw();
});
document.getElementById('export').addEventListener('click', exportCurrentSize);
document.getElementById('photo').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    uploadCount += 1;
    const id = `photo-${uploadCount}`;
    await addPhoto(id, URL.createObjectURL(file));
  }
  rebuildTray();
  redraw();
});

// --- start: load the sample photos, then draw (or run a screenshot scene)
async function start() {
  await addPhoto('boulevard', 'samples/boulevard.jpg');
  await addPhoto('pier', 'samples/pier.jpg');
  rebuildTray();
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  if (shot) {
    await runShot(shot, params, { state, photos, setLayout, setGrade, setSize, redraw, addPhoto });
  } else {
    redraw();
  }
}
start();
