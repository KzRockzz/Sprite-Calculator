// app.js — Calculator + Items + History wired with theme variable
import { get as dbGet, set as dbSet, KEYS } from './modules/storage.js';
import { initCalculator } from './modules/calculator.js';
import { initItems } from './modules/items.js';
import { initHistory } from './modules/history.js';

const qs  = (s, r=document) => r.querySelector(s);

// ---------- State kept in IndexedDB
const state = {
  items: [],
  recentSearches: [],
  recentItems: [],
  calc: { lines: [], total: 0 },
  bills: [],
  settings: { fontScale: 1, accent: '#59d1ff' },
  theme: 'dark'
};

// ---------- Theme toggle + field background variable
const themeBtn = qs('#themeBtn');
function applyTheme(t) {
  document.body.classList.toggle('light', t==='light');
  document.body.classList.toggle('dark', t!=='light');
  // Inputs use --field-bg via var() for theme-aware background
  const fieldBg = t==='light' ? 'rgba(0,0,0,.04)' : 'rgba(255,255,255,.05)';
  document.documentElement.style.setProperty('--field-bg', fieldBg); // CSS custom property for inputs [4][6]
  if (themeBtn?.querySelector('.only')) {
    themeBtn.querySelector('.only').textContent = t==='light' ? '☀️' : '🌙'; // simple icon swap [12]
  }
}
themeBtn?.addEventListener('click', async () => {
  state.theme = (state.theme==='dark' ? 'light' : 'dark'); // flip theme [12]
  applyTheme(state.theme); // re-apply classes and vars [4]
  try { await dbSet(KEYS.theme, state.theme); } catch {} // persist theme [15]
});

// ---------- Settings
function applySettings() {
  document.documentElement.style.setProperty('--font-scale', state.settings.fontScale); // scale text [4]
  document.documentElement.style.setProperty('--accent', state.settings.accent); // accent color [4]
}

// ---------- Generic modal wiring
document.addEventListener('click', (e)=>{
  const openId = e.target.getAttribute('data-open');
  if (openId) { qs(`#${openId}`)?.classList.add('open'); } // open modal [12]
  const closeId = e.target.getAttribute('data-close');
  if (closeId) { qs(`#${closeId}`)?.classList.remove('open'); } // close modal [12]
  if (e.target.classList.contains('backdrop')) {
    const id = e.target.getAttribute('data-close');
    if (id) qs(`#${id}`)?.classList.remove('open'); // backdrop close [12]
  }
}); // event delegation for modal triggers [12]

// ---------- Keyboard lift for mobile
(function keyboardLift(){
  function setKb(px){ document.documentElement.style.setProperty('--kb', Math.max(0, px) + 'px'); } // adjust CSS var [16]
  if ('virtualKeyboard' in navigator) {
    try {
      navigator.virtualKeyboard.overlaysContent = true;
      navigator.virtualKeyboard.addEventListener('geometrychange', (e)=> setKb(e.target.boundingRect.height||0) ); // geometrychange [17]
    } catch(e){}
  }
  if (window.visualViewport){
    const vv = window.visualViewport;
    const onVv = ()=> setKb( Math.max(0, (window.innerHeight - (vv.height||window.innerHeight))) ); // account for viewport inset [18]
    vv.addEventListener('resize', onVv); // update on resize [19]
    vv.addEventListener('scroll', onVv); // update on scroll [16]
  }
})();

// ---------- Load persisted state then mount modules
async function loadAll() {
  try {
    const [items, rSearch, rItems, calc, bills, settings, theme] = await Promise.all([
      dbGet(KEYS.items), dbGet(KEYS.recentSearches), dbGet(KEYS.recentItems),
      dbGet(KEYS.calc), dbGet(KEYS.bills), dbGet(KEYS.settings), dbGet(KEYS.theme)
    ]); // parallel IndexedDB reads [15]
    if (Array.isArray(items)) state.items = items; // items list [15]
    if (Array.isArray(rSearch)) state.recentSearches = rSearch; // recents [15]
    if (Array.isArray(rItems)) state.recentItems = rItems; // recents [15]
    if (calc && Array.isArray(calc.lines)) state.calc = calc; // bill [15]
    if (Array.isArray(bills)) state.bills = bills.slice(0,20); // cap history [15]
    if (settings) Object.assign(state.settings, settings); // apply settings [15]
    if (theme === 'light' || theme === 'dark') state.theme = theme; // apply theme [15]
  } catch {}

  applyTheme(state.theme); // set classes and field var [4]
  applySettings(); // set scale and accent [4]

  // Mount base UI
  initCalculator(document.getElementById('calcMount'), state); // calculator UI [12]
  initItems(document.getElementById('listMount'), state); // items + dropdowns [12]
  initHistory(state); // history modal + export [10]
}

// ---------- Service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(()=>{}); // register SW [10][13]
  });
}

// ---------- Boot
loadAll(); // start app [12]
