// modules/calculator.js
import { get as dbGet, set as dbSet, KEYS } from './storage.js';

/*
  Money rounding rule (robust to FP):
  - Work in integer paise for comparison.
  - Floor to rupee unless fractional part is ≥ 90 paise, then round up by ₹1.
*/
function rupeeRound(x) {
  const n = Number(x) || 0;
  const base = Math.floor(n);
  const paise = Math.round((n - base) * 100);
  return paise >= 90 ? base + 1 : base;
}

// Two‑decimal total with small decimal typography
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
        <input id="cMiniPrice" type="number" inputmode="decimal" step="0.01" min="0"
               style="width:140px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:inherit;padding:6px 8px" />
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

  // Local mini amount in integer rupees
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

  // ----- Keypad (3×4) for × multiplier on long‑press -----
  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

  function showMultiplierPad(anchorBtn, baseValue){
    // Guard: only if a base value exists
    if(!baseValue || baseValue <= 0) return;

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
    grid.style.cssText = 'display:grid; grid-template-columns:repeat(3,1fr); gap:6px';
    const keys = ['1','2','3','4','5','6','7','8','9','0','C','10']; // 3x4
    keys.forEach(k=>{
      const b = document.createElement('button');
      b.className='small-btn';
      b.textContent = (k==='10'?'×10':k);
      b.setAttribute('data-k', k);
      b.style.height='36px';
      grid.appendChild(b);
    });
    pad.appendChild(grid);

    // Position near the anchor
    const r = anchorBtn.getBoundingClientRect(); // placement geometry
    const W = 180, H = 180; // approx
    let top = r.bottom + 8;
    let left = r.left - (W - r.width);
    top = clamp(top, 8, window.innerHeight - H - 8);
    left = clamp(left, 8, window.innerWidth - W - 8);
    pad.style.top = `${top}px`;
    pad.style.left = `${left}px`;

    // Backdrop
    const bd = document.createElement('div');
    bd.style.cssText = 'position:fixed;inset:0;z-index:999;background:transparent';

    function close() { pad.remove(); bd.remove(); }

    bd.addEventListener('click', close);
    pad.addEventListener('click', (e)=>{
      if (e.target.getAttribute('data-close')!=null) { close(); return; }
      const k = e.target.getAttribute('data-k');
      if(!k) return;
      if(k==='C'){ close(); return; }
      const mul = parseInt(k,10);
      if(!isNaN(mul) && mul>=0){
        mini = rupeeRound(baseValue * mul);
        updateMiniView();
        close();
      }
    });

    document.body.append(bd, pad);
  }
  // -------------------------------------------------------

  // Events
  el.miniPrice.addEventListener('input', ()=>{
    const raw = parseFloat(el.miniPrice.value);
    const safe = isNaN(raw) || raw < 0 ? 0 : raw;
    mini = rupeeRound(safe);
    updateMiniView();
  });

  // Short tap: add to bill, then clear
  el.miniAdd.addEventListener('click', ()=>{
    // If a long‑press just opened the pad, suppress one click
    if (el.miniAdd.dataset.lp === '1') { delete el.miniAdd.dataset.lp; return; }
    if(mini<=0) return;
    state.calc.lines.push({
      itemName: 'Manual',
      grams: null,
      price: mini,
      lineTotal: rupeeRound(mini)
    });
    el.miniPrice.value = ''; // clear converter input
    mini = 0;                // clear mini total
    updateMiniView();
    renderList();
  });

  el.miniClear.addEventListener('click', ()=>{
    el.miniPrice.value = '';
    mini = 0;
    updateMiniView();
  });

  // Long‑press on ＋ → open multiplier keypad
  let lpTimer = null;
  const LP_MS = 450;
  el.miniAdd.addEventListener('pointerdown', (e)=>{
    if (lpTimer) clearTimeout(lpTimer);
    const base = parseFloat(el.miniPrice.value) || 0;
    // Only if there is a base cost in converter
    if (base > 0) {
      lpTimer = setTimeout(()=>{
        el.miniAdd.dataset.lp = '1'; // mark so next click is ignored
        showMultiplierPad(el.miniAdd, base);
      }, LP_MS);
    }
  }, {passive:true}); // listener setup
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>{
    el.miniAdd.addEventListener(ev, ()=>{
      if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
    }, {passive:true});
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
    const receipt = {
      id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()),
      ts: Date.now(),
      lines: JSON.parse(JSON.stringify(state.calc.lines)),
      total: state.calc.total
    };
    const bills = (await dbGet(KEYS.bills)) || [];
    bills.unshift(receipt);
    await dbSet(KEYS.bills, bills.slice(0,20)).catch(()=>{});
    state.calc.lines = [];
    renderList();
    alert('Saved to Bill history.');
  });

  // Initial paint
  renderList();
  updateMiniView();

  return { renderList };
}
