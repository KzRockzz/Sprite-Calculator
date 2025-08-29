// modules/search_sheet.js
import { setMiniFromItems, addToMiniFromItems, addLineFromItems, onMiniChange, formatMoney } from './calculator.js';
import { get as dbGet, set as dbSet, KEYS } from './storage.js';

const qs  = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];

const DEFAULT_WEIGHT = [50,100,500,1000];

// ---------- Create the bottom sheet once ----------
function ensureSheetDOM(){
  if (qs('#sheetScrim')) return;
  const scrim = document.createElement('div');
  scrim.id = 'sheetScrim';
  scrim.style.cssText = `
    position:fixed;inset:0;display:none;z-index:900;
    background:rgba(0,0,0,.45);
  `;
  const panel = document.createElement('div');
  panel.id = 'sheetPanel';
  panel.style.cssText = `
    position:fixed;left:0;right:0;bottom:0;z-index:901;
    border-radius:14px 14px 0 0;box-shadow:0 -10px 24px rgba(0,0,0,.35);
    background:var(--surface-sheet, #0e1320);color:var(--fg, #e8eaed);
    transform:translateY(100%);transition:transform .2s ease-out;
    max-height:calc(70vh - var(--kb,0px));display:grid;grid-template-rows:auto 1fr;gap:8px;padding:10px 10px 12px;
  `;
  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px">
      <div style="height:4px;width:40px;border-radius:999px;background:rgba(255,255,255,.2);margin:0 auto 4px auto"></div>
    </div>
    <div style="display:grid;grid-template-rows:auto 1fr;gap:8px;min-height:0">
      <div style="display:flex;gap:8px">
        <input id="sheetQuery" placeholder="Search items…" inputmode="search"
               style="flex:1;border-radius:10px;border:1px solid rgba(255,255,255,.12);
                      background:var(--field-bg, rgba(255,255,255,.05));color:var(--fg, #e8eaed);padding:8px 10px" />
        <button class="small-btn" id="sheetClose">✕</button>
      </div>
      <div id="sheetList" style="overflow:auto;min-height:0"></div>
    </div>
  `;
  document.body.append(scrim, panel);

  scrim.addEventListener('click', closeSheet, { passive:true }); // isolated click close [2]
  qs('#sheetClose')?.addEventListener('click', closeSheet); // explicit close [2]
}

function openSheet(){
  ensureSheetDOM();
  qs('#sheetScrim').style.display = 'block';
  qs('#sheetPanel').style.transform = 'translateY(0)';
  setTimeout(()=>qs('#sheetQuery')?.focus(),20); // focus after transition [2]
}
function closeSheet(){
  const scr = qs('#sheetScrim'); const pan = qs('#sheetPanel');
  if(!scr||!pan) return;
  pan.style.transform = 'translateY(100%)';
  setTimeout(()=>{ scr.style.display='none'; }, 180); // graceful hide [2]
}

// ---------- Helpers ----------
function gramsToPrice(sp, g){ return (Number(sp)||0) * (g/1000); } // converter core [2]
function rupeeRound(x){ const n=Number(x)||0; const r=Math.floor(n); const p=Math.round((n-r)*100); return p>=90? r+1 : r; } // rounding [2]
function normalizeGramEntry(entry){
  let val=entry;
  if(entry&&typeof entry==='object'){ val=('val'in entry)?entry.val:('value'in entry?entry.value:entry); }
  const grams=Math.max(0,parseFloat(val)||0);
  const label=grams===1000?'1kg':`${grams}g`;
  return { grams, label };
} // chip label [2]
function displayNameOf(it){
  const idx=Number(it.showNameIdx||0)%3;
  const names=[it.name1||'', it.name2||'', it.name3||''];
  return names[idx] || it.name1 || it.name2 || it.name3 || '';
} // name cycle [2]

// ---------- Render results inside the sheet ----------
function renderResults(state){
  const list = qs('#sheetList'); if(!list) return;
  const q = (qs('#sheetQuery')?.value || '').trim().toLowerCase();
  const base = Array.isArray(state.items) ? state.items : [];
  const filtered = q ? base.filter(it=>{
    const n1=(it.name1||'').toLowerCase(), n2=(it.name2||'').toLowerCase(), n3=(it.name3||'').toLowerCase();
    return n1.includes(q)||n2.includes(q)||n3.includes(q);
  }) : base; // guarded filtering [2]

  list.innerHTML = '';
  if(!filtered.length){
    const empty = document.createElement('div');
    empty.className='small-muted';
    empty.style.cssText='text-align:center;padding:14px 0';
    empty.textContent = q ? 'No matches.' : 'Start typing to search.';
    list.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();

  filtered.forEach((it)=>{
    if (typeof it.showNameIdx!=='number') it.showNameIdx = 0;

    const item=document.createElement('div');
    item.style.cssText='padding:10px 8px;border-radius:10px;background:rgba(255,255,255,.03);margin-bottom:10px;display:grid;gap:6px';

    // Header with caret toggle only (no name click)
    const head=document.createElement('div');
    head.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:8px';
    head.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1">
        <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700">${displayNameOf(it)}</div>
        <button class="small-btn" data-toggle="${it.id}" title="Open/close">▾</button>
        <button class="small-btn" data-cycle="${it.id}" title="Toggle name">↻</button>
      </div>
      <div style="display:flex;gap:6px">
        <button class="small-btn" data-edit="${it.id}">✏️</button>
      </div>
    `;
    item.appendChild(head);

    // Collapsible box
    const box=document.createElement('div');
    box.id = 'd-'+it.id;
    box.style.cssText='display:none;gap:8px;flex-direction:column';
    item.appendChild(box);

    head.querySelector('[data-toggle]')?.addEventListener('click', (e)=>{
      e.stopPropagation(); e.preventDefault();
      box.style.display = (box.style.display!=='none') ? 'none' : 'grid'; // isolated toggle [2]
    });

    // Chips
    const sp=+it.sprice||0;
    const chips=document.createElement('div');
    chips.style.cssText='display:flex;gap:6px;overflow:auto;padding:2px 0';
    const weights=(it.presets?.weight?.length? it.presets.weight : DEFAULT_WEIGHT);
    weights.forEach(entry=>{
      const { grams, label } = normalizeGramEntry(entry);
      if(grams<=0) return;
      const amount = rupeeRound(gramsToPrice(sp, grams));
      const b=document.createElement('button'); b.className='small-btn'; b.textContent=`${label}\n₹${amount}`;
      b.style.whiteSpace='pre';
      b.addEventListener('click', ()=> addToMiniFromItems(amount) ); // accumulate [2]
      chips.appendChild(b);
    });
    box.appendChild(chips);

    // Converter
    const conv=document.createElement('div');
    conv.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap';
    conv.innerHTML = `
      <label style="display:flex;align-items:center;gap:6px">
        <span>₹</span>
        <input type="number" inputmode="decimal" min="0" step="0.01" data-p="${it.id}"
               style="width:110px;border-radius:9px;border:1px solid rgba(255,255,255,.12);
                      background:var(--field-bg);color:var(--fg);padding:6px 8px" />
      </label>
      <label style="display:flex;align-items:center;gap:6px">
        <span>g</span>
        <input type="number" inputmode="numeric" min="0" step="1" data-g="${it.id}"
               style="width:110px;border-radius:9px;border:1px solid rgba(255,255,255,.12);
                      background:var(--field-bg);color:var(--fg);padding:6px 8px" />
      </label>
      <div class="mini-mirror" style="margin-left:auto;font-weight:800">${formatMoney(0)}</div>
      <button class="small-btn" data-add="${it.id}">＋</button>
      <button class="small-btn" data-clear="${it.id}">−</button>
    `;
    box.appendChild(conv);

    const pInput = conv.querySelector('[data-p]');
    const gInput = conv.querySelector('[data-g]');
    const mirror = conv.querySelector('.mini-mirror');

    let lastMini=0;
    const off = onMiniChange(v => { lastMini = v; mirror.innerHTML = formatMoney(v); }); // pub/sub [2]

    conv.addEventListener('input', (e)=>{
      if(e.target.hasAttribute('data-p')){
        const p=parseFloat(e.target.value)||0;
        setMiniFromItems(p);
      } else if(e.target.hasAttribute('data-g')){
        const g=parseFloat(e.target.value)||0;
        setMiniFromItems(gramsToPrice(sp, g));
      }
    }); // live update [2]

    conv.addEventListener('click', (e)=>{
      const add=e.target.getAttribute('data-add');
      const clr=e.target.getAttribute('data-clear');
      if(add){
        const typed = parseFloat(pInput?.value);
        const miniAmt = rupeeRound(lastMini||0);
        const amt = (miniAmt>0) ? miniAmt : ((!isNaN(typed)&&typed>0)? rupeeRound(typed) : 0);
        if(amt>0){
          addLineFromItems({ itemName: displayNameOf(it), grams: (parseFloat(gInput?.value)||null), price: amt });
          if(pInput) pInput.value=''; if(gInput) gInput.value='';
          setMiniFromItems(0);
        }
        return;
      }
      if(clr){
        if(pInput) pInput.value=''; if(gInput) gInput.value='';
        setMiniFromItems(0);
      }
    }); // actions [2]

    head.querySelector('[data-cycle]')?.addEventListener('click', async ()=>{
      it.showNameIdx = ((Number(it.showNameIdx)||0) + 1) % 3;
      await dbSet(KEYS.items, state.items).catch(()=>{});
      renderResults(state);
    });

    frag.appendChild(item);
  });

  list.appendChild(frag);
}

// ---------- Keyboard lift for sheet ----------
function setupViewportLift(){
  if(!window.visualViewport) return;
  const vv = window.visualViewport;
  const onVv = ()=>{
    const kb = Math.max(0, (window.innerHeight - (vv.height||window.innerHeight)));
    document.documentElement.style.setProperty('--kb', kb + 'px');
    const pan = qs('#sheetPanel');
    if(pan){ pan.style.maxHeight = `calc(70vh - var(--kb,0px))`; }
  };
  vv.addEventListener('resize', onVv);
  vv.addEventListener('scroll', onVv);
  onVv();
} // keep above keyboard [4][5]

// ---------- Public init ----------
export function initSearchSheet(state){
  ensureSheetDOM();
  setupViewportLift();

  const footerSearch = qs('#searchInput');

  // Open sheet only when there is text typed in the footer search;
  // keep the footer and sheet queries in sync both ways. [MDN addEventListener]
  function syncFromFooter(){
    const val = (footerSearch?.value || '').trim();
    const sq = qs('#sheetQuery');
    if(sq && sq.value !== val) sq.value = val;
    if(val.length>0){ openSheet(); renderResults(state); }
    else { closeSheet(); }
  }
  function syncFromSheet(){
    const sq = qs('#sheetQuery'); if(!sq) return;
    if(footerSearch && footerSearch.value !== sq.value) footerSearch.value = sq.value;
    if((sq.value||'').trim().length>0){ renderResults(state); }
    else { closeSheet(); }
  }

  footerSearch?.addEventListener('input', syncFromFooter, { passive:true }); // open/close by typing [2]
  qs('#sheetQuery')?.addEventListener('input', syncFromSheet, { passive:true }); // keep in sync [2]

  // Initial render (closed until text exists)
  renderResults(state);

  return { open:()=>{}, close: closeSheet, rerender: ()=>renderResults(state) };
}
