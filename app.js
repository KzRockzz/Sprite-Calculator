// app.js (ES module) — Step 2 + Calculator base mounted
import { get as dbGet, set as dbSet, KEYS } from './modules/storage.js';
import { initCalculator } from './modules/calculator.js';

const qs  = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];

// ---------- State skeleton (will expand next steps)
const state = {
  items: [],
  recentSearches: [],
  recentItems: [],
  calc: { lines: [], total: 0 },
  bills: [],
  settings: { fontScale: 1, accent: '#59d1ff' },
  theme: 'dark'
};

// ---------- Theme toggle
const themeBtn = qs('#themeBtn');
function applyTheme(t) {
  document.body.classList.toggle('light', t==='light');
  document.body.classList.toggle('dark', t!=='light');
  if (themeBtn?.querySelector('.only')) {
    themeBtn.querySelector('.only').textContent = t==='light' ? '☀️' : '🌙';
  }
}
themeBtn?.addEventListener('click', async () => {
  state.theme = (state.theme==='dark' ? 'light' : 'dark');
  applyTheme(state.theme);
  try { await dbSet(KEYS.theme, state.theme); } catch {}
});

// ---------- Settings helpers
function applySettings() {
  document.documentElement.style.setProperty('--font-scale', state.settings.fontScale);
  document.documentElement.style.setProperty('--accent', state.settings.accent);
}

// ---------- Simple modal wiring
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

// ---------- Keyboard lift via VisualViewport + VirtualKeyboard
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

// ---------- Load persisted state, then render shell + calculator
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

  // Mount calculator as the base UI
  initCalculator(document.getElementById('calcMount'), state);
}

// ---------- Service worker register
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  });
}

// ---------- Boot
loadAll();
