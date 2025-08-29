// modules/items.js
import { get as dbGet, set as dbSet, KEYS } from './storage.js';
import { setMiniFromItems, addToMiniFromItems, addLineFromItems, onMiniChange, formatMoney } from './calculator.js';

const qs  = (s, r=document) => r.querySelector(s);

const DEFAULT_WEIGHT = [50,100,500,1000];

// Theme-aware input attrs
function themedInputAttrs(){
  return 'style="border-radius:9px;border:1px solid rgba(255,255,255,.12);' +
         'background:var(--field-bg, rgba(255,255,255,.05));color:var(--fg, inherit);padding:8px"';
}

// Modal form
function ensureItemForm(){
  const body = qs('#itemModalBody');
  if (!body || body.dataset.wired==='1') return;
  body.dataset.wired='1';
  body.innerHTML = `
    <form id="itemForm" novalidate>
      <div style="display:grid;grid-template-columns:1fr;gap:8px">
        <label style="display:flex;flex-direction:column;gap:4px"><span>Name 1</span><input id="name1" ${themedInputAttrs()} required maxlength="80" /></label>
        <label style="display:flex;flex-direction:column;gap:4px"><span>Name 2</span><input id="name2" ${themedInputAttrs()} required maxlength="80" /></label>
        <label style="display:flex;flex-direction:column;gap:4px"><span>Name 3</span><input id="name3" ${themedInputAttrs()} required maxlength="80" /></label>
        <label style="display:flex;flex-direction:column;gap:4px"><span>Selling ₹/kg</span><input id="sprice" ${themedInputAttrs()} type="number" step="0.01" min="0" inputmode="decimal" /></label>
        <label style="display:flex;flex-direction:column;gap:4px"><span>Bought ₹/kg</span><input id="bprice" ${themedInputAttrs()} type="number" step="0.01" min="0" inputmode="decimal" /></label>
      </div>
      <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:10px">
        <button type="button" class="small-btn" data-close="itemModal">Cancel</button>
        <button type="submit" class="small-btn" id="itemSaveBtn">Save</button>
        <button type="button" class="small-btn" id="itemDeleteBtn" style="display:none">Delete</button>
      </div>
    </form>
  `;
} [5]

function gramsToPrice(sp, g){ return (Number(sp)||0) * (g/1000); } [4]
function rupeeRound(x){ const n=Number(x)||0; const r=Math.floor(n); const p=Math.round((n-r)*100); return p>=90? r+1 : r; } [4]
function normalizeGramEntry(entry){ let val=entry; if(entry&&typeof entry==='object'){ val=('val'in entry)?entry.val:('value'in entry?entry.value:entry); } const grams=Math.max(0,parseFloat(val)||0); const label=grams===1000?'1kg':`${grams}g`; return { grams, label }; } [4]
function displayNameOf(it){ const idx=Number(it.showNameIdx||0)%3; const names=[it.name1||'', it.name2||'', it.name3||'']; return names[idx] || it.name1 || it.name2 || it.name3 || ''; } [4]

// Robust, side-effect-free render
function renderCards(mountEl, state, ui){
  try{
    const searchEl = document.getElementById('searchInput');
    const q = ((searchEl && searchEl.value) || '').trim().toLowerCase();
    const base = Array.isArray(state.items) ? state.items : []; // guard against undefined [4]
    const filtered = q ? base.filter(it=>{
      const n1=(it.name1||'').toLowerCase(), n2=(it.name2||'').toLowerCase(), n3=(it.name3||'').toLowerCase();
      return n1.includes(q)||n2.includes(q)||n3.includes(q);
    }) : base; // safe filter [4]

    mountEl.innerHTML = '';

    if (!filtered.length){
      const empty = document.createElement('div');
      empty.className='small-muted';
      empty.style.cssText='text-align:center;padding:10px 0';
      empty.textContent = q ? 'No matches.' : 'No items yet. Tap + to add.';
      mountEl.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();

    filtered.forEach((it)=>{
      if (typeof it.showNameIdx!=='number') it.showNameIdx = 0;

      const card=document.createElement('div'); card.className='card';

      // Header
      const head=document.createElement('div'); head.className='card-row';
      head.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:6px';
      head.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1">
          <button type="button" class="names" style="all:unset;cursor:pointer;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${displayNameOf(it)}</button>
          <button class="small-btn" data-cycle="${it.id}" title="Toggle name">↻</button>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <button class="small-btn" data-edit="${it.id}" title="Edit">✏️</button>
        </div>`;
      card.appendChild(head);

      // Direct, isolated name click
      head.querySelector('.names')?.addEventListener('click', (e)=>{
        e.preventDefault(); e.stopPropagation(); // keep it local [4]
        ui.openId = (ui.openId===it.id ? null : it.id);
        renderCards(mountEl, state, ui); // re-render safely [4]
      });

      // Meta
      const meta=document.createElement('div'); meta.className='meta';
      meta.style.cssText='display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:2px';
      meta.innerHTML = `
        <div class="sell" style="font-size:.9rem">₹${(+it.sprice||0).toFixed(2)}/kg</div>
        <div class="buy"  style="font-size:.5rem;opacity:.75">₹${(+it.bprice||0).toFixed(2)}/kg</div>`;
      card.appendChild(meta);

      // Dropdown
      if(ui.openId===it.id){
        const dd=document.createElement('div'); dd.className='dropdown';
        dd.style.cssText='margin-top:8px;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);padding:8px';

        const chips=document.createElement('div'); chips.style.cssText='display:flex;gap:6px;overflow:auto;padding:2px 0';
        const sp=+it.sprice||0;
        const weights=(it.presets?.weight?.length? it.presets.weight : DEFAULT_WEIGHT);
        weights.forEach(entry=>{
          const { grams, label } = normalizeGramEntry(entry);
          if(grams<=0) return;
          const amount = rupeeRound(gramsToPrice(sp, grams));
          const b=document.createElement('button'); b.className='small-btn'; b.textContent=`${label}\n₹${amount}`;
          b.style.whiteSpace='pre';
          b.addEventListener('click', ()=>{ addToMiniFromItems(amount); });
          chips.appendChild(b);
        });
        dd.appendChild(chips);

        // Simple converter ₹ only (g field will be added next)
        const conv=document.createElement('div'); conv.style.cssText='display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap';
        conv.innerHTML = `
          <label style="display:flex;align-items:center;gap:6px">
            <span>₹</span>
            <input type="number" inputmode="decimal" min="0" step="0.01"
                   style="width:120px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:var(--field-bg);color:var(--fg);padding:6px 8px" />
          </label>
          <div class="mini-mirror" style="margin-left:auto;font-weight:800">${formatMoney(0)}</div>
          <button class="small-btn" data-add-now="${it.id}">＋</button>
          <button class="small-btn" data-clear-mini="${it.id}">−</button>
          <button class="small-btn" data-close="${it.id}">✕</button>
        `;
        dd.appendChild(conv);

        const priceInput = conv.querySelector('input');
        const addBtn = dd.querySelector('button[data-add-now]');
        const mirror = conv.querySelector('.mini-mirror');

        let lastMini = 0;
        const off = onMiniChange(v => { lastMini = v; if(mirror) mirror.innerHTML = formatMoney(v); }); // live mirror [4]

        conv.addEventListener('input', ()=>{
          const p=parseFloat(priceInput?.value)||0;
          setMiniFromItems(p);
        }); // live set [4]

        dd.addEventListener('click', (e)=>{
          const addNow=e.target.getAttribute('data-add-now');
          const close=e.target.getAttribute('data-close');
          const clear=e.target.getAttribute('data-clear-mini');

          if(addNow){
            const typed = parseFloat(priceInput?.value);
            const amt = (!isNaN(typed) && typed>0) ? rupeeRound(typed) : rupeeRound(lastMini);
            if(amt>0){
              addLineFromItems({ itemName: displayNameOf(it), grams:null, price:amt });
              if(priceInput) priceInput.value=''; setMiniFromItems(0);
            }
            return;
          }
          if(clear){ if(priceInput) priceInput.value=''; setMiniFromItems(0); return; }
          if(close){ off && off(); ui.openId=null; renderCards(mountEl,state,ui); return; }
        }); // actions [4]

        // Long-press keypad on dropdown +
        let lpTimer=null; const LP_MS=450;
        addBtn.addEventListener('pointerdown', ()=>{
          if(lpTimer) clearTimeout(lpTimer);
          const base = parseFloat(priceInput?.value)||0;
          if(base>0){
            lpTimer=setTimeout(()=>{
              // minimal inline keypad: multiply and set mini
              const pad=document.createElement('div'); pad.style.cssText='position:fixed;inset:auto auto 16px 16px;z-index:1000;background:#11151f;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:8px';
              pad.innerHTML='<div style="font-weight:700;margin-bottom:6px">Multiply: ×2 ×3 ×5 ×10</div>';
              ['2','3','5','10'].forEach(k=>{ const b=document.createElement('button'); b.className='small-btn'; b.textContent='×'+k; b.addEventListener('click', ()=>{ setMiniFromItems(base*(+k)); pad.remove(); }); pad.appendChild(b); });
              document.body.appendChild(pad);
              setTimeout(()=>{ document.addEventListener('click', ()=>pad.remove(), { once:true }); }, 0);
            }, LP_MS);
          }
        }, {passive:true}); // pointerdown [4]
        ['pointerup','pointercancel','pointerleave'].forEach(ev=>{
          addBtn.addEventListener(ev, ()=>{ if(lpTimer){ clearTimeout(lpTimer); lpTimer=null; } }, {passive:true});
        }); // cancel timer [4]

        card.appendChild(dd);
      }

      frag.appendChild(card);
    });

    mountEl.appendChild(frag);
  } finally {
    // nothing
  }
}

// Init
export async function initItems(mountEl, state){
  if(!mountEl) return;

  try { const existing = await dbGet(KEYS.items); if(Array.isArray(existing)) state.items = existing; } catch {} // idb read [8]
  ensureItemForm(); // inject form [5]

  const fab=qs('#fab'); const form=qs('#itemForm'); const title=qs('#itemModalTitle');
  const name1=qs('#name1'); const name2=qs('#name2'); const name3=qs('#name3');
  const sprice=qs('#sprice'); const bprice=qs('#bprice'); const delBtn=qs('#itemDeleteBtn');

  const ui = { openId:null };
  let editingId=null;
  const genId = () => Math.random().toString(36).slice(2)+Date.now().toString(36);

  function render(){ renderCards(mountEl,state,ui); } // stable re-render [4]

  function startAdd(){
    editingId=null; title.textContent='Add item'; delBtn.style.display='none';
    name1.value=''; name2.value=''; name3.value=''; sprice.value=''; bprice.value='';
    qs('#itemModal')?.classList.add('open');
    setTimeout(()=>name1?.focus(),50);
  } [4]
  function startEdit(id){
    const it=state.items.find(x=>x.id===id); if(!it) return;
    editingId=id; title.textContent='Edit item'; delBtn.style.display='inline-block';
    name1.value=it.name1||''; name2.value=it.name2||''; name3.value=it.name3||'';
    sprice.value=it.sprice||''; bprice.value=it.bprice||'';
    qs('#itemModal')?.classList.add('open');
  } [4]

  async function onSubmit(e){
    e.preventDefault();
    const payload={ name1:name1.value.trim(), name2:name2.value.trim(), name3:name3.value.trim(),
      sprice:+(+sprice.value||0).toFixed(2), bprice:+(+bprice.value||0).toFixed(2),
      showNameIdx: 0, presets:{ weight:[...DEFAULT_WEIGHT] } };
    if(!(payload.name1&&payload.name2&&payload.name3)){ alert('Please fill all three names.'); return; }
    if(!editingId){ state.items.unshift({ id:genId(), ...payload }); }
    else { const it=state.items.find(x=>x.id===editingId); if(it) Object.assign(it, payload, { showNameIdx: it.showNameIdx??0 }); }
    await dbSet(KEYS.items, state.items).catch(()=>{});
    qs('#itemModal')?.classList.remove('open'); render();
  } [8]
  async function onDelete(){
    if(!editingId) return;
    const it=state.items.find(x=>x.id===editingId); if(!it) return;
    if(confirm(`Delete "${displayNameOf(it)}"?`)){
      state.items = state.items.filter(x=>x.id!==editingId);
      await dbSet(KEYS.items, state.items).catch(()=>{});
      qs('#itemModal')?.classList.remove('open'); render();
    }
  } [8]

  fab?.addEventListener('click', startAdd);
  form?.addEventListener('submit', onSubmit);
  delBtn?.addEventListener('click', onDelete);

  // Only delegated handlers that cannot be bound directly
  mountEl.addEventListener('click', (e)=>{
    const edit=e.target.getAttribute('data-edit'); if(edit){ startEdit(edit); return; }
    const cycleId = e.target.getAttribute('data-cycle');
    if(cycleId){
      const it = state.items.find(x=>x.id===cycleId);
      if(it){ it.showNameIdx = ((Number(it.showNameIdx)||0) + 1) % 3; dbSet(KEYS.items, state.items).catch(()=>{}); render(); }
    }
  }); // event delegation [4]

  document.getElementById('searchInput')?.addEventListener('input', render); // live search [4]

  render();
}
