// modules/calculator.js
import { get as dbGet, set as dbSet, KEYS } from './storage.js';

/* Rounding + display */
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

/* Mini change pub/sub so other modules can mirror live values */
const miniSubs = new Set();
function emitMini(){ miniSubs.forEach(fn=>{ try{ fn(mini); }catch{} }); }
export function onMiniChange(cb){ miniSubs.add(cb); try{ cb(mini); }catch{} return ()=>miniSubs.delete(cb); } [2]

/* Helpers used by the search sheet */
export function setMiniFromItems(amount){
  mini = Math.max(0, rupeeRound(amount||0));
  emitMini();
}
export function addToMiniFromItems(delta){
  mini = Math.max(0, rupeeRound((mini||0) + (Number(delta)||0)));
  emitMini();
}
export function addLineFromItems({ itemName, grams=null, price=null }={}){
  if(!stateRef) return;
  const lineTotal = rupeeRound(price ?? 0);
  stateRef.calc.lines.push({ itemName: itemName || 'Item', grams, price, lineTotal });
  renderList();
}

/* Bill render: Name • small x • Amount (one line, no separators) */
function renderList(){
  if(!els || !stateRef) return;
  let total = 0;
  els.list.innerHTML = '';
  const frag = document.createDocumentFragment();

  stateRef.calc.lines.forEach((ln, idx)=>{
    total += ln.lineTotal;

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 0;gap:10px'; // stable, single line [6]

    // Left cluster: Name + compact x
    const left = document.createElement('div');
    left.style.cssText='display:flex;align-items:center;gap:10px;min-width:0;flex:1';
    const name = document.createElement('div');
    name.style.cssText='font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    name.textContent = ln.itemName;
    const del = document.createElement('button');
    del.className='small-btn';
    del.setAttribute('data-del', String(idx));
    del.title='Remove';
    del.textContent='x';
    del.style.cssText='padding:0 6px;height:22px;line-height:22px;border-radius:6px;font-size:.9rem'; // small x [2]
    left.append(name, del);

    // Right cluster: Amount
    const right = document.createElement('div');
    right.innerHTML = `${formatMoney(ln.lineTotal)}`;

    row.append(left, right);
    frag.appendChild(row);
  });

  stateRef.calc.total = total;
  els.list.appendChild(frag);
  els.total.innerHTML = formatMoney(total);
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
    <div id="cList"></div>
  `;
  mountEl.replaceChildren(wrap);

  els = {
    total: wrap.querySelector('#cTotal'),
    list: wrap.querySelector('#cList'),
    saveBill: wrap.querySelector('#cSaveBill'),
    clearAll: wrap.querySelector('#cClearAll')
  };

  // Delete line
  els.list.addEventListener('click', (e)=>{
    const del = e.target.getAttribute('data-del');
    if(del!=null){
      stateRef.calc.lines.splice(parseInt(del,10),1);
      renderList();
    }
  }); [2]

  // Clear all and save
  els.clearAll.addEventListener('click', ()=>{
    if(stateRef.calc.lines.length===0) return;
    if(confirm('Clear the current bill?')){
      stateRef.calc.lines = [];
      renderList();
    }
  }); [2]
  els.saveBill.addEventListener('click', async ()=>{
    if(stateRef.calc.lines.length===0){ alert('Nothing to save.'); return; }
    const receipt = { id: (crypto.randomUUID&&crypto.randomUUID())||String(Date.now()), ts: Date.now(),
      lines: JSON.parse(JSON.stringify(stateRef.calc.lines)), total: stateRef.calc.total };
    const bills = (await dbGet(KEYS.bills)) || [];
    bills.unshift(receipt);
    await dbSet(KEYS.bills, bills.slice(0,20)).catch(()=>{});
    stateRef.calc.lines = [];
    renderList();
    alert('Saved to Bill history.');
  }); [2]

  renderList();
}
