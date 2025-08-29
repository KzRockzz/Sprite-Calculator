// modules/calculator.js
import { get as dbGet, set as dbSet, KEYS } from './storage.js';

/* FP‑safe rounding: floor unless fractional ≥ 90 paise */
function rupeeRound(x){
  const n = Number(x) || 0;
  const r = Math.floor(n);
  const p = Math.round((n - r) * 100);
  return p >= 90 ? r + 1 : r;
}
export function formatMoney(n){
  const v = (Number(n)||0).toFixed(2);
  const [a,b] = v.split('.');
  return `₹${a}<span class="dec">.${b}</span>`;
}

/* Shared refs */
let stateRef = null;
let els = null;
let mini = 0;

/* Mini change subscribers for dropdown mirrors */
const miniSubs = new Set();
function emitMini(){ miniSubs.forEach(fn=>{ try{ fn(mini); }catch{} }); }
export function onMiniChange(cb){ miniSubs.add(cb); try{ cb(mini); }catch{} return ()=>miniSubs.delete(cb); }

/* Public helpers used by items.js */
export function setMiniFromItems(amount){
  mini = Math.max(0, rupeeRound(amount||0));
  if (els?.miniView && els?.miniAdd){
    els.miniView.innerHTML = formatMoney(mini);
    els.miniAdd.disabled = mini <= 0;
  }
  emitMini();
}
export function addToMiniFromItems(delta){
  mini = Math.max(0, rupeeRound((mini||0) + (Number(delta)||0)));
  if (els?.miniView && els?.miniAdd){
    els.miniView.innerHTML = formatMoney(mini);
    els.miniAdd.disabled = mini <= 0;
  }
  emitMini();
}
export function addLineFromItems({ itemName, grams=null, price=null }={}){
  if(!stateRef) return;
  const lineTotal = rupeeRound(price ?? 0);
  stateRef.calc.lines.push({ itemName: itemName || 'Item', grams, price, lineTotal });
  renderList();
}

/* Internal render */
function renderList(){
  if(!els || !stateRef) return;
  let total = 0;
  els.list.innerHTML = '';
  const frag = document.createDocumentFragment();

  stateRef.calc.lines.forEach((ln, idx)=>{
    total += ln.lineTotal;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08);padding:8px 0;gap:8px';

    const left = document.createElement('div');
    left.style.cssText='flex:1;min-width:0';
    left.innerHTML = `
      <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ln.itemName}</div>
      <div class="small-muted">${ln.grams? (ln.grams+'g') : ''} ${ln.grams&&ln.price? '•' : ''} ${ln.price? ('₹'+ln.price) : ''}</div>
    `; /* innerHTML updates the DOM subtree; safe here with known strings. [2] */

    const right = document.createElement('div');
    right.style.cssText='display:flex;align-items:center;gap:8px';
    right.innerHTML = `<div>${formatMoney(ln.lineTotal)}</div><button class="small-btn" data-del="${idx}">✕</button>`;

    row.append(left, right); /* createElement/appendChild pattern. [12] */
    frag.appendChild(row);
  });

  stateRef.calc.total = total;
  els.list.appendChild(frag);
  els.total.innerHTML = formatMoney(total);
  dbSet(KEYS.calc, stateRef.calc).catch(()=>{});
}

/* Long‑press keypad for main ＋ */
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function showMultiplierPad(anchorBtn, baseValue){
  if(!baseValue || baseValue<=0) return;

  const pad = document.createElement('div');
  pad.setAttribute('role','dialog');
  pad.style.cssText = `
    position:fixed; z-index:1000;
    background:#11151f; color:#e8eaed;
    border:1px solid rgba(255,255,255,.12);
    border-radius:10px; box-shadow:0 10px 24px rgba(0,0,0,.35);
    padding:8px; width:180px;
  `;
  const title = document.createElement('div');
  title.style.cssText='font-weight:700; font-size:.9rem; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center';
  title.innerHTML = `<span>Multiply</span><button class="small-btn" data-close>✕</button>`;
  pad.appendChild(title);

  const grid = document.createElement('div');
  grid.style.cssText='display:grid; grid-template-columns:repeat(3,1fr); gap:6px';
  const keys = ['1','2','3','4','5','6','7','8','9','0','C','10'];
  keys.forEach(k=>{
    const b=document.createElement('button');
    b.className='small-btn';
    b.textContent=(k==='10'?'×10':k);
    b.setAttribute('data-k', k);
    b.style.height='36px';
    grid.appendChild(b);
  });
  pad.appendChild(grid);

  const r = anchorBtn.getBoundingClientRect(); /* geometry for placement. [17] */
  const W=180, H=180;
  let top = r.bottom + 8;
  let left = r.left - (W - r.width);
  top = clamp(top, 8, window.innerHeight - H - 8);
  left = clamp(left, 8, window.innerWidth - W - 8);
  pad.style.top = `${top}px`; pad.style.left = `${left}px`;

  const bd=document.createElement('div');
  bd.style.cssText='position:fixed;inset:0;z-index:999;background:transparent';

  function close(){ pad.remove(); bd.remove(); }
  bd.addEventListener('click', close);
  pad.addEventListener('click', (e)=>{
    if (e.target.getAttribute('data-close')!=null){ close(); return; }
    const k = e.target.getAttribute('data-k'); if(!k) return;
    if(k==='C'){ close(); return; }
    const mul = parseInt(k,10);
    if(!isNaN(mul) && mul>=0){
      mini = Math.max(0, rupeeRound((parseFloat(baseValue)||0) * mul));
      els.miniView.innerHTML = formatMoney(mini);
      els.miniAdd.disabled = mini<=0;
      emitMini();
      close();
    }
  });

  document.body.append(bd, pad);
}

/* Init */
export function initCalculator(mountEl, state){
  if(!mountEl) return;
  stateRef = state;

  const wrap = document.createElement('div');
  wrap.style.padding = '6px 0';
  wrap.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:6px;margin-bottom:8px">
      <div style="font-weight:800">Calculator</div>
      <button class="small-btn" id="cSaveBill">Save bill</button>
      <button class="small-btn" id="cClearAll" title="Clear bill">C</button>
      <div style="margin-left:auto;font-weight:800" id="cTotal">₹0<span class="dec">.00</span></div>
    </div>

    <div id="cMini" style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <label style="display:flex;align-items:center;gap:6px">
        <span>₹</span>
        <input id="cMiniPrice" type="number" inputmode="decimal" step="0.01" min="0"
               style="width:140px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:inherit;padding:6px 8px" />
      </label>
      <div id="cMiniView" style="font-weight:800">₹0<span class="dec">.00</span></div>
      <button class="small-btn" id="cMiniAdd" title="Add to bill" disabled>＋</button>
      <button class="small-btn" id="cMiniClear" title="Clear mini">−</button>
    </div>

    <div id="cList"></div>
  `;
  mountEl.replaceChildren(wrap);

  els = {
    total: wrap.querySelector('#cTotal'),
    list: wrap.querySelector('#cList'),
    miniPrice: wrap.querySelector('#cMiniPrice'),
    miniView: wrap.querySelector('#cMiniView'),
    miniAdd: wrap.querySelector('#cMiniAdd'),
    miniClear: wrap.querySelector('#cMiniClear'),
    saveBill: wrap.querySelector('#cSaveBill'),
    clearAll: wrap.querySelector('#cClearAll'),
    miniRow: wrap.querySelector('#cMini')
  };

  // Hide the top mini row; dropdowns will mirror it
  if (els.miniRow) els.miniRow.style.display = 'none'; /* layout change via style; the logic remains. [2] */

  function updateMiniView(){
    els.miniView.innerHTML = formatMoney(mini);
    emitMini();
    els.miniAdd.disabled = mini <= 0;
  }

  // Input -> mini (still works, just hidden)
  els.miniPrice.addEventListener('input', ()=>{
    const raw = parseFloat(els.miniPrice.value)||0;
    mini = rupeeRound(raw);
    updateMiniView();
  }); /* input event wiring. [14] */

  // Short tap: add to bill, then clear
  els.miniAdd.addEventListener('click', ()=>{
    if(els.miniAdd.dataset.lp === '1'){ delete els.miniAdd.dataset.lp; return; }
    if(mini<=0) return;
    stateRef.calc.lines.push({ itemName:'Manual', grams:null, price:mini, lineTotal:rupeeRound(mini) });
    els.miniPrice.value=''; mini=0; updateMiniView(); renderList();
  }); /* click handler. [14] */

  // Long‑press on ＋ → keypad
  let lpTimer = null;
  const LP_MS = 450;
  els.miniAdd.addEventListener('pointerdown', ()=>{
    if (lpTimer) clearTimeout(lpTimer);
    const base = parseFloat(els.miniPrice.value) || 0;
    if (base > 0){
      lpTimer = setTimeout(()=>{
        els.miniAdd.dataset.lp = '1';
        showMultiplierPad(els.miniAdd, base);
      }, LP_MS);
    }
  }, {passive:true}); /* pointerdown for long press. [15] */
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>{
    els.miniAdd.addEventListener(ev, ()=>{
      if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
    }, {passive:true});
  }); /* cancel timer on end/cancel. [16] */

  els.miniClear.addEventListener('click', ()=>{ els.miniPrice.value=''; mini=0; updateMiniView(); });

  els.list.addEventListener('click', (e)=>{
    const del = e.target.getAttribute('data-del');
    if(del!=null){ stateRef.calc.lines.splice(parseInt(del,10),1); renderList(); }
  });

  els.clearAll.addEventListener('click', ()=>{
    if(stateRef.calc.lines.length===0) return;
    if(confirm('Clear the current bill?')){ stateRef.calc.lines = []; renderList(); }
  });
  els.saveBill.addEventListener('click', async ()=>{
    if(stateRef.calc.lines.length===0){ alert('Nothing to save.'); return; }
    const receipt = { id: (crypto.randomUUID&&crypto.randomUUID())||String(Date.now()), ts: Date.now(),
      lines: JSON.parse(JSON.stringify(stateRef.calc.lines)), total: stateRef.calc.total };
    const bills = (await dbGet(KEYS.bills)) || [];
    bills.unshift(receipt); await dbSet(KEYS.bills, bills.slice(0,20)).catch(()=>{});
    stateRef.calc.lines = []; renderList(); alert('Saved to Bill history.');
  });

  renderList();
  updateMiniView();
}
