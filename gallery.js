(function(){
  const $ = (q, el=document)=>el.querySelector(q);

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

  const thumbUrl = (id)=>`https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  const embedUrl = (id)=>`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
  const sanitize = (t)=>String(t ?? '').replace(/[<>]/g,'');

  function getScrollAmount(scroller){
    const firstCard = scroller.querySelector('.card');
    if(!firstCard) return 400;

    const cardWidth = firstCard.getBoundingClientRect().width;
    const style = window.getComputedStyle(scroller);
    const gap = parseFloat(style.columnGap || style.gap || 16) || 16;
    return Math.round((cardWidth + gap) * 2);
  }

  function updateScrollerButtons(sectionEl){
    const scroller = sectionEl.querySelector('.row-scroller');
    const prevBtn = sectionEl.querySelector('.scroll-btn.prev');
    const nextBtn = sectionEl.querySelector('.scroll-btn.next');
    if(!scroller || !prevBtn || !nextBtn) return;

    const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const current = Math.round(scroller.scrollLeft);
    const canScroll = scroller.scrollWidth > scroller.clientWidth + 8;
    const atStart = current <= 4;
    const atEnd = current >= maxScrollLeft - 4;

    sectionEl.classList.toggle('has-scroll', canScroll);
    prevBtn.classList.toggle('is-hidden', !canScroll || atStart);
    nextBtn.classList.toggle('is-hidden', !canScroll || atEnd);
  }

  function bindScrollerButtons(sectionEl){
    const scroller = sectionEl.querySelector('.row-scroller');
    const prevBtn = sectionEl.querySelector('.scroll-btn.prev');
    const nextBtn = sectionEl.querySelector('.scroll-btn.next');
    if(!scroller || !prevBtn || !nextBtn) return;

    const onPrev = ()=>scroller.scrollBy({ left:-getScrollAmount(scroller), behavior:'smooth' });
    const onNext = ()=>scroller.scrollBy({ left:getScrollAmount(scroller), behavior:'smooth' });

    prevBtn.addEventListener('click', onPrev);
    nextBtn.addEventListener('click', onNext);
    scroller.addEventListener('scroll', ()=>updateScrollerButtons(sectionEl), { passive:true });

    requestAnimationFrame(()=>updateScrollerButtons(sectionEl));
  }

  function navButton(direction){
    const cls = direction === 'prev' ? 'prev' : 'next';
    const label = direction === 'prev' ? 'Scroll left' : 'Scroll right';
    const path = direction === 'prev'
      ? '<path d="M15.5 19 8.5 12l7-7" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"/>'
      : '<path d="m8.5 5 7 7-7 7" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"/>';

    return `
      <button class="scroll-btn ${cls} is-hidden" type="button" aria-label="${label}">
        <svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>
      </button>
    `;
  }

  function renderSections(data){
    const wrap = $('#sections');
    wrap.innerHTML = '';

    const items = Array.isArray(data.items) ? data.items : [];
    const sectionsRaw = Array.isArray(data.sections) ? data.sections : [];

    let sections = sectionsRaw
      .map(s=>({ ...s, order: Number(s.order ?? 9999) }))
      .sort((a,b)=>a.order-b.order);

    if(!sections.length){
      const cats = Array.from(new Set(items.map(it=>it.category || 'Uncategorized')));
      sections = cats.map((c, idx)=>({id:'sec-'+idx, title:c, category:c, order:idx+1}));
    }

    const q = ($('#search').value || '').toLowerCase().trim();
    const tag = ($('#tagFilter').value || '').trim();
    const sort = ($('#sort').value || 'featured').trim();

    const base = items.filter(it=>{
      if(tag && !(Array.isArray(it.tags) && it.tags.map(String).includes(tag))) return false;
      if(q){
        const hay = `${it.title||''} ${it.description||''} ${(it.tags||[]).join(' ')} ${it.category||''}`.toLowerCase();
        if(!hay.includes(q)) return false;
      }
      return true;
    });

    const sorter = (a,b)=>{
      const ap = Number(a.priority ?? 9999);
      const bp = Number(b.priority ?? 9999);

      if(sort === 'priority'){
        if(ap !== bp) return ap - bp;
        const af = a.featured ? 1 : 0;
        const bf = b.featured ? 1 : 0;
        if(bf !== af) return bf - af;
        return String(b.created_at||'').localeCompare(String(a.created_at||''));
      }

      if(sort === 'newest') return String(b.created_at||'').localeCompare(String(a.created_at||''));
      if(sort === 'title') return String(a.title||'').localeCompare(String(b.title||''));

      const af = a.featured ? 1 : 0;
      const bf = b.featured ? 1 : 0;
      if(bf !== af) return bf - af;
      if(ap !== bp) return ap - bp;
      return String(b.created_at||'').localeCompare(String(a.created_at||''));
    };

    let total = 0;

    for(const sec of sections){
      const cat = sec.category || sec.title || 'Uncategorized';
      const list = base.filter(it=>String(it.category||'Uncategorized')===String(cat)).sort(sorter);
      if(!list.length) continue;
      total += list.length;

      const sectionEl = document.createElement('section');
      sectionEl.className = 'section';
      sectionEl.innerHTML = `
        <div class="section-head">
          <div>
            <h2 class="section-title">${sanitize(sec.title || cat)}</h2>
            <div class="section-sub">${list.length} video</div>
          </div>
        </div>
        <div class="row-shell">
          ${navButton('prev')}
          <div class="row-scroller"></div>
          ${navButton('next')}
        </div>
      `;

      const scroller = sectionEl.querySelector('.row-scroller');

      for(const item of list){
        const yid = parseYouTubeId(item.youtube_url);
        const img = yid ? thumbUrl(yid) : '';
        const tags = Array.isArray(item.tags) ? item.tags : [];
        const featured = !!item.featured;

        const card = document.createElement('article');
        card.className = 'card';
        card.innerHTML = `
          <div class="thumb" role="button" tabindex="0">
            ${img ? `<img src="${img}" alt="${sanitize(item.title)}">` : ``}
            <div class="play"><div class="triangle"></div></div>
          </div>
          <div class="body">
            <h3 class="title">${sanitize(item.title || 'Untitled')}</h3>
            <div class="meta">
              ${featured ? `<span class="badge">⭐ Featured</span>` : ``}
            </div>
            <p class="desc">${sanitize(item.description || '')}</p>
            <div class="tags">
              ${tags.slice(0,6).map(t=>`<span class="tag">${sanitize(t)}</span>`).join('')}
            </div>
          </div>
        `;
        const open = ()=>openModal(item);
        card.querySelector('.thumb').addEventListener('click', open);
        card.querySelector('.thumb').addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' ') open(); });
        scroller.appendChild(card);
      }

      wrap.appendChild(sectionEl);
      bindScrollerButtons(sectionEl);
    }

    $('#count').textContent = `${total} video`;
    if(total===0) wrap.innerHTML = `<div class="notice">Tiada video match dengan filter/search.</div>`;
  }

  function openModal(item){
    const id = parseYouTubeId(item.youtube_url);
    if(!id){ toast('Link YouTube tak valid.'); return; }

    $('#modalTitle').textContent = item.title || 'Play';
    $('#modal').classList.add('open');
    $('#player').innerHTML = `<iframe src="${embedUrl(id)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;

    $('#modalDesc').textContent = item.description || '';
    const linksWrap = $('#modalLinks');
    linksWrap.innerHTML = '';
    const links = Array.isArray(item.extra_links) ? item.extra_links : [];
    for(const l of links){
      if(!l?.url) continue;
      const a = document.createElement('a');
      a.className='link';
      a.href=String(l.url);
      a.target='_blank';
      a.rel='noopener noreferrer';
      a.textContent = l.label ? String(l.label) : 'Link';
      linksWrap.appendChild(a);
    }
    linksWrap.style.display = linksWrap.children.length ? 'flex' : 'none';
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
      $('#sections').innerHTML = `<div class="notice">
        Tak dapat load <span class="kbd">data.json</span>.
        Jika test local (file://), guna server ringkas (VSCode Live Server).
      </div>`;
      return;
    }
    window.__DATA__ = data;

    const items = Array.isArray(data.items) ? data.items : [];
    const tags = new Set();
    items.forEach(it => (it.tags||[]).forEach(t=>tags.add(String(t))));
    const sortedTags = Array.from(tags).sort((a,b)=>a.localeCompare(b));
    $('#tagFilter').innerHTML = `<option value="">Semua tag</option>` + sortedTags.map(t=>`<option value="${sanitize(t)}">${sanitize(t)}</option>`).join('');

    renderSections(data);
  }

  const rerender = ()=>renderSections(window.__DATA__ || {items:[]});

  ['input','change'].forEach(evt=>$('#search').addEventListener(evt, rerender));
  $('#tagFilter').addEventListener('change', rerender);
  $('#sort').addEventListener('change', rerender);
  window.addEventListener('resize', ()=>{
    document.querySelectorAll('.section').forEach(updateScrollerButtons);
  });

  $('#closeModal').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', (e)=>{ if(e.target.id==='modal') closeModal(); });
  window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeModal(); });

  load();
})();
