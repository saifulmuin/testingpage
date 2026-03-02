(function(){
  const $ = (q, el=document) => el.querySelector(q);
  const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));

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

    // If someone pasted just the ID
    if(/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;

    // Handle youtu.be/<id>
    let m = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if(m) return m[1];

    // watch?v=<id>
    m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if(m) return m[1];

    // /embed/<id>
    m = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if(m) return m[1];

    // /shorts/<id>
    m = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if(m) return m[1];

    // fallback: last 11-ish token
    m = url.match(/([a-zA-Z0-9_-]{11})(?!.*[a-zA-Z0-9_-]{11})/);
    if(m) return m[1];

    return null;
  }

  function thumbUrl(id){
    // hqdefault is usually ok
    return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }

  function embedUrl(id){
    // privacy-enhanced mode
    return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
  }

  function sanitize(text){
    return String(text ?? '').replace(/[<>]/g, '');
  }

  function render(items){
    const grid = $('#grid');
    grid.innerHTML = '';

    if(!items.length){
      grid.innerHTML = `<div class="notice">Tiada video match dengan filter/search.</div>`;
      return;
    }

    for(const item of items){
      const id = parseYouTubeId(item.youtube_url);
      const img = id ? thumbUrl(id) : '';
      const tags = Array.isArray(item.tags) ? item.tags : [];
      const featured = !!item.featured;

      const card = document.createElement('article');
      card.className = 'card';
      card.dataset.id = item.id || '';
      card.dataset.ytid = id || '';

      card.innerHTML = `
        <div class="thumb" role="button" tabindex="0" aria-label="Play ${sanitize(item.title)}">
          ${img ? `<img src="${img}" alt="${sanitize(item.title)}">` : `<div class="play"><div class="triangle"></div></div>`}
          <div class="play"><div class="triangle"></div></div>
        </div>
        <div class="body">
          <h3 class="title">${sanitize(item.title || 'Untitled')}</h3>
          <div class="meta">
            ${featured ? `<span class="badge">⭐ Featured</span>` : ``}
            ${item.created_at ? `<span class="pill">${sanitize(item.created_at)}</span>` : ``}
          </div>
          <p class="desc">${sanitize(item.description || '')}</p>
          <div class="tags">
            ${tags.slice(0,6).map(t=>`<span class="tag">${sanitize(t)}</span>`).join('')}
          </div>
        </div>
        <div class="footer">
          <span class="small">${id ? 'YouTube' : 'Link tidak sah'}</span>
          <button class="btn sm primary playbtn">Play</button>
        </div>
      `;

      const open = ()=>openModal(item);
      $('.thumb', card).addEventListener('click', open);
      $('.thumb', card).addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' ') open(); });
      $('.playbtn', card).addEventListener('click', open);

      grid.appendChild(card);
    }
  }

  function openModal(item){
    const id = parseYouTubeId(item.youtube_url);
    if(!id){ toast('Link YouTube tak valid.'); return; }

    $('#modalTitle').textContent = item.title || 'Play';
    $('#modal').classList.add('open');
    $('#player').innerHTML = `<iframe src="${embedUrl(id)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    document.body.style.overflow='hidden';
  }

  function closeModal(){
    $('#modal').classList.remove('open');
    $('#player').innerHTML = '';
    document.body.style.overflow='';
  }

  async function load(){
    let data;
    try{
      const res = await fetch('./data.json', {cache:'no-store'});
      data = await res.json();
    }catch(e){
      $('#grid').innerHTML = `<div class="notice">
        Tak dapat load <span class="kbd">data.json</span>.
        Kalau buka file ini direct dari komputer (file://), fetch mungkin block.
        Untuk test local, guna server ringkas (contoh VSCode Live Server).
      </div>`;
      return;
    }

    const items = Array.isArray(data.items) ? data.items : [];
    window.__ALL_ITEMS__ = items;

    // Populate tag filter
    const tags = new Set();
    for(const it of items){
      (it.tags || []).forEach(t=>tags.add(String(t)));
    }
    const tagSelect = $('#tagFilter');
    const sortedTags = Array.from(tags).sort((a,b)=>a.localeCompare(b));
    tagSelect.innerHTML = `<option value="">Semua tag</option>` + sortedTags.map(t=>`<option value="${sanitize(t)}">${sanitize(t)}</option>`).join('');

    applyFilters();
  }

  function applyFilters(){
    const q = ($('#search').value || '').toLowerCase().trim();
    const tag = ($('#tagFilter').value || '').trim();
    const sort = ($('#sort').value || 'featured').trim();

    let items = (window.__ALL_ITEMS__ || []).slice();

    if(tag){
      items = items.filter(it => Array.isArray(it.tags) && it.tags.map(String).includes(tag));
    }
    if(q){
      items = items.filter(it => {
        const hay = `${it.title||''} ${it.description||''} ${(it.tags||[]).join(' ')}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if(sort === 'newest'){
      items.sort((a,b)=> String(b.created_at||'').localeCompare(String(a.created_at||'')));
    }else if(sort === 'title'){
      items.sort((a,b)=> String(a.title||'').localeCompare(String(b.title||'')));
    }else{ // featured
      items.sort((a,b)=>{
        const af = a.featured ? 1 : 0;
        const bf = b.featured ? 1 : 0;
        if(bf !== af) return bf - af;
        return String(b.created_at||'').localeCompare(String(a.created_at||'')); // newest-ish
      });
    }

    $('#count').textContent = `${items.length} video`;
    render(items);
  }

  // Events
  ['input','change'].forEach(evt=>{
    $('#search').addEventListener(evt, applyFilters);
  });
  $('#tagFilter').addEventListener('change', applyFilters);
  $('#sort').addEventListener('change', applyFilters);

  $('#closeModal').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', (e)=>{ if(e.target.id==='modal') closeModal(); });
  window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeModal(); });

  load();
})();
