/* Spark — App Logic */
const App = {
  state: {
    view: 'ideas',
    ideaTagFilter: null,
    pinFilter: false,
    captureTags: [],
    captureColor: null,
    pendingDelete: null,
    projStatus: 'concept',
    projTags: [],
    projGallery: [],
    projCover: null,
    editProjId: null,
    openProjId: null,
    sourceIdeaId: null,
    voiceActive: false,
  },

  // ── GRADIENTS for cards without cover ──
  gradients: [
    ['#7c3aed','#2563eb'],['#db2777','#7c3aed'],['#0891b2','#10b981'],
    ['#d97706','#dc2626'],['#059669','#2563eb'],['#7c3aed','#ec4899'],
  ],
  getGrad(str){
    let h=0; for(let c of str) h=(h*31+c.charCodeAt(0))&0xffffffff;
    const [a,b]=this.gradients[Math.abs(h)%this.gradients.length];
    return `linear-gradient(135deg,${a},${b})`;
  },
  getEmoji(str){
    const e=['🚀','💡','🎯','🔥','⚡','🌟','🎨','🛠️','📱','🌐'];
    let h=0; for(let c of str) h=(h*31+c.charCodeAt(0))&0xffffffff;
    return e[Math.abs(h)%e.length];
  },

  // ── TIME ──
  ago(ts){
    const d=Math.floor((Date.now()-ts)/1000);
    if(d<60) return 'just now';
    if(d<3600) return `${Math.floor(d/60)}m ago`;
    if(d<86400) return `${Math.floor(d/3600)}h ago`;
    if(d<604800) return `${Math.floor(d/86400)}d ago`;
    return new Date(ts).toLocaleDateString('vi-VN');
  },

  // ── INIT ──
  init(){
    this.bindNav();
    this.bindCapture();
    this.bindColorPicker();
    this.bindVoice();
    this.bindProjectForm();
    this.bindSearch();
    this.bindSettings();
    this.checkUser();
    this.renderIdeas();
    this.renderProjects();
    if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  },

  checkUser(){
    if(!DB.getUser()) this.openModal('modal-setup');
    else this.renderIdeas();
    document.getElementById('btn-setup-save').onclick = () => {
      const n = document.getElementById('setup-name').value.trim();
      if(!n) return;
      DB.setUser(n);
      this.closeModal('modal-setup');
      this.toast('Welcome, '+n+'! ⚡');
    };
    document.getElementById('setup-name').addEventListener('keydown', e => {
      if(e.key==='Enter') document.getElementById('btn-setup-save').click();
    });
  },

  // ── NAV ──
  bindNav(){
    document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.view));
    });
    document.getElementById('btn-quick-add').addEventListener('click', () => {
      this.openCaptureModal();
    });
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal(btn.dataset.modal));
    });
    document.querySelectorAll('.modal-backdrop').forEach(bd => {
      bd.addEventListener('click', e => {
        const modal = e.target.closest('.modal');
        if(modal && modal.id !== 'modal-setup') this.closeModal(modal.id);
      });
    });
  },

  navigate(view){
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('view-'+view)?.classList.add('active');
    document.querySelector(`.nav-btn[data-view="${view}"]`)?.classList.add('active');
    this.state.view = view;
    if(view==='projects') this.renderProjects();
  },

  openModal(id){
    document.getElementById(id)?.classList.add('open');
    document.body.style.overflow='hidden';
  },
  closeModal(id){
    document.getElementById(id)?.classList.remove('open');
    document.body.style.overflow='';
  },

  toast(msg, dur=2200){
    const t=document.getElementById('toast');
    t.textContent=msg; t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'), dur);
  },

  // ── CAPTURE MODAL ──
  bindCapture(){
    const tagInput = document.getElementById('capture-tag-input');
    tagInput.addEventListener('keydown', e => {
      if(e.key==='Enter'){ e.preventDefault(); this.addCaptureTag(tagInput.value); tagInput.value=''; }
    });
    document.getElementById('btn-save-idea').onclick = () => this.saveIdea();
    document.getElementById('btn-to-project').onclick = () => {
      const text = document.getElementById('capture-text').value.trim();
      this.closeModal('modal-capture');
      this.openProjectModal(null, text);
    };
    document.getElementById('btn-pin-filter').onclick = () => {
      this.state.pinFilter = !this.state.pinFilter;
      document.getElementById('btn-pin-filter').style.background = this.state.pinFilter ? 'rgba(124,58,237,.3)' : '';
      this.renderIdeas();
    };
    document.getElementById('proj-status-filter').onchange = e => {
      this.renderProjects(e.target.value);
    };
  },

  openCaptureModal(){
    document.getElementById('capture-text').value = '';
    document.getElementById('capture-tag-input').value = '';
    document.getElementById('capture-tags').innerHTML = '';
    this.state.captureTags = [];
    this.state.captureColor = null;
    document.querySelectorAll('#capture-colors .color-dot').forEach((d,i)=>d.classList.toggle('active',i===0));
    this.openModal('modal-capture');
    setTimeout(() => document.getElementById('capture-text').focus(), 350);
    // char count
    const ta = document.getElementById('capture-text');
    ta.oninput = () => {
      let cc = document.getElementById('char-count');
      if(!cc){ cc=document.createElement('div'); cc.id='char-count'; cc.className='char-count'; ta.parentNode.after(cc); }
      cc.textContent = ta.value.length ? `${ta.value.length} chars` : '';
    };
  },

  addCaptureTag(val){
    val = val.replace(/^#+/,'').trim().toLowerCase();
    if(!val) return;
    if(!this.state.captureTags) this.state.captureTags = [];
    if(this.state.captureTags.includes(val)) return;
    this.state.captureTags.push(val);
    this.renderCaptureTags();
  },
  renderCaptureTags(){
    const row = document.getElementById('capture-tags');
    row.innerHTML = (this.state.captureTags||[]).map(t =>
      `<span class="tag">#${t} <button class="tag-rm" data-tag="${t}">✕</button></span>`
    ).join('');
    row.querySelectorAll('.tag-rm').forEach(b => {
      b.onclick = () => {
        this.state.captureTags = this.state.captureTags.filter(x=>x!==b.dataset.tag);
        this.renderCaptureTags();
      };
    });
  },

  saveIdea(){
    const text = document.getElementById('capture-text').value.trim();
    if(!text){ this.toast('Write something first! ✍️'); return; }
    DB.addIdea({ content:text, tags:this.state.captureTags||[], isPinned:false, status:'active', color:this.state.captureColor||null });
    this.closeModal('modal-capture');
    this.renderIdeas();
    this.toast('Idea saved! 💡');
  },

  // ── RENDER IDEAS ──
  renderIdeas(){
    let ideas = DB.getIdeas();
    // hide pending-delete idea
    if(this.state.pendingDelete) ideas = ideas.filter(i => i.id !== this.state.pendingDelete.id);
    if(this.state.pinFilter) ideas = ideas.filter(i=>i.isPinned);
    if(this.state.ideaTagFilter) ideas = ideas.filter(i=>i.tags?.includes(this.state.ideaTagFilter));
    // count badge
    document.getElementById('idea-count').textContent = DB.getIdeas().length;
    // tag filter row
    const allTags = [...new Set(DB.getIdeas().flatMap(i=>i.tags||[]))];
    const filterRow = document.getElementById('idea-tag-filter');
    filterRow.innerHTML = allTags.map(t =>
      `<button class="tag-chip${this.state.ideaTagFilter===t?' active':''}" data-tag="${t}">#${t}</button>`
    ).join('');
    filterRow.querySelectorAll('.tag-chip').forEach(c => {
      c.onclick = () => {
        this.state.ideaTagFilter = this.state.ideaTagFilter===c.dataset.tag ? null : c.dataset.tag;
        this.renderIdeas();
      };
    });
    // feed
    const feed = document.getElementById('idea-feed');
    const empty = document.getElementById('idea-empty');
    if(!ideas.length){ feed.innerHTML=''; empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    // sort: pinned first
    ideas.sort((a,b)=>(b.isPinned?1:0)-(a.isPinned?1:0)||(b.createdAt-a.createdAt));
    feed.innerHTML = ideas.map(i => `
      <div class="idea-card${i.isPinned?' pinned':''}" data-id="${i.id}"${i.color?` data-color="${i.color}"`:''}>
        ${i.isPinned?'<div class="pin-icon">📌</div>':''}
        <div class="idea-card-text">${this.esc(i.content)}</div>
        <div class="idea-card-footer">
          <div class="idea-card-tags">${(i.tags||[]).map(t=>`<span class="tag">#${t}</span>`).join('')}</div>
          <div class="idea-card-meta">
            <span class="idea-card-date">${this.ago(i.createdAt)}</span>
            <span style="color:var(--dim);font-size:18px">›</span>
          </div>
        </div>
      </div>`).join('');
    feed.querySelectorAll('.idea-card').forEach(card => {
      card.onclick = () => { if(!card.dataset.swiped) this.openIdeaDetail(card.dataset.id); };
      this.bindSwipe(card, card.dataset.id);
    });
  },

  openIdeaDetail(id){
    const idea = DB.getIdea(id);
    if(!idea) return;
    const body = document.getElementById('idea-detail-body');
    body.innerHTML = `
      <p class="idea-detail-text" id="idea-view-text">${this.esc(idea.content)}</p>
      <div class="tags-row">${(idea.tags||[]).map(t=>`<span class="tag">#${t}</span>`).join('')}</div>
      <p style="font-size:12px;color:var(--dim);margin-top:10px">${new Date(idea.createdAt).toLocaleString('vi-VN')}</p>
      <div class="idea-detail-actions">
        <button class="btn-secondary" id="btn-idea-edit">✏️ Edit</button>
        <button class="btn-secondary" id="btn-idea-pin">${idea.isPinned?'📌 Unpin':'📌 Pin'}</button>
        <button class="btn-secondary" id="btn-idea-to-proj">🗂️ Convert to Project</button>
        <button class="btn-danger" id="btn-idea-del">🗑️ Delete Idea</button>
      </div>`;
    document.getElementById('btn-idea-edit').onclick = () => this.startEditIdea(id, idea.content);
    document.getElementById('btn-idea-pin').onclick = () => {
      DB.updateIdea(id, {isPinned:!idea.isPinned});
      this.closeModal('modal-idea');
      this.renderIdeas();
      this.toast(idea.isPinned?'Unpinned':'Pinned! 📌');
    };
    document.getElementById('btn-idea-to-proj').onclick = () => {
      this.closeModal('modal-idea');
      this.openProjectModal(null, idea.content, id);
    };
    document.getElementById('btn-idea-del').onclick = () => {
      this.closeModal('modal-idea');
      this.softDeleteIdea(id);
    };
    this.openModal('modal-idea');
  },

  startEditIdea(id, original){
    const body = document.getElementById('idea-detail-body');
    body.innerHTML = `
      <textarea class="idea-edit-ta" id="idea-edit-ta">${original}</textarea>
      <div class="edit-btn-row">
        <button class="btn-primary" id="btn-edit-save">💾 Save</button>
        <button class="btn-secondary" id="btn-edit-cancel">Cancel</button>
      </div>`;
    document.getElementById('idea-edit-ta').focus();
    document.getElementById('btn-edit-save').onclick = () => {
      const newText = document.getElementById('idea-edit-ta').value.trim();
      if(!newText) return;
      DB.updateIdea(id, {content:newText});
      this.closeModal('modal-idea');
      this.renderIdeas();
      this.toast('Idea updated ✅');
    };
    document.getElementById('btn-edit-cancel').onclick = () => this.openIdeaDetail(id);
  },

  // ── PROJECTS ──
  bindProjectForm(){
    // status toggle
    document.getElementById('proj-status-btns').querySelectorAll('.status-opt').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.status-opt').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        this.state.projStatus = btn.dataset.s;
      };
    });
    // tags
    const ti = document.getElementById('proj-tag-input');
    ti.addEventListener('keydown', e => {
      if(e.key==='Enter'){ e.preventDefault(); this.addProjTag(ti.value); ti.value=''; }
    });
    // cover upload
    document.getElementById('cover-zone').onclick = () => document.getElementById('proj-cover').click();
    document.getElementById('proj-cover').onchange = async e => {
      const file = e.target.files[0]; if(!file) return;
      this.state.projCover = await DB.compressImage(file, 1200, 0.85);
      const prev = document.getElementById('cover-preview');
      prev.src = this.state.projCover; prev.hidden=false;
      document.getElementById('cover-placeholder').hidden=true;
    };
    // gallery
    document.getElementById('btn-add-gallery').onclick = () => document.getElementById('proj-gallery').click();
    document.getElementById('proj-gallery').onchange = async e => {
      const files = Array.from(e.target.files);
      for(const f of files){
        const b64 = await DB.compressImage(f, 900, 0.8);
        this.state.projGallery.push(b64);
      }
      this.renderGalleryThumbs();
      e.target.value='';
    };
    // form submit
    document.getElementById('project-form').onsubmit = e => { e.preventDefault(); this.saveProject(); };
  },

  addProjTag(val){
    val = val.replace(/^#+/,'').trim().toLowerCase();
    if(!val||this.state.projTags.includes(val)) return;
    this.state.projTags.push(val);
    this.renderProjTags();
  },
  renderProjTags(){
    const row = document.getElementById('proj-tags');
    row.innerHTML = this.state.projTags.map(t =>
      `<span class="tag">#${t} <button class="tag-rm" data-tag="${t}">✕</button></span>`
    ).join('');
    row.querySelectorAll('.tag-rm').forEach(b => {
      b.onclick = () => { this.state.projTags=this.state.projTags.filter(x=>x!==b.dataset.tag); this.renderProjTags(); };
    });
  },
  renderGalleryThumbs(){
    const row = document.getElementById('gallery-row');
    row.innerHTML = this.state.projGallery.map((src,i) =>
      `<div class="gallery-thumb"><img src="${src}" alt=""><button class="gallery-thumb-rm" data-i="${i}">✕</button></div>`
    ).join('');
    row.querySelectorAll('.gallery-thumb-rm').forEach(b => {
      b.onclick = () => { this.state.projGallery.splice(+b.dataset.i,1); this.renderGalleryThumbs(); };
    });
  },

  openProjectModal(projId=null, prefill='', sourceIdeaId=null){
    this.state.editProjId = projId;
    this.state.projCover = null;
    this.state.projGallery = [];
    this.state.projTags = [];
    this.state.projStatus = 'concept';
    document.getElementById('proj-form-title').textContent = projId ? 'Edit Project' : 'New Project';
    document.getElementById('proj-edit-id').value = projId||'';
    document.getElementById('proj-name').value = '';
    document.getElementById('proj-desc').value = prefill||'';
    document.getElementById('proj-link').value = '';
    document.getElementById('proj-tag-input').value = '';
    document.getElementById('proj-tags').innerHTML = '';
    document.getElementById('gallery-row').innerHTML = '';
    document.getElementById('cover-preview').hidden=true;
    document.getElementById('cover-placeholder').hidden=false;
    document.querySelectorAll('.status-opt').forEach(b => {
      b.classList.toggle('active', b.dataset.s==='concept');
    });
    if(projId){
      const p = DB.getProject(projId);
      if(p){
        document.getElementById('proj-name').value = p.name;
        document.getElementById('proj-desc').value = p.description||'';
        document.getElementById('proj-link').value = p.link||'';
        this.state.projStatus = p.status;
        this.state.projTags = [...(p.tags||[])];
        this.state.projGallery = [...(p.gallery||[])];
        this.state.projCover = p.cover||null;
        document.querySelectorAll('.status-opt').forEach(b=>b.classList.toggle('active',b.dataset.s===p.status));
        if(p.cover){ document.getElementById('cover-preview').src=p.cover; document.getElementById('cover-preview').hidden=false; document.getElementById('cover-placeholder').hidden=true; }
        this.renderProjTags();
        this.renderGalleryThumbs();
      }
    }
    if(sourceIdeaId) this.state.sourceIdeaId = sourceIdeaId;
    this.openModal('modal-proj-form');
  },

  saveProject(){
    const name = document.getElementById('proj-name').value.trim();
    if(!name){ this.toast('Project name required!'); return; }
    const data = {
      name, status:this.state.projStatus,
      description: document.getElementById('proj-desc').value.trim(),
      link: document.getElementById('proj-link').value.trim(),
      tags: [...this.state.projTags],
      cover: this.state.projCover,
      gallery: [...this.state.projGallery],
      sourceIdeaId: this.state.sourceIdeaId||null,
    };
    if(this.state.editProjId){
      DB.updateProject(this.state.editProjId, data);
      this.toast('Project updated ✅');
    } else {
      DB.addProject(data);
      this.toast('Project saved! 🗂️');
    }
    this.state.sourceIdeaId = null;
    this.closeModal('modal-proj-form');
    this.navigate('projects');
    this.renderProjects();
  },

  renderProjects(statusFilter){
    const filter = statusFilter || document.getElementById('proj-status-filter').value || 'all';
    let projects = DB.getProjects();
    if(filter !== 'all') projects = projects.filter(p=>p.status===filter);
    document.getElementById('proj-count').textContent = DB.getProjects().length;
    const grid = document.getElementById('project-grid');
    const empty = document.getElementById('proj-empty');
    if(!projects.length){ grid.innerHTML=''; empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    const statusLabel = { concept:'💡 Concept', in_progress:'🚀 In Progress', completed:'✅ Done', on_hold:'⏸ On Hold' };
    grid.innerHTML = projects.map(p => `
      <div class="proj-card" data-id="${p.id}">
        ${p.cover
          ? `<img class="proj-card-cover" src="${p.cover}" alt="${this.esc(p.name)}" loading="lazy">`
          : `<div class="proj-card-grad" style="background:${this.getGrad(p.id)}">${this.getEmoji(p.name)}</div>`}
        <div class="proj-card-body">
          <div class="proj-card-name">${this.esc(p.name)}</div>
          <span class="status-badge ${p.status}">${statusLabel[p.status]||p.status}</span>
        </div>
      </div>`).join('');
    grid.querySelectorAll('.proj-card').forEach(c => {
      c.onclick = () => this.openProjectDetail(c.dataset.id);
    });
  },

  openProjectDetail(id){
    const p = DB.getProject(id);
    if(!p) return;
    this.state.openProjId = id;
    const user = DB.getUser();
    const emojis = ['👍','❤️','🔥','💡'];
    const statusLabel = { concept:'💡 Concept', in_progress:'🚀 In Progress', completed:'✅ Done', on_hold:'⏸ On Hold' };
    const inner = document.getElementById('proj-detail-inner');
    inner.innerHTML = `
      <div class="proj-detail-hero">
        ${p.cover
          ? `<img src="${p.cover}" alt="${this.esc(p.name)}">`
          : `<div class="proj-detail-hero-grad" style="background:${this.getGrad(p.id)}">${this.getEmoji(p.name)}</div>`}
        <div class="proj-detail-bar">
          <button id="btn-proj-back">‹ Back</button>
          <button id="btn-proj-edit">✎ Edit</button>
        </div>
      </div>
      <div class="proj-detail-content">
        <h2 class="proj-detail-title">${this.esc(p.name)}</h2>
        <div class="proj-detail-meta">
          <span class="status-badge ${p.status}">${statusLabel[p.status]}</span>
          ${(p.tags||[]).map(t=>`<span class="tag">#${t}</span>`).join('')}
        </div>
        ${p.description ? `<p class="proj-detail-desc">${this.esc(p.description)}</p>` : ''}
        ${p.link ? `<div class="proj-detail-link"><a href="${p.link}" target="_blank" rel="noopener">🔗 ${p.link}</a></div>` : ''}
        ${(p.gallery||[]).length ? `<div class="gallery-scroll">${p.gallery.map(src=>`<img src="${src}" loading="lazy" alt="gallery">`).join('')}</div>` : ''}
        <hr class="section-divider">
        <div class="reactions-row" id="reactions-row">
          ${emojis.map(em => {
            const count = DB.countReaction(id,em);
            const reacted = DB.hasReacted(id,em,user);
            return `<button class="reaction-btn${reacted?' reacted':''}" data-emoji="${em}">
              ${em} <span>${count||''}</span>
            </button>`;
          }).join('')}
        </div>
        <hr class="section-divider">
        <div class="comments-section">
          <h3>💬 Comments <span id="cmt-count" style="color:var(--muted);font-weight:500;font-size:14px"></span></h3>
          <div class="comment-list" id="comment-list"></div>
          <div class="comment-input-row">
            <textarea id="new-comment" placeholder="Add a comment..." rows="2"></textarea>
            <button class="btn-send" id="btn-send-cmt">➤</button>
          </div>
        </div>
      </div>`;

    document.getElementById('btn-proj-back').onclick = () => this.closeModal('modal-proj-detail');
    document.getElementById('btn-proj-edit').onclick = () => { this.closeModal('modal-proj-detail'); this.openProjectModal(id); };
    document.getElementById('reactions-row').querySelectorAll('.reaction-btn').forEach(btn => {
      btn.onclick = () => { DB.toggleReaction(id, btn.dataset.emoji, user); this.openProjectDetail(id); };
    });
    document.getElementById('btn-send-cmt').onclick = () => this.addComment(id);
    document.getElementById('new-comment').addEventListener('keydown', e => {
      if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); this.addComment(id); }
    });
    this.renderComments(id);
    this.openModal('modal-proj-detail');
  },

  renderComments(projectId){
    const comments = DB.getComments(projectId);
    const list = document.getElementById('comment-list');
    const cnt = document.getElementById('cmt-count');
    if(cnt) cnt.textContent = `(${comments.length})`;
    if(!list) return;
    if(!comments.length){ list.innerHTML=`<p style="color:var(--dim);font-size:14px">No comments yet. Be first!</p>`; return; }
    list.innerHTML = comments.map(c => `
      <div class="comment-item">
        <div class="comment-author">${this.esc(c.author||'Anonymous')}</div>
        <div class="comment-text">${this.esc(c.content)}</div>
        <div class="comment-date">${this.ago(c.createdAt)}</div>
      </div>`).join('');
  },

  addComment(projectId){
    const ta = document.getElementById('new-comment');
    const text = ta.value.trim();
    if(!text) return;
    const user = DB.getUser()||'Anonymous';
    DB.addComment({ projectId, author:user, content:text });
    ta.value='';
    this.renderComments(projectId);
    this.toast('Comment added 💬');
  },

  // ── SEARCH ──
  bindSearch(){
    document.getElementById('search-input').addEventListener('input', e => {
      this.search(e.target.value.trim());
    });
  },
  search(q){
    const feed = document.getElementById('search-results');
    const empty = document.getElementById('search-empty');
    if(!q){ feed.innerHTML=''; empty.classList.add('hidden'); return; }
    const ql = q.toLowerCase();
    const ideas = DB.getIdeas().filter(i => i.content.toLowerCase().includes(ql)||(i.tags||[]).some(t=>t.includes(ql)));
    const projects = DB.getProjects().filter(p => p.name.toLowerCase().includes(ql)||(p.description||'').toLowerCase().includes(ql)||(p.tags||[]).some(t=>t.includes(ql)));
    if(!ideas.length && !projects.length){ feed.innerHTML=''; empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    const statusLabel = { concept:'💡 Concept', in_progress:'🚀 In Progress', completed:'✅ Done', on_hold:'⏸ On Hold' };
    feed.innerHTML = [
      ...ideas.map(i => `<div class="idea-card" data-type="idea" data-id="${i.id}">
        <div style="font-size:11px;color:var(--accent);font-weight:700;margin-bottom:6px">💡 IDEA</div>
        <div class="idea-card-text">${this.esc(i.content)}</div>
        <div class="idea-card-tags">${(i.tags||[]).map(t=>`<span class="tag">#${t}</span>`).join('')}</div></div>`),
      ...projects.map(p => `<div class="proj-card" data-type="project" data-id="${p.id}" style="display:block">
        <div class="proj-card-body" style="padding:14px">
          <div style="font-size:11px;color:#93c5fd;font-weight:700;margin-bottom:6px">🗂️ PROJECT</div>
          <div class="proj-card-name" style="font-size:15px">${this.esc(p.name)}</div>
          <span class="status-badge ${p.status}">${statusLabel[p.status]}</span>
        </div></div>`)
    ].join('');
    feed.querySelectorAll('[data-type="idea"]').forEach(c => { c.onclick=()=>this.openIdeaDetail(c.dataset.id); });
    feed.querySelectorAll('[data-type="project"]').forEach(c => { c.onclick=()=>this.openProjectDetail(c.dataset.id); });
  },

  // ── SETTINGS ──
  bindSettings(){
    document.getElementById('settings-name').value = DB.getUser();
    document.getElementById('btn-save-name').onclick = () => {
      const n = document.getElementById('settings-name').value.trim();
      if(!n) return;
      DB.setUser(n);
      this.toast('Name saved! ✅');
    };
    document.getElementById('btn-export').onclick = () => DB.exportAll();
    document.getElementById('btn-clear-data').onclick = () => {
      if(!confirm('Delete ALL ideas, projects and comments? This cannot be undone!')) return;
      DB.clearAll();
      this.renderIdeas();
      this.renderProjects();
      this.toast('All data cleared');
    };
  },

  // ── UTIL ──
  bindColorPicker(){
    document.querySelectorAll('#capture-colors .color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        document.querySelectorAll('#capture-colors .color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        this.state.captureColor = dot.dataset.color || null;
      });
    });
  },

  bindVoice(){
    const btn = document.getElementById('btn-voice');
    if(!btn) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR){ btn.style.opacity='0.3'; btn.title='Not supported on this browser'; return; }
    const rec = new SR();
    rec.lang = 'vi-VN';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = e => {
      const text = e.results[0][0].transcript;
      const ta = document.getElementById('capture-text');
      ta.value = (ta.value ? ta.value + ' ' : '') + text;
      ta.dispatchEvent(new Event('input'));
    };
    rec.onend = () => {
      this.state.voiceActive = false;
      btn.classList.remove('recording');
      btn.textContent = '🎙️';
    };
    rec.onerror = () => {
      this.state.voiceActive = false;
      btn.classList.remove('recording');
      btn.textContent = '🎙️';
      this.toast('Mic error — check permissions');
    };
    btn.addEventListener('click', () => {
      if(this.state.voiceActive){ rec.stop(); }
      else { rec.start(); this.state.voiceActive=true; btn.classList.add('recording'); btn.textContent='⏹️'; }
    });
  },

  bindSwipe(el, id){
    let sx, sy, swiping=false, lastDx=0;
    const T = 72;
    el.addEventListener('touchstart', e => {
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
      swiping=false; lastDx=0; delete el.dataset.swiped;
    }, {passive:true});
    el.addEventListener('touchmove', e => {
      if(sx===undefined) return;
      const dx = e.touches[0].clientX - sx;
      const dy = e.touches[0].clientY - sy;
      if(!swiping && Math.abs(dy) > Math.abs(dx)+5) return;
      swiping=true; lastDx=dx;
      e.preventDefault();
      const c = Math.max(-120, Math.min(120, dx));
      el.style.transform = `translateX(${c}px)`;
      el.style.transition = 'none';
      const r = Math.min(Math.abs(dx)/T, 1);
      el.classList.toggle('swiping-right', dx>10);
      el.classList.toggle('swiping-left', dx<-10);
      el.style.opacity = 1 - r*0.3;
    }, {passive:false});
    el.addEventListener('touchend', () => {
      if(!swiping) return;
      el.classList.remove('swiping-right','swiping-left');
      el.style.transition = 'transform .3s cubic-bezier(.32,.72,0,1), opacity .3s';
      el.style.transform = '';
      el.style.opacity = '';
      if(lastDx > T){ el.dataset.swiped='1'; this.swipePinIdea(id); }
      else if(lastDx < -T){ el.dataset.swiped='1'; this.softDeleteIdea(id, el); }
      swiping=false; sx=undefined;
    }, {passive:true});
  },

  swipePinIdea(id){
    const idea = DB.getIdea(id);
    if(!idea) return;
    DB.updateIdea(id, {isPinned:!idea.isPinned});
    this.renderIdeas();
    this.toast(idea.isPinned ? 'Unpinned' : 'Pinned! 📌');
  },

  softDeleteIdea(id, el){
    const idea = DB.getIdea(id);
    if(!idea) return;
    // cancel any pending
    if(this.state.pendingDelete) {
      DB.deleteIdea(this.state.pendingDelete.id);
      clearTimeout(this.state.pendingDelete.timer);
    }
    // animate out
    if(el){ el.style.transition='all .3s'; el.style.opacity='0'; el.style.maxHeight=el.offsetHeight+'px'; setTimeout(()=>{el.style.maxHeight='0'; el.style.margin='0'; el.style.padding='0';},200); }
    this.state.pendingDelete = {
      id,
      timer: setTimeout(()=>{ DB.deleteIdea(id); this.state.pendingDelete=null; this.renderIdeas(); }, 5000)
    };
    this.renderIdeas();
    this.showUndoToast('Idea deleted', () => {
      if(this.state.pendingDelete?.id===id){
        clearTimeout(this.state.pendingDelete.timer);
        this.state.pendingDelete = null;
        this.renderIdeas();
        this.toast('Restored! ↩️');
      }
    });
  },

  showUndoToast(msg, onUndo){
    const t = document.getElementById('toast');
    t.innerHTML = `<span class="toast-inner">${msg} <button class="btn-undo">Undo</button></span>`;
    t.style.pointerEvents = 'all';
    t.classList.add('show');
    const tid = setTimeout(()=>{ t.classList.remove('show'); t.style.pointerEvents=''; }, 5000);
    t.querySelector('.btn-undo').onclick = () => {
      clearTimeout(tid); t.classList.remove('show'); t.style.pointerEvents='';
      onUndo();
    };
  },

  esc(str){ return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\n/g,'<br>') }
};

document.addEventListener('DOMContentLoaded', () => App.init());
