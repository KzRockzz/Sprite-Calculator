// modules/calculator.js
import { get as dbGet, set as dbSet, KEYS } from './storage.js';

// Rounding: floor to rupee unless fractional ≥ 0.9 then ceil
function rupeeRound(x){
  const f = x - Math.floor(x);
  return (f >= 0.9) ? Math.ceil(x) : Math.floor(x);
}
function fmtMain(n){
  const v = (Number(n)||0).toFixed(2);
  const [a,b] = v.split('.');
  return `₹${a}<span class="dec">.${b}</span>`;
}

export function initCalculator(mountEl, state){
  if(!mountEl) return;

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
        <input id="cMiniPrice" type="number" inputmode="decimal" step="0.01" min="0" style="width:120px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:inherit;padding:6px 8px" />
      </label>
      <div id="cMiniView" style="font-weight:800">${fmtMain(0)}</div>
      <button class="small-btn" id="cMiniAdd" title="Add to bill" disabled>＋</button>
      <button class="small-btn" id="cMiniClear" title="Clear mini">−</button>
    </div>

    <div id="cList"></div>
  `;
  mountEl.replaceChildren(wrap);

  const el = {
    total: wrap.querySelector('#cTotal'),
    list: wrap.querySelector('#cList'),
    miniPrice: wrap.querySelector('#cMiniPrice'),
    miniView: wrap.querySelector('#cMiniView'),
    miniAdd: wrap.querySelector('#cMiniAdd'),
    miniClear: wrap.querySelector('#cMiniClear'),
    saveBill: wrap.querySelector('#cSaveBill'),
    clearAll: wrap.querySelector('#cClearAll')
  };

  let mini = 0;

  function renderList(){
    let total = 0;
    el.list.innerHTML = '';
    const frag = document.createDocumentFragment();

    state.calc.lines.forEach((ln, idx)=>{
      total += ln.lineTotal;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08);padding:8px 0;gap:8px';
      const left = document.createElement('div');
      left.style.cssText='flex:1;min-width:0';
      left.innerHTML = `
        <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ln.itemName || 'Item'}</div>
        <div class="small-muted">${ln.grams? (ln.grams+'g') : ''} ${ln.grams&&ln.price? '•' : ''} ${ln.price? ('₹'+ln.price) : ''}</div>
      `;
      const right = document.createElement('div');
      right.style.cssText='display:flex;align-items:center;gap:8px';
      right.innerHTML = `<div>${fmtMain(ln.lineTotal)}</div><button class="small-btn" data-del="${idx}">✕</button>`;
      row.append(left, right);
      frag.appendChild(row);
    });

    state.calc.total = total;
    el.list.appendChild(frag);
    el.total.innerHTML = fmtMain(total);
    dbSet(KEYS.calc, state.calc).catch(()=>{});
  }

  function updateMiniView(){
    el.miniView.innerHTML = fmtMain(mini);
    el.miniAdd.disabled = mini <= 0;
  }

  el.miniPrice.addEventListener('input', ()=>{
    const p = parseFloat(el.miniPrice.value)||0;
    mini = rupeeRound(p);
    updateMiniView();
  });
  el.miniAdd.addEventListener('click', ()=>{
    if(mini<=0) return;
    state.calc.lines.push({
      itemName: 'Manual',
      grams: null,
      price: mini,
      lineTotal: rupeeRound(mini)
    });
    el.miniPrice.value = '';
    mini = 0;
    updateMiniView();
    renderList();
  });
  el.miniClear.addEventListener('click', ()=>{
    el.miniPrice.value = '';
    mini = 0;
    updateMiniView();
  });

  el.list.addEventListener('click', (e)=>{
    const del = e.target.getAttribute('data-del');
    if(del!=null){
      state.calc.lines.splice(parseInt(del,10),1);
      renderList();
    }
  });

  el.clearAll.addEventListener('click', ()=>{
    if(state.calc.lines.length===0) return;
    if(confirm('Clear the current bill?')){
      state.calc.lines = [];
      renderList();
    }
  });

  el.saveBill.addEventListener('click', async ()=>{
    if(state.calc.lines.length===0){ alert('Nothing to save.'); return; }
    const receipt = { id: crypto.randomUUID?.() || String(Date.now()), ts: Date.now(), lines: JSON.parse(JSON.stringify(state.calc.lines)), total: state.calc.total };
    const bills = (await dbGet(KEYS.bills)) || [];
    bills.unshift(receipt);
    await dbSet(KEYS.bills, bills.slice(0,20)).catch(()=>{});
    state.calc.lines = [];
    renderList();
    alert('Saved to Bill history.');
  });

  renderList();
  updateMiniView();
  return { renderList };
}
