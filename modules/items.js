// modules/items.js
import { get as dbGet, set as dbSet, KEYS } from './storage.js';
import { setMiniFromItems, addToMiniFromItems, addLineFromItems, onMiniChange, formatMoney } from './calculator.js';

const qs  = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];

const DEFAULT_WEIGHT = [50,100,500,1000];

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
} [6]

function openModal(id){ qs('#'+id)?.classList.add('open'); } [4]
function closeModal(id){ qs('#'+id)?.classList.remove('open'); } [4]

function gramsToPrice(sp, g){ return (Number(sp)||0) * (g/1000); } [4]
function rupeeRound(x){ const n=Number(x)||0; const r=Math.floor(n); const p=Math.round((n-r)*100); return p>=90? r+1 : r; } [4]

// Normalize preset entry → numeric grams and label (1kg for 1000g)
function normalizeGramEntry(entry){
  let val = entry;
  if (entry && typeof entry==='object'){
    val = ('val' in entry) ? entry.val : (('value' in entry) ? entry.value : entry);
  }
  const grams = Math.max(0, parseFloat(val)||0);
  const label = grams===1000 ? '1kg' : `${grams}g`;
  return { grams, label };
} [4]

function displayNameOf(it){
  const idx = Number(it.showNameIdx||0)%3;
  const names = [it.name1||'', it.name2||'', it.name3||''];
  return names[idx] || it.name1 || it.name2 || it.name3 || '';
} [4]

function renderCards(mountEl, state, ui){
  const q = (qs('#searchInput')?.value || '').trim().toLowerCase();
  const filtered = !q ? state.items : state.items.filter(it => {
    const n1=(it.name1||'').toLowerCase(), n2=(it.name2||'').toLowerCase(), n3=(it.name3||'').toLowerCase();
    return n1.includes(q)||n2.includes(q)||n3.includes(q);
  }); [4]

  mountEl.innerHTML = '';
  if (!filtered.length){
    const empty = document.createElement('div');
    empty.className='small-muted';
    empty.style.cssText='text-align:center;padding:10px 0';
    empty.textContent='No items yet. Tap + to add.';
    mountEl.appendChild(empty);
    return;
  } [4]

  const frag = document.createDocumentFragment();

  filtered.forEach((it)=>{
    // Ensure showNameIdx exists in memory (persist on next change)
    if (typeof it.showNameIdx!=='number') it.showNameIdx = 0;

    const card=document.createElement('div'); card.className='card';

    // Header row: show one name + small toggle + pencil
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
      </div>`; [6]
    card.appendChild(head);

    // Meta row
    const meta=document.createElement('div'); meta.className='meta';
    meta.style.cssText='display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:2px';
    meta.innerHTML = `
      <div class="sell" style="font-size:.9rem">₹${(+it.sprice||0).toFixed(2)}/kg</div>
      <div class="buy"  style="font-size:.5rem;opacity:.75">₹${(+it.bprice||0).toFixed(2)}/kg</div>`; [6]
    card.appendChild(meta);

    // Dropdown under the card if open
    if(ui.openId===it.id){
      const dd=document.createElement('div'); dd.className='dropdown';
      dd.style.cssText='margin-top:8px;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);padding:8px'; [6]

      // Chips row (weight → ₹, additive taps)
      const chips=document.createElement('div'); chips.style.cssText='display:flex;gap:6px;overflow:auto;padding:2px 0';
      const src=(it.presets?.weight?.length? it.presets.weight : DEFAULT_WEIGHT);
      const sp=+it.sprice||0;
      src.forEach(entry=>{
        const { grams, label } = normalizeGramEntry(entry);
        if(grams<=0) return;
        const amount = rupeeRound(gramsToPrice(sp, grams));
        const b=document.createElement('button'); b.className='small-btn'; b.textContent=`${label}\n₹${amount}`;
        b.style.whiteSpace='pre';
        b.addEventListener('click', ()=>{ addToMiniFromItems(amount); }); // accumulate [4]
        chips.appendChild(b);
      }); [4]
      dd.appendChild(chips);

      // Converter row: ₹ input • live mini mirror • ＋ add • ✕ close
      const conv=document.createElement('div'); conv.style.cssText='display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap';
      conv.innerHTML = `
        <label style="display:flex;align-items:center;gap:6px">
          <span>₹</span>
          <input type="number" inputmode="decimal" min="0" step="0.01" data-price="${it.id}"
                 style="width:120px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:inherit;padding:6px 8px" />
        </label>
        <div class="mini-mirror" style="margin-left:auto;font-weight:800">${formatMoney(0)}</div>
        <button class="small-btn" data-add-now="${it.id}">＋</button>
        <button class="small-btn" data-close="${it.id}">✕</button>
      `; [6]
      dd.appendChild(conv);

      // Keep mini mirror synced with calculator mini
      const mirror = conv.querySelector('.mini-mirror');
      const off = onMiniChange(v => { if(mirror) mirror.innerHTML = formatMoney(v); }); [4]

      dd.addEventListener('input', (e)=>{
        const pid=e.target.getAttribute('data-price');
        if(pid){ const p=parseFloat(e.target.value)||0; setMiniFromItems(p); }
      }); [4]
      dd.addEventListener('click', (e)=>{
        const addNow=e.target.getAttribute('data-add-now');
        const close=e.target.getAttribute('data-close');
        if(addNow){
          const priceInput=dd.querySelector('input[data-price]');
          const p=parseFloat(priceInput?.value)||0;
          const amt=rupeeRound(p);
          if(amt>0){
            addLineFromItems({ itemName: displayNameOf(it), grams:null, price:amt });
            priceInput.value=''; setMiniFromItems(0);
          }
        }
        if(close){ off && off(); ui.openId=null; renderCards(mountEl,state,ui); }
      }); [4]

      card.appendChild(dd);
    }

    frag.appendChild(card);
  });

  mountEl.appendChild(frag);
} [4]

export async function initItems(mountEl, state){
  if(!mountEl) return;

  // Load and ensure showNameIdx defaults
  try { 
    const existing = await dbGet(KEYS.items);
    if(Array.isArray(existing)) existing.forEach(it=>{ if(typeof it.showNameIdx!=='number') it.showNameIdx = 0; });
    if(Array.isArray(existing)) state.items = existing;
  } catch {} [5]

  ensureItemForm(); [6]

  const fab=qs('#fab'); const form=qs('#itemForm'); const title=qs('#itemModalTitle');
  const name1=qs('#name1'); const name2=qs('#name2'); const name3=qs('#name3');
  const sprice=qs('#sprice'); const bprice=qs('#bprice'); const delBtn=qs('#itemDeleteBtn'); [4]

  const ui = { openId:null };
  let editingId=null;
  const genId = () => Math.random().toString(36).slice(2)+Date.now().toString(36); [4]

  function render(){ renderCards(mountEl,state,ui); } [4]

  function startAdd(){
    editingId=null; title.textContent='Add item'; delBtn.style.display='none';
    name1.value=''; name2.value=''; name3.value=''; sprice.value=''; bprice.value='';
    openModal('itemModal'); setTimeout(()=>name1?.focus(),50);
  } [4]
  function startEdit(id){
    const it=state.items.find(x=>x.id===id); if(!it) return;
    editingId=id; title.textContent='Edit item'; delBtn.style.display='inline-block';
    name1.value=it.name1||''; name2.value=it.name2||''; name3.value=it.name3||'';
    sprice.value=it.sprice||''; bprice.value=it.bprice||'';
    openModal('itemModal');
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
    closeModal('itemModal'); render();
  } [5]
  async function onDelete(){
    if(!editingId) return;
    const it=state.items.find(x=>x.id===editingId); if(!it) return;
    if(confirm(`Delete "${displayNameOf(it)}"?`)){
      state.items = state.items.filter(x=>x.id!==editingId);
      await dbSet(KEYS.items, state.items).catch(()=>{});
      closeModal('itemModal'); render();
    }
  } [5]

  fab?.addEventListener('click', startAdd);
  form?.addEventListener('submit', onSubmit);
  delBtn?.addEventListener('click', onDelete); [4]

  mountEl.addEventListener('click', async (e)=>{
    // Edit pencil
    const edit=e.target.getAttribute('data-edit'); 
    if(edit){ startEdit(edit); return; }

    // Toggle dropdown by tapping the name
    const openEl = e.target.closest('[data-open-item]');
    if(openEl){
      const id = openEl.getAttribute('data-open-item');
      ui.openId = (ui.openId===id ? null : id);
      render();
      return;
    }

    // Cycle between Name 1/2/3
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
  }); [4]

  qs('#searchInput')?.addEventListener('input', render); [4]

  render();
} [4]
