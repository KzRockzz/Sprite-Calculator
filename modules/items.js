// modules/items.js
import { get as dbGet, set as dbSet, KEYS } from './storage.js';
import { setMiniFromItems, addToMiniFromItems, addLineFromItems, onMiniChange, formatMoney } from './calculator.js';

const qs  = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];

const DEFAULT_WEIGHT = [50,100,500,1000];

// ---------- Modal form scaffold ----------
function ensureItemForm(){
  const body = qs('#itemModalBody');
  if (!body || body.dataset.wired==='1') return;
  body.dataset.wired='1';
  body.innerHTML = `
    <form id="itemForm" novalidate>
      <div style="display:grid;grid-template-columns:1fr;gap:8px">
        <label style="display:flex;flex-direction:column;gap:4px"><span>Name 1</span><input id="name1" required maxlength="80" /></label>
        <label style="display:flex;flex-direction:column;gap:4px"><span>Name 2</span><input id="name2" required maxlength="80" /></label>
        <label style="display:flex;flex-direction:column;gap:4px"><span>Name 3</span><input id="name3" required maxlength="80" /></label>
        <label style="display:flex;flex-direction:column;gap:4px"><span>Selling ₹/kg</span><input id="sprice" type="number" step="0.01" min="0" inputmode="decimal" /></label>
        <label style="display:flex;flex-direction:column;gap:4px"><span>Bought ₹/kg</span><input id="bprice" type="number" step="0.01" min="0" inputmode="decimal" /></label>
      </div>
      <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:10px">
        <button type="button" class="small-btn" data-close="itemModal">Cancel</button>
        <button type="submit" class="small-btn" id="itemSaveBtn">Save</button>
        <button type="button" class="small-btn" id="itemDeleteBtn" style="display:none">Delete</button>
      </div>
    </form>
  `;
}

function openModal(id){ qs('#'+id)?.classList.add('open'); }
function closeModal(id){ qs('#'+id)?.classList.remove('open'); }

// ---------- Helpers ----------
function gramsToPrice(sp, g){ return (Number(sp)||0) * (g/1000); }
function rupeeRound(x){ const n=Number(x)||0; const r=Math.floor(n); const p=Math.round((n-r)*100); return p>=90? r+1 : r; }
function normalizeGramEntry(entry){ let val=entry; if(entry&&typeof entry==='object'){ val=('val'in entry)?entry.val:('value'in entry?entry.value:entry); } const grams=Math.max(0,parseFloat(val)||0); const label=grams===1000?'1kg':`${grams}g`; return { grams, label }; }
function displayNameOf(it){ const idx=Number(it.showNameIdx||0)%3; const names=[it.name1||'',it.name2||'',it.name3||'']; return names[idx] || it.name1 || it.name2 || it.name3 || ''; }

// ---------- Keypad for dropdown long‑press (with decimal) ----------
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function showMultiplierPad(anchorBtn, baseValue, onApply){
  if(!baseValue || baseValue<=0) return;
  let multStr = '1';
  function valid(s){
    // allow digits with at most one decimal point, no leading empty except "0."
    return /^(\d+(\.\d{0,4})?)$/.test(s);
  }

  const pad=document.createElement('div');
  pad.setAttribute('role','dialog');
  pad.style.cssText='position:fixed;z-index:1000;background:#11151f;color:#e8eaed;border:1px solid rgba(255,255,255,.12);border-radius:10px;box-shadow:0 10px 24px rgba(0,0,0,.35);padding:8px;width:200px';

  const head=document.createElement('div');
  head.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;font-weight:700';
  const titleLeft=document.createElement('div'); titleLeft.textContent='Multiply';
  const closeBtn=document.createElement('button'); closeBtn.className='small-btn'; closeBtn.textContent='✕';
  head.append(titleLeft, closeBtn);
  pad.appendChild(head);

  const preview=document.createElement('div');
  preview.style.cssText='font-size:.85rem;opacity:.85;margin-bottom:6px';
  preview.textContent = `${baseValue} × ${multStr}`;
  pad.appendChild(preview);

  const grid=document.createElement('div');
  grid.style.cssText='display:grid;grid-template-columns:repeat(4,1fr);gap:6px';
  const keys = ['1','2','3','.','4','5','6','0','7','8','9','←','C','×10','OK','✕'];
  keys.forEach(k=>{
    const b=document.createElement('button'); b.className='small-btn'; b.textContent=k; b.setAttribute('data-k',k); b.style.height='36px'; grid.appendChild(b);
  });
  pad.appendChild(grid);

  const r = anchorBtn.getBoundingClientRect();
  const W=200, H=210;
  let top=r.bottom+8, left=r.left-(W-r.width);
  top=clamp(top,8,window.innerHeight-H-8);
  left=clamp(left,8,window.innerWidth-W-8);
  pad.style.top=`${top}px`; pad.style.left=`${left}px`;

  const bd=document.createElement('div');
  bd.style.cssText='position:fixed;inset:0;z-index:999;background:transparent';

  function close(){ pad.remove(); bd.remove(); }
  function apply(){
    const m=parseFloat(multStr)||0;
    if(m>0 && onApply){ onApply(m); }
    close();
  }

  bd.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  pad.addEventListener('click', (e)=>{
    const k = e.target.getAttribute('data-k'); if(!k) return;
    if(k==='✕'){ close(); return; }
    if(k==='C'){ multStr='1'; preview.textContent=`${baseValue} × ${multStr}`; return; }
    if(k==='←'){ multStr=multStr.length>1? multStr.slice(0,-1):'1'; preview.textContent=`${baseValue} × ${multStr}`; return; }
    if(k==='×10'){ multStr=String((parseFloat(multStr)||0)*10||10); preview.textContent=`${baseValue} × ${multStr}`; return; }
    if(k==='OK'){ apply(); return; }
    // digits / dot
    let next = multStr==='1' && k!=='.' ? k : (multStr + k);
    if(k==='.' && multStr.includes('.')) next = multStr; // only one dot
    if(valid(next)){ multStr=next; preview.textContent=`${baseValue} × ${multStr}`; }
  });

  document.body.append(bd,pad);
}

// ---------- Cards render ----------
function renderCards(mountEl, state, ui){
  const q = (qs('#searchInput')?.value || '').trim().toLowerCase();
  const filtered = !q ? state.items : state.items.filter(it => {
    const n1=(it.name1||'').toLowerCase(), n2=(it.name2||'').toLowerCase(), n3=(it.name3||'').toLowerCase();
    return n1.includes(q)||n2.includes(q)||n3.includes(q);
  });

  mountEl.innerHTML = '';
  if (!filtered.length){
    const empty = document.createElement('div');
    empty.className='small-muted';
    empty.style.cssText='text-align:center;padding:10px 0';
    empty.textContent='No items yet. Tap + to add.';
    mountEl.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();

  filtered.forEach((it)=>{
    if (typeof it.showNameIdx!=='number') it.showNameIdx = 0;

    const card=document.createElement('div'); card.className='card';

    const head=document.createElement('div'); head.className='card-row';
    head.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:6px';
    head.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1">
        <div class="names" data-open-item="${it.id}" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer">
          ${displayNameOf(it)}
        </div>
        <button class="small-btn" data-cycle="${it.id}" title="Toggle name">↻</button>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <button class="small-btn" data-edit="${it.id}" title="Edit">✏️</button>
      </div>`;
    card.appendChild(head);

    const meta=document.createElement('div'); meta.className='meta';
    meta.style.cssText='display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:2px';
    meta.innerHTML = `
      <div class="sell" style="font-size:.9rem">₹${(+it.sprice||0).toFixed(2)}/kg</div>
      <div class="buy"  style="font-size:.5rem;opacity:.75">₹${(+it.bprice||0).toFixed(2)}/kg</div>`;
    card.appendChild(meta);

    if(ui.openId===it.id){
      const dd=document.createElement('div'); dd.className='dropdown';
      dd.style.cssText='margin-top:8px;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);padding:8px';

      const chips=document.createElement('div'); chips.style.cssText='display:flex;gap:6px;overflow:auto;padding:2px 0';
      const src=(it.presets?.weight?.length? it.presets.weight : DEFAULT_WEIGHT);
      const sp=+it.sprice||0;

      src.forEach(entry=>{
        const { grams, label } = normalizeGramEntry(entry);
        if(grams<=0) return;
        const amount = rupeeRound(gramsToPrice(sp, grams));
        const b=document.createElement('button'); b.className='small-btn'; b.textContent=`${label}\n₹${amount}`;
        b.style.whiteSpace='pre';
        b.addEventListener('click', ()=>{ addToMiniFromItems(amount); });
        chips.appendChild(b);
      });
      dd.appendChild(chips);

      const conv=document.createElement('div'); conv.style.cssText='display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap';
      conv.innerHTML = `
        <label style="display:flex;align-items:center;gap:6px">
          <span>₹</span>
          <input type="number" inputmode="decimal" min="0" step="0.01" data-price="${it.id}"
                 style="width:120px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:inherit;padding:6px 8px" />
        </label>
        <div class="mini-mirror" style="margin-left:auto;font-weight:800">${formatMoney(0)}</div>
        <button class="small-btn" data-add-now="${it.id}" title="Add line">＋</button>
        <button class="small-btn" data-clear-mini="${it.id}" title="Clear mini">−</button>
        <button class="small-btn" data-close="${it.id}" title="Close">✕</button>
      `;
      dd.appendChild(conv);

      const priceInput = dd.querySelector('input[data-price]');
      const addBtn = dd.querySelector('button[data-add-now]');
      const mirror = conv.querySelector('.mini-mirror');

      // Keep mirror synced with calculator mini
      const off = onMiniChange(v => { if(mirror) mirror.innerHTML = formatMoney(v); });

      dd.addEventListener('input', (e)=>{
        const pid=e.target.getAttribute('data-price');
        if(pid){ const p=parseFloat(e.target.value)||0; setMiniFromItems(p); }
      });

      dd.addEventListener('click', (e)=>{
        const addNow=e.target.getAttribute('data-add-now');
        const close=e.target.getAttribute('data-close');
        const clear=e.target.getAttribute('data-clear-mini');

        if(addNow){
          const p=parseFloat(priceInput?.value)||0;
          const amt=rupeeRound(p);
          if(amt>0){
            addLineFromItems({ itemName: displayNameOf(it), grams:null, price:amt });
            priceInput.value=''; setMiniFromItems(0);
          }
          return;
        }
        if(clear){
          if(priceInput) priceInput.value='';
          setMiniFromItems(0);
          return;
        }
        if(close){
          off && off();
          ui.openId=null; renderCards(mountEl,state,ui);
          return;
        }
      });

      // Long‑press on dropdown ＋ → decimal keypad multiply
      let lpTimer=null; const LP_MS=450;
      addBtn.addEventListener('pointerdown', ()=>{
        if(lpTimer) clearTimeout(lpTimer);
        const base = parseFloat(priceInput?.value)||0;
        if(base>0){
          lpTimer=setTimeout(()=>{
            showMultiplierPad(addBtn, base, (mult)=>{
              setMiniFromItems(base*mult);
            });
          }, LP_MS);
        }
      }, {passive:true});
      ['pointerup','pointercancel','pointerleave'].forEach(ev=>{
        addBtn.addEventListener(ev, ()=>{ if(lpTimer){ clearTimeout(lpTimer); lpTimer=null; } }, {passive:true});
      });

      card.appendChild(dd);
    }

    frag.appendChild(card);
  });

  mountEl.appendChild(frag);
}

// ---------- Init ----------
export async function initItems(mountEl, state){
  if(!mountEl) return;

  try { 
    const existing = await dbGet(KEYS.items);
    if(Array.isArray(existing)) existing.forEach(it=>{ if(typeof it.showNameIdx!=='number') it.showNameIdx = 0; });
    if(Array.isArray(existing)) state.items = existing;
  } catch {}

  ensureItemForm();

  const fab=qs('#fab'); const form=qs('#itemForm'); const title=qs('#itemModalTitle');
  const name1=qs('#name1'); const name2=qs('#name2'); const name3=qs('#name3');
  const sprice=qs('#sprice'); const bprice=qs('#bprice'); const delBtn=qs('#itemDeleteBtn');

  const ui = { openId:null };
  let editingId=null;
  const genId = () => Math.random().toString(36).slice(2)+Date.now().toString(36);

  function render(){ renderCards(mountEl,state,ui); }

  function startAdd(){
    editingId=null; title.textContent='Add item'; delBtn.style.display='none';
    name1.value=''; name2.value=''; name3.value=''; sprice.value=''; bprice.value='';
    openModal('itemModal'); setTimeout(()=>name1?.focus(),50);
  }
  function startEdit(id){
    const it=state.items.find(x=>x.id===id); if(!it) return;
    editingId=id; title.textContent='Edit item'; delBtn.style.display='inline-block';
    name1.value=it.name1||''; name2.value=it.name2||''; name3.value=it.name3||'';
    sprice.value=it.sprice||''; bprice.value=it.bprice||'';
    openModal('itemModal');
  }

  async function onSubmit(e){
    e.preventDefault();
    const payload={ name1:name1.value.trim(), name2:name2.value.trim(), name3:name3.value.trim(),
      sprice:+(+sprice.value||0).toFixed(2), bprice:+(+bprice.value||0).toFixed(2),
      showNameIdx: 0, presets:{ weight:[...DEFAULT_WEIGHT] } };
    if(!(payload.name1&&payload.name2&&payload.name3)){ alert('Please fill all three names.'); return; }
    if(!editingId){ state.items.unshift({ id:genId(), ...payload }); }
    else { const it=state.items.find(x=>x.id===editingId); if(it) Object.assign(it, payload, { showNameIdx: it.showNameIdx??0 }); }
    await dbSet(KEYS.items, state.items).catch(()=>{});
    closeModal('itemModal'); render();
  }
  async function onDelete(){
    if(!editingId) return;
    const it=state.items.find(x=>x.id===editingId); if(!it) return;
    if(confirm(`Delete "${displayNameOf(it)}"?`)){
      state.items = state.items.filter(x=>x.id!==editingId);
      await dbSet(KEYS.items, state.items).catch(()=>{});
      closeModal('itemModal'); render();
    }
  }

  fab?.addEventListener('click', startAdd);
  form?.addEventListener('submit', onSubmit);
  delBtn?.addEventListener('click', onDelete);

  mountEl.addEventListener('click', async (e)=>{
    const edit=e.target.getAttribute('data-edit'); 
    if(edit){ startEdit(edit); return; }
    const openEl = e.target.closest('[data-open-item]');
    if(openEl){
      const id = openEl.getAttribute('data-open-item');
      ui.openId = (ui.openId===id ? null : id);
      render();
      return;
    }
    const cycleId = e.target.getAttribute('data-cycle');
    if(cycleId){
      const it = state.items.find(x=>x.id===cycleId);
      if(it){
        it.showNameIdx = ((Number(it.showNameIdx)||0) + 1) % 3;
        await dbSet(KEYS.items, state.items).catch(()=>{});
        render();
      }
      return;
    }
  });

  qs('#searchInput')?.addEventListener('input', render);

  render();
}
