// modules/calculator.js
import { get as dbGet, set as dbSet, KEYS } from './storage.js';

/* Rounding: floor unless fractional ≥ 90 paise, using integer paise for FP safety */
function rupeeRound(x){ const n=Number(x)||0; const r=Math.floor(n); const p=Math.round((n-r)*100); return p>=90? r+1 : r; }
function fmtMain(n){ const v=(Number(n)||0).toFixed(2); const [a,b]=v.split('.'); return `₹${a}<span class="dec">.${b}</span>`; }

/* Module‑scope references so other modules can call exports after init */
let stateRef=null, els=null, mini=0;

/* Public helpers for other modules */
export function setMiniFromItems(amount){
  mini = Math.max(0, rupeeRound(amount||0));
  if(els?.miniView && els?.miniAdd){ els.miniView.innerHTML = fmtMain(mini); els.miniAdd.disabled = mini<=0; }
}
export function addLineFromItems({ itemName, grams=null, price=null }={}){
  if(!stateRef) return;
  const lineTotal = rupeeRound(price ?? 0);
  stateRef.calc.lines.push({ itemName:itemName||'Item', grams, price, lineTotal });
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
    row.style.cssText='display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08);padding:8px 0;gap:8px';
    const left = document.createElement('div');
    left.style.cssText='flex:1;min-width:0';
    left.innerHTML = `<div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ln.itemName}</div>
      <div class="small-muted">${ln.grams? (ln.grams+'g') : ''} ${ln.grams&&ln.price? '•' : ''} ${ln.price? ('₹'+ln.price) : ''}</div>`;
    const right = document.createElement('div');
    right.style.cssText='display:flex;align-items:center;gap:8px';
    right.innerHTML = `<div>${fmtMain(ln.lineTotal)}</div><button class="small-btn" data-del="${idx}">✕</button>`;
    row.append(left,right); frag.appendChild(row);
  });
  stateRef.calc.total = total;
  els.list.appendChild(frag);
  els.total.innerHTML = fmtMain(total);
  dbSet(KEYS.calc, stateRef.calc).catch(()=>{});
}

/* Init UI */
export function initCalculator(mountEl, state){
  if(!mountEl) return;
  stateRef = state;

  const wrap=document.createElement('div'); wrap.style.padding='6px 0';
  wrap.innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:6px;margin-bottom:8px">
      <div style="font-weight:800">Calculator</div>
      <button class="small-btn" id="cSaveBill">Save bill</button>
      <button class="small-btn" id="cClearAll" title="Clear bill">C</button>
      <div style="margin-left:auto;font-weight:800" id="cTotal">₹0<span class="dec">.00</span></div>
    </div>
    <div id="cMini" style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <label style="display:flex;align-items:center;gap:6px"><span>₹</span>
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
    clearAll: wrap.querySelector('#cClearAll')
  };

  function updateMiniView(){ els.miniView.innerHTML = fmtMain(mini); els.miniAdd.disabled = mini<=0; }

  els.miniPrice.addEventListener('input', ()=>{ const raw=parseFloat(els.miniPrice.value)||0; mini=rupeeRound(raw); updateMiniView(); });  // input binding [8]
  els.miniAdd.addEventListener('click', ()=>{ if(mini<=0) return;
    stateRef.calc.lines.push({ itemName:'Manual', grams:null, price:mini, lineTotal:rupeeRound(mini) });
    els.miniPrice.value=''; mini=0; updateMiniView(); renderList();
  });
  els.miniClear.addEventListener('click', ()=>{ els.miniPrice.value=''; mini=0; updateMiniView(); });

  els.list.addEventListener('click', (e)=>{ const del=e.target.getAttribute('data-del'); if(del!=null){ stateRef.calc.lines.splice(parseInt(del,10),1); renderList(); } });  // row delete [8]
  els.clearAll.addEventListener('click', ()=>{ if(stateRef.calc.lines.length===0) return; if(confirm('Clear the current bill?')){ stateRef.calc.lines=[]; renderList(); } });
  els.saveBill.addEventListener('click', async ()=>{ if(stateRef.calc.lines.length===0){ alert('Nothing to save.'); return; }
    const receipt={ id: (crypto.randomUUID&&crypto.randomUUID())||String(Date.now()), ts: Date.now(), lines: JSON.parse(JSON.stringify(stateRef.calc.lines)), total: stateRef.calc.total };
    const bills=(await dbGet(KEYS.bills))||[]; bills.unshift(receipt); await dbSet(KEYS.bills, bills.slice(0,20)).catch(()=>{});
    stateRef.calc.lines=[]; renderList(); alert('Saved to Bill history.');
  });

  // First paint
  renderList(); updateMiniView();
}
