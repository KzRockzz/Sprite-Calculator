// modules/calculator.js
import { get as dbGet, set as dbSet, KEYS } from './storage.js';

/* FP‑safe rounding + display */
function rupeeRound(x){
  const n = Number(x) || 0;
  const r = Math.floor(n);
  const p = Math.round((n - r) * 100);
  return p >= 90 ? r + 1 : r;
}
function fmtMain(n){
  const v = (Number(n)||0).toFixed(2);
  const [a,b] = v.split('.');
  return `₹${a}<span class="dec">.${b}</span>`;
}

/* Shared refs */
let stateRef = null;
let els = null;
let mini = 0;

/* Public helpers for other modules */
export function setMiniFromItems(amount){
  mini = Math.max(0, rupeeRound(amount||0));
  if (els?.miniView && els?.miniAdd){
    els.miniView.innerHTML = fmtMain(mini);
    els.miniAdd.disabled = mini <= 0;
  }
}
export function addToMiniFromItems(delta){
  mini = Math.max(0, rupeeRound((mini||0) + (Number(delta)||0)));
  if (els?.miniView && els?.miniAdd){
    els.miniView.innerHTML = fmtMain(mini);
    els.miniAdd.disabled = mini <= 0;
  }
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
    // Removed row separators; keep compact vertical rhythm [align center via flex] [4][2]
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 0;gap:8px';

    const left = document.createElement('div');
    left.style.cssText='flex:1;min-width:0';
    left.innerHTML = `
      <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ln.itemName}</div>
      <div class="small-muted">${ln.grams? (ln.grams+'g') : ''} ${ln.grams&&ln.price? '•' : ''} ${ln.price? ('₹'+ln.price) : ''}</div>
    `;

    const right = document.createElement('div');
    // Position amount then a compact ✕ next to it, centered on the cross-axis [3][9]
    right.style.cssText='display:flex;align-items:center;gap:10px';
    right.innerHTML = `<div>${fmtMain(ln.lineTotal)}</div><button class="small-btn" data-del="${idx}" title="Remove">✕</button>`;

    row.append(left, right);
    frag.appendChild(row);
  });

  stateRef.calc.total = total;
  els.list.appendChild(frag);
  els.total.innerHTML = fmtMain(total);
  dbSet(KEYS.calc, stateRef.calc).catch(()=>{});
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

    <div id="cMini" style="display:none">
      <!-- hidden mini row; dropdowns mirror the mini total -->
    </div>

    <div id="cList"></div>
  `;
  mountEl.replaceChildren(wrap);

  els = {
    total: wrap.querySelector('#cTotal'),
    list: wrap.querySelector('#cList'),
    saveBill: wrap.querySelector('#cSaveBill'),
    clearAll: wrap.querySelector('#cClearAll')
  };

  // Row delete [recommended addEventListener] [7]
  els.list.addEventListener('click', (e)=>{
    const del = e.target.getAttribute('data-del');
    if(del!=null){
      stateRef.calc.lines.splice(parseInt(del,10),1);
      renderList();
    }
  });

  // Clear all, Save bill
  els.clearAll.addEventListener('click', ()=>{
    if(stateRef.calc.lines.length===0) return;
    if(confirm('Clear the current bill?')){
      stateRef.calc.lines = [];
      renderList();
    }
  });
  els.saveBill.addEventListener('click', async ()=>{
    if(stateRef.calc.lines.length===0){ alert('Nothing to save.'); return; }
    const receipt = {
      id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()),
      ts: Date.now(),
      lines: JSON.parse(JSON.stringify(stateRef.calc.lines)),
      total: stateRef.calc.total
    };
    const bills = (await dbGet(KEYS.bills)) || [];
    bills.unshift(receipt);
    await dbSet(KEYS.bills, bills.slice(0,20)).catch(()=>{});
    stateRef.calc.lines = [];
    renderList();
    alert('Saved to Bill history.');
  });

  renderList();
}
