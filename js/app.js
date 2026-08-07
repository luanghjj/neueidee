/* Spark v3 — App Logic (UX-hardened: fast capture, real retrieval, safe lifecycle, a11y) */
const App = {
  state: {
    view: 'overview',
    ideaView: 'list',          // list | compact | grid
    ideaStageFilter: 'all',    // all | spark | outline | demo | shipped | archived
    ideaTagFilter: null,
    ideaSearch: '',
    ideaSort: 'newest',        // newest | oldest | updated | stage
    captureStage: 'spark',
    captureTags: [],
    captureImages: [],
    voiceOn: false,
    projFilter: 'all',
    projStatus: 'concept',
    projTags: [],
    editProjId: null,
    sourceIdeaId: null,
    projCover: null,
    pendingDelete: null,
    lastFocus: null,
    currentProjectId: null,
  },

  // ── STAGE CONFIG ──
  stages: {
    spark:    { icon:'bolt',         label:'Funke',      color:'#f59e0b' },
    outline:  { icon:'edit_note',    label:'Entwurf',    color:'#3b82f6' },
    demo:     { icon:'build',        label:'Demo',       color:'#8b5cf6' },
    shipped:  { icon:'check_circle', label:'Fertig',     color:'#10b981' },
    archived: { icon:'inventory_2',  label:'Archiviert', color:'#6b7280' },
  },
  stageOrder: ['spark','outline','demo','shipped'],
  statusLabel: { concept:'Konzept', in_progress:'In Arbeit', completed:'Fertig', on_hold:'Pausiert' },
  // Honest linear progress: Konzept → Umsetzung → Fertig (3 steps). on_hold is paused, not "further along".
  progressSteps: ['Konzept','Umsetzung','Fertig'],
  progressStep(status){ return status==='completed' ? 3 : status==='in_progress' ? 2 : 1; },

  emojiSet: ['😎','🚀','💡','🔥','🎨','🧑‍💻','🦄','🌟','🎯','🛠️','📱','🌐','🧠','⚡','🌈','🦋'],

  // ── GRADIENTS / EMOJI (cover-less projects) ──
  gradients: [
    ['#0f172a','#475569'],['#1e293b','#64748b'],['#374151','#9ca3af'],
    ['#111827','#4b5563'],['#1f2937','#6b7280'],['#0b1220','#334155'],
  ],
  hash(str){ let h=0; for(const c of String(str)) h=(h*31+c.charCodeAt(0))&0xffffffff; return Math.abs(h); },
  getGrad(str){ const [a,b]=this.gradients[this.hash(str)%this.gradients.length]; return `linear-gradient(135deg,${a},${b})`; },
  getEmoji(str){ const e=['🚀','💡','🎯','🔥','⚡','🌟','🎨','🛠️','📱','🌐']; return e[this.hash(str)%e.length]; },

  reduceMotion(){ return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; },

  // ── TIME ──
  ago(ts){
    const d=Math.floor((Date.now()-ts)/1000);
    if(d<60) return 'gerade eben';
    if(d<3600) return `vor ${Math.floor(d/60)} Min.`;
    if(d<86400) return `vor ${Math.floor(d/3600)} Std.`;
    if(d<604800) return `vor ${Math.floor(d/86400)} T.`;
    return new Date(ts).toLocaleDateString('de-DE',{day:'numeric',month:'short'});
  },

  // ── INIT ──
  init(){
    this.initDarkMode();
    this.bindNav();
    this.bindCapture();
    this.bindVoice();
    this.bindCaptureImage();
    this.bindIdeasControls();
    this.bindProjectForm();
    this.bindSettings();
    this.bindGlobalKeys();
    this.checkUser();
    this.renderOverview();
    this.renderIdeas();
    this.renderProjects();
    this.renderProfile();
    this.setActiveNav(this.state.view);
    this.checkIOSInstallPrompt();
    if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
    DB.onLiveComment = c => this.handleLiveComment(c);
    DB.onLiveShare = s => this.handleLiveShare(s);
    DB.onNotification = () => this.renderNotifBadge();
    document.getElementById('btn-notif-mob')?.addEventListener('click', () => this.openNotifCenter());
    document.getElementById('btn-notif-desk')?.addEventListener('click', () => this.openNotifCenter());
    this.renderNotifBadge();
    DB.syncSupabase().then(() => {
      this.renderOverview();
      this.renderIdeas();
      this.renderProjects();
    }).catch(()=>{});
    DB.syncShares().then(() => {
      DB.syncComments().then(() => {
        this.renderProjects();
      });
      this.renderProjects();
    }).catch(()=>{});
    DB.initRealtime();
  },

  // ── DARK MODE ──
  initDarkMode(){
    if(localStorage.getItem('spark_dark')==='dark') document.documentElement.classList.add('dark');
    const toggle = () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('spark_dark', isDark ? 'dark' : 'light');
      const icon = isDark ? 'light_mode' : 'dark_mode';
      document.querySelectorAll('.dark-toggle .material-symbols-outlined').forEach(el => el.textContent = icon);
    };
    document.getElementById('dark-toggle-desk')?.addEventListener('click', toggle);
    document.getElementById('dark-toggle-mob')?.addEventListener('click', toggle);
    const isDark = document.documentElement.classList.contains('dark');
    const icon = isDark ? 'light_mode' : 'dark_mode';
    document.querySelectorAll('.dark-toggle .material-symbols-outlined').forEach(el => el.textContent = icon);
  },

  // ── SETUP / USER ──
  checkUser(){
    const row = document.getElementById('setup-emoji-row');
    let chosen = this.emojiSet[0];
    row.innerHTML = this.emojiSet.map((e,i)=>`<button class="emoji-opt${i===0?' active':''}" data-e="${e}" aria-label="Emoji ${e}">${e}</button>`).join('');
    row.querySelectorAll('.emoji-opt').forEach(b=>{
      b.onclick = () => { row.querySelectorAll('.emoji-opt').forEach(x=>x.classList.remove('active')); b.classList.add('active'); chosen=b.dataset.e; };
    });
    if(!DB.getUser()) this.openModal('modal-setup');
    const save = () => {
      const n = document.getElementById('setup-name').value.trim();
      if(!n){ this.toast('Bitte zuerst deinen Namen eingeben'); return; }
      DB.setUser(n); DB.setUserEmoji(chosen);
      DB.initRealtime();
      this.closeModal('modal-setup');
      this.renderProfile(); this.renderOverview();
      this.toast(`Willkommen, ${n}! ⚡`);
    };
    document.getElementById('btn-setup-save').onclick = save;
    document.getElementById('setup-name').addEventListener('keydown', e => { if(e.key==='Enter') save(); });
  },

  // ── NAV / MODALS ──
  bindNav(){
    document.querySelectorAll('.nav-btn[data-view], .side-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.view));
    });
    document.getElementById('btn-quick-add').addEventListener('click', () => this.openCaptureModal());
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal(btn.dataset.modal));
    });
    document.querySelectorAll('.backdrop').forEach(bd => {
      bd.addEventListener('click', () => { const m=bd.parentElement; if(m && m.id!=='modal-setup') this.closeModal(m.id); });
    });
    this.bindPrototypeEvents();
  },

  bindGlobalKeys(){
    document.addEventListener('keydown', e => {
      // Escape closes the topmost open modal (except first-run setup)
      if(e.key==='Escape'){
        const open = [...document.querySelectorAll('.open')].filter(m=>m.id && m.id!=='modal-setup');
        if(open.length){ this.closeModal(open[open.length-1].id); return; }
      }
      // Cmd/Ctrl+K → open capture from anywhere
      if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); this.openCaptureModal(); return; }
      // plain "n" opens capture when not typing and no modal open
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'');
      const anyModal = document.querySelector('.open');
      if(!typing && !anyModal && e.key==='n'){ e.preventDefault(); this.openCaptureModal(); }
    });
  },

  setActiveNav(view){
    document.querySelectorAll('.nav-btn, .side-btn').forEach(b => { b.classList.remove('active'); b.removeAttribute('aria-current'); });
    document.querySelectorAll(`.nav-btn[data-view="${view}"], .side-btn[data-view="${view}"]`).forEach(b=>{ b.classList.add('active'); b.setAttribute('aria-current','page'); });
  },

  navigate(view){
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-'+view)?.classList.add('active');
    this.setActiveNav(view);
    this.state.view = view;
    if(view==='overview') this.renderOverview();
    if(view==='ideas') this.renderIdeas();
    if(view==='journey'){
      this.renderProjects();
      DB.syncShares().then(() => {
        DB.syncComments().then(() => this.renderProjects());
        this.renderProjects();
      }).catch(()=>{});
    }
    if(view==='profile') this.renderProfile();
  },

  openModal(id, focusSel){
    this.state.lastFocus = document.activeElement;
    const m = document.getElementById(id);
    if(!m) return;
    m.classList.add('open');
    // move focus into the dialog for keyboard/screen-reader users
    const target = focusSel ? m.querySelector(focusSel) : m.querySelector('.modal-close, button, [href], input, textarea, select');
    if(target) { try { target.focus({preventScroll:true}); } catch(_) { target.focus(); } }
  },
  closeModal(id){
    if(id==='modal-capture' && this.state.voiceOn && this._rec){ try{ this._rec.stop(); }catch(_){} }
    if(id==='modal-project-detail') this.state.currentProjectId = null;
    document.getElementById(id)?.classList.remove('open');
    const lf = this.state.lastFocus;
    if(lf && document.contains(lf)) { try { lf.focus({preventScroll:true}); } catch(_){} }
    this.state.lastFocus = null;
  },

  handleLiveComment(c){
    if(this.state.currentProjectId === c.projectId) this.renderComments(c.projectId, true);
    this.toast(`💬 ${c.author}: ${this.snippet(c.content, 36)}`, 2600);
  },

  handleLiveShare(s){
    if(!s) return;
    const proj = DB.getProject(s.projectId);
    this.toast(`🔔 ${s.owner} hat das Projekt "${proj ? proj.name : 'neu'}" mit dir geteilt`, 3200);
    if(this.state.currentProjectId === s.projectId) this.renderShareSection(s.projectId);
    if('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker){
      try { navigator.serviceWorker.ready.then(r => r.showNotification('Spark 🔔', { body: `${s.owner} hat ein Projekt mit dir geteilt`, icon:'./assets/icon-192.png', tag:'spark-share' })).catch(()=>{}); } catch(_) {}
    }
  },

  renderNotifBadge(){
    const count = DB.unreadNotifCount();
    ['notif-badge-mob','notif-badge-desk'].forEach(id => {
      const el = document.getElementById(id);
      if(!el) return;
      el.textContent = count>99 ? '99+' : count;
      el.classList.toggle('hidden', count===0);
    });
  },

  renderNotifList(){
    const list = document.getElementById('notif-list');
    const notifs = DB.getNotifications();
    if(!list) return;
    if(!notifs.length){
      list.innerHTML = `<p class="text-sm text-secondary italic py-6 text-center border border-dashed border-border rounded-xl">Keine Benachrichtigungen.</p>`;
      return;
    }
    list.innerHTML = notifs.map(n => `
      <div class="notif-item ${n.read?'':'unread'}" data-id="${n.id}" data-proj="${n.projectId || ''}" role="button" tabindex="0">
        <div class="notif-dot"></div>
        <div class="flex-1 min-w-0">
          <p class="text-sm ${n.read?'text-secondary':'font-semibold text-primary'}">${n.type==='share'?'🤝':'💬'} ${this.esc(n.text)}</p>
          <p class="text-[11px] text-dim mt-0.5">${this.ago(n.ts)}</p>
        </div>
      </div>`).join('');
    list.querySelectorAll('.notif-item').forEach(item => {
      const open = () => {
        DB.markNotifRead(item.dataset.id);
        this.renderNotifBadge();
        item.classList.remove('unread');
        const proj = item.dataset.proj;
        if(proj && DB.getProject(proj)){
          this.closeModal('modal-notif-center');
          this.openProjectDetail(proj);
        } else {
          this.renderNotifList();
        }
      };
      item.onclick = open;
      item.onkeydown = e => { if(e.key==='Enter'||e.key===' ') { e.preventDefault(); open(); } };
    });
  },

  openNotifCenter(){
    if('Notification' in window && Notification.permission === 'default' && !localStorage.getItem('spark_notif_asked')){
      localStorage.setItem('spark_notif_asked','1');
      Notification.requestPermission().catch(()=>{});
    }
    this.renderNotifList();
    const btnClear = document.getElementById('btn-notif-clear');
    if(btnClear) btnClear.onclick = () => {
      DB.clearNotifications();
      this.renderNotifBadge();
      this.openNotifCenter();
    };
    this.openModal('modal-notif-center');
  },

  toast(msg, dur=2200){
    const t=document.getElementById('toast');
    t.textContent=msg; t.style.pointerEvents=''; t.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(()=>t.classList.remove('show'), dur);
  },

  animateCount(el, to){
    if(this.reduceMotion()){ el.textContent = to; return; }
    const dur=600, start=performance.now();
    const step = now => {
      const p = Math.min((now-start)/dur, 1);
      el.textContent = Math.round(to * (1-Math.pow(1-p,3)));
      if(p<1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  // ════════════════════ OVERVIEW ════════════════════
  renderOverview(){
    const now = new Date();
    const dateStr = now.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'});
    document.getElementById('overview-date').textContent = dateStr;
    const dd = document.getElementById('overview-date-desktop'); if(dd) dd.textContent = dateStr;
    const h = now.getHours();
    const part = h<12 ? 'Guten Morgen' : h<18 ? 'Guten Tag' : 'Guten Abend';
    const user = DB.getUser();
    document.getElementById('overview-greeting').textContent = user ? `${part}, ${user}` : part;

    const ideas = DB.getIdeas().filter(i=>i.stage!=='archived');
    const projects = DB.getProjects();
    this.animateCount(document.getElementById('stat-ideas'), ideas.length);
    this.animateCount(document.getElementById('stat-projects'), projects.length);

    // Pipeline — clickable, routes to Ideas filtered by that stage
    const rows = document.getElementById('pipeline-rows');
    const counts = {};
    this.stageOrder.forEach(s => counts[s] = ideas.filter(i=>i.stage===s).length);
    const max = Math.max(1, ...Object.values(counts));
    rows.innerHTML = this.stageOrder.map(s => {
      const st = this.stages[s];
      return `
      <button class="pipe-row w-full text-left space-y-1.5 rounded-lg p-1 -m-1 hover:bg-surface-low transition-colors" data-stage="${s}" aria-label="${st.label}-Ideen anzeigen (${counts[s]})">
        <div class="flex justify-between items-center">
          <span class="text-sm font-medium flex items-center gap-1.5">${this.stageIcon(s)} ${st.label}</span>
          <span class="text-sm text-secondary tabular-nums">${counts[s]}</span>
        </div>
        <div class="pipe-bar"><div class="pipe-bar-fill" data-w="${(counts[s]/max)*100}" style="width:0;background:${st.color}"></div></div>
      </button>`;
    }).join('');
    const paint = ()=> rows.querySelectorAll('.pipe-bar-fill').forEach(f => f.style.width = f.dataset.w+'%');
    this.reduceMotion() ? paint() : requestAnimationFrame(paint);
    rows.querySelectorAll('.pipe-row').forEach(r => r.onclick = () => {
      this.state.ideaStageFilter = r.dataset.stage; this.state.ideaTagFilter=null; this.state.ideaSearch='';
      const si=document.getElementById('idea-search'); if(si) si.value='';
      this.navigate('ideas');
    });

    // Recent activity — clickable rows
    const recent = [
      ...DB.getIdeas().map(i=>({type:'idea', id:i.id, icon:'lightbulb', title:this.snippet(i.content), sub:`${this.stages[i.stage]?.label||'Idee'}`, ts:i.updatedAt||i.createdAt})),
      ...DB.getProjects().map(p=>({type:'project', id:p.id, icon:'folder', title:p.name, sub:this.statusLabel[p.status]||'Projekt', ts:p.updatedAt||p.createdAt})),
    ].sort((a,b)=>b.ts-a.ts).slice(0,5);
    const list = document.getElementById('recent-list');
    if(!recent.length){
      list.innerHTML = `<div class="px-4 py-8 text-center text-secondary text-sm">Noch keine Aktivität — erfasse deine erste Idee.</div>`;
      return;
    }
    list.innerHTML = recent.map(r => `
      <button class="recent-row w-full text-left flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-surface-low transition-colors" data-type="${r.type}" data-id="${r.id}">
        <div class="w-9 h-9 rounded-full bg-surface-mid flex items-center justify-center flex-shrink-0">
          <span class="material-symbols-outlined" style="font-size:18px" aria-hidden="true">${r.icon}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">${this.esc(r.title)}</p>
          <p class="text-xs text-secondary">${r.sub}</p>
        </div>
        <span class="text-xs text-secondary flex-shrink-0">${this.ago(r.ts)}</span>
      </button>`).join('');
    list.querySelectorAll('.recent-row').forEach(row => row.onclick = () => {
      if(row.dataset.type==='idea') this.openIdeaDetail(row.dataset.id);
      else { this.navigate('journey'); this.openProjectDetail(row.dataset.id); }
    });
    this.renderHeatmap();
    this.renderReSpark();
  },

  // ── ACTIVITY HEATMAP ──
  renderHeatmap(){
    const el = document.getElementById('activity-heatmap');
    if(!el) return;
    const ideas = DB.getIdeas();
    const days = 56;
    const bins = {};
    const now = Date.now();
    for(let d=0; d<days; d++){
      const key = new Date(now - d*86400000).toISOString().slice(0,10);
      bins[key] = 0;
    }
    ideas.forEach(i => {
      const key = new Date(i.createdAt).toISOString().slice(0,10);
      if(key in bins) bins[key]++;
    });
    const keys = Object.keys(bins).reverse();
    const max = Math.max(1, ...Object.values(bins));
    el.innerHTML = keys.map(k => {
      const count = bins[k];
      const opacity = count ? 0.18 + (count/max)*0.82 : 0.06;
      const date = new Date(k+'T12:00:00').toLocaleDateString('de-DE',{weekday:'short',day:'numeric',month:'short'});
      return `<div class="heatmap-cell" style="opacity:${opacity.toFixed(2)}" title="${date}: ${count} Idee${count!==1?'n':''}"></div>`;
    }).join('');
  },

  // ── RE-SPARK REMINDER ──
  renderReSpark(){
    const el = document.getElementById('resparkSection');
    if(!el) return;
    const week = 7*24*3600*1000;
    const stale = DB.getIdeas()
      .filter(i => i.stage==='spark' && (Date.now()-i.createdAt) > week)
      .slice(0,3);
    if(!stale.length){ el.classList.add('hidden'); el.innerHTML=''; return; }
    el.classList.remove('hidden');
    el.innerHTML = `
      <div>
        <h3 class="text-xl font-semibold mb-3"><span class="material-symbols-outlined" style="font-size:20px;vertical-align:middle" aria-hidden="true">lightbulb</span> Vergessene Funken</h3>
        <div class="bg-white border border-border rounded-2xl overflow-hidden shadow-ambient">
          ${stale.map(i => `
            <button class="resparkRow w-full text-left flex items-center gap-3 px-4 py-3 border-b border-border last:border-0" data-id="${i.id}">
              <div class="w-2 h-2 rounded-full flex-shrink-0" style="background:#f59e0b"></div>
              <p class="text-sm flex-1 truncate">${this.esc(this.snippet(i.content,55))}</p>
              <span class="text-xs text-secondary flex-shrink-0">${this.ago(i.createdAt)}</span>
            </button>`).join('')}
        </div>
      </div>`;
    el.querySelectorAll('.resparkRow').forEach(r => {
      r.onclick = () => this.openIdeaDetail(r.dataset.id);
    });
  },

  snippet(s, n=40){ s=String(s).replace(/\n/g,' '); return s.length<n ? s : s.slice(0,n)+'…'; },

  // Stage icon helper (monochrome)
  stageIcon(stage, size=15){
    const st = this.stages[stage] || this.stages.spark;
    return `<span class="material-symbols-outlined" style="font-size:${size}px;line-height:1;vertical-align:middle" aria-hidden="true">${st.icon}</span>`;
  },

  // ════════════════════ IDEAS ════════════════════
  setIdeaView(v){
    this.state.ideaView = v;
    ['list','compact','grid','board'].forEach(x => {
      const b = document.getElementById('view-'+x+'-btn');
      if(b) b.classList.toggle('active', v===x);
    });
    this.renderIdeas();
  },

  bindIdeasControls(){
    const search = document.getElementById('idea-search');
    const clearBtn = document.getElementById('idea-search-clear');
    search.addEventListener('input', () => {
      this.state.ideaSearch = search.value.trim();
      clearBtn.classList.toggle('hidden', !search.value);
      clearTimeout(this._searchT);
      this._searchT = setTimeout(()=>this.renderIdeas(), 120);
    });
    clearBtn.onclick = () => { search.value=''; this.state.ideaSearch=''; clearBtn.classList.add('hidden'); this.renderIdeas(); search.focus(); };
    document.getElementById('idea-sort').addEventListener('change', e => { this.state.ideaSort = e.target.value; this.renderIdeas(); });
    document.getElementById('idea-empty-btn').onclick = () => {
      // if a filter is what's hiding things, reset it; otherwise capture
      if(this.state.ideaStageFilter!=='all' || this.state.ideaTagFilter || this.state.ideaSearch){
        this.resetIdeaFilters();
      } else {
        this.openCaptureModal();
      }
    };

    // One-time swipe hint
    const hint = document.getElementById('swipe-hint');
    if(hint && !localStorage.getItem('spark_swipe_hint_seen')){
      hint.classList.remove('hidden');
      document.getElementById('swipe-hint-close').onclick = () => {
        hint.classList.add('hidden');
        localStorage.setItem('spark_swipe_hint_seen','1');
      };
    }
  },

  hideSwipeHint(){
    const hint = document.getElementById('swipe-hint');
    if(hint) hint.classList.add('hidden');
    localStorage.setItem('spark_swipe_hint_seen','1');
  },

  resetIdeaFilters(){
    this.state.ideaStageFilter='all'; this.state.ideaTagFilter=null; this.state.ideaSearch='';
    const si=document.getElementById('idea-search'); if(si) si.value='';
    document.getElementById('idea-search-clear')?.classList.add('hidden');
    this.renderIdeas();
  },

  filterByTag(tag){
    this.state.ideaTagFilter = this.state.ideaTagFilter===tag ? null : tag;
    this.renderIdeas();
  },

  sortIdeas(list){
    const s = this.state.ideaSort;
    const cmp = {
      newest:  (a,b)=> b.createdAt - a.createdAt,
      oldest:  (a,b)=> a.createdAt - b.createdAt,
      updated: (a,b)=> (b.updatedAt||b.createdAt) - (a.updatedAt||a.createdAt),
      stage:   (a,b)=> this.stageOrder.indexOf(a.stage) - this.stageOrder.indexOf(b.stage) || b.createdAt - a.createdAt,
    }[s] || ((a,b)=>b.createdAt-a.createdAt);
    return list.sort((a,b)=> (b.isPinned?1:0)-(a.isPinned?1:0) || cmp(a,b));
  },

  renderIdeas(){
    const all = DB.getIdeas();
    let ideas = all.filter(i => !(this.state.pendingDelete && i.id===this.state.pendingDelete.id));

    // stage filter chips (+ Archived chip when any archived exist)
    const filterRow = document.getElementById('stage-filter-row');
    const counts = {}; this.stageOrder.forEach(s=>counts[s]=all.filter(i=>i.stage===s).length);
    const archivedCount = all.filter(i=>i.stage==='archived').length;
    const chips = [{k:'all',label:'Alle'}, ...this.stageOrder.map(s=>({k:s,label:`${this.stages[s].label} (${counts[s]})`}))];
    if(archivedCount) chips.push({k:'archived', label:`Archiviert (${archivedCount})`});
    filterRow.innerHTML = chips.map(c =>
      `<button class="chip${this.state.ideaStageFilter===c.k?' active':''}" data-stage="${c.k}">${c.label}</button>`
    ).join('');
    filterRow.querySelectorAll('.chip').forEach(c => {
      c.onclick = () => { this.state.ideaStageFilter = c.dataset.stage; this.renderIdeas(); };
    });
    // Board groups by stage inherently → hide the stage-filter chips in board mode
    filterRow.classList.toggle('hidden', this.state.ideaView==='board');

    // active tag bar
    const tagBar = document.getElementById('active-tag-bar');
    if(this.state.ideaTagFilter){
      tagBar.classList.remove('hidden');
      tagBar.innerHTML = `<span class="text-secondary">Gefiltert nach</span> <span class="tag">#${this.esc(this.state.ideaTagFilter)}</span>
        <button id="clear-tag" class="text-primary font-semibold underline" aria-label="Tag-Filter zurücksetzen">zurücksetzen</button>`;
      tagBar.querySelector('#clear-tag').onclick = () => { this.state.ideaTagFilter=null; this.renderIdeas(); };
    } else { tagBar.classList.add('hidden'); tagBar.innerHTML=''; }

    // ── BOARD VIEW: columns per stage (ignores the stage-filter chip) ──
    if(this.state.ideaView==='board'){
      let b = all.filter(i => !(this.state.pendingDelete && i.id===this.state.pendingDelete.id) && i.stage!=='archived');
      if(this.state.ideaTagFilter) b = b.filter(i=>(i.tags||[]).includes(this.state.ideaTagFilter));
      if(this.state.ideaSearch){ const q=this.state.ideaSearch.toLowerCase(); b = b.filter(i=>i.content.toLowerCase().includes(q)||(i.tags||[]).some(t=>t.toLowerCase().includes(q))); }
      document.getElementById('idea-count').textContent = all.filter(i=>i.stage!=='archived').length;
      this.renderBoard(b);
      return;
    }

    // apply filters: archived only when explicitly selected
    if(this.state.ideaStageFilter==='archived') ideas = ideas.filter(i=>i.stage==='archived');
    else if(this.state.ideaStageFilter!=='all') ideas = ideas.filter(i=>i.stage===this.state.ideaStageFilter);
    else ideas = ideas.filter(i=>i.stage!=='archived');

    if(this.state.ideaTagFilter) ideas = ideas.filter(i=>(i.tags||[]).includes(this.state.ideaTagFilter));
    if(this.state.ideaSearch){
      const q = this.state.ideaSearch.toLowerCase();
      ideas = ideas.filter(i => i.content.toLowerCase().includes(q) || (i.tags||[]).some(t=>t.toLowerCase().includes(q)));
    }

    document.getElementById('idea-count').textContent = all.filter(i=>i.stage!=='archived').length;

    const feed = document.getElementById('idea-feed');
    const scroll = document.getElementById('idea-scroll');
    const empty = document.getElementById('idea-empty');
    const filtering = this.state.ideaStageFilter!=='all' || this.state.ideaTagFilter || this.state.ideaSearch;
    if(!ideas.length){
      feed.innerHTML=''; scroll.classList.add('hidden'); empty.classList.remove('hidden');
      const msg = document.getElementById('idea-empty-msg');
      const btn = document.getElementById('idea-empty-btn');
      if(filtering){
        msg.textContent = this.state.ideaSearch ? `Keine Ideen für „${this.state.ideaSearch}“.` : 'Hier noch keine Ideen.';
        btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px" aria-hidden="true">filter_alt_off</span> Alle Ideen anzeigen`;
      } else {
        msg.textContent = 'Erfasse deine erste Idee.';
        btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px" aria-hidden="true">add</span> Neue Idee`;
      }
      return;
    }
    scroll.classList.remove('hidden'); empty.classList.add('hidden');

    this.sortIdeas(ideas);

    const base = 'w-full max-w-[1180px] mx-auto ';
    if(this.state.ideaView==='grid'){
      feed.className = base + 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 content-start';
      feed.innerHTML = ideas.map((i,idx)=>this.ideaGridCard(i,idx)).join('');
    } else if(this.state.ideaView==='compact'){
      feed.className = base + 'flex flex-col gap-2';
      feed.innerHTML = ideas.map((i,idx)=>this.ideaCompactCard(i,idx)).join('');
    } else {
      feed.className = base + 'flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-3';
      feed.innerHTML = ideas.map((i,idx)=>this.ideaListCard(i,idx)).join('');
    }

    feed.querySelectorAll('.idea-card').forEach(card => {
      const open = () => { if(!card.dataset.swiped) this.openIdeaDetail(card.dataset.id); };
      card.onclick = open;
      card.onkeydown = e => { if(e.key==='Enter'||e.key===' '){ e.preventDefault(); this.openIdeaDetail(card.dataset.id); } };
      this.bindSwipe(card, card.dataset.id);
      // clickable tags inside cards
      card.querySelectorAll('.tag-click').forEach(t => {
        t.onclick = e => { e.stopPropagation(); this.filterByTag(t.dataset.tag); };
      });
    });
  },

  stagePill(stage){
    const st = this.stages[stage] || this.stages.spark;
    return `<span class="stage-pill ${stage}">${this.stageIcon(stage,12)} ${st.label}</span>`;
  },
  tagChip(t, clickable){
    const cls = clickable ? 'tag tag-click' : 'tag';
    return `<span class="${cls}" ${clickable?`data-tag="${this.escAttr(t)}"`:''}>#${this.esc(t)}</span>`;
  },

  getIdeaTitle(content){
    if(!content) return 'Unbenannte Idee';
    const lines = content.split('\n').map(l=>l.trim()).filter(Boolean);
    if(!lines.length) return 'Unbenannte Idee';
    let first = lines[0];
    first = first.replace(/^([#*_\-\s>]+)/, '').replace(/([*_]+)$/, '').trim();
    if(!first) first = lines[0];
    return first.length > 70 ? first.slice(0, 70) + '…' : first;
  },

  getIdeaPreview(content){
    if(!content) return '';
    const lines = content.split('\n').map(l=>l.trim()).filter(Boolean);
    if(lines.length <= 1) return '';
    let rest = lines.slice(1).join(' ').trim();
    rest = rest.replace(/^([#*_\-\s>]+)/, '').replace(/([*_]+)/g, '').trim();
    if(!rest) return '';
    return rest.length > 100 ? rest.slice(0, 100) + '…' : rest;
  },

  quickShareIdea(id, e){
    if(e) e.stopPropagation();
    const idea = DB.getIdea(id);
    if(!idea) return;
    let projId = idea.projectId;
    if(!projId){
      if(!confirm('Noch kein Projekt vorhanden. Projekt aus dieser Idee erstellen und teilen?')) return;
      const newP = DB.addProject({ name: this.getIdeaTitle(idea.content), description: idea.content, status: 'in_progress', tags: idea.tags||[] });
      DB.updateIdea(id, { projectId: newP.id });
      projId = newP.id;
    }
    this.openShareCenter(projId);
  },

  ideaListCard(i, idx){
    const st = this.stages[i.stage] || this.stages.spark;
    const tagsAll = i.tags||[];
    const tags = tagsAll.slice(0,2).map(t=>this.tagChip(t,true)).join('');
    const more = tagsAll.length>2 ? `<span class="tag">+${tagsAll.length-2}</span>` : '';
    const delay = this.reduceMotion()?0:Math.min(idx*40,300);
    const img = (i.images&&i.images[0]) ? `<img class="idea-card-img" src="${i.images[0]}" alt="" loading="lazy">` : '';
    const imgCount = (i.images&&i.images.length>1) ? `<span class="text-xs text-secondary flex items-center gap-0.5"><span class="material-symbols-outlined" style="font-size:13px" aria-hidden="true">image</span>${i.images.length}</span>` : '';
    const title = this.getIdeaTitle(i.content);
    const preview = this.getIdeaPreview(i.content);

    return `
    <div class="idea-card anim-up" role="button" tabindex="0" aria-label="Idee: ${this.escAttr(title)} — ${st.label}" data-id="${i.id}" style="animation-delay:${delay}ms">
      <div class="stage-bar" style="background:${st.color}"></div>
      <div class="pl-2">
        ${i.isPinned?'<span class="material-symbols-outlined text-secondary float-right" style="font-size:16px" aria-hidden="true">push_pin</span>':''}
        ${i.projectId?'<span class="stage-pill shipped float-right" style="margin-left:4px">umgewandelt</span>':''}
        ${img}
        <h3 class="text-[15px] leading-snug text-primary font-bold tracking-tight mb-1">${this.esc(title)}</h3>
        ${preview ? `<p class="text-xs leading-relaxed text-secondary line-clamp-2 mb-2">${this.esc(preview)}</p>` : ''}
        <div class="flex items-center gap-2 mt-2 pt-2 border-t border-border flex-wrap">
          ${this.stagePill(i.stage)}
          ${i.prototypeHtml?'<span class="tag text-[11px] flex items-center gap-1 bg-surface-mid border border-border"><span class="material-symbols-outlined" style="font-size:12px">view_quilt</span> Prototyp</span>':''}
          ${tags}${more}${imgCount}
          <button onclick="App.quickShareIdea('${i.id}', event)" class="btn-secondary !py-1 !px-2.5 !text-xs ml-auto flex items-center gap-1 font-semibold" title="Teilen &amp; Live-Chat">
            <span class="material-symbols-outlined" style="font-size:14px">handshake</span> Teilen
          </button>
        </div>
      </div>
    </div>`;
  },

  ideaCompactCard(i, idx){
    const st = this.stages[i.stage] || this.stages.spark;
    const delay = this.reduceMotion()?0:Math.min(idx*30,300);
    const title = this.getIdeaTitle(i.content);
    return `
    <div class="idea-card anim-up !py-3" role="button" tabindex="0" aria-label="Idee: ${this.escAttr(title)} — ${st.label}" data-id="${i.id}" style="animation-delay:${delay}ms">
      <div class="stage-bar" style="background:${st.color}"></div>
      <div class="pl-2 flex items-center gap-3">
        <p class="text-sm font-semibold text-primary truncate flex-1">${this.esc(title)}</p>
        <button onclick="App.quickShareIdea('${i.id}', event)" class="btn-secondary !py-1 !px-2 !text-xs flex items-center gap-1 font-semibold" title="Teilen &amp; Live-Chat">
          <span class="material-symbols-outlined" style="font-size:14px">handshake</span>
        </button>
        ${this.stagePill(i.stage)}
      </div>
    </div>`;
  },

  ideaGridCard(i, idx){
    const st = this.stages[i.stage] || this.stages.spark;
    const tags = (i.tags||[]).slice(0,2).map(t=>this.tagChip(t,true)).join('');
    const delay = this.reduceMotion()?0:Math.min(idx*40,300);
    const img = (i.images&&i.images[0]) ? `<img class="idea-card-img" src="${i.images[0]}" alt="" loading="lazy" style="height:90px">` : '';
    const title = this.getIdeaTitle(i.content);
    const preview = this.getIdeaPreview(i.content);
    return `
    <div class="idea-card anim-up flex flex-col justify-between min-h-[140px]" role="button" tabindex="0" aria-label="Idee: ${this.escAttr(title)} — ${st.label}" data-id="${i.id}" style="animation-delay:${delay}ms">
      <div class="stage-bar" style="background:${st.color}"></div>
      <div class="pl-2 flex-1">
        <div class="mb-2">${this.stagePill(i.stage)}</div>
        ${img}
        <h3 class="text-sm font-bold text-primary mb-1 leading-tight">${this.esc(title)}</h3>
        ${preview ? `<p class="text-xs text-secondary line-clamp-2">${this.esc(preview)}</p>` : ''}
      </div>
      <div class="pl-2 mt-2 flex items-center gap-2 flex-wrap">
        ${tags}
        <button onclick="App.quickShareIdea('${i.id}', event)" class="btn-secondary !py-1 !px-2.5 !text-xs ml-auto flex items-center gap-1 font-semibold" title="Teilen &amp; Live-Chat">
          <span class="material-symbols-outlined" style="font-size:14px">handshake</span>
        </button>
      </div>
    </div>`;
  },

  // ── BOARD (Kanban) ──
  renderBoard(ideas){
    const scroll = document.getElementById('idea-scroll');
    const empty = document.getElementById('idea-empty');
    const feed = document.getElementById('idea-feed');
    scroll.classList.remove('hidden'); empty.classList.add('hidden');
    feed.className = 'board-wrap w-full';
    const byStage = {}; this.stageOrder.forEach(s => byStage[s] = []);
    ideas.forEach(i => { if(byStage[i.stage]) byStage[i.stage].push(i); });
    this.stageOrder.forEach(s => byStage[s].sort((a,b)=>(b.isPinned?1:0)-(a.isPinned?1:0)||b.createdAt-a.createdAt));
    feed.innerHTML = this.stageOrder.map(s => {
      const st = this.stages[s], cards = byStage[s];
      return `
      <section class="board-col" data-stage="${s}" aria-label="Spalte ${st.label}">
        <div class="board-col-head" style="color:${st.color}">
          ${this.stageIcon(s,14)} ${st.label}
          <span class="ml-auto text-secondary tabular-nums">${cards.length}</span>
        </div>
        <div class="board-col-body" data-stage="${s}">
          ${cards.length ? cards.map(i=>this.boardCard(i)).join('') : '<p class="text-xs text-secondary text-center py-6">Ideen hierher ziehen</p>'}
        </div>
      </section>`;
    }).join('');

    // open detail
    feed.querySelectorAll('.board-open').forEach(el => el.onclick = () => this.openIdeaDetail(el.dataset.id));
    // move buttons (mobile / no-drag)
    feed.querySelectorAll('.board-move-prev').forEach(b => b.onclick = e => { e.stopPropagation(); this.moveIdeaStage(b.dataset.id,-1); });
    feed.querySelectorAll('.board-move-next').forEach(b => b.onclick = e => { e.stopPropagation(); this.moveIdeaStage(b.dataset.id, 1); });
    // drag & drop (desktop)
    feed.querySelectorAll('.board-card').forEach(card => {
      card.addEventListener('dragstart', e => { card.classList.add('dragging'); e.dataTransfer.setData('text/plain', card.dataset.id); e.dataTransfer.effectAllowed='move'; });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });
    feed.querySelectorAll('.board-col').forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drop-hover'); e.dataTransfer.dropEffect='move'; });
      col.addEventListener('dragleave', e => { if(!col.contains(e.relatedTarget)) col.classList.remove('drop-hover'); });
      col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('drop-hover'); const id=e.dataTransfer.getData('text/plain'); if(id) this.setStageTo(id, col.dataset.stage); });
    });
  },

  boardCard(i){
    const idx = this.stageOrder.indexOf(i.stage);
    const prev = this.stageOrder[idx-1], next = this.stageOrder[idx+1];
    const tags = (i.tags||[]).slice(0,2).map(t=>this.tagChip(t,false)).join('');
    const img = (i.images&&i.images[0]) ? `<img src="${i.images[0]}" class="idea-card-img" style="height:80px;margin-bottom:8px" alt="" loading="lazy">` : '';
    const title = this.getIdeaTitle(i.content);
    const preview = this.getIdeaPreview(i.content);
    return `
    <div class="board-card" draggable="true" data-id="${i.id}">
      ${img}
      <h3 class="text-sm font-bold text-primary board-open cursor-pointer mb-1" data-id="${i.id}">${this.esc(title)}</h3>
      ${preview ? `<p class="text-xs text-secondary line-clamp-2 board-open cursor-pointer mb-2" data-id="${i.id}">${this.esc(preview)}</p>` : ''}
      <div class="flex items-center gap-1.5 mt-2 flex-wrap">${tags}${i.isPinned?'<span class="material-symbols-outlined text-secondary" style="font-size:14px" aria-hidden="true">push_pin</span>':''}</div>
      <div class="board-move">
        <button class="board-move-prev" data-id="${i.id}" ${prev?'':'disabled'} aria-label="${prev?'Zu '+this.stages[prev].label+' verschieben':'Erste Phase'}"><span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">chevron_left</span></button>
        <button class="board-move-next" data-id="${i.id}" ${next?'':'disabled'} aria-label="${next?'Zu '+this.stages[next].label+' verschieben':'Letzte Phase'}"><span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">chevron_right</span></button>
      </div>
    </div>`;
  },

  moveIdeaStage(id, dir){
    const idea=DB.getIdea(id); if(!idea) return;
    const to=this.stageOrder[this.stageOrder.indexOf(idea.stage)+dir];
    if(!to) return;
    DB.addTimelineEntry(id, to, dir>0?`Weiter zu ${this.stages[to].label}`:`Zurück zu ${this.stages[to].label}`);
    if(dir>0) this.confetti();
    this.renderIdeas(); this.renderOverview();
    this.toast(`${this.stages[to].label}`);
  },

  setStageTo(id, stage){
    const idea=DB.getIdea(id); if(!idea || idea.stage===stage) return;
    const forward = this.stageOrder.indexOf(stage) > this.stageOrder.indexOf(idea.stage);
    DB.addTimelineEntry(id, stage, `Verschoben zu ${this.stages[stage].label}`);
    if(forward) this.confetti();
    this.renderIdeas(); this.renderOverview();
    this.toast(`${this.stages[stage].label}`);
  },

  // ── CAPTURE ──
  bindCapture(){
    document.getElementById('capture-stage-row').querySelectorAll('.chip').forEach(c => {
      c.onclick = () => {
        document.querySelectorAll('#capture-stage-row .chip').forEach(x=>x.classList.remove('active'));
        c.classList.add('active'); this.state.captureStage = c.dataset.stage; this.saveDraft();
      };
    });
    const text = document.getElementById('capture-text');
    text.addEventListener('input', () => this.saveDraft());
    // Enter = save & keep going; Cmd/Ctrl+Enter = save & close; Shift+Enter = newline
    text.addEventListener('keydown', e => {
      if(e.key==='Enter' && (e.metaKey||e.ctrlKey)){ e.preventDefault(); this.saveIdea(false); }
      else if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); this.saveIdea(true); }
    });
    const ti = document.getElementById('capture-tag-input');
    ti.addEventListener('keydown', e => {
      if(e.key==='Enter'){ e.preventDefault(); this.addCaptureTag(ti.value); ti.value=''; this.saveDraft(); }
    });
    document.getElementById('btn-save-idea').onclick = () => this.saveIdea(false);
    document.getElementById('btn-save-add').onclick = () => this.saveIdea(true);

    // AI Capture outline & chat
    const btnAiCap = document.getElementById('btn-ai-capture');
    if(btnAiCap){
      btnAiCap.onclick = () => this.generateCaptureAI();
    }
    const btnTopProto = document.getElementById('btn-cap-top-prototype');
    if(btnTopProto) btnTopProto.onclick = () => this.generateCapturePrototype();

    const btnChipProto = document.getElementById('btn-cap-chip-prototype');
    if(btnChipProto) btnChipProto.onclick = () => this.generateCapturePrototype();

    this.bindCaptureAIChat();
  },

  // ── VOICE (Web Speech API) ──
  bindVoice(){
    const btn = document.getElementById('btn-voice');
    const hint = document.getElementById('voice-hint');
    const langSel = document.getElementById('voice-lang');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR){
      if(btn){ btn.disabled = true; btn.style.opacity = '.35'; btn.title = 'Spracheingabe wird in diesem Browser nicht unterstützt'; }
      return;
    }
    if(langSel){
      const saved = localStorage.getItem('spark_voice_lang');
      if(saved && [...langSel.options].some(o=>o.value===saved)) langSel.value = saved;
      langSel.addEventListener('change', () => {
        localStorage.setItem('spark_voice_lang', langSel.value);
        if(hint) hint.textContent = `🎙️ ${langSel.options[langSel.selectedIndex].text}`;
      });
    }
    const rec = new SR();
    const pickLang = () => {
      const v = langSel ? langSel.value : 'auto';
      if(v==='auto'){
        const nl = (navigator.language||'').toLowerCase();
        rec.lang = (nl.startsWith('vi') || nl.startsWith('de')) ? navigator.language : 'de-DE';
      } else rec.lang = v;
    };
    rec.continuous = false; // continuous = false is 100x more reliable on iOS Safari
    rec.interimResults = true;
    this._rec = rec;
    let baseText = '';

    rec.onstart = () => {
      this.state.voiceOn = true;
      if(btn) btn.classList.add('recording');
      if(hint) hint.textContent = `🎙️ Höre zu… (${rec.lang})`;
    };

    rec.onresult = e => {
      let finalTxt = '', interim = '';
      for(let i=e.resultIndex; i<e.results.length; i++){
        const t = e.results[i][0].transcript;
        if(e.results[i].isFinal) finalTxt += t; else interim += t;
      }
      const ta = document.getElementById('capture-text');
      if(ta){
        if(finalTxt){ baseText = (baseText ? baseText+' ' : '') + finalTxt.trim(); }
        ta.value = (baseText + (interim ? ' '+interim : '')).trim();
        this.saveDraft();
      }
    };

    rec.onerror = ev => {
      if(ev.error === 'no-speech') return; // Silence pause is normal
      if(ev.error === 'aborted') return;
      this.state.voiceOn = false;
      if(btn) btn.classList.remove('recording');
      if(!hint) return;
      const msgs = {
        'not-allowed': '❌ Mikrofon verweigert — bitte im Browser erlauben',
        'service-not-allowed': '❌ Sprachdienst vom Browser blockiert',
        'language-not-supported': '⚠️ Sprachpaket fehlt — iPhone: Einstellungen → Allgemein → Tastatur → Diktat → Sprache',
        'network': '❌ Internetverbindung benötigt (Erkennung läuft in der Cloud)',
        'audio-capture': '❌ Mikrofon wird von einer anderen App verwendet',
        'audio-output': '❌ Kein Mikrofon gefunden'
      };
      hint.textContent = msgs[ev.error] || '❌ Fehler: ' + ev.error;
    };

    rec.onend = () => {
      if(this.state.voiceOn){
        try {
          rec.start();
        } catch(_) {
          this.state.voiceOn = false;
          if(btn) btn.classList.remove('recording');
          if(hint) hint.textContent = '';
        }
      } else {
        if(btn) btn.classList.remove('recording');
        if(hint) hint.textContent = '';
      }
    };

    if(btn){
      btn.onclick = () => {
        if(this.state.voiceOn){
          this.state.voiceOn = false;
          try { rec.stop(); } catch(_){}
          if(btn) btn.classList.remove('recording');
          if(hint) hint.textContent = '';
          return;
        }
        if(!window.isSecureContext){
          if(hint) hint.textContent = '❌ Diktat braucht HTTPS — Seite über https:// öffnen (nicht http://)';
          return;
        }
        const ta = document.getElementById('capture-text');
        baseText = ta ? ta.value.trim() : '';
        pickLang();
        this.state.voiceOn = true;
        try {
          rec.start();
        } catch(e) {
          this.state.voiceOn = false;
          if(hint) hint.textContent = '❌ Mikrofon konnte nicht gestartet werden';
        }
      };
    }
  },

  checkIOSInstallPrompt(){
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = localStorage.getItem('spark_ios_banner_dismissed');
    if(isIOS && !isStandalone && !dismissed){
      const banner = document.getElementById('ios-pwa-banner');
      if(banner) banner.classList.remove('hidden');
      const btnClose = document.getElementById('btn-close-ios-banner');
      if(btnClose){
        btnClose.onclick = () => {
          if(banner) banner.classList.add('hidden');
          localStorage.setItem('spark_ios_banner_dismissed', '1');
        };
      }
    }
  },

  // ── IMAGE ATTACH ──
  bindCaptureImage(){
    const btn = document.getElementById('btn-add-image');
    const input = document.getElementById('capture-image-input');
    btn.onclick = () => input.click();
    input.onchange = async e => {
      const files = Array.from(e.target.files||[]);
      for(const f of files){
        if(this.state.captureImages.length >= 4){ this.toast('Maximal 4 Bilder'); break; }
        try { const b64 = await DB.compressImage(f, 1000, 0.8); this.state.captureImages.push(b64); }
        catch(_){ this.toast('Bild konnte nicht gelesen werden'); }
      }
      input.value='';
      this.renderCaptureImages(); this.saveDraft();
    };
  },
  renderCaptureImages(){
    const row = document.getElementById('capture-images');
    if(!this.state.captureImages.length){ row.innerHTML=''; return; }
    row.innerHTML = this.state.captureImages.map((src,i)=>
      `<div class="img-thumb"><img src="${src}" alt="Anhang ${i+1}"><button class="img-thumb-rm" data-i="${i}" aria-label="Bild ${i+1} entfernen">✕</button></div>`
    ).join('');
    row.querySelectorAll('.img-thumb-rm').forEach(b => {
      b.onclick = () => { this.state.captureImages.splice(+b.dataset.i,1); this.renderCaptureImages(); this.saveDraft(); };
    });
  },

  saveDraft(){
    DB.setDraft({ text:document.getElementById('capture-text').value, stage:this.state.captureStage, tags:this.state.captureTags, images:this.state.captureImages, aiChat:this.state.captureAIChat, prototypeHtml:this.state.capturePrototypeHtml });
  },

  openCaptureModal(){
    const draft = DB.getDraft();
    const text = document.getElementById('capture-text');
    text.value = draft?.text || '';
    this.state.captureTags = draft?.tags ? [...draft.tags] : [];
    this.state.captureImages = draft?.images ? [...draft.images] : [];
    this.state.captureStage = draft?.stage || 'spark';
    this.state.captureAIChat = draft?.aiChat ? [...draft.aiChat] : [];
    this.state.capturePrototypeHtml = draft?.prototypeHtml || null;
    document.getElementById('capture-tag-input').value = '';
    this.renderCaptureTags();
    this.renderCaptureImages();
    this.updateCaptureAIChatUI();
    this.bindCaptureAIChat();
    document.querySelectorAll('#capture-stage-row .chip').forEach(c=>c.classList.toggle('active', c.dataset.stage===this.state.captureStage));
    // Focus synchronously so iOS raises the keyboard on the first tap
    this.openModal('modal-capture', '#capture-text');
    text.focus();
    if(draft?.text || draft?.images?.length) this.toast('Entwurf wiederhergestellt');
  },

  addCaptureTag(val){
    val = val.replace(/^#+/,'').trim().toLowerCase();
    if(!val || this.state.captureTags.includes(val)) return;
    this.state.captureTags.push(val);
    this.renderCaptureTags();
  },
  renderCaptureTags(){
    const row = document.getElementById('capture-tags');
    row.innerHTML = this.state.captureTags.map(t =>
      `<span class="tag flex items-center gap-1">#${this.esc(t)} <button data-tag="${this.escAttr(t)}" class="tag-rm leading-none" aria-label="Tag ${this.escAttr(t)} entfernen">✕</button></span>`
    ).join('');
    row.querySelectorAll('.tag-rm').forEach(b => {
      b.onclick = () => { this.state.captureTags = this.state.captureTags.filter(x=>x!==b.dataset.tag); this.renderCaptureTags(); this.saveDraft(); };
    });
  },

  saveIdea(keepOpen){
    const text = document.getElementById('capture-text').value.trim();
    if(!text && !this.state.captureImages.length){ this.toast('Schreib zuerst etwas ✍️'); return; }
    if(this.state.voiceOn && this._rec){ try{ this._rec.stop(); }catch(_){} }
    DB.addIdea({ content:text, tags:[...this.state.captureTags], images:[...this.state.captureImages], stage:this.state.captureStage, aiChat:[...(this.state.captureAIChat||[])], prototypeHtml:this.state.capturePrototypeHtml||null, isPinned:false, color:null });
    DB.clearDraft();
    this.renderIdeas(); this.renderOverview(); this.renderProfile();
    if(keepOpen){
      // burst capture: clear text+tags+images+chat+prototype, keep stage, refocus
      const ta = document.getElementById('capture-text');
      ta.value=''; this.state.captureTags=[]; this.state.captureImages=[]; this.state.captureAIChat=[]; this.state.capturePrototypeHtml=null;
      this.renderCaptureTags(); this.renderCaptureImages(); this.updateCaptureAIChatUI();
      ta.focus();
      this.toast('Gespeichert 💡 — weiter geht’s');
    } else {
      this.state.captureAIChat = [];
      this.state.capturePrototypeHtml = null;
      this.closeModal('modal-capture');
      this.toast('Idee erfasst 💡');
    }
  },

  // ── IDEA DETAIL ──
  openIdeaDetail(id){
    const idea = DB.getIdea(id);
    if(!idea) return;
    const isArchived = idea.stage==='archived';
    document.getElementById('idea-modal-title').textContent = this.stages[idea.stage]?.label || 'Idee';
    const next = isArchived ? null : this.stageOrder[this.stageOrder.indexOf(idea.stage)+1];
    const prev = isArchived ? null : this.stageOrder[this.stageOrder.indexOf(idea.stage)-1];
    const timeline = (idea.timeline||[]).slice().reverse();
    const linkedProj = idea.projectId ? DB.getProject(idea.projectId) : null;
    const body = document.getElementById('idea-modal-body');
    body.innerHTML = `
      <div class="mb-4 flex items-center gap-2 flex-wrap">${this.stagePill(idea.stage)}
        ${linkedProj?`<button id="btn-view-linked" class="stage-pill shipped" style="cursor:pointer">↗ ${this.esc(this.snippet(linkedProj.name,24))}</button>`:''}
      </div>
      <p class="text-lg leading-relaxed text-primary whitespace-pre-wrap">${this.esc(idea.content)}</p>
      ${(idea.images&&idea.images.length)?`<div class="grid grid-cols-2 gap-2 mt-4">${idea.images.map((src,ix)=>`<img src="${src}" alt="Anhang ${ix+1}" loading="lazy" class="w-full rounded-xl border border-border" style="max-height:220px;object-fit:cover">`).join('')}</div>`:''}
      <div class="flex flex-wrap gap-2 mt-4">${(idea.tags||[]).map(t=>this.tagChip(t,true)).join('')}</div>
      <p class="text-xs text-secondary mt-3">${new Date(idea.createdAt).toLocaleString('de-DE')}</p>

      <div class="grid grid-cols-2 gap-2 mt-6">
        ${next?`<button id="btn-idea-advance" class="btn-primary col-span-2 py-3"><span class="material-symbols-outlined" style="font-size:18px" aria-hidden="true">arrow_forward</span> Weiter zu ${this.stages[next].label}</button>`:''}
        ${prev?`<button id="btn-idea-back" class="btn-secondary col-span-2 py-3"><span class="material-symbols-outlined" style="font-size:18px" aria-hidden="true">arrow_back</span> Zurück zu ${this.stages[prev].label}</button>`:''}
        ${isArchived?`<button id="btn-idea-restore" class="btn-primary col-span-2 py-3"><span class="material-symbols-outlined" style="font-size:18px" aria-hidden="true">unarchive</span> Wiederherstellen</button>`:''}
        <button id="btn-idea-ai" class="btn-secondary col-span-2 py-3 flex items-center justify-center gap-2"><span class="material-symbols-outlined" style="font-size:18px" aria-hidden="true">auto_awesome</span> KI-Gliederung &amp; Vorschläge</button>
        <button id="btn-idea-edit" class="btn-secondary py-3"><span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">edit</span> Bearbeiten</button>
        <button id="btn-idea-pin" class="btn-secondary py-3"><span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">push_pin</span> ${idea.isPinned?'Lösen':'Anheften'}</button>
        ${!isArchived?`<button id="btn-idea-archive" class="btn-secondary py-3"><span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">archive</span> Archivieren</button>`:''}
        <button id="btn-idea-share" class="btn-secondary py-3"><span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">share</span> Teilen</button>
        <button id="btn-idea-to-proj" class="btn-secondary py-3 ${isArchived?'col-span-2':''}"><span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">drive_file_move</span> In Projekt umwandeln</button>
        <button id="btn-idea-prototype" class="btn-primary col-span-2 py-3 flex items-center justify-center gap-2"><span class="material-symbols-outlined" style="font-size:18px" aria-hidden="true">view_quilt</span> 📐 ${idea.prototypeHtml ? 'UI-Prototyp öffnen &amp; anpassen' : 'KI UI-Prototyp generieren'}</button>
        <button id="btn-idea-del" class="btn-danger col-span-2"><span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">delete</span> Löschen</button>
      </div>

      <!-- Interactive AI Workspace -->
      <div class="mt-6 border border-border bg-surface-mid rounded-2xl p-4 space-y-3 shadow-ambient">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary" style="font-size:20px" aria-hidden="true">auto_awesome</span>
            <span class="text-sm font-bold text-primary">KI-Assistent &amp; Feinschliff</span>
          </div>
          ${(idea.aiChat&&idea.aiChat.length)?`<button id="btn-clear-ai-chat" class="text-xs text-secondary hover:text-red-500">Verlauf löschen</button>`:''}
        </div>

        <div id="ai-chat-messages" class="space-y-3 max-h-[360px] overflow-y-auto pr-1">
          ${(idea.aiChat&&idea.aiChat.length) ? this.renderAIChatList(idea.aiChat, id) : `
            <div class="p-3.5 text-center text-xs text-dim border border-dashed border-border rounded-xl">
              Kein Verlauf vorhanden. Gib unten eine Anweisung ein oder wähle einen Vorschlag.
            </div>
          `}
        </div>

        <!-- Quick Prompts Chips -->
        <div class="flex flex-wrap gap-1.5 pt-1">
          <button class="ai-prompt-chip chip text-xs bg-surface border-border text-primary" data-prompt="Erstelle eine strukturierte 3-Schritte-Gliederung für diese Idee">3-Schritte-Gliederung</button>
          <button class="ai-prompt-chip chip text-xs bg-surface border-border text-primary" data-prompt="Schlage 3 kreative und nützliche Funktionen für diese Idee vor">Funktionsvorschläge</button>
          <button class="ai-prompt-chip chip text-xs bg-surface border-border text-primary" data-prompt="Formuliere diese Idee prägnant und kompakt">Kompakt fassen</button>
          <button class="ai-prompt-chip chip text-xs bg-surface border-border text-primary" data-prompt="Analysiere die Zielgruppe und den Mehrwert dieser Idee">Zielgruppen-Analyse</button>
        </div>

        <!-- Input Row -->
        <div class="flex items-center gap-2 pt-1">
          <input type="text" id="ai-chat-input" class="inp text-sm flex-1" placeholder="Anweisung oder Überarbeitung eingeben..." aria-label="KI-Anweisung">
          <button id="btn-send-ai-chat" class="btn-primary py-2.5 px-4 text-sm flex items-center gap-1.5 flex-shrink-0">
            <span>Senden</span>
            <span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">send</span>
          </button>
        </div>
      </div>

      <div class="mt-6">
        <p class="text-xs font-semibold uppercase tracking-widest text-dim mb-3">Verlauf</p>
        <div class="space-y-3">
          ${timeline.map(t=>`
            <div class="flex gap-3">
              <div class="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style="background:${this.stages[t.stage]?.color||'#6b7280'}"></div>
              <div class="flex-1">
                <p class="text-sm font-medium">${this.stages[t.stage]?.label||t.stage} — <span class="text-secondary font-normal">${this.esc(t.note||'')}</span></p>
                <p class="text-xs text-secondary">${this.ago(t.ts)}</p>
              </div>
            </div>`).join('')}
        </div>
      </div>`;

    if(next) document.getElementById('btn-idea-advance').onclick = () => {
      DB.addTimelineEntry(id, next, `Weiter zu ${this.stages[next].label}`);
      this.confetti();
      this.openIdeaDetail(id); this.renderIdeas(); this.renderOverview();
      this.toast(`Verschoben zu ${this.stages[next].label}`);
    };
    if(prev) document.getElementById('btn-idea-back').onclick = () => {
      DB.addTimelineEntry(id, prev, `Zurück zu ${this.stages[prev].label}`);
      this.openIdeaDetail(id); this.renderIdeas(); this.renderOverview();
      this.toast(`Zurück zu ${this.stages[prev].label} ↩️`);
    };
    if(isArchived) document.getElementById('btn-idea-restore').onclick = () => this.restoreIdea(id);
    if(linkedProj) document.getElementById('btn-view-linked').onclick = () => { this.closeModal('modal-idea'); this.navigate('journey'); this.openProjectDetail(linkedProj.id); };
    document.getElementById('btn-idea-edit').onclick = () => this.startEditIdea(id, idea.content);
    document.getElementById('btn-idea-pin').onclick = () => {
      DB.updateIdea(id, {isPinned:!idea.isPinned});
      this.closeModal('modal-idea'); this.renderIdeas();
      this.toast(idea.isPinned?'Gelöst':'Angeheftet 📌');
    };
    const archiveBtn = document.getElementById('btn-idea-archive');
    if(archiveBtn) archiveBtn.onclick = () => { this.closeModal('modal-idea'); this.archiveIdea(id); };
    document.getElementById('btn-idea-to-proj').onclick = () => {
      this.closeModal('modal-idea'); this.openProjectModal(null, idea.content, id);
    };
    document.getElementById('btn-idea-prototype').onclick = () => {
      this.closeModal('modal-idea');
      this.openPrototypeModal(id, false);
    };
    document.getElementById('btn-idea-del').onclick = () => {
      this.closeModal('modal-idea'); this.softDeleteIdea(id);
    };
    // Bind AI Chat events
    this.bindAIChatEvents(id, idea);
    document.getElementById('btn-idea-share')?.addEventListener('click', () => {
      let projId = idea.projectId;
      if(!projId){
        if(!confirm('Noch kein Projekt vorhanden. Projekt aus dieser Idee erstellen und teilen?')) return;
        const newP = DB.addProject({ name: this.getIdeaTitle(idea.content), description: idea.content, status: 'in_progress', tags: idea.tags||[] });
        DB.updateIdea(id, { projectId: newP.id });
        projId = newP.id;
      }
      this.closeModal('modal-idea');
      this.openShareCenter(projId);
    });
    this.openModal('modal-idea');
  },

  startEditIdea(id, original){
    const body = document.getElementById('idea-modal-body');
    body.innerHTML = `
      <textarea id="idea-edit-ta" class="inp text-base" rows="6"></textarea>
      <div class="grid grid-cols-2 gap-2 mt-3">
        <button id="btn-edit-save" class="btn-primary py-3">Speichern</button>
        <button id="btn-edit-cancel" class="btn-secondary py-3">Abbrechen</button>
      </div>`;
    const ta = document.getElementById('idea-edit-ta'); ta.value = original; ta.focus();
    document.getElementById('btn-edit-save').onclick = () => {
      const v = ta.value.trim(); if(!v) return;
      DB.updateIdea(id, {content:v});
      this.openIdeaDetail(id); this.renderIdeas(); this.renderOverview();
      this.toast('Aktualisiert ✅');
    };
    document.getElementById('btn-edit-cancel').onclick = () => this.openIdeaDetail(id);
  },

  archiveIdea(id){
    const idea=DB.getIdea(id); if(!idea || idea.stage==='archived') return;
    const prev = idea.stage;
    DB.addTimelineEntry(id, 'archived', 'Archiviert');
    this.renderIdeas(); this.renderOverview();
    this.showUndoToast('Archiviert 📦', () => {
      DB.addTimelineEntry(id, prev, 'Wiederhergestellt');
      this.renderIdeas(); this.renderOverview(); this.toast('Wiederhergestellt ↩️');
    });
  },

  restoreIdea(id){
    const idea=DB.getIdea(id); if(!idea) return;
    const prevEntry = [...(idea.timeline||[])].reverse().find(t=>t.stage!=='archived');
    const to = prevEntry?.stage || 'spark';
    DB.addTimelineEntry(id, to, 'Wiederhergestellt');
    this.openIdeaDetail(id); this.renderIdeas(); this.renderOverview();
    this.toast(`Wiederhergestellt zu ${this.stages[to].label}`);
  },

  softDeleteIdea(id){
    if(this.state.pendingDelete){ DB.deleteIdea(this.state.pendingDelete.id); clearTimeout(this.state.pendingDelete.timer); }
    this.state.pendingDelete = { id, timer: setTimeout(()=>{ DB.deleteIdea(id); this.state.pendingDelete=null; this.renderIdeas(); this.renderOverview(); }, 5000) };
    this.renderIdeas(); this.renderOverview();
    this.showUndoToast('Idee gelöscht', () => {
      if(this.state.pendingDelete?.id===id){
        clearTimeout(this.state.pendingDelete.timer); this.state.pendingDelete=null;
        this.renderIdeas(); this.renderOverview(); this.toast('Wiederhergestellt ↩️');
      }
    });
  },

  showUndoToast(msg, onUndo){
    const t = document.getElementById('toast');
    t.innerHTML = `${msg} &nbsp;<button class="btn-undo underline font-semibold" aria-label="Rückgängig">Rückgängig</button>`;
    t.style.pointerEvents='all'; t.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(()=>{ t.classList.remove('show'); t.style.pointerEvents=''; }, 5000);
    t.querySelector('.btn-undo').onclick = () => { clearTimeout(this._toastT); t.classList.remove('show'); t.style.pointerEvents=''; onUndo(); };
  },

  confetti(){
    if(this.reduceMotion()) return;
    const colors=['#f59e0b','#3b82f6','#8b5cf6','#10b981','#000'];
    for(let i=0;i<18;i++){
      const p=document.createElement('div');
      p.style.cssText=`position:fixed;top:40%;left:50%;width:7px;height:7px;border-radius:2px;z-index:999;pointer-events:none;background:${colors[i%colors.length]}`;
      document.body.appendChild(p);
      const ang=Math.random()*Math.PI*2, dist=80+Math.random()*120;
      const dx=Math.cos(ang)*dist, dy=Math.sin(ang)*dist - 60;
      p.animate([{transform:'translate(0,0) rotate(0)',opacity:1},{transform:`translate(${dx}px,${dy+200}px) rotate(${Math.random()*720}deg)`,opacity:0}],
        {duration:900+Math.random()*400,easing:'cubic-bezier(.2,.6,.4,1)'}).onfinish=()=>p.remove();
    }
  },

  // ── SWIPE (pointer events: works with touch AND mouse) ──
  bindSwipe(el, id){
    let sx, sy, swiping=false, lastDx=0, active=false;
    const T=72;
    el.addEventListener('pointerdown', e => {
      if(e.pointerType==='mouse' && e.button!==0) return;
      sx=e.clientX; sy=e.clientY; swiping=false; lastDx=0; active=true; delete el.dataset.swiped;
    });
    el.addEventListener('pointermove', e => {
      if(!active) return;
      const dx=e.clientX-sx, dy=e.clientY-sy;
      if(!swiping){
        if(Math.abs(dy)>Math.abs(dx)+5){ active=false; return; }   // vertical scroll intent → bail
        if(Math.abs(dx)<8) return;                                  // ignore tiny moves so clicks survive
        swiping=true; try{ el.setPointerCapture(e.pointerId); }catch(_){}
      }
      lastDx=dx;
      el.style.transition='none';
      el.style.transform=`translateX(${Math.max(-120,Math.min(120,dx))}px)`;
      el.style.opacity = 1 - Math.min(Math.abs(dx)/T,1)*0.3;
    });
    const end = () => {
      if(!active) return;
      active=false;
      if(!swiping) return;
      el.style.transition='transform .3s cubic-bezier(.32,.72,0,1),opacity .3s';
      el.style.transform=''; el.style.opacity='';
      if(lastDx>T){ el.dataset.swiped='1'; this.hideSwipeHint(); this.swipeAdvance(id); }
      else if(lastDx<-T){ el.dataset.swiped='1'; this.hideSwipeHint(); this.archiveIdea(id); }
      swiping=false; sx=undefined;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  },

  swipeAdvance(id){
    const idea=DB.getIdea(id); if(!idea) return;
    if(idea.stage==='archived'){ this.restoreIdea(id); return; }
    const next=this.stageOrder[this.stageOrder.indexOf(idea.stage)+1];
    if(!next){ this.toast('Bereits fertig ✅'); return; }
    DB.addTimelineEntry(id, next, `Weiter zu ${this.stages[next].label}`);
    this.confetti(); this.renderIdeas(); this.renderOverview();
    this.toast(`Verschoben zu ${this.stages[next].label}`);
  },

  // ════════════════════ JOURNEY / PROJECTS ════════════════════
  filterProjects(btn){
    btn.parentElement.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
    btn.classList.add('active');
    this.state.projFilter = btn.dataset.status;
    this.renderProjects();
  },

  renderProjects(){
    let projects = DB.getProjects();
    if(this.state.projFilter!=='all') projects = projects.filter(p=>p.status===this.state.projFilter);
    document.getElementById('proj-count').textContent = DB.getProjects().length;
    const grid = document.getElementById('project-grid');
    const scroll = document.getElementById('project-scroll');
    const empty = document.getElementById('proj-empty');
    if(!projects.length){
      grid.innerHTML=''; scroll.classList.add('hidden'); empty.classList.remove('hidden');
      const filtering = this.state.projFilter!=='all';
      document.getElementById('proj-empty-msg').textContent = filtering ? 'Keine Projekte mit diesem Status.' : 'Noch keine Projekte.';
      const btn = document.getElementById('proj-empty-btn');
      btn.innerHTML = filtering
        ? `<span class="material-symbols-outlined" style="font-size:18px" aria-hidden="true">filter_alt_off</span> Alle anzeigen`
        : `<span class="material-symbols-outlined" style="font-size:18px" aria-hidden="true">add</span> Neues Projekt`;
      return;
    }
    scroll.classList.remove('hidden'); empty.classList.add('hidden');
    grid.innerHTML = projects.map((p,idx) => {
      const step = this.progressStep(p.status), total=this.progressSteps.length;
      const paused = p.status==='on_hold';
      const bars = this.progressSteps.map((_,n)=>`<div class="h-1.5 flex-1 rounded-full ${(n+1)<=step && !paused?'bg-primary':paused && n===0?'bg-secondary':'bg-surface-highest'}"></div>`).join('');
      const comments = DB.getComments(p.id);
      const recent = comments.slice(-2);
      const commentList = recent.length
        ? recent.map(c=>`<p class="text-xs text-secondary truncate"><span class="font-semibold text-primary">${this.esc(c.author||'Anon')}</span> ${this.esc(this.snippet(c.content,48))}</p>`).join('')
        : `<p class="text-xs text-secondary italic">Noch keine Kommentare</p>`;
      const delay = this.reduceMotion()?0:Math.min(idx*40,300);
      return `
      <div class="proj-card anim-up" data-id="${p.id}" style="animation-delay:${delay}ms">
        <div class="flex gap-3 p-3 proj-open" role="button" tabindex="0" aria-label="Project: ${this.escAttr(p.name)}" data-id="${p.id}">
          <div class="w-20 h-20 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" aria-hidden="true" style="${p.cover?`background-image:url('${p.cover}');background-size:cover;background-position:center`:`background:${this.getGrad(p.id)}`}">
            ${p.cover?'':this.getEmoji(p.name)}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <p class="text-[15px] font-semibold leading-tight line-clamp-2">${this.esc(p.name)}</p>
              <button class="btn-secondary !py-1 !px-2.5 !text-xs flex items-center gap-1 font-bold text-primary flex-shrink-0" onclick="event.stopPropagation(); App.openShareCenter('${p.id}')" title="Teilen &amp; Live-Chat">
                <span class="material-symbols-outlined" style="font-size:14px">handshake</span> Share
              </button>
            </div>
            <span class="status-badge ${p.status} mt-1.5">${this.statusLabel[p.status]||p.status}</span>
            ${DB.isProjectShared(p.id)?'<span class="text-[10px] font-semibold bg-surface-high text-primary border border-border rounded-full px-2 py-0.5 ml-1 align-middle">Geteilt</span>':''}
            <div class="flex gap-1 mt-2">${bars}</div>
          </div>
        </div>
        <div class="px-3 pb-3 pt-2 border-t border-border">
          <div class="flex items-center gap-1.5 mb-2">
            <span class="material-symbols-outlined text-dim" style="font-size:15px" aria-hidden="true">chat_bubble</span>
            <span class="text-xs font-semibold text-secondary">${comments.length} ${comments.length===1?'Kommentar':'Kommentare'}</span>
          </div>
          <div class="space-y-0.5 mb-2">${commentList}</div>
          <div class="flex items-end gap-2">
            <input type="text" class="inp !py-2 !text-sm card-cmt-input" data-id="${p.id}" placeholder="Kommentar schreiben..." aria-label="Kommentar zu ${this.escAttr(p.name)}">
            <button class="btn-primary px-3 py-2 card-cmt-send" data-id="${p.id}" aria-label="Kommentar senden"><span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">send</span></button>
          </div>
        </div>
      </div>`;
    }).join('');
    grid.querySelectorAll('.proj-open').forEach(c => {
      c.onclick = () => this.openProjectDetail(c.dataset.id);
      c.onkeydown = e => { if(e.key==='Enter'||e.key===' '){ e.preventDefault(); this.openProjectDetail(c.dataset.id); } };
    });
    grid.querySelectorAll('.card-cmt-input').forEach(inp => {
      inp.onkeydown = e => { if(e.key==='Enter'){ e.preventDefault(); this.addCardComment(inp.dataset.id, inp); } };
    });
    grid.querySelectorAll('.card-cmt-send').forEach(btn => {
      btn.onclick = () => { const inp = btn.parentElement.querySelector('.card-cmt-input'); this.addCardComment(btn.dataset.id, inp); };
    });
  },

  addCardComment(projectId, inputEl){
    const text = inputEl.value.trim();
    if(!text) return;
    DB.addComment({ projectId, author:DB.getUser()||'Anonym', content:text });
    inputEl.value='';
    this.renderProjects(); this.renderOverview();
    this.toast('Kommentar hinzugefügt 💬');
  },

  // ── PROJECT FORM ──
  bindProjectForm(){
    document.getElementById('proj-status-row').querySelectorAll('.chip').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#proj-status-row .chip').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active'); this.state.projStatus = btn.dataset.status;
      };
    });
    const ti = document.getElementById('proj-tag-input');
    ti.addEventListener('keydown', e => { if(e.key==='Enter'){ e.preventDefault(); this.addProjTag(ti.value); ti.value=''; } });
    document.getElementById('btn-save-project').onclick = () => this.saveProject();
    document.getElementById('proj-empty-btn')?.addEventListener('click', () => {
      if(this.state.projFilter!=='all'){ this.state.projFilter='all'; document.querySelectorAll('#view-journey .chip').forEach(c=>c.classList.toggle('active',c.dataset.status==='all')); this.renderProjects(); }
      else this.openProjectModal();
    });

    // Titelbild upload
    const coverArea = document.getElementById('proj-cover-area');
    const coverInput = document.getElementById('proj-cover-input');
    if(coverArea && coverInput){
      coverArea.addEventListener('click', ()=>coverInput.click());
      coverInput.addEventListener('change', async () => {
        const f = coverInput.files && coverInput.files[0];
        if(!f) return;
        try{
          this.state.projCover = await DB.compressImage(f);
          this.setProjCoverUI(this.state.projCover);
        }catch(err){ this.toast('Bild konnte nicht geladen werden'); }
        coverInput.value = '';
      });
      document.getElementById('proj-cover-rm').addEventListener('click', (e) => {
        e.stopPropagation();
        this.state.projCover = null;
        this.setProjCoverUI(null);
      });
    }

    const btnShareSubmit = document.getElementById('btn-share-center-submit');
    if(btnShareSubmit){
      btnShareSubmit.onclick = async () => {
        const nick = document.getElementById('share-center-nick')?.value.trim();
        const projId = document.getElementById('share-center-project-select')?.value;
        if(!nick){ this.toast('Nickname des Freundes eingeben 👤'); return; }
        if(!projId){ this.toast('Erstelle oder wähle ein Projekt 📁'); return; }
        await DB.shareProject(projId, nick);
        this.toast(`Mit "${nick}" geteilt — Empfänger wird benachrichtigt 🔔`);
        this.closeModal('modal-share-center');
        this.openProjectDetail(projId);
      };
    }
  },

  addProjTag(val){
    val = val.replace(/^#+/,'').trim().toLowerCase();
    if(!val || this.state.projTags.includes(val)) return;
    this.state.projTags.push(val); this.renderProjTags();
  },
  renderProjTags(){
    const row = document.getElementById('proj-tags');
    row.innerHTML = this.state.projTags.map(t =>
      `<span class="tag flex items-center gap-1">#${this.esc(t)} <button data-tag="${this.escAttr(t)}" class="tag-rm leading-none" aria-label="Remove tag ${this.escAttr(t)}">✕</button></span>`
    ).join('');
    row.querySelectorAll('.tag-rm').forEach(b => { b.onclick = () => { this.state.projTags=this.state.projTags.filter(x=>x!==b.dataset.tag); this.renderProjTags(); }; });
  },

  openProjectModal(projId=null, prefill='', sourceIdeaId=null){
    this.state.editProjId = projId;
    this.state.projTags = [];
    this.state.projStatus = 'concept';
    this.state.projCover = null;
    this.state.sourceIdeaId = sourceIdeaId;
    this.setProjCoverUI(null);
    document.getElementById('proj-form-title').textContent = projId ? 'Projekt bearbeiten' : 'Neues Projekt';
    document.getElementById('proj-edit-id').value = projId||'';
    // conversion: seed name from a snippet, keep full text as description
    document.getElementById('proj-name').value = (!projId && sourceIdeaId && prefill) ? this.snippet(prefill,50) : '';
    document.getElementById('proj-desc').value = prefill||'';
    document.getElementById('proj-link').value = '';
    document.getElementById('proj-tag-input').value = '';
    document.getElementById('proj-tags').innerHTML = '';
    document.querySelectorAll('#proj-status-row .chip').forEach(b => b.classList.toggle('active', b.dataset.status==='concept'));
    if(projId){
      const p = DB.getProject(projId);
      if(p){
        document.getElementById('proj-name').value = p.name;
        document.getElementById('proj-desc').value = p.description||'';
        document.getElementById('proj-link').value = p.link||'';
        this.state.projStatus = p.status;
        this.state.projTags = [...(p.tags||[])];
        this.state.projCover = p.cover||null;
        this.setProjCoverUI(p.cover||null);
        document.querySelectorAll('#proj-status-row .chip').forEach(b=>b.classList.toggle('active', b.dataset.status===p.status));
        this.renderProjTags();
      }
    }
    this.openModal('modal-project-form', '#proj-name');
    document.getElementById('proj-name').focus();
  },

  setProjCoverUI(cover){
    const preview = document.getElementById('proj-cover-preview');
    const empty = document.getElementById('proj-cover-empty');
    const rm = document.getElementById('proj-cover-rm');
    if(cover){
      if(preview) preview.src = cover;
      preview?.classList.remove('hidden');
      empty?.classList.add('hidden');
      rm?.classList.remove('hidden');
    } else {
      preview?.classList.add('hidden');
      preview?.removeAttribute('src');
      empty?.classList.remove('hidden');
      rm?.classList.add('hidden');
    }
  },

  saveProject(){
    const name = document.getElementById('proj-name').value.trim();
    if(!name){ this.toast('Projektname erforderlich'); return; }
    const data = {
      name, status:this.state.projStatus,
      description: document.getElementById('proj-desc').value.trim(),
      link: document.getElementById('proj-link').value.trim(),
      tags: [...this.state.projTags],
      cover: this.state.projCover||null, gallery: [],
      sourceIdeaId: this.state.sourceIdeaId||null,
    };
    let createdId = null;
    if(this.state.editProjId){
      DB.updateProject(this.state.editProjId, data); this.toast('Projekt aktualisiert ✅');
    } else {
      const created = DB.addProject(data);
      createdId = created ? created.id : null;
      // link the source idea both ways, keep it in place (no auto-archive)
      if(this.state.sourceIdeaId && created){
        const srcIdea = DB.getIdea(this.state.sourceIdeaId);
        if(srcIdea){
          const timeline = [...(srcIdea.timeline||[]), { stage: srcIdea.stage, note:`In Projekt „${name}“ umgewandelt`, author: DB.getUser()||'Anonym', ts: Date.now() }];
          DB.updateIdea(this.state.sourceIdeaId, { projectId: created.id, timeline });
        }
      }
      this.toast('Projekt gespeichert 🗂️');
    }
    this.state.sourceIdeaId = null;
    this.state.projCover = null;
    this.closeModal('modal-project-form');
    this.navigate('journey'); this.renderOverview(); this.renderProfile(); this.renderIdeas();
    // open the freshly converted project right away
    if(createdId) setTimeout(()=>this.openProjectDetail(createdId), 150);
  },

  // ── PROJECT DETAIL ──
  openProjectDetail(id){
    const p = DB.getProject(id);
    if(!p) return;
    this.state.currentProjectId = id;
    const user = DB.getUser();
    const emojis = ['👍','❤️','🔥','💡'];
    const step = this.progressStep(p.status);
    const steps = this.progressSteps;
    const paused = p.status==='on_hold';
    const srcIdea = p.sourceIdeaId ? DB.getIdea(p.sourceIdeaId) : null;
    const inner = document.getElementById('proj-detail-inner');
    inner.innerHTML = `
      <div class="relative h-44 flex items-end" aria-hidden="true" style="${p.cover?`background-image:url('${p.cover}');background-size:cover;background-position:center`:`background:${this.getGrad(p.id)}`}">
        ${p.cover?'':`<div class="absolute inset-0 flex items-center justify-center text-6xl opacity-90">${this.getEmoji(p.name)}</div>`}
        <div class="absolute top-0 left-0 right-0 flex justify-between items-center p-3">
          <button id="btn-proj-back" class="icon-btn-44 rounded-full bg-white/90 backdrop-blur" aria-label="Zurück"><span class="material-symbols-outlined" style="font-size:20px" aria-hidden="true">arrow_back</span></button>
          <button id="btn-proj-edit" class="icon-btn-44 rounded-full bg-white/90 backdrop-blur" aria-label="Projekt bearbeiten"><span class="material-symbols-outlined" style="font-size:18px" aria-hidden="true">edit</span></button>
        </div>
      </div>
      <div class="px-5 py-4 space-y-5 overflow-y-auto">
        <div>
          <h2 class="text-2xl font-bold tracking-tight">${this.esc(p.name)}</h2>
          <div class="flex flex-wrap items-center gap-2 mt-2">
            <span class="status-badge ${p.status}">${this.statusLabel[p.status]}</span>
            ${(p.tags||[]).map(t=>`<span class="tag">#${this.esc(t)}</span>`).join('')}
          </div>
          ${srcIdea?`<button id="btn-src-idea" class="text-xs text-secondary mt-2 underline" aria-label="Quell-Idee anzeigen">↩ Aus Idee: ${this.esc(this.snippet(srcIdea.content,40))}</button>`:''}
        </div>

        <div class="bg-white border border-border rounded-2xl p-4 shadow-ambient">
          <p class="text-xs font-semibold uppercase tracking-widest text-dim mb-3">Fortschritt${paused?' · <span class="text-secondary">Pausiert</span>':''}</p>
          <div class="flex items-center justify-between">
            ${steps.map((s,idx)=>{
              const n=idx+1, done=n<step && !paused, cur=n===step && !paused;
              return `<div class="flex flex-col items-center gap-1 flex-1">
                <div class="w-7 h-7 rounded-full flex items-center justify-center ${done?'bg-primary text-on-primary':cur?'border-2 border-primary':'bg-surface-highest'}">
                  ${done?'<span class="material-symbols-outlined" style="font-size:15px" aria-hidden="true">check</span>':cur?'<div class="w-2 h-2 rounded-full bg-primary"></div>':''}
                </div>
                <span class="text-[10px] ${n<=step && !paused?'text-primary font-medium':'text-secondary'}">${s}</span>
              </div>${idx<steps.length-1?'<div class="h-0.5 flex-1 '+(n<step && !paused?'bg-primary':'bg-surface-highest')+' -mt-4"></div>':''}`;
            }).join('')}
          </div>
        </div>

        ${p.description?`<div><p class="text-xs font-semibold uppercase tracking-widest text-dim mb-2">Übersicht</p><p class="text-[15px] leading-relaxed text-secondary whitespace-pre-wrap">${this.esc(p.description)}</p></div>`:''}

        ${p.link?`<a href="${this.escAttr(p.link)}" target="_blank" rel="noopener" class="flex items-center gap-3 bg-white border border-border rounded-xl p-3 shadow-ambient">
          <div class="w-9 h-9 rounded-lg bg-surface-mid flex items-center justify-center"><span class="material-symbols-outlined" style="font-size:18px" aria-hidden="true">link</span></div>
          <span class="text-sm text-primary truncate flex-1">${this.esc(p.link)}</span>
          <span class="material-symbols-outlined text-secondary" style="font-size:18px" aria-hidden="true">open_in_new</span>
        </a>`:''}

        <div>
          <div class="flex gap-2" id="reactions-row">
            ${emojis.map(em=>{ const c=DB.countReaction(id,em), r=DB.hasReacted(id,em,user);
              return `<button class="px-3 py-2 rounded-xl border text-sm ${r?'border-primary bg-surface-mid':'border-border bg-white'}" data-emoji="${em}" aria-label="Reaktion ${em}" aria-pressed="${r}">${em} ${c||''}</button>`;}).join('')}
          </div>
        </div>

        <div class="bg-surface-mid border border-border rounded-2xl p-4 shadow-ambient space-y-3">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary" style="font-size:20px" aria-hidden="true">group_add</span>
            <p class="text-xs font-semibold uppercase tracking-widest text-dim">Projekt teilen</p>
          </div>
          <div id="share-wrap"></div>
          <div class="flex gap-2">
            <input type="text" id="share-nick-input" class="inp !py-2 !text-sm flex-1" placeholder="Nickname der anderen Person..." aria-label="Nickname zum Teilen" autocomplete="off">
            <button id="btn-share-project" class="btn-primary px-4 py-2"><span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">send</span></button>
          </div>
          <p class="text-[11px] text-dim">Die andere Person sieht dieses Projekt sofort, sobald sie sich mit demselben Nickname anmeldet. Beide können dann live chatten.</p>
        </div>

        <div class="bg-surface-mid border border-border rounded-2xl p-4 shadow-ambient space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary" style="font-size:20px">view_quilt</span>
              <span class="text-sm font-bold text-primary">UI-Prototyp &amp; Interaktiver Code</span>
            </div>
            <button id="btn-proj-proto-open" class="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
              <span class="material-symbols-outlined" style="font-size:14px">auto_awesome</span> ${p.prototypeHtml ? 'Vorschau &amp; Code' : 'UI Generieren'}
            </button>
          </div>
          <p class="text-xs text-secondary">${p.prototypeHtml ? 'Ein interaktiver UI-Prototyp ist für dieses Projekt gespeichert. Klicke auf Vorschau, um den Code zu testen oder zu kopieren.' : 'Erstelle mit der KI einen interaktiven UI-Prototypen für dieses Projekt.'}</p>
        </div>

        <div>
          <p class="text-xs font-semibold uppercase tracking-widest text-dim mb-3">Aufgaben <span id="check-progress"></span></p>
          <div id="checklist-wrap" class="mb-3"></div>
          <div class="flex gap-2">
            <input type="text" id="check-new-input" class="inp !py-2 !text-sm flex-1" placeholder="Neue Aufgabe..." aria-label="Neue Aufgabe">
            <button id="btn-check-add" class="btn-primary px-4 py-2"><span class="material-symbols-outlined" style="font-size:16px">add</span></button>
          </div>
        </div>

        <div>
          <p class="text-xs font-semibold uppercase tracking-widest text-dim mb-3">Kommentare <span id="cmt-count"></span></p>
          <div id="comment-list" class="space-y-3 mb-3"></div>
          <div class="flex items-end gap-2">
            <textarea id="new-comment" rows="1" class="inp resize-none" placeholder="Kommentar hinzufügen..." aria-label="Kommentar hinzufügen"></textarea>
            <button id="btn-send-cmt" class="btn-primary px-4 py-3" aria-label="Kommentar senden"><span class="material-symbols-outlined" style="font-size:18px" aria-hidden="true">send</span></button>
          </div>
        </div>

        <button id="btn-proj-delete" class="btn-danger"><span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">delete</span> Projekt löschen</button>
        <div style="height:8px"></div>
      </div>`;

    document.getElementById('btn-proj-back').onclick = () => this.closeModal('modal-project-detail');
    document.getElementById('btn-proj-edit').onclick = () => { this.closeModal('modal-project-detail'); this.openProjectModal(id); };
    if(srcIdea) document.getElementById('btn-src-idea').onclick = () => { this.closeModal('modal-project-detail'); this.navigate('ideas'); this.openIdeaDetail(srcIdea.id); };
    const btnProjProto = document.getElementById('btn-proj-proto-open');
    if(btnProjProto) btnProjProto.onclick = () => {
      this.closeModal('modal-project-detail');
      this.openPrototypeModal(id, true);
    };
    document.getElementById('btn-proj-delete').onclick = () => {
      if(!confirm('Dieses Projekt löschen? Das kann nicht rückgängig gemacht werden.')) return;
      DB.deleteProject(id); this.closeModal('modal-project-detail');
      this.renderProjects(); this.renderOverview(); this.renderProfile(); this.toast('Projekt gelöscht');
    };
    document.getElementById('reactions-row').querySelectorAll('[data-emoji]').forEach(b => {
      b.onclick = () => { DB.toggleReaction(id, b.dataset.emoji, user); this.openProjectDetail(id); };
    });
    document.getElementById('btn-send-cmt').onclick = () => this.addComment(id);
    document.getElementById('new-comment').addEventListener('keydown', e => { if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); this.addComment(id); } });
    this.renderComments(id);
    this.renderShareSection(id);
    document.getElementById('btn-share-project').onclick = async () => {
      const inp = document.getElementById('share-nick-input');
      const nick = inp.value.trim();
      if(!nick){ this.toast('Nickname eingeben'); return; }
      const share = await DB.shareProject(id, nick);
      inp.value='';
      if(!share){
        this.toast(nick===user ? 'Das bist du selbst' : 'Bereits geteilt');
        return;
      }
      this.renderShareSection(id);
      this.renderProjects();
      this.toast(`✅ Mit "${share.sharedWith}" geteilt — Empfänger wird benachrichtigt 🔔`);
    };
    this.renderChecklist(id);
    document.getElementById('btn-check-add').onclick = () => {
      const inp = document.getElementById('check-new-input');
      const text = inp.value.trim(); if(!text) return;
      DB.addCheckItem(id, text); inp.value='';
      this.renderChecklist(id); this.toast('☑️ Aufgabe hinzugefügt');
    };
    document.getElementById('check-new-input').addEventListener('keydown', e => {
      if(e.key==='Enter'){ e.preventDefault(); document.getElementById('btn-check-add').click(); }
    });
    this.openModal('modal-project-detail', '#btn-proj-back');
  },

  // ── CHECKLIST RENDERING ──
  renderChecklist(projId){
    const items = DB.getChecklist(projId);
    const wrap = document.getElementById('checklist-wrap');
    const prog = document.getElementById('check-progress');
    if(!wrap) return;
    const done = items.filter(c=>c.done).length;
    if(prog) prog.textContent = items.length ? `(${done}/${items.length})` : '';
    if(!items.length){ wrap.innerHTML = `<p class="text-sm text-secondary italic">Noch keine Aufgaben.</p>`; return; }
    wrap.innerHTML = items.map(c => `
      <div class="check-item ${c.done?'done':''}" data-id="${c.id}">
        <input type="checkbox" ${c.done?'checked':''} id="ck-${c.id}" aria-label="${this.escAttr(c.text)}">
        <label for="ck-${c.id}" class="flex-1 text-sm cursor-pointer">${this.esc(c.text)}</label>
        <button class="check-del" data-del="${c.id}" aria-label="Löschen">
          <span class="material-symbols-outlined" style="font-size:16px">close</span>
        </button>
      </div>`).join('');
    wrap.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.onchange = () => { DB.toggleCheckItem(projId, cb.closest('.check-item').dataset.id); this.renderChecklist(projId); };
    });
    wrap.querySelectorAll('.check-del').forEach(btn => {
      btn.onclick = () => { DB.deleteCheckItem(projId, btn.dataset.del); this.renderChecklist(projId); };
    });
  },

  renderShareSection(projectId){
    const wrap = document.getElementById('share-wrap');
    if(!wrap) return;
    const me = DB.getUser();
    const shares = DB.getShares().filter(s=>s.projectId===projectId);
    if(!shares.length){
      wrap.innerHTML = `<p class="text-xs text-secondary">Noch nicht geteilt. Gib den Nickname einer Person ein, um gemeinsam am Projekt zu arbeiten.</p>`;
      return;
    }
    wrap.innerHTML = shares.map(s => `
      <div class="flex items-center justify-between bg-white border border-border rounded-xl px-3 py-2.5 mb-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="material-symbols-outlined text-secondary" style="font-size:18px" aria-hidden="true">person</span>
          <span class="text-sm font-semibold truncate">${this.esc(s.sharedWith)}</span>
          ${s.owner!==me?`<span class="text-[10px] text-secondary bg-surface-highest rounded-full px-2 py-0.5 flex-shrink-0">von ${this.esc(s.owner)}</span>`:''}
        </div>
        ${s.owner===me?`<button class="btn-share-remove text-xs text-secondary hover:text-red-500 flex-shrink-0" data-id="${s.id}" aria-label="Teilung entfernen">Entfernen</button>`:''}
      </div>`).join('');
    wrap.querySelectorAll('.btn-share-remove').forEach(b => {
      b.onclick = async () => {
        await DB.removeShare(b.dataset.id);
        this.renderShareSection(projectId);
        this.renderProjects();
        this.toast('Teilung entfernt');
      };
    });
  },

  openShareCenter(defaultProjectId=null){
    const projects = DB.getProjects();
    const sel = document.getElementById('share-center-project-select');
    if(sel){
      if(!projects.length){
        sel.innerHTML = `<option value="">Keine Projekte vorhanden — erstelle zuerst ein Projekt</option>`;
      } else {
        sel.innerHTML = projects.map(p=>`<option value="${p.id}" ${p.id===(defaultProjectId||projects[0]?.id)?'selected':''}>${this.esc(p.name)}</option>`).join('');
      }
    }
    this.renderSharedCenterList();
    this.openModal('modal-share-center');
  },

  renderSharedCenterList(){
    const wrap = document.getElementById('shared-projects-list');
    if(!wrap) return;
    const me = DB.getUser();
    const shares = DB.getShares();
    if(!shares.length){
      wrap.innerHTML = `<p class="text-xs text-secondary italic py-3 text-center border border-dashed border-border rounded-xl">Noch keine geteilten Projekte. Gib oben den Nickname eines Freundes ein, um zu starten!</p>`;
      return;
    }
    wrap.innerHTML = shares.map(s => {
      const proj = DB.getProject(s.projectId);
      const pName = proj ? proj.name : 'Projekt';
      return `
      <div class="flex items-center justify-between bg-white border border-border rounded-xl p-3 shadow-ambient">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 font-bold">
            🤝
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold truncate text-primary">${this.esc(pName)}</p>
            <p class="text-xs text-secondary">👥 Geteilt mit <b>${this.esc(s.sharedWith)}</b> ${s.owner!==me ? `(erstellt von ${this.esc(s.owner)})` : ''}</p>
          </div>
        </div>
        <button class="btn-primary text-xs py-2 px-3 flex-shrink-0 flex items-center gap-1 open-share-chat-btn" data-proj="${s.projectId}">
          <span>💬 Chat Live</span>
        </button>
      </div>`;
    }).join('');

    wrap.querySelectorAll('.open-share-chat-btn').forEach(btn => {
      btn.onclick = () => {
        this.closeModal('modal-share-center');
        this.openProjectDetail(btn.dataset.proj);
      };
    });
  },

  renderComments(projectId, scrollBottom){
    const comments = DB.getComments(projectId);
    const list = document.getElementById('comment-list');
    const cnt = document.getElementById('cmt-count');
    if(cnt) cnt.textContent = comments.length?`(${comments.length})`:'';
    if(!list) return;
    if(!comments.length){ list.innerHTML = `<p class="text-sm text-secondary">Noch keine Kommentare.</p>`; return; }
    list.innerHTML = comments.map(c => `
      <div class="bg-surface-low rounded-xl p-3">
        <p class="text-xs font-semibold">${this.esc(c.author||'Anonym')} <span class="text-secondary font-normal">· ${this.ago(c.createdAt)}</span></p>
        <p class="text-sm mt-1 whitespace-pre-wrap">${this.esc(c.content)}</p>
      </div>`).join('');
    if(scrollBottom){
      const inner = document.getElementById('proj-detail-inner');
      if(inner) inner.scrollTop = inner.scrollHeight;
    }
  },

  addComment(projectId){
    const ta = document.getElementById('new-comment');
    const text = ta.value.trim(); if(!text) return;
    DB.addComment({ projectId, author:DB.getUser()||'Anonym', content:text });
    ta.value=''; this.renderComments(projectId); this.toast('Kommentar hinzugefügt 💬');
  },

  // ════════════════════ PROFILE ════════════════════
  renderProfile(){
    document.getElementById('profile-avatar').textContent = DB.getUserEmoji();
    document.getElementById('profile-name').textContent = DB.getUser() || '—';
    const since = new Date(DB.getSince());
    document.getElementById('profile-since').textContent = 'Mitglied seit ' + since.toLocaleDateString('de-DE',{month:'long',year:'numeric'});

    const sa = document.getElementById('side-avatar'); if(sa) sa.textContent = DB.getUserEmoji();
    const sn = document.getElementById('side-name'); if(sn) sn.textContent = DB.getUser() || 'Spark';

    const ideas = DB.getIdeas();
    document.getElementById('p-stat-ideas').textContent = ideas.filter(i=>i.stage!=='archived').length;
    document.getElementById('p-stat-projects').textContent = DB.getProjects().length;
    document.getElementById('p-stat-shipped').textContent = ideas.filter(i=>i.stage==='shipped').length;

    document.getElementById('settings-name').value = DB.getUser();

    // AI Settings populate (hide raw API key code to avoid leaking)
    const aiCfg = DB.getAISettings();
    const epEl = document.getElementById('ai-endpoint'); if(epEl) epEl.value = aiCfg.endpoint || '';
    const akEl = document.getElementById('ai-apikey');
    if(akEl){
      akEl.value = '';
      akEl.placeholder = '•••••••••••••••• (Standard-Schlüssel aktiv)';
    }
    const mdEl = document.getElementById('ai-model'); if(mdEl) mdEl.value = aiCfg.model || 'deepseek-v4-flash-free';

    const grid = document.getElementById('emoji-grid');
    const cur = DB.getUserEmoji();
    grid.innerHTML = this.emojiSet.map(e=>`<button class="emoji-opt${e===cur?' active':''}" data-e="${e}" aria-label="Emoji ${e}">${e}</button>`).join('');
    grid.querySelectorAll('.emoji-opt').forEach(b => {
      b.onclick = () => {
        DB.setUserEmoji(b.dataset.e);
        grid.querySelectorAll('.emoji-opt').forEach(x=>x.classList.remove('active')); b.classList.add('active');
        document.getElementById('profile-avatar').textContent = b.dataset.e;
        const sa2=document.getElementById('side-avatar'); if(sa2) sa2.textContent=b.dataset.e;
        this.toast('Emoji aktualisiert');
      };
    });
  },

  bindSettings(){
    document.getElementById('btn-save-name').onclick = () => {
      const n = document.getElementById('settings-name').value.trim();
      if(!n){ this.toast('Namen eingeben'); return; }
      DB.setUser(n);
      DB.initRealtime();
      DB.syncShares().then(() => this.renderProjects());
      this.renderProfile(); this.renderOverview();
      this.toast('Profil gespeichert ✅');
    };

    // Save AI Config
    const btnSaveAI = document.getElementById('btn-save-ai');
    if(btnSaveAI){
      btnSaveAI.onclick = () => {
        const ep = document.getElementById('ai-endpoint')?.value.trim();
        const ak = document.getElementById('ai-apikey')?.value.trim();
        const md = document.getElementById('ai-model')?.value.trim() || 'deepseek-v4-flash-free';
        const patch = { model: md };
        if(ep) patch.endpoint = ep;
        if(ak) patch.apiKey = ak;
        DB.setAISettings(patch);
        this.toast('KI-Einstellungen gespeichert ✅');
      };
    }

    document.getElementById('btn-export').onclick = () => { DB.exportAll(); this.toast('JSON exportiert ⬇️'); };
    // Import
    const importBtn = document.getElementById('btn-import');
    const importInput = document.getElementById('import-file-input');
    if(importBtn && importInput){
      importBtn.onclick = () => importInput.click();
      importInput.onchange = e => {
        const file = e.target.files[0]; if(!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          if(!confirm('Vorhandene Daten werden durch den Import überschrieben. Fortfahren?')) return;
          const ok = DB.importAll(ev.target.result);
          importInput.value = '';
          if(ok){
            this.renderIdeas(); this.renderProjects(); this.renderOverview(); this.renderProfile();
            this.toast('✅ Daten erfolgreich importiert');
          } else {
            this.toast('❌ Ungültige Datei');
          }
        };
        reader.readAsText(file);
      };
    }
    document.getElementById('btn-clear').onclick = () => {
      if(!confirm('ALLE Ideen, Projekte und Kommentare löschen? Das kann nicht rückgängig gemacht werden!')) return;
      DB.clearAll();
      this.state.pendingDelete=null;
      this.renderIdeas(); this.renderProjects(); this.renderOverview(); this.renderProfile();
      this.toast('Alle Daten gelöscht');
    };
  },

  // ════════════════════ AI INTEGRATION ════════════════════
  renderAIChatList(chatList, ideaId){
    return chatList.map((m, idx) => {
      if(m.role === 'user'){
        return `
          <div class="flex justify-end">
            <div class="bg-surface-high border border-border text-primary text-sm px-3.5 py-2.5 rounded-2xl rounded-tr-xs max-w-[85%]">
              ${this.esc(m.content)}
            </div>
          </div>`;
      } else {
        const matchedTags = (m.content.match(/#[a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]+/g) || []).map(t => t.slice(1));
        return `
          <div class="flex flex-col items-start gap-1.5 max-w-[98%]">
            <div class="bg-surface border border-border text-primary text-sm p-3.5 rounded-2xl rounded-tl-xs shadow-ambient space-y-2.5 w-full">
              <div class="flex items-center gap-1.5 text-xs text-secondary font-bold">
                <span class="material-symbols-outlined" style="font-size:16px">auto_awesome</span> KI-Assistent
              </div>
              <div class="whitespace-pre-wrap leading-relaxed text-sm">${this.esc(m.content)}</div>
              <div class="pt-2 border-t border-border flex flex-wrap gap-2">
                <button data-idx="${idx}" class="chat-btn-override btn-primary py-1.5 px-3 text-xs flex items-center gap-1">
                  <span class="material-symbols-outlined" style="font-size:14px">check_circle</span> Idee übernehmen
                </button>
                <button data-idx="${idx}" class="chat-btn-append btn-secondary py-1.5 px-3 text-xs flex items-center gap-1">
                  <span class="material-symbols-outlined" style="font-size:14px">add</span> Anhängen
                </button>
                <button data-idx="${idx}" class="chat-btn-copy btn-secondary py-1.5 px-2.5 text-xs flex items-center gap-1">
                  <span class="material-symbols-outlined" style="font-size:14px">content_copy</span> Kopieren
                </button>
                ${matchedTags.length ? `<button data-idx="${idx}" class="chat-btn-tags btn-secondary py-1.5 px-2.5 text-xs flex items-center gap-1 text-secondary">
                  <span class="material-symbols-outlined" style="font-size:14px">sell</span> +${matchedTags.length} Tags
                </button>` : ''}
              </div>
            </div>
          </div>`;
      }
    }).join('');
  },

  bindAIChatEvents(ideaId, idea){
    const input = document.getElementById('ai-chat-input');
    const sendBtn = document.getElementById('btn-send-ai-chat');
    const clearBtn = document.getElementById('btn-clear-ai-chat');

    const handleSend = () => {
      const txt = input ? input.value.trim() : '';
      if(!txt) return;
      if(input) input.value = '';
      this.sendAIChat(ideaId, txt);
    };

    if(sendBtn) sendBtn.onclick = handleSend;
    if(input) {
      input.onkeydown = e => {
        if(e.key === 'Enter'){ e.preventDefault(); handleSend(); }
      };
    }

    if(clearBtn) {
      clearBtn.onclick = () => {
        if(!confirm('Gesamten KI-Verlauf für diese Idee löschen?')) return;
        DB.updateIdea(ideaId, { aiChat: [] });
        this.openIdeaDetail(ideaId);
      };
    }

    // Bind prompt chips
    document.querySelectorAll('.ai-prompt-chip').forEach(chip => {
      chip.onclick = () => {
        const prompt = chip.dataset.prompt;
        if(prompt) this.sendAIChat(ideaId, prompt);
      };
    });

    // Bind AI response action buttons
    const chatContainer = document.getElementById('ai-chat-messages');
    if(chatContainer){
      chatContainer.querySelectorAll('.chat-btn-override').forEach(b => {
        b.onclick = () => {
          const idx = parseInt(b.dataset.idx, 10);
          const msg = idea.aiChat?.[idx];
          if(!msg) return;
          DB.updateIdea(ideaId, { content: msg.content });
          DB.addTimelineEntry(ideaId, idea.stage, 'Idee von KI übernommen');
          this.toast('✅ Idee übernommen!');
          this.openIdeaDetail(ideaId);
          this.renderIdeas();
          this.renderOverview();
        };
      });

      chatContainer.querySelectorAll('.chat-btn-append').forEach(b => {
        b.onclick = () => {
          const idx = parseInt(b.dataset.idx, 10);
          const msg = idea.aiChat?.[idx];
          if(!msg) return;
          const newContent = idea.content + '\n\n' + '--- KI-Ergänzung ---\n' + msg.content;
          DB.updateIdea(ideaId, { content: newContent });
          this.toast('➕ Angehängt!');
          this.openIdeaDetail(ideaId);
          this.renderIdeas();
        };
      });

      chatContainer.querySelectorAll('.chat-btn-copy').forEach(b => {
        b.onclick = () => {
          const idx = parseInt(b.dataset.idx, 10);
          const msg = idea.aiChat?.[idx];
          if(!msg) return;
          navigator.clipboard.writeText(msg.content).then(() => this.toast('📋 Nachricht kopiert')).catch(() => {});
        };
      });

      chatContainer.querySelectorAll('.chat-btn-tags').forEach(b => {
        b.onclick = () => {
          const idx = parseInt(b.dataset.idx, 10);
          const msg = idea.aiChat?.[idx];
          if(!msg) return;
          const matchedTags = (msg.content.match(/#[a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]+/g) || []).map(t => t.slice(1));
          if(matchedTags.length){
            const curTags = idea.tags || [];
            const newTags = Array.from(new Set([...curTags, ...matchedTags]));
            DB.updateIdea(ideaId, { tags: newTags });
            this.toast('🏷️ Tags hinzugefügt!');
            this.openIdeaDetail(ideaId);
            this.renderIdeas();
          }
        };
      });
    }
  },

  async sendAIChat(ideaId, userPrompt){
    const idea = DB.getIdea(ideaId);
    if(!idea) return;

    let chatList = idea.aiChat || [];
    chatList.push({ role: 'user', content: userPrompt, ts: Date.now() });
    DB.updateIdea(ideaId, { aiChat: chatList });

    const chatContainer = document.getElementById('ai-chat-messages');
    if(chatContainer){
      chatContainer.innerHTML = this.renderAIChatList(chatList, ideaId) + `
        <div class="flex justify-start">
          <div class="p-3 bg-surface border border-border rounded-2xl text-xs text-secondary flex items-center gap-2 animate-pulse">
            <span class="material-symbols-outlined animate-spin" style="font-size:16px">progress_activity</span> KI-Assistent generiert Antwort...
          </div>
        </div>`;
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    try {
      const messagesForApi = chatList.map(m => ({ role: m.role, content: m.content }));
      const systemPrompt = `Du bist der KI-Assistent für Ideen- und Projektentwicklung in der Spark-App. Die aktuelle Idee des Nutzers lautet: "${idea.content}". Antworte stets auf Deutsch, prägnant, strukturiert und übersichtlich. Unterstütze den Nutzer bei Überarbeitungen, Gliederungen und Feinabstimmungen.`;
      
      const reply = await this.callAIChat(messagesForApi, systemPrompt);
      
      chatList.push({ role: 'assistant', content: reply, ts: Date.now() });
      DB.updateIdea(ideaId, { aiChat: chatList });
    } catch (err) {
      chatList.push({ role: 'assistant', content: `❌ Fehler bei KI-Verbindung: ${err.message}`, ts: Date.now() });
      DB.updateIdea(ideaId, { aiChat: chatList });
    }

    this.openIdeaDetail(ideaId);
  },

  // ════════════════════ QUICK CAPTURE KI CHAT ════════════════════
  renderCaptureAIChatList(chatList){
    return chatList.map((m, idx) => {
      if(m.role === 'user'){
        return `
          <div class="flex justify-end">
            <div class="bg-surface-high border border-border text-primary text-xs px-3 py-2 rounded-xl max-w-[85%]">
              ${this.esc(m.content)}
            </div>
          </div>`;
      } else {
        const matchedTags = (m.content.match(/#[a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]+/g) || []).map(t => t.slice(1));
        return `
          <div class="flex flex-col items-start gap-1.5 max-w-[98%]">
            <div class="bg-surface border border-border text-primary text-xs p-3 rounded-xl shadow-ambient space-y-2 w-full">
              <div class="flex items-center gap-1 text-[11px] text-secondary font-bold">
                <span class="material-symbols-outlined" style="font-size:14px">auto_awesome</span> KI-Assistent
              </div>
              <div class="whitespace-pre-wrap leading-relaxed text-xs">${this.esc(m.content)}</div>
              <div class="pt-1.5 border-t border-border flex flex-wrap gap-1.5">
                <button data-idx="${idx}" class="cap-btn-override btn-primary py-1 px-2.5 text-[11px] flex items-center gap-1">
                  <span class="material-symbols-outlined" style="font-size:13px">check_circle</span> Idee übernehmen
                </button>
                <button data-idx="${idx}" class="cap-btn-append btn-secondary py-1 px-2.5 text-[11px] flex items-center gap-1">
                  <span class="material-symbols-outlined" style="font-size:13px">add</span> Anhängen
                </button>
                <button data-idx="${idx}" class="cap-btn-copy btn-secondary py-1 px-2 text-[11px] flex items-center gap-1">
                  <span class="material-symbols-outlined" style="font-size:13px">content_copy</span> Kopieren
                </button>
                ${matchedTags.length ? `<button data-idx="${idx}" class="cap-btn-tags btn-secondary py-1 px-2 text-[11px] flex items-center gap-1 text-secondary">
                  <span class="material-symbols-outlined" style="font-size:13px">sell</span> +${matchedTags.length} Tags
                </button>` : ''}
              </div>
            </div>
          </div>`;
      }
    }).join('');
  },

  bindCaptureAIChat(){
    const input = document.getElementById('capture-ai-chat-input');
    const sendBtn = document.getElementById('btn-send-capture-ai-chat');
    const clearBtn = document.getElementById('btn-clear-capture-ai');

    const handleSend = () => {
      const txt = input ? input.value.trim() : '';
      if(!txt) return;
      if(input) input.value = '';
      this.sendCaptureAIChat(txt);
    };

    if(sendBtn) sendBtn.onclick = handleSend;
    if(input) {
      input.onkeydown = e => {
        if(e.key === 'Enter'){ e.preventDefault(); handleSend(); }
      };
    }

    if(clearBtn) {
      clearBtn.onclick = () => {
        this.state.captureAIChat = [];
        this.updateCaptureAIChatUI();
      };
    }

    document.querySelectorAll('.cap-ai-chip').forEach(chip => {
      chip.onclick = () => {
        const prompt = chip.dataset.prompt;
        if(prompt) this.sendCaptureAIChat(prompt);
      };
    });
  },

  updateCaptureAIChatUI(){
    const chatList = this.state.captureAIChat || [];
    const container = document.getElementById('capture-ai-chat-messages');
    const clearBtn = document.getElementById('btn-clear-capture-ai');
    if(clearBtn) clearBtn.classList.toggle('hidden', chatList.length === 0);

    if(container){
      if(chatList.length === 0){
        container.innerHTML = `
          <div class="p-3 text-center text-xs text-dim border border-dashed border-border rounded-xl">
            Tippe oben eine Idee ein und frage den KI-Assistenten nach Überarbeitungen oder Gliederungen.
          </div>`;
      } else {
        container.innerHTML = this.renderCaptureAIChatList(chatList);
        this.bindCaptureAIChatActions();
        container.scrollTop = container.scrollHeight;
      }
    }
  },

  bindCaptureAIChatActions(){
    const chatList = this.state.captureAIChat || [];
    const container = document.getElementById('capture-ai-chat-messages');
    const ta = document.getElementById('capture-text');
    if(!container) return;

    container.querySelectorAll('.cap-btn-override').forEach(b => {
      b.onclick = () => {
        const idx = parseInt(b.dataset.idx, 10);
        const msg = chatList[idx];
        if(!msg || !ta) return;
        ta.value = msg.content;
        this.saveDraft();
        this.toast('✅ Idee übernommen!');
      };
    });

    container.querySelectorAll('.cap-btn-append').forEach(b => {
      b.onclick = () => {
        const idx = parseInt(b.dataset.idx, 10);
        const msg = chatList[idx];
        if(!msg || !ta) return;
        ta.value = (ta.value.trim() ? ta.value.trim() + '\n\n' : '') + msg.content;
        this.saveDraft();
        this.toast('➕ Angehängt!');
      };
    });

    container.querySelectorAll('.cap-btn-copy').forEach(b => {
      b.onclick = () => {
        const idx = parseInt(b.dataset.idx, 10);
        const msg = chatList[idx];
        if(!msg) return;
        navigator.clipboard.writeText(msg.content).then(() => this.toast('📋 Nachricht kopiert')).catch(() => {});
      };
    });

    container.querySelectorAll('.cap-btn-tags').forEach(b => {
      b.onclick = () => {
        const idx = parseInt(b.dataset.idx, 10);
        const msg = chatList[idx];
        if(!msg) return;
        const matchedTags = (msg.content.match(/#[a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]+/g) || []).map(t => t.slice(1));
        matchedTags.forEach(t => this.addCaptureTag(t));
        this.saveDraft();
        this.toast('🏷️ Tags hinzugefügt!');
      };
    });
  },

  async sendCaptureAIChat(userPrompt){
    const ta = document.getElementById('capture-text');
    const currentIdeaContent = ta ? ta.value.trim() : '';
    
    if(!this.state.captureAIChat) this.state.captureAIChat = [];
    this.state.captureAIChat.push({ role: 'user', content: userPrompt, ts: Date.now() });

    const container = document.getElementById('capture-ai-chat-messages');
    if(container){
      container.innerHTML = this.renderCaptureAIChatList(this.state.captureAIChat) + `
        <div class="flex justify-start">
          <div class="p-2.5 bg-surface border border-border rounded-xl text-xs text-secondary flex items-center gap-2 animate-pulse">
            <span class="material-symbols-outlined animate-spin" style="font-size:14px">progress_activity</span> KI-Assistent generiert Antwort...
          </div>
        </div>`;
      container.scrollTop = container.scrollHeight;
    }

    try {
      const messagesForApi = this.state.captureAIChat.map(m => ({ role: m.role, content: m.content }));
      const systemPrompt = `Du bist der KI-Assistent für Ideen und Projektentwicklung (Spark KI). Die aktuelle Idee des Nutzers lautet: "${currentIdeaContent}". Antworte stets auf Deutsch, prägnant, strukturiert und übersichtlich. Unterstütze den Nutzer bei Überarbeitungen, Gliederungen und Feinabstimmungen.`;
      
      const reply = await this.callAIChat(messagesForApi, systemPrompt);
      this.state.captureAIChat.push({ role: 'assistant', content: reply, ts: Date.now() });
    } catch (err) {
      this.state.captureAIChat.push({ role: 'assistant', content: `❌ Fehler bei KI-Verbindung: ${err.message}`, ts: Date.now() });
    }

    this.updateCaptureAIChatUI();
  },

  async callAIChat(messages, systemPrompt){
    const cfg = DB.getAISettings();
    const endpoint = cfg.endpoint.trim() || 'https://opencode.ai/zen/v1';
    const apiKey = cfg.apiKey.trim();
    const model = cfg.model.trim() || 'deepseek-v4-flash-free';

    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    const payload = {
      endpoint, apiKey, model,
      messages: fullMessages,
      temperature: 0.7
    };

    let res;
    try {
      res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (_) {}

    // Fallback to direct client-side fetch if proxy returns 404 or network error
    if (!res || !res.ok) {
      let directUrl = endpoint;
      if (!directUrl.includes('/chat/completions')) {
        directUrl = directUrl.replace(/\/+$/, '') + '/chat/completions';
      }
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      const directRes = await fetch(directUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ model, messages: fullMessages, temperature: 0.7 })
      }).catch(() => null);

      if (directRes && directRes.ok) {
        res = directRes;
      }
    }

    if(!res || !res.ok){
      const err = res ? await res.text().catch(()=>'') : '';
      throw new Error(`API-Fehler (${res ? res.status : 'Network'}): ${err.slice(0,120) || (res ? res.statusText : 'Verbindung fehlgeschlagen')}`);
    }

    const data = await res.json();
    if (data.error) throw new Error(`API-Fehler: ${data.error}`);
    const reply = data.choices?.[0]?.message?.content || data.reply || data.output || '';
    if(!reply) throw new Error('Keine Antwort von der KI-API.');
    return reply;
  },

  async callAI(userPrompt, systemPrompt = 'Du bist ein professioneller KI-Assistent für Ideen- und Projektentwicklung.'){
    const cfg = DB.getAISettings();
    const endpoint = cfg.endpoint.trim() || 'https://opencode.ai/zen/v1';
    const apiKey = cfg.apiKey.trim();
    const model = cfg.model.trim() || 'deepseek-v4-flash-free';

    const payload = {
      endpoint: endpoint,
      apiKey: apiKey,
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7
    };

    let res;
    try {
      res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (_) {}

    // Fallback to direct client-side fetch if proxy returns 404 or network error
    if (!res || !res.ok) {
      let directUrl = endpoint;
      if (!directUrl.includes('/chat/completions')) {
        directUrl = directUrl.replace(/\/+$/, '') + '/chat/completions';
      }
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      const directRes = await fetch(directUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          model: model,
          messages: payload.messages,
          temperature: payload.temperature
        })
      }).catch(() => null);

      if (directRes && directRes.ok) {
        res = directRes;
      }
    }

    if(!res || !res.ok){
      const err = res ? await res.text().catch(()=>'') : '';
      throw new Error(`API-Verbindungsfehler (${res ? res.status : 'Network'}): ${err.slice(0,120) || (res ? res.statusText : 'Verbindung fehlgeschlagen')}`);
    }

    const data = await res.json();
    if (data.error) throw new Error(`API-Fehler: ${data.error}`);
    const reply = data.choices?.[0]?.message?.content || data.reply || data.output || '';
    if(!reply) throw new Error('Kein Inhalt in der KI-Antwort.');
    return reply;
  },

  async generateIdeaAIOutline(ideaId){
    const idea = DB.getIdea(ideaId);
    if(!idea) return;
    const aiContainer = document.getElementById('idea-ai-result');
    const aiBtn = document.getElementById('btn-idea-ai');
    if(!aiContainer || !aiBtn) return;

    const originalBtnHTML = aiBtn.innerHTML;
    aiBtn.disabled = true;
    aiBtn.innerHTML = `<span class="material-symbols-outlined animate-spin" style="font-size:18px">progress_activity</span> Analysiere &amp; Erstelle Gliederung...`;
    aiContainer.classList.remove('hidden');
    aiContainer.innerHTML = `<div class="p-4 bg-surface-mid border border-border rounded-xl text-sm flex items-center gap-2 text-secondary animate-pulse">
      <span class="material-symbols-outlined animate-spin" style="font-size:20px">auto_awesome</span> Verbinde mit KI-API...
    </div>`;

    try {
      const prompt = `Meine Idee:\n"${idea.content}"\n\nBitte analysiere diese Idee und erstelle:\n1. Eine strukturierte 3-5 Schritte Gliederung\n2. Funktionsvorschläge & Alleinstellungsmerkmale\n3. Zielgruppe & Mehrwert\n4. Empfohlene Tags (#tag1 #tag2)`;
      const reply = await this.callAI(prompt, 'Du bist ein KI-Assistent für Ideen- und Projektentwicklung. Antworte auf Deutsch, übersichtlich und gut strukturiert.');
      
      const matchedTags = (reply.match(/#[a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]+/g) || []).map(t => t.slice(1));
      
      aiContainer.innerHTML = `
        <div class="p-4 bg-surface-mid border border-border rounded-2xl space-y-3 shadow-ambient">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-widest text-secondary flex items-center gap-1.5">
              <span class="material-symbols-outlined" style="font-size:18px">auto_awesome</span> KI-Gliederung &amp; Vorschläge
            </span>
            <button id="btn-copy-ai-res" class="text-xs text-secondary hover:text-primary flex items-center gap-1">
              <span class="material-symbols-outlined" style="font-size:14px">content_copy</span> Kopieren
            </button>
          </div>
          <div class="text-sm leading-relaxed text-primary whitespace-pre-wrap font-sans">${this.esc(reply)}</div>
          <div class="pt-2 border-t border-border flex flex-wrap gap-2">
            <button id="btn-append-ai-outline" class="btn-primary py-2 px-3 text-xs flex items-center gap-1.5">
              <span class="material-symbols-outlined" style="font-size:14px">add_to_photos</span> Gliederung zur Idee hinzufügen
            </button>
            ${matchedTags.length ? `<button id="btn-add-ai-tags" class="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5">
              <span class="material-symbols-outlined" style="font-size:14px">sell</span> +${matchedTags.length} vorgeschlagene Tags
            </button>` : ''}
          </div>
        </div>`;

      document.getElementById('btn-copy-ai-res')?.addEventListener('click', () => {
        navigator.clipboard.writeText(reply).then(() => this.toast('📋 Kopiert')).catch(() => {});
      });

      document.getElementById('btn-append-ai-outline')?.addEventListener('click', () => {
        const updatedContent = idea.content + '\n\n' + '--- KI-Gliederung ---\n' + reply;
        DB.updateIdea(ideaId, { content: updatedContent });
        this.toast('✅ Gliederung übernommen!');
        this.openIdeaDetail(ideaId);
        this.renderIdeas();
      });

      if(matchedTags.length) {
        document.getElementById('btn-add-ai-tags')?.addEventListener('click', () => {
          const currentTags = idea.tags || [];
          const newTags = Array.from(new Set([...currentTags, ...matchedTags]));
          DB.updateIdea(ideaId, { tags: newTags });
          this.toast('🏷️ Tags aktualisiert!');
          this.openIdeaDetail(ideaId);
          this.renderIdeas();
        });
      }

    } catch (err) {
      aiContainer.innerHTML = `
        <div class="p-4 bg-surface-mid border border-border rounded-xl text-sm text-red-400 space-y-2">
          <p class="font-semibold flex items-center gap-1.5"><span class="material-symbols-outlined" style="font-size:18px">warning</span> KI-Verbindungsfehler</p>
          <p class="text-xs text-secondary">${this.esc(err.message)}</p>
          <p class="text-[11px] text-dim">Bitte prüfe unter Profil > KI-Verbindung deine Einstellungen.</p>
        </div>`;
    } finally {
      aiBtn.disabled = false;
      aiBtn.innerHTML = originalBtnHTML;
    }
  },

  async generateCaptureAI(){
    const ta = document.getElementById('capture-text');
    const content = ta ? ta.value.trim() : '';
    if(!content){ this.toast('Bitte gib zuerst eine Idee ein!'); return; }
    this.sendCaptureAIChat('Erstelle eine strukturierte 3-Schritte-Gliederung für diese Idee');
  },

  // ════════════════════ UI PROTOTYPE GENERATOR ════════════════════
  bindPrototypeEvents(){
    const tabPreview = document.getElementById('tab-proto-preview');
    const tabCode = document.getElementById('tab-proto-code');
    const viewPreview = document.getElementById('proto-preview-view');
    const viewCode = document.getElementById('proto-code-view');
    const codeInp = document.getElementById('prototype-code-inp');
    const iframe = document.getElementById('prototype-iframe');

    if(tabPreview && tabCode){
      tabPreview.onclick = () => {
        tabPreview.className = 'py-2 px-4 text-xs font-bold text-primary border-b-2 border-primary';
        tabCode.className = 'py-2 px-4 text-xs font-medium text-secondary';
        if(viewPreview) viewPreview.classList.remove('hidden');
        if(viewCode) viewCode.classList.add('hidden');
        if(codeInp && iframe){
          iframe.srcdoc = codeInp.value;
        }
      };

      tabCode.onclick = () => {
        tabCode.className = 'py-2 px-4 text-xs font-bold text-primary border-b-2 border-primary';
        tabPreview.className = 'py-2 px-4 text-xs font-medium text-secondary';
        if(viewCode) viewCode.classList.remove('hidden');
        if(viewPreview) viewPreview.classList.add('hidden');
      };
    }

    const btnGen = document.getElementById('btn-generate-prototype-ai');
    const promptInp = document.getElementById('prototype-prompt-inp');
    if(btnGen){
      btnGen.onclick = () => {
        const prompt = promptInp ? promptInp.value.trim() : '';
        if(!prompt){ this.toast('Bitte gib eine UI-Anweisung ein!'); return; }
        this.generateUIPrototype(prompt);
      };
    }

    if(promptInp){
      promptInp.onkeydown = e => {
        if(e.key === 'Enter'){ e.preventDefault(); btnGen?.click(); }
      };
    }

    const btnSave = document.getElementById('btn-save-prototype');
    if(btnSave){
      btnSave.onclick = () => this.saveUIPrototype();
    }

    const btnCopy = document.getElementById('btn-copy-prototype-code');
    if(btnCopy){
      btnCopy.onclick = () => {
        if(!codeInp || !codeInp.value){ this.toast('Kein Code zum Kopieren vorhanden'); return; }
        navigator.clipboard.writeText(codeInp.value).then(() => this.toast('📋 HTML/CSS Code kopiert!')).catch(() => {});
      };
    }
  },

  openPrototypeModal(id, isProject = false, initialPrompt = ''){
    this.state.currentProtoId = id;
    this.state.currentProtoIsProj = isProject;

    const item = id === 'draft'
      ? { content: document.getElementById('capture-text')?.value || 'Neue Idee Entwurf', prototypeHtml: this.state.capturePrototypeHtml || '' }
      : (isProject ? DB.getProject(id) : DB.getIdea(id));
    if(!item) return;

    const modalTitle = document.getElementById('prototype-modal-title');
    const modalSubtitle = document.getElementById('prototype-modal-subtitle');
    const promptInp = document.getElementById('prototype-prompt-inp');
    const codeInp = document.getElementById('prototype-code-inp');
    const iframe = document.getElementById('prototype-iframe');

    if(modalTitle) modalTitle.textContent = id === 'draft' ? 'UI-Prototyp: Entwurf' : (isProject ? `UI-Prototyp: ${item.name}` : 'UI-Prototyp & Live-Vorschau');
    if(modalSubtitle) modalSubtitle.textContent = this.snippet(item.content || item.description || '', 60);

    const protoCode = item.prototypeHtml || '';
    if(codeInp) codeInp.value = protoCode;
    if(iframe) iframe.srcdoc = protoCode || `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; background: #0f0f11; color: #e5e5e7; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
          .card { border: 1px dashed #333; padding: 2rem; border-radius: 1rem; max-width: 400px; }
          h3 { margin-top: 0; color: #fff; }
          p { color: #888; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h3>Noch kein UI-Prototyp</h3>
          <p>Gib oben eine Anweisung ein und klicke auf <b>UI Generieren</b>, um einen interaktiven Prototypen mit der KI zu erstellen.</p>
        </div>
      </body>
      </html>
    `;

    if(promptInp){
      promptInp.value = initialPrompt || `Erstelle ein modernes Interface für: "${item.content || item.name}"`;
    }

    this.openModal('modal-prototype');
  },

  generateCapturePrototype(){
    const ta = document.getElementById('capture-text');
    const content = ta ? ta.value.trim() : '';
    if(!content){
      this.toast('Bitte gib zuerst eine Idee oder Gliederung ein!');
      if(ta) ta.focus();
      return;
    }

    let aiNotes = '';
    if(this.state.captureAIChat && this.state.captureAIChat.length){
      aiNotes = this.state.captureAIChat
        .filter(m => m.role === 'assistant')
        .map(m => m.content)
        .join('\n\n');
    }

    const protoPrompt = `Design & Code ein meisterhaftes, responsive HTML/CSS Web-Interface (UI-Prototyp) für folgende Idee:\n\nIdee: "${content}"\n\n${aiNotes ? 'Spezifikationen & Funktionen aus dem KI-Entwurf:\n' + aiNotes + '\n\n' : ''}Erstelle direkt den vollständigen, funktionsfähigen HTML/CSS Code für das komplette Interface.`;

    this.openPrototypeModal('draft', false, protoPrompt);
    this.generateUIPrototype(protoPrompt);
  },

  async generateUIPrototype(promptText){
    const loading = document.getElementById('prototype-loading');
    const codeInp = document.getElementById('prototype-code-inp');
    const iframe = document.getElementById('prototype-iframe');
    const btnGen = document.getElementById('btn-generate-prototype-ai');

    if(loading) loading.classList.remove('hidden');
    if(btnGen) btnGen.disabled = true;

    try {
      const systemPrompt = `Du bist ein weltklasse UI/UX Designer und Senior Frontend Web Developer. 
DEINE EINZIGE AUFGABE IST ES, EINEN VOLLSTÄNDIGEN, INTERAKTIVEN, WUNDERSCHÖNEN HTML/CSS INTERFACE-PROTOTYPEN (UI DESIGN) ZU GENERIEREN.

CRITICAL INSTRUCTIONS (STRIKT EINHALTEN):
1. GIB KEINEN TEXT, KEINE ERKLÄRUNGEN, KEINEN PLAN UND KEINE MARKDOWN-WRAPPER (\`\`\`html) ZURÜCK!
2. GIB NUREIN VOLLSTÄNDIGES HTML-DOKUMENT AUS (mit <!DOCTYPE html><html><head>...</head><body>...</body></html>).
3. Binde Tailwind CSS via CDN ein (<script src="https://cdn.tailwindcss.com"></script>) ODER nutze eingebettetes Vanilla CSS (<style>...</style>).
4. Verwende ein edles monochrome/dark Design (dunkler Hintergrund #0f0f11, weiße/graue Akzente, modernste Typografie, Abrundungen rounded-2xl, Buttons, Forms, Dashboards, Controls).
5. Erstelle ein VOLLSTÄNDIGES, INTERAKTIVES INTERFACE (Layout, Navigation, Content-Cards, Buttons, Formulare, Tabellen) – ES MUSS DIREKT IN EINEM IFRAME GERENDERT WERDEN KÖNNEN.`;

      let reply = await this.callAI(promptText, systemPrompt);

      // Strip markdown wrapper fences
      reply = reply.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();

      // Extract HTML document if surrounded by any extra text
      const htmlMatch = reply.match(/<!DOCTYPE[\s\S]*<\/html>/i) || reply.match(/<html[\s\S]*<\/html>/i);
      if (htmlMatch) {
        reply = htmlMatch[0];
      }

      if(codeInp) codeInp.value = reply;
      if(iframe) iframe.srcdoc = reply;

      this.toast('✅ UI-Prototyp erfolgreich generiert!');
    } catch(err) {
      this.toast('❌ Fehler bei UI-Generierung: ' + err.message);
    } finally {
      if(loading) loading.classList.add('hidden');
      if(btnGen) btnGen.disabled = false;
    }
  },

  saveUIPrototype(){
    const id = this.state.currentProtoId;
    const isProj = this.state.currentProtoIsProj;
    const codeInp = document.getElementById('prototype-code-inp');
    const html = codeInp ? codeInp.value.trim() : '';

    if(!id) return;
    if(!html){ this.toast('Kein Code zum Speichern vorhanden!'); return; }

    if(id === 'draft'){
      this.state.capturePrototypeHtml = html;
      this.saveDraft();
      this.closeModal('modal-prototype');
      this.toast('💾 UI-Prototyp an Entwurf angehängt!');
      return;
    }

    if(isProj){
      DB.updateProject(id, { prototypeHtml: html });
      this.toast('💾 UI-Prototyp für Projekt gespeichert!');
      this.renderProjects();
    } else {
      DB.updateIdea(id, { prototypeHtml: html });
      DB.addTimelineEntry(id, DB.getIdea(id)?.stage, 'UI-Prototyp gespeichert');
      this.toast('💾 UI-Prototyp für Idee gespeichert!');
      this.openIdeaDetail(id);
      this.renderIdeas();
      this.renderOverview();
    }
  },

  // ── UTIL ──
  esc(str){ return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\n/g,'<br>'); },
  escAttr(str){ return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); },
};

document.addEventListener('DOMContentLoaded', () => App.init());
