// app.js — Bill page + Bottom-sheet Search wired
import { get as dbGet, set as dbSet, KEYS } from './modules/storage.js';
import { initCalculator } from './modules/calculator.js';
import { initItems } from './modules/items.js';
import { initHistory } from './modules/history.js';
import { initSearchSheet } from './modules/search_sheet.js';

const qs  = (s, r=document) => r.querySelector(s);

// ---------- State
const state = {
  items: [],
  recentSearches: [],
  recentItems: [],
  calc: { lines: [], total: 0 },
  bills: [],
  settings: { fontScale: 1, accent: '#59d1ff' },
  theme: 'dark'
};

// ---------- Theme + tokens for bill vs sheet
const themeBtn = qs('#themeBtn');
function applyTheme(t) {
  document.body.classList.toggle('light', t==='light');
  document.body.classList.toggle('dark', t!=='light');
  const fieldBg = t==='light' ? '#ffffff' : 'rgba(255,255,255,.05)';
  const fg      = t==='light' ? '#101418' : '#e8eaed';
  // slightly different surface for the sheet
  const surfaceBill  = t==='light' ? '#f6f7fb' : '#0b101b';
  const surfaceSheet = t==='light' ? '#ffffff' : '#0e1320';
  document.documentElement.style.setProperty('--field-bg', fieldBg);
  document.documentElement.style.setProperty('--fg', fg);
  document.documentElement.style.setProperty('--surface-bill', surfaceBill);
  document.documentElement.style.setProperty('--surface-sheet', surfaceSheet);
  const only = themeBtn?.querySelector('.only');
  if (only) only.textContent = t==='light' ? '☀️' : '🌙';
}
themeBtn?.addEventListener('click', async () => {
  state.theme = (state.theme==='dark' ? 'light' : 'dark');
  applyTheme(state.theme);
  try { await dbSet(KEYS.theme, state.theme); } catch {}
});

// ---------- Settings
function applySettings() {
  document.documentElement.style.setProperty('--font-scale', state.settings.fontScale);
  document.documentElement.style.setProperty('--accent', state.settings.accent);
}

// ---------- Modal open/close (generic)
document.addEventListener('click', (e)=>{
  const openId = e.target.getAttribute('data-open');
  if (openId) { qs(`#${openId}`)?.classList.add('open'); }
  const closeId = e.target.getAttribute('data-close');
  if (closeId) { qs(`#${closeId}`)?.classList.remove('open'); }
  if (e.target.classList.contains('backdrop')) {
    const id = e.target.getAttribute('data-close');
    if (id) qs(`#${id}`)?.classList.remove('open');
  }
});

// ---------- Keyboard lift (shared var --kb)
(function keyboardLift(){
  function setKb(px){ document.documentElement.style.setProperty('--kb', Math.max(0, px) + 'px'); }
  if ('virtualKeyboard' in navigator) {
    try {
      navigator.virtualKeyboard.overlaysContent = true;
      navigator.virtualKeyboard.addEventListener('geometrychange', (e)=> setKb(e.target.boundingRect.height||0) );
    } catch(e){}
  }
  if (window.visualViewport){
    const vv = window.visualViewport;
    const onVv = ()=> setKb( Math.max(0, (window.innerHeight - (vv.height||window.innerHeight))) );
    vv.addEventListener('resize', onVv);
    vv.addEventListener('scroll', onVv);
  }
})();

// ---------- Load then mount
async function loadAll() {
  try {
    const [items, rSearch, rItems, calc, bills, settings, theme] = await Promise.all([
      dbGet(KEYS.items), dbGet(KEYS.recentSearches), dbGet(KEYS.recentItems),
      dbGet(KEYS.calc), dbGet(KEYS.bills), dbGet(KEYS.settings), dbGet(KEYS.theme)
    ]);
    if (Array.isArray(items)) state.items = items;
    if (Array.isArray(rSearch)) state.recentSearches = rSearch;
    if (Array.isArray(rItems)) state.recentItems = rItems;
    if (calc && Array.isArray(calc.lines)) state.calc = calc;
    if (Array.isArray(bills)) state.bills = bills.slice(0,20);
    if (settings) Object.assign(state.settings, settings);
    if (theme === 'light' || theme === 'dark') state.theme = theme;
  } catch {}

  applyTheme(state.theme);
  applySettings();

  // Bill page stays stable
  initCalculator(document.getElementById('calcMount'), state);
  initItems(document.getElementById('listMount'), state);
  initHistory(state);

  // Search bottom sheet (opens on tapping search box or FAB)
  initSearchSheet(state);
}

// ---------- Service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  });
}

// ---------- Boot
loadAll();
