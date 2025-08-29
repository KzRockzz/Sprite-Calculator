// app.js — Calculator + Items + History wired with theme variables and keyboard lift
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

// ---------- Theme toggle + CSS variables for inputs and text
const themeBtn = qs('#themeBtn');
function applyTheme(t) {
  document.body.classList.toggle('light', t==='light'); // set body class for light [14]
  document.body.classList.toggle('dark', t!=='light');   // set body class for dark [14]
  // Inputs use CSS custom properties with var() so styles adapt per theme [4][6]
  const fieldBg = t==='light' ? '#ffffff' : 'rgba(255,255,255,.05)';
  const fg      = t==='light' ? '#101418' : '#e8eaed';
  document.documentElement.style.setProperty('--field-bg', fieldBg); // themable field background [4]
  document.documentElement.style.setProperty('--fg', fg);            // themable foreground color [4]
  const only = themeBtn?.querySelector('.only');
  if (only) only.textContent = t==='light' ? '☀️' : '🌙'; // simple icon swap [14]
}
themeBtn?.addEventListener('click', async () => {
  state.theme = (state.theme==='dark' ? 'light' : 'dark'); // flip theme mode [14]
  applyTheme(state.theme);                                  // apply CSS variables and classes [4]
  try { await dbSet(KEYS.theme, state.theme); } catch {}    // persist choice in IndexedDB [16]
});

// ---------- Settings
function applySettings() {
  document.documentElement.style.setProperty('--font-scale', state.settings.fontScale); // font scaling via var() [4]
  document.documentElement.style.setProperty('--accent', state.settings.accent);        // accent color via var() [4]
}

// ---------- Generic modal wiring
document.addEventListener('click', (e)=>{
  const openId = e.target.getAttribute('data-open');
  if (openId) { qs(`#${openId}`)?.classList.add('open'); } // open modal by id [14]
  const closeId = e.target.getAttribute('data-close');
  if (closeId) { qs(`#${closeId}`)?.classList.remove('open'); } // close modal by id [14]
  if (e.target.classList.contains('backdrop')) {
    const id = e.target.getAttribute('data-close');
    if (id) qs(`#${id}`)?.classList.remove('open'); // backdrop click closes modal [14]
  }
}); // recommended addEventListener usage for delegated UI events [14]

// ---------- Keyboard lift (VisualViewport & VirtualKeyboard)
(function keyboardLift(){
  function setKb(px){ document.documentElement.style.setProperty('--kb', Math.max(0, px) + 'px'); } // set CSS var [4]
  if ('virtualKeyboard' in navigator) {
    try {
      navigator.virtualKeyboard.overlaysContent = true;
      navigator.virtualKeyboard.addEventListener('geometrychange', (e)=> setKb(e.target.boundingRect.height||0) ); // lift on geometry change [17]
    } catch(e){}
  }
  if (window.visualViewport){
    const vv = window.visualViewport;
    const onVv = ()=> setKb( Math.max(0, (window.innerHeight - (vv.height||window.innerHeight))) ); // compute inset [18]
    vv.addEventListener('resize', onVv);  // update when viewport resizes [19]
    vv.addEventListener('scroll', onVv);  // update on scroll [20]
  }
})();

// ---------- Load persisted state then mount modules
async function loadAll() {
  try {
    const [items, rSearch, rItems, calc, bills, settings, theme] = await Promise.all([
      dbGet(KEYS.items), dbGet(KEYS.recentSearches), dbGet(KEYS.recentItems),
      dbGet(KEYS.calc), dbGet(KEYS.bills), dbGet(KEYS.settings), dbGet(KEYS.theme)
    ]); // parallel IndexedDB reads [16]
    if (Array.isArray(items)) state.items = items;                         // items [16]
    if (Array.isArray(rSearch)) state.recentSearches = rSearch;            // recent searches [16]
    if (Array.isArray(rItems)) state.recentItems = rItems;                 // recent items [16]
    if (calc && Array.isArray(calc.lines)) state.calc = calc;              // current bill [16]
    if (Array.isArray(bills)) state.bills = bills.slice(0,20);             // history cap [16]
    if (settings) Object.assign(state.settings, settings);                 // settings [16]
    if (theme === 'light' || theme === 'dark') state.theme = theme;        // theme [16]
  } catch {}

  applyTheme(state.theme);  // set CSS variables and classes for theme [4]
  applySettings();          // set font scale and accent [4]

  // Mount UI modules
  initCalculator(document.getElementById('calcMount'), state); // calculator + totals [14]
  initItems(document.getElementById('listMount'), state);      // list + dropdown chips/converter [14]
  initHistory(state);                                          // history modal + export/import [10]
}

// ---------- Service worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(()=>{}); // register SW on load [15]
  });
}

// ---------- Boot
loadAll(); // start app after state hydration [14]
