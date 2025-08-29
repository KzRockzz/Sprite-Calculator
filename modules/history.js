// modules/history.js
import { get as dbGet, set as dbSet, KEYS } from './storage.js';

// Locale-aware date/relative formatters
const absFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }); // absolute date [MDN Intl.DateTimeFormat]
const relFmt = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' }); // relative "time ago" [MDN Intl.RelativeTimeFormat]

// Relative helper
function relFrom(nowMs, ts){
  const diffSec = Math.floor((ts - nowMs) / 1000);
  const absSec = Math.abs(diffSec);
  if (absSec < 60) return relFmt.format(diffSec, 'second');        // seconds granularity
  const diffMin = Math.floor(diffSec / 60);
  if (Math.abs(diffMin) < 60) return relFmt.format(diffMin, 'minute');
  const diffHr = Math.floor(diffMin / 60);
  if (Math.abs(diffHr) < 24) return relFmt.format(diffHr, 'hour');
  const diffDay = Math.floor(diffHr / 24);
  return relFmt.format(diffDay, 'day');
}

// Trigger a file download (JSON) via Blob + anchor download
function downloadJSON(obj, filename='bill.json'){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 150);
}

function makeModalShell(){
  const wrap = document.createElement('div');
  wrap.id = 'historyModal';
  wrap.className = 'backdrop';                // reuse shell CSS: .backdrop.open shows modal
  wrap.setAttribute('data-close','historyModal');
  wrap.innerHTML = `
    <div class="modal" role="dialog" aria-label="Bill history">
      <div class="modal-head" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div id="historyTitle" style="font-weight:800">Bill history</div>
        <button class="small-btn" data-close="historyModal">✕</button>
      </div>
      <div id="historyBody" class="modal-body" style="padding-top:8px"></div>
    </div>
  `;
  return wrap;
}

function openModal(){ document.getElementById('historyModal')?.classList.add('open'); }
function closeModal(){ document.getElementById('historyModal')?.classList.remove('open'); }

function fmtAbs(ts){ try { return absFmt.format(ts); } catch { return new Date(ts).toLocaleString(); } } // absolute date
function fmtRel(ts){ try { return relFrom(Date.now(), ts); } catch { return ''; } }                    // relative label

function renderList(state){
  const body = document.getElementById('historyBody');
  if (!body) return;
  body.innerHTML = '';

  const bills = Array.isArray(state.bills) ? state.bills : [];
  if (!bills.length){
    const empty = document.createElement('div');
    empty.className = 'small-muted';
    empty.style.cssText = 'text-align:center;padding:10px 0';
    empty.textContent = 'No saved bills yet. Use “Save bill” after adding lines.';
    body.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();

  bills.forEach((b, idx)=>{
    const row = document.createElement('div');
    row.style.cssText = 'border-bottom:1px solid rgba(255,255,255,.08);padding:8px 0;display:grid;gap:6px';

    // Top line: name + total + actions
    const top = document.createElement('div');
    top.style.cssText = 'display:flex;align-items:center;gap:8px;justify-content:space-between';
    const name = (b.name && String(b.name).trim()) || `Bill ${idx+1}`;
    top.innerHTML = `
      <div style="min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700">${name}</div>
      <div style="display:flex;align-items:center;gap:6px;flex:0 0 auto">
        <button class="small-btn" data-view="${b.id}">View</button>
        <button class="small-btn" data-rename="${b.id}">Rename</button>
        <button class="small-btn" data-export="${b.id}">Export</button>
        <button class="small-btn" data-del="${b.id}">Delete</button>
      </div>
    `;
    row.appendChild(top);

    // Meta line
    const meta = document.createElement('div');
    meta.className = 'small-muted';
    const ts = b.ts || Date.now();
    const count = Array.isArray(b.lines) ? b.lines.length : 0;
    const total = (b.total ?? 0);
    meta.innerHTML = `${fmtAbs(ts)} • ${fmtRel(ts)} • ${count} lines • ₹${total.toFixed(2)}`;
    row.appendChild(meta);

    // Details container (collapsed)
    const det = document.createElement('div');
    det.id = `bill-det-${b.id}`;
    det.style.cssText = 'display:none;padding:6px 0 0 0';
    const dl = document.createElement('div');
    dl.style.cssText = 'display:grid;gap:6px';
    (b.lines||[]).forEach(ln=>{
      const it = document.createElement('div');
      it.style.cssText = 'display:flex;justify-content:space-between;gap:8px';
      const left = document.createElement('div');
      left.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      left.textContent = ln.itemName || 'Item';
      const right = document.createElement('div');
      right.textContent = `₹${Number(ln.lineTotal||0).toFixed(2)}`;
      it.append(left,right);
      dl.appendChild(it);
    });
    det.appendChild(dl);
    row.appendChild(det);

    frag.appendChild(row);
  });

  body.appendChild(frag);

  // Actions
  body.addEventListener('click', async (e)=>{
    const idV = e.target.getAttribute('data-view');
    const idR = e.target.getAttribute('data-rename');
    const idE = e.target.getAttribute('data-export');
    const idD = e.target.getAttribute('data-del');

    const idxById = (id)=> (state.bills||[]).findIndex(x=> String(x.id)===String(id));

    if (idV){
      const idx = idxById(idV); if (idx<0) return;
      const det = document.getElementById(`bill-det-${idV}`);
      if (det){ det.style.display = det.style.display==='none' ? 'block' : 'none'; }
      return;
    }
    if (idR){
      const idx = idxById(idR); if (idx<0) return;
      const cur = state.bills[idx];
      const name = prompt('Rename bill:', cur.name || `Bill ${idx+1}`);
      if (name!=null){
        cur.name = String(name).trim();
        await dbSet(KEYS.bills, state.bills).catch(()=>{});
        renderList(state);
      }
      return;
    }
    if (idE){
      const idx = idxById(idE); if (idx<0) return;
      const cur = state.bills[idx];
      downloadJSON(cur, (cur.name?.trim() || 'bill') + '.json');
      return;
    }
    if (idD){
      const idx = idxById(idD); if (idx<0) return;
      if (confirm('Delete this bill?')){
        state.bills.splice(idx,1);
        await dbSet(KEYS.bills, state.bills).catch(()=>{});
        renderList(state);
      }
      return;
    }
  }, { once:true });
}

export function initHistory(state){
  // Inject History button next to “Save bill”
  const saveBtn = document.getElementById('cSaveBill');
  if (saveBtn && !document.getElementById('cHistoryBtn')){
    const btn = document.createElement('button');
    btn.className = 'small-btn';
    btn.id = 'cHistoryBtn';
    btn.textContent = 'History';
    saveBtn.insertAdjacentElement('afterend', btn);
    btn.addEventListener('click', async ()=>{
      // Ensure bills are up to date
      try {
        const fresh = await dbGet(KEYS.bills);
        if (Array.isArray(fresh)) state.bills = fresh.slice(0,20);
      } catch {}
      if (!document.getElementById('historyModal')){
        document.body.appendChild(makeModalShell());
      }
      renderList(state);
      openModal();
    });
  }

  // Close modal by backdrop click
  document.addEventListener('click', (e)=>{
    const closeId = e.target.getAttribute('data-close');
    if (closeId==='historyModal'){ closeModal(); }
  });
}
