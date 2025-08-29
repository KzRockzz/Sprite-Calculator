// modules/items.js
import { get as dbGet, set as dbSet, KEYS } from './storage.js';

const qs  = (s, r=document) => r.querySelector(s);

function themedInputAttrs(){
  return 'style="border-radius:9px;border:1px solid rgba(255,255,255,.12);' +
         'background:var(--field-bg, rgba(255,255,255,.05));color:var(--fg, inherit);padding:8px"';
}

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
} [7]

function openModal(id){ qs('#'+id)?.classList.add('open'); } [2]
function closeModal(id){ qs('#'+id)?.classList.remove('open'); } [2]

export async function initItems(mountEl, state){
  try {
    const existing = await dbGet(KEYS.items);
    if(Array.isArray(existing)) state.items = existing;
  } catch {} [8]

  ensureItemForm(); [7]

  const fab=qs('#fab'); const form=qs('#itemForm'); const title=qs('#itemModalTitle');
  const name1=qs('#name1'); const name2=qs('#name2'); const name3=qs('#name3');
  const sprice=qs('#sprice'); const bprice=qs('#bprice'); const delBtn=qs('#itemDeleteBtn');

  let editingId=null;
  const genId = () => Math.random().toString(36).slice(2)+Date.now().toString(36);

  function startAdd(){
    editingId=null; title.textContent='Add item'; delBtn.style.display='none';
    name1.value=''; name2.value=''; name3.value=''; sprice.value=''; bprice.value='';
    openModal('itemModal'); setTimeout(()=>name1?.focus(),50);
  } [2]
  function startEdit(id){
    const it=state.items.find(x=>x.id===id); if(!it) return;
    editingId=id; title.textContent='Edit item'; delBtn.style.display='inline-block';
    name1.value=it.name1||''; name2.value=it.name2||''; name3.value=it.name3||'';
    sprice.value=it.sprice||''; bprice.value=it.bprice||'';
    openModal('itemModal');
  } [2]

  async function onSubmit(e){
    e.preventDefault();
    const payload={ name1:name1.value.trim(), name2:name2.value.trim(), name3:name3.value.trim(),
      sprice:+(+sprice.value||0).toFixed(2), bprice:+(+bprice.value||0).toFixed(2),
      showNameIdx: 0, presets:{ weight:[50,100,500,1000] } };
    if(!(payload.name1&&payload.name2&&payload.name3)){ alert('Please fill all three names.'); return; }
    if(!editingId){ state.items.unshift({ id:genId(), ...payload }); }
    else { const it=state.items.find(x=>x.id===editingId); if(it) Object.assign(it, payload, { showNameIdx: it.showNameIdx??0 }); }
    await dbSet(KEYS.items, state.items).catch(()=>{});
    closeModal('itemModal');
  } [8]
  async function onDelete(){
    if(!editingId) return;
    const it=state.items.find(x=>x.id===editingId); if(!it) return;
    if(confirm(`Delete "${it.name1||'Item'}"?`)){
      state.items = state.items.filter(x=>x.id!==editingId);
      await dbSet(KEYS.items, state.items).catch(()=>{});
      closeModal('itemModal');
    }
  } [8]

  fab?.addEventListener('click', startAdd);
  form?.addEventListener('submit', onSubmit);
  delBtn?.addEventListener('click', onDelete);

  // Ensure any legacy list mount is hidden/cleared so nothing shows under the bill
  if (mountEl){ mountEl.replaceChildren(); mountEl.style.display='none'; } // remove in‑page list [2]
}
