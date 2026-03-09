(function(){
  const $ = (q, el=document)=>el.querySelector(q);

  const STORAGE_KEY = 'yt_gallery_admin_draft_v2';
  const VISIT_KEY = 'yt_gallery_visit_count_local';

  function uid(){ return 'vid-' + Math.random().toString(16).slice(2,10); }
  function suid(){ return 'sec-' + Math.random().toString(16).slice(2,10); }

  function toast(msg){
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._tm);
    toast._tm = setTimeout(()=>t.classList.remove('show'), 2200);
  }

  function parseYouTubeId(url){
    if(!url) return null;
    url = String(url).trim();
    if(/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
    let m = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if(m) return m[1];
    m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if(m) return m[1];
    m = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if(m) return m[1];
    m = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if(m) return m[1];
    m = url.match(/([a-zA-Z0-9_-]{11})(?!.*[a-zA-Z0-9_-]{11})/);
    if(m) return m[1];
    return null;
  }

  const sanitize = (t)=>String(t ?? '').replace(/[<>]/g,'');

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        const s = JSON.parse(raw);
        return { sections: s.sections||[], items: s.items||[] };
      }
    }catch(e){}
    return { sections: [], items: [] };
  }

  function persist(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

  function normalize(){
    state.sections = (state.sections||[]).map((s, idx)=>({
      id: String(s.id || suid()),
      title: String(s.title || s.category || `Section ${idx+1}`),
      category: String(s.category || s.title || `Category ${idx+1}`),
      order: Number(s.order ?? (idx+1))
    })).sort((a,b)=>a.order-b.order);

    const fallback = state.sections[0]?.category || 'Uncategorized';
    state.items = (state.items||[]).map(it=>({
      id: String(it.id || uid()),
      title: String(it.title || ''),
      youtube_url: String(it.youtube_url || ''),
      category: String(it.category || fallback),
      description: String(it.description || ''),
      extra_links: Array.isArray(it.extra_links) ? it.extra_links.filter(x=>x && x.url).map(x=>({label:String(x.label||'Link'), url:String(x.url)})) : [],
      tags: Array.isArray(it.tags) ? it.tags.map(String).filter(Boolean) : [],
      created_at: String(it.created_at || ''),
      priority: Number(it.priority ?? 9999),
      featured: !!it.featured
    }));
  }

  function toData(){
    return {
      version: 2,
      generated_at: new Date().toISOString().replace('T',' ').slice(0,19),
      sections: state.sections.map(s=>({id:s.id,title:s.title,category:s.category,order:s.order})),
      items: state.items
    };
  }

  function download(filename, text){
    const blob = new Blob([text], {type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function fromData(data){
    state.sections = Array.isArray(data?.sections) ? data.sections : [];
    state.items = Array.isArray(data?.items) ? data.items : [];
    normalize(); persist(); renderAll(); toast('Import siap.');
  }

  // --- Visits (local-only) ---
  const visits = Number(localStorage.getItem(VISIT_KEY) || '0') + 1;
  localStorage.setItem(VISIT_KEY, String(visits));
  $('#visitCount').textContent = String(visits);

  // --- Section Form ---
  function setSectionForm(s){
    $('#sec_id').value = s?.id || '';
    $('#sec_title').value = s?.title || '';
    $('#sec_category').value = s?.category || '';
    $('#sec_order').value = String(s?.order ?? (state.sections.length+1));
    $('#sec_mode').textContent = s ? 'Edit' : 'New';
  }
  function getSectionForm(){
    const id = ($('#sec_id').value||'').trim() || suid();
    return {
      id,
      title: ($('#sec_title').value||'').trim(),
      category: ($('#sec_category').value||'').trim(),
      order: Number(($('#sec_order').value||'').trim() || 999)
    };
  }
  function upsertSection(s){
    if(!s.title){ toast('Section title wajib.'); return; }
    if(!s.category){ toast('Category wajib.'); return; }
    const others = state.sections.filter(x=>x.id!==s.id).map(x=>x.category.toLowerCase());
    if(others.includes(s.category.toLowerCase())){ toast('Category duplicate.'); return; }

    const idx = state.sections.findIndex(x=>x.id===s.id);
    if(idx>=0) state.sections[idx]=s; else state.sections.push(s);
    state.sections.sort((a,b)=>a.order-b.order);

    const cats = new Set(state.sections.map(x=>x.category));
    const fallback = state.sections[0]?.category || 'Uncategorized';
    state.items.forEach(it=>{ if(!cats.has(it.category)) it.category=fallback; });

    persist(); renderAll(); toast('Section saved.');
    setSectionForm(s);
  }
  function deleteSection(id){
    const idx = state.sections.findIndex(x=>x.id===id);
    if(idx<0) return;
    const cat = state.sections[idx].category;
    state.sections.splice(idx,1);
    const fallback = state.sections[0]?.category || 'Uncategorized';
    state.items.forEach(it=>{ if(it.category===cat) it.category=fallback; });
    persist(); renderAll(); toast('Section deleted.');
    setSectionForm(null);
  }
  function moveSection(id, dir){
    const sorted = state.sections.slice().sort((a,b)=>a.order-b.order);
    const i = sorted.findIndex(x=>x.id===id);
    const j = i + dir;
    if(i<0||j<0||j>=sorted.length) return;
    const tmp = sorted[i].order;
    sorted[i].order = sorted[j].order;
    sorted[j].order = tmp;
    state.sections = sorted.sort((a,b)=>a.order-b.order);
    persist(); renderAll();
  }

  function renderSections(){
    const rows = $('#sec_rows'); rows.innerHTML='';
    if(!state.sections.length){
      rows.innerHTML = `<div class="notice">Tiada section. Tambah section dulu.</div>`;
      return;
    }
    for(const s of state.sections.slice().sort((a,b)=>a.order-b.order)){
      const row = document.createElement('div');
      row.className='row';
      row.innerHTML = `
        <div>
          <div><strong>${sanitize(s.title)}</strong></div>
          <div class="pill">Category: ${sanitize(s.category)}</div>
        </div>
        <div class="hide-sm"><div class="pill">Order: ${sanitize(s.order)}</div></div>
        <div class="hide-md"><div class="pill">ID: ${sanitize(s.id)}</div></div>
        <div class="row-actions">
          <button class="btn sm ghost edit">Edit</button>
          <button class="btn sm ghost up">↑</button>
          <button class="btn sm ghost down">↓</button>
          <button class="btn sm danger del">Delete</button>
        </div>
      `;
      row.querySelector('.edit').addEventListener('click', ()=>setSectionForm(s));
      row.querySelector('.up').addEventListener('click', ()=>moveSection(s.id,-1));
      row.querySelector('.down').addEventListener('click', ()=>moveSection(s.id,1));
      row.querySelector('.del').addEventListener('click', ()=>{
        if(confirm(`Delete section "${s.title}"? Items akan dipindah.`)) deleteSection(s.id);
      });
      rows.appendChild(row);
    }
  }

  // --- Item Form ---
  function refreshCategorySelect(){
    const sel = $('#category');
    sel.innerHTML = state.sections.map(s=>`<option value="${sanitize(s.category)}">${sanitize(s.category)}</option>`).join('');
  }
  function setItemForm(it){
    refreshCategorySelect();
    $('#id').value = it?.id || '';
    $('#title').value = it?.title || '';
    $('#youtube_url').value = it?.youtube_url || '';
    $('#created_at').value = it?.created_at || new Date().toISOString().slice(0,10);
    $('#priority').value = String(it?.priority ?? '');
    $('#featured').checked = !!it?.featured;
    $('#tags').value = (it?.tags || []).join(', ');
    $('#description').value = it?.description || '';
    $('#category').value = it?.category || (state.sections[0]?.category || '');
    const lines = (it?.extra_links || []).map(l=>`${l.label||'Link'} | ${l.url}`).join('\n');
    $('#extra_links').value = lines;
    const v = $('#youtube_url').value || '';
    $('#yt_status').textContent = v ? (parseYouTubeId(v)?'OK':'Invalid link') : '-';
    $('#item_mode').textContent = it ? 'Edit' : 'New';
  }
  function parseExtraLinks(text){
    const lines = String(text||'').split('\n').map(s=>s.trim()).filter(Boolean);
    const out=[];
    for(const line of lines){
      const parts = line.split('|').map(s=>s.trim());
      if(parts.length===1){ out.push({label:'Link', url:parts[0]}); }
      else{
        const label = parts[0] || 'Link';
        const url = parts.slice(1).join(' | ').trim();
        if(url) out.push({label, url});
      }
    }
    return out.filter(x=>x.url);
  }
  function getItemForm(){
    const id = ($('#id').value||'').trim() || uid();
    const tags = ($('#tags').value||'').split(',').map(s=>s.trim()).filter(Boolean);
    return {
      id,
      title: ($('#title').value||'').trim(),
      youtube_url: ($('#youtube_url').value||'').trim(),
      category: ($('#category').value||'').trim(),
      description: ($('#description').value||'').trim(),
      extra_links: parseExtraLinks($('#extra_links').value||''),
      tags,
      created_at: ($('#created_at').value||'').trim(),
      priority: Number((($('#priority').value||'').trim()) || 9999),
      featured: $('#featured').checked
    };
  }
  function upsertItem(it){
    const idx = state.items.findIndex(x=>x.id===it.id);
    if(idx>=0) state.items[idx]=it; else state.items.unshift(it);
    persist(); renderItems(); toast('Item saved.');
    setItemForm(it);
  }
  function deleteItem(id){
    const idx = state.items.findIndex(x=>x.id===id);
    if(idx<0) return;
    state.items.splice(idx,1);
    persist(); renderItems(); toast('Item deleted.');
    setItemForm(null);
  }

  function renderItems(){
    refreshCategorySelect();
    const cats = state.sections.map(s=>s.category);

    // ✅ FIX: preserve selected category; jangan reset bila render semula
    const prevCat = ($('#filter_cat').value||'').trim();

    $('#filter_cat').innerHTML = `<option value="">Semua category</option>` +
      cats.map(c=>`<option value="${sanitize(c)}">${sanitize(c)}</option>`).join('');

    // restore selection (kalau masih wujud)
    $('#filter_cat').value = cats.includes(prevCat) ? prevCat : '';

    const q = ($('#search').value||'').toLowerCase().trim();
    const cat = ($('#filter_cat').value||'').trim();
    const feat = ($('#filter_feat').value||'').trim();

    let list = state.items.slice();
    if(cat) list = list.filter(it=>it.category===cat);
    if(feat==='featured') list = list.filter(it=>!!it.featured);
    if(q){
      list = list.filter(it=>{
        const hay = `${it.title} ${it.description} ${it.tags.join(' ')} ${it.youtube_url} ${it.category}`.toLowerCase();
        return hay.includes(q);
      });
    }

    $('#count').textContent = `${list.length} item`;

    const rows = $('#rows'); rows.innerHTML='';
    if(!list.length){
      rows.innerHTML = `<div class="notice">Tiada item. Klik <span class="kbd">New Item</span>.</div>`;
      return;
    }

    for(const it of list){
      const ok = !!parseYouTubeId(it.youtube_url);
      const row = document.createElement('div');
      row.className='row';
      row.innerHTML = `
        <div>
          <div><strong>${sanitize(it.title || '(untitled)')}</strong></div>
          <div class="pill">${sanitize(it.category || '-')} • P:${sanitize(it.priority ?? '-')} • ${sanitize(it.created_at || '-')}</div>
        </div>
        <div class="hide-sm">
          <div class="pill">${ok?'YouTube OK':'Link invalid'}</div>
          <div class="pill">${it.featured?'⭐ Featured':''}</div>
        </div>
        <div class="hide-md"><div class="pill">${(it.tags||[]).slice(0,4).map(sanitize).join(', ')||'-'}</div></div>
        <div class="row-actions">
          <button class="btn sm ghost edit">Edit</button>
          <button class="btn sm danger del">Delete</button>
        </div>
      `;
      row.querySelector('.edit').addEventListener('click', ()=>setItemForm(it));
      row.querySelector('.del').addEventListener('click', ()=>{
        if(confirm(`Delete "${it.title}"?`)) deleteItem(it.id);
      });
      rows.appendChild(row);
    }
  }

  function renderAll(){ renderSections(); renderItems(); }

  // --- State init ---
  const state = loadState();
  normalize(); persist();

  // default forms
  setSectionForm(null);
  setItemForm(null);

  // --- Events ---
  $('#sec_newBtn').addEventListener('click', ()=>setSectionForm(null));
  $('#sec_saveBtn').addEventListener('click', ()=>upsertSection(getSectionForm()));
  $('#sec_deleteBtn').addEventListener('click', ()=>{
    const id = ($('#sec_id').value||'').trim();
    if(!id) return toast('Tiada section dipilih.');
    const s = state.sections.find(x=>x.id===id);
    if(!s) return toast('Section tak jumpa.');
    if(confirm(`Delete section "${s.title}"?`)) deleteSection(id);
  });

  $('#newBtn').addEventListener('click', ()=>setItemForm(null));
  $('#saveBtn').addEventListener('click', ()=>{
    if(!state.sections.length) return toast('Tambah section dulu.');
    const it = getItemForm();
    if(!it.title) return toast('Title wajib.');
    if(!it.youtube_url) return toast('YouTube link wajib.');
    if(!parseYouTubeId(it.youtube_url)) return toast('Link YouTube invalid.');
    upsertItem(it);
  });
  $('#deleteBtn').addEventListener('click', ()=>{
    const id = ($('#id').value||'').trim();
    if(!id) return toast('Tiada item dipilih.');
    const it = state.items.find(x=>x.id===id);
    if(!it) return toast('Item tak jumpa.');
    if(confirm(`Delete "${it.title}"?`)) deleteItem(id);
  });

  $('#exportBtn').addEventListener('click', ()=>{
    download('data.json', JSON.stringify(toData(), null, 2));
    toast('Export data.json siap.');
  });

  $('#importFile').addEventListener('change', async (e)=>{
    const f = e.target.files?.[0];
    if(!f) return;
    try{
      fromData(JSON.parse(await f.text()));
      setSectionForm(null); setItemForm(null);
      e.target.value='';
    }catch(err){
      console.error(err);
      toast('Import gagal: JSON tak valid.');
    }
  });

  $('#clearAllBtn').addEventListener('click', ()=>{
    if(!confirm('Clear semua draft (localStorage)?')) return;
    state.sections=[]; state.items=[];
    normalize(); persist(); renderAll();
    setSectionForm(null); setItemForm(null);
    toast('Cleared.');
  });

  $('#youtube_url').addEventListener('input', ()=>{
    const v = $('#youtube_url').value || '';
    $('#yt_status').textContent = v ? (parseYouTubeId(v)?'OK':'Invalid link') : '-';
  });

  ['input','change'].forEach(evt=>{
    $('#search').addEventListener(evt, renderItems);
    $('#filter_cat').addEventListener(evt, renderItems);
    $('#filter_feat').addEventListener(evt, renderItems);
  });

  $('#loadSampleBtn').addEventListener('click', async ()=>{
    try{
      const res = await fetch('../data.json', {cache:'no-store'});
      fromData(await res.json());
      setSectionForm(null); setItemForm(null);
    }catch(e){
      toast('Tak dapat load data.json. Import manual lebih selamat.');
    }
  });

  renderAll();
})();
