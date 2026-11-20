// Fixed scenes for screenshots: ?shot=editor shows the page with a sample
// photo; ?shot=cover shows the cover alone at the export size named by
// `size`. `photo` picks the sample for every panel, `caption` and `sub` the
// words, `layout` and `grade` the look. window.__shotReady is set once painted.
export async function runShot(shot, query, api) {
  const { state, setLayout, setGrade, setSize, redraw } = api;
  const caption = query.get('caption') ?? 'SUNSET HEIST';
  const sub = query.get('sub') ?? 'NEON NIGHTS';
  const photo = query.get('photo') ?? 'pier';
  const layout = query.get('layout') ?? 'poster';
  const grade = query.get('grade') ?? 'sunset';
  const size = query.get('size') ?? '1080x1080';
  document.getElementById('caption').value = caption;
  document.getElementById('subcaption').value = sub;
  state.caption = caption;
  state.subcaption = sub;
  setSize(size);
  setGrade(grade);
  setLayout(layout);
  const perPanel = (query.get('photos') ?? '').split(',').filter(Boolean);
  state.panels.forEach((panel, i) => {
    panel.photo = perPanel.length === state.panels.length ? perPanel[i] : photo;
  });
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    document.getElementById('cover').style.aspectRatio = 'auto';
  }
  redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
