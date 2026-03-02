(function(){
  const $ = (q, el=document)=>el.querySelector(q);
  const $$ = (q, el=document)=>Array.from(el.querySelectorAll(q));

  const STORAGE_KEY = 'yt_gallery_admin_draft_v1';

  function uid(){ return 'vid-' + Math.random().toString(16).slice(2,10); }

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

  function toData(){
    return {
      version: 1,
      generated_at: new Date().toISOString().replace('T',' ').slice(0,19),
      items: state.items
    };
  }

  function fromData(data){
    const items = Array.isArray(data?.items) ? data.items : [];
    // normalize
    state.items = items.map(it => ({
      id: String(it.id || uid()),
      title: String(it.title || ''),
      youtube_url: String(it.youtube_url || ''),
      description: String(it.description || ''),
      tags: Array.isArray(it.tags) ? it.tags.map(String).filter(Boolean) : [],
      created_at: String(it.created_at || ''),
      featured: !!it.featured
    }));
    state.selectedId = null;
    persist();
    render();
    toast('Import siap.');
  }

  function persist(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        const s = JSON.parse(raw);
        if(s && Array.isArray(s.items)){
          return {
            items: s.items,
            selectedId: s.selectedId || null
          };
        }
      }
    }catch(e){}
    return { items: [], selectedId: null };
  }

  function sanitize(text){
    return String(text ?? '').replace(/[<>]/g,'');
  }

  function setForm(item){
    $('#id').value = item?.id || '';
    $('#title').value = item?.title || '';
    $('#youtube_url').value = item?.youtube_url || '';
    $('#created_at').value = item?.created_at || new Date().toISOString().slice(0,10);
    $('#featured').checked = !!item?.featured;
    $('#tags').value = (item?.tags || []).join(', ');
    $('#description').value = item?.description || '';
    $('#yt_status').textContent = item?.youtube_url ? (parseYouTubeId(item.youtube_url) ? 'OK' : 'Invalid link') : '-';
  }

  function getForm(){
    const id = ($('#id').value || '').trim() || uid();
    const tags = ($('#tags').value || '')
      .split(',')
      .map(s=>s.trim())
      .filter(Boolean);
    return {
      id,
      title: ($('#title').value || '').trim(),
      youtube_url: ($('#youtube_url').value || '').trim(),
      description: ($('#description').value || '').trim(),
      tags,
      created_at: ($('#created_at').value || '').trim(),
      featured: $('#featured').checked
    };
  }

  function upsert(item){
    const idx = state.items.findIndex(x=>x.id === item.id);
    if(idx >= 0) state.items[idx] = item;
    else state.items.unshift(item); // newest on top
    state.selectedId = item.id;
    persist();
    render();
    toast('Saved.');
  }

  function del(id){
    const idx = state.items.findIndex(x=>x.id === id);
    if(idx < 0) return;
    state.items.splice(idx,1);
    if(state.selectedId === id) state.selectedId = null;
    persist();
    render();
    toast('Deleted.');
  }

  function move(id, dir){
    const i = state.items.findIndex(x=>x.id === id);
    if(i < 0) return;
    const j = i + dir;
    if(j < 0 || j >= state.items.length) return;
    const tmp = state.items[i];
    state.items[i] = state.items[j];
    state.items[j] = tmp;
    persist();
    render();
  }

  function applyFilters(list){
    const q = ($('#search').value || '').toLowerCase().trim();
    const tag = ($('#filter_tag').value || '').trim();
    const feat = ($('#filter_feat').value || '').trim();

    let items = list.slice();

    if(tag){
      items = items.filter(it => it.tags.includes(tag));
    }
    if(feat === 'featured'){
      items = items.filter(it => !!it.featured);
    }
    if(q){
      items = items.filter(it => {
        const hay = `${it.title} ${it.description} ${it.tags.join(' ')} ${it.youtube_url}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return items;
  }

  function refreshTagFilter(){
    const tags = new Set();
    state.items.forEach(it => it.tags.forEach(t=>tags.add(t)));
    const sorted = Array.from(tags).sort((a,b)=>a.localeCompare(b));
    $('#filter_tag').innerHTML = `<option value="">Semua tag</option>` + sorted.map(t=>`<option value="${sanitize(t)}">${sanitize(t)}</option>`).join('');
  }

  function render(){
    refreshTagFilter();

    const rows = $('#rows');
    const filtered = applyFilters(state.items);

    $('#count').textContent = `${filtered.length} item`;
    rows.innerHTML = '';

    if(!filtered.length){
      rows.innerHTML = `<div class="notice">Tiada item. Klik <span class="kbd">New</span> untuk tambah video.</div>`;
      return;
    }

    for(const it of filtered){
      const row = document.createElement('div');
      row.className = 'row';
      row.dataset.id = it.id;

      const ytok = !!parseYouTubeId(it.youtube_url);

      row.innerHTML = `
        <div>
          <div><strong>${sanitize(it.title || '(untitled)')}</strong></div>
          <div class="pill">${sanitize(it.id)}</div>
        </div>
        <div class="hide-sm">
          <div class="pill">${sanitize(it.youtube_url || '-')}</div>
          <div class="pill">${ytok ? 'YouTube OK' : 'Link invalid'}</div>
        </div>
        <div class="hide-md">
          <div class="pill">${sanitize(it.created_at || '-')}</div>
          <div class="pill">${it.featured ? '⭐ Featured' : ''}</div>
        </div>
        <div class="hide-md">
          <div class="pill">${(it.tags||[]).slice(0,4).map(sanitize).join(', ') || '-'}</div>
        </div>
        <div class="row-actions">
          <button class="btn sm ghost edit">Edit</button>
          <button class="btn sm ghost up" title="Move up">↑</button>
          <button class="btn sm ghost down" title="Move down">↓</button>
          <button class="btn sm danger del">Delete</button>
        </div>
      `;

      $('.edit', row).addEventListener('click', ()=>{
        state.selectedId = it.id;
        persist();
        setForm(it);
        $('#mode').textContent = 'Edit';
        toast('Loaded to form.');
        window.scrollTo({top:0, behavior:'smooth'});
      });
      $('.del', row).addEventListener('click', ()=>{
        if(confirm(`Delete: ${it.title || it.id}?`)) del(it.id);
      });
      $('.up', row).addEventListener('click', ()=>move(it.id, -1));
      $('.down', row).addEventListener('click', ()=>move(it.id, 1));

      rows.appendChild(row);
    }
  }

  function download(filename, text){
    const blob = new Blob([text], {type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // State
  const state = loadState();

  // Init form
  setForm(null);
  $('#mode').textContent = 'New';

  // Events
  $('#newBtn').addEventListener('click', ()=>{
    state.selectedId = null;
    persist();
    setForm(null);
    $('#mode').textContent = 'New';
    toast('New item.');
  });

  $('#saveBtn').addEventListener('click', ()=>{
    const item = getForm();
    if(!item.title){ toast('Title wajib.'); return; }
    if(!item.youtube_url){ toast('YouTube link wajib.'); return; }
    if(!parseYouTubeId(item.youtube_url)){ toast('Link YouTube invalid.'); return; }
    upsert(item);
    $('#mode').textContent = 'Edit';
  });

  $('#deleteBtn').addEventListener('click', ()=>{
    const id = ($('#id').value || '').trim();
    if(!id){ toast('Tiada item dipilih.'); return; }
    const it = state.items.find(x=>x.id===id);
    if(!it){ toast('ID tak jumpa.'); return; }
    if(confirm(`Delete: ${it.title || it.id}?`)) del(id);
    setForm(null);
    $('#mode').textContent = 'New';
  });

  $('#exportBtn').addEventListener('click', ()=>{
    const data = toData();
    download('data.json', JSON.stringify(data, null, 2));
    toast('Export data.json siap.');
  });

  $('#importFile').addEventListener('change', async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    try{
      const txt = await file.text();
      const data = JSON.parse(txt);
      fromData(data);
      setForm(null);
      $('#mode').textContent = 'New';
      e.target.value = '';
    }catch(err){
      console.error(err);
      toast('Import gagal: JSON tak valid.');
    }
  });

  $('#clearAllBtn').addEventListener('click', ()=>{
    if(!confirm('Clear semua data dalam draft (localStorage)?')) return;
    state.items = [];
    state.selectedId = null;
    persist();
    setForm(null);
    $('#mode').textContent = 'New';
    render();
    toast('Cleared.');
  });

  $('#youtube_url').addEventListener('input', ()=>{
    const v = $('#youtube_url').value || '';
    $('#yt_status').textContent = v ? (parseYouTubeId(v) ? 'OK' : 'Invalid link') : '-';
  });

  ['input','change'].forEach(evt=>{
    $('#search').addEventListener(evt, render);
    $('#filter_tag').addEventListener(evt, render);
    $('#filter_feat').addEventListener(evt, render);
  });

  // initial render
  render();

  // helpers
  $('#loadSampleBtn').addEventListener('click', async ()=>{
    try{
      const res = await fetch('./data.json', {cache:'no-store'});
      const data = await res.json();
      fromData(data);
      setForm(null);
      $('#mode').textContent = 'New';
    }catch(e){
      toast('Tak dapat load data.json (CORS/file://). Import file manual lebih selamat.');
    }
  });

})();
