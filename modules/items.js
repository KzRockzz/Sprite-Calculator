// modules/items.js
import { get as dbGet, set as dbSet, KEYS } from './storage.js';

// DOM helpers
const qs  = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];

// Install the add/edit form inside the existing item modal body
function ensureItemForm(){
  const body = qs('#itemModalBody');
  if (!body) return;
  if (body.dataset.wired === '1') return;
  body.dataset.wired = '1';
  body.innerHTML = `
    <form id="itemForm" novalidate>
      <div style="display:grid;grid-template-columns:1fr;gap:8px">
        <label style="display:flex;flex-direction:column;gap:4px">
          <span>Name 1</span>
          <input id="name1" required maxlength="80" />
        </label>
        <label style="display:flex;flex-direction:column;gap:4px">
          <span>Name 2</span>
          <input id="name2" required maxlength="80" />
        </label>
        <label style="display:flex;flex-direction:column;gap:4px">
          <span>Name 3</span>
          <input id="name3" required maxlength="80" />
        </label>
        <label style="display:flex;flex-direction:column;gap:4px">
          <span>Selling ₹/kg</span>
          <input id="sprice" type="number" step="0.01" min="0" inputmode="decimal" />
        </label>
        <label style="display:flex;flex-direction:column;gap:4px">
          <span>Bought ₹/kg</span>
          <input id="bprice" type="number" step="0.01" min="0" inputmode="decimal" />
        </label>
      </div>
      <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:10px">
        <button type="button" class="small-btn" data-close="itemModal">Cancel</button>
        <button type="submit" class="small-btn" id="itemSaveBtn">Save</button>
        <button type="button" class="small-btn" id="itemDeleteBtn" style="display:none">Delete</button>
      </div>
    </form>
  `;
}

// Modal helpers
function openModal(id){ qs('#'+id)?.classList.add('open'); }
function closeModal(id){ qs('#'+id)?.classList.remove('open'); }

// Render compact item cards under the calculator
function renderCards(mountEl, state){
  const q = (qs('#searchInput')?.value || '').trim().toLowerCase();
  const items = !q ? state.items : state.items.filter(it => {
    const n1=(it.name1||'').toLowerCase(), n2=(it.name2||'').toLowerCase(), n3=(it.name3||'').toLowerCase();
    return n1.includes(q)||n2.includes(q)||n3.includes(q);
  });

  mountEl.innerHTML = '';
  if (!items.length){
    const empty = document.createElement('div');
    empty.className='small-muted';
    empty.style.cssText='text-align:center;padding:10px 0';
    empty.textContent='No items yet. Tap + to add.';
    mountEl.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();
  items.forEach((it)=>{
    const card = document.createElement('div');
    card.className='card';

    // Header row: names left, pencil right
    const head = document.createElement('div');
    head.className = 'card-row';
    head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:6px';
    head.innerHTML = `
      <div class="names" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        ${it.name1} <span class="sep">/</span> ${it.name2} <span class="sep">/</span> ${it.name3}
      </div>
      <div class="row-icons" style="flex:0 0 auto">
        <button class="small-btn" data-edit="${it.id}" title="Edit">✏️</button>
      </div>
    `;
    card.appendChild(head);

    // Meta row: sell (normal), bought (10% bigger than before)
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:2px';
    meta.innerHTML = `
      <div class="sell" style="font-size:.9rem">₹${(+it.sprice||0).toFixed(2)}/kg</div>
      <div class="buy"  style="font-size:.5rem;opacity:.75">₹${(+it.bprice||0).toFixed(2)}/kg</div>
    `;
    card.appendChild(meta);

    frag.appendChild(card);
  });

  mountEl.appendChild(frag);
}

export async function initItems(mountEl, state){
  if(!mountEl) return;

  // Load any saved items into state from IndexedDB
  try {
    const existing = await dbGet(KEYS.items);
    if (Array.isArray(existing)) state.items = existing;
  } catch {}

  // Ensure form exists in the modal body
  ensureItemForm();

  // Elements
  const fab = qs('#fab');
  const form = qs('#itemForm');
  const title = qs('#itemModalTitle');
  const name1 = qs('#name1');
  const name2 = qs('#name2');
  const name3 = qs('#name3');
  const sprice = qs('#sprice');
  const bprice = qs('#bprice');
  const delBtn = qs('#itemDeleteBtn');

  // Editing state
  let editingId = null;
  const genId = () => Math.random().toString(36).slice(2)+Date.now().toString(36);

  function render(){ renderCards(mountEl, state); }

  function startAdd(){
    editingId = null;
    title.textContent='Add item';
    delBtn.style.display='none';
    name1.value=''; name2.value=''; name3.value='';
    sprice.value=''; bprice.value='';
    openModal('itemModal');
    setTimeout(()=>name1?.focus(), 50);
  }

  function startEdit(id){
    const it = state.items.find(x=>x.id===id);
    if(!it) return;
    editingId = id;
    title.textContent='Edit item';
    delBtn.style.display='inline-block';
    name1.value=it.name1||''; name2.value=it.name2||''; name3.value=it.name3||'';
    sprice.value=it.sprice||''; bprice.value=it.bprice||'';
    openModal('itemModal');
  }

  async function onSubmit(e){
    e.preventDefault();
    const payload = {
      name1: name1.value.trim(),
      name2: name2.value.trim(),
      name3: name3.value.trim(),
      sprice: +(+sprice.value||0).toFixed(2),
      bprice: +(+bprice.value||0).toFixed(2)
    };
    if(!(payload.name1 && payload.name2 && payload.name3)){
      alert('Please fill all three names.'); return;
    }
    if(!editingId){
      state.items.unshift({ id: genId(), ...payload });
    }else{
      const it = state.items.find(x=>x.id===editingId);
      if (it) Object.assign(it, payload);
    }
    await dbSet(KEYS.items, state.items).catch(()=>{});
    closeModal('itemModal');
    render();
  }

  async function onDelete(){
    if(!editingId) return;
    const it = state.items.find(x=>x.id===editingId);
    if(!it) return;
    if(confirm(`Delete "${it.name1} / ${it.name2} / ${it.name3}"?`)){
      state.items = state.items.filter(x=>x.id!==editingId);
      await dbSet(KEYS.items, state.items).catch(()=>{});
      closeModal('itemModal');
      render();
    }
  }

  // Wire UI events
  fab?.addEventListener('click', startAdd);
  form?.addEventListener('submit', onSubmit);
  delBtn?.addEventListener('click', onDelete);

  mountEl.addEventListener('click', (e)=>{
    const edit = e.target.getAttribute('data-edit');
    if(edit){ startEdit(edit); }
  });

  // Live search re-render
  qs('#searchInput')?.addEventListener('input', render);

  // Initial paint
  render();
}
