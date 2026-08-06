/* Spark v3 — Data Layer (localStorage + Supabase Sync) */
const SUPABASE_URL = 'https://bknbretpqzbqadensozh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrbmJyZXRwcXpicWFkZW5zb3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MDI0MzAsImV4cCI6MjEwMTI3ODQzMH0.vbrPJD07PYyzV7jaYxAGE2gwpL1w2SELEPDm18Cw06Q';

let _sbClient = null;
try {
  if (typeof window !== 'undefined' && window.supabase) {
    _sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (_) {}

const DB = {
  supabase: _sbClient,
  onLiveComment: null,
  onLiveShare: null,
  onNotification: null,

  // Chuyển project (JS) → payload khớp schema Supabase (bảng có cột "desc", không có "description")
  projectToRow(p){
    const { id, name, status, cover, link, tags, gallery, checklist, createdAt, updatedAt } = p;
    return { id, name, desc: p.description || p.desc || null, status, cover, link,
      tags: tags || [], gallery: gallery || [], checklist: checklist || [], createdAt, updatedAt };
  },

  // Chuyển idea (JS) → payload khớp schema (JS dùng isPinned/aiChat, bảng dùng pinned)
  ideaToRow(i){
    const { id, content, author, stage, color, prototypeHtml, tags, images, timeline, createdAt, updatedAt } = i;
    return { id, content, author, stage, color, pinned: i.isPinned || false,
      prototypeHtml: prototypeHtml || null, tags: tags || [], images: images || [],
      timeline: timeline || [], createdAt, updatedAt };
  },

  // ── SUPABASE CLOUD SYNC ──
  async syncSupabase(){
    if (!this.supabase) return;
    try {
      // Sync Ideas
      const { data: remoteIdeas } = await this.supabase.from('ideas').select('*');
      if (remoteIdeas && remoteIdeas.length) {
        const local = this.getIdeas();
        const mergedMap = new Map();
        [...local, ...remoteIdeas].forEach(item => {
          mergedMap.set(item.id, {
            ...item,
            isPinned: item.isPinned !== undefined ? item.isPinned : item.pinned
          });
        });
        this.saveIdeas(Array.from(mergedMap.values()));
      }
    } catch (_) {}

    try {
      // Sync Projects
      const { data: remoteProjects } = await this.supabase.from('projects').select('*');
      if (remoteProjects && remoteProjects.length) {
        const local = this.getProjects();
        const mergedMap = new Map();
        [...local, ...remoteProjects].forEach(item => {
          mergedMap.set(item.id, {
            ...item,
            description: item.description || item.desc || ''
          });
        });
        this.saveProjects(Array.from(mergedMap.values()));
      }
    } catch (_) {}

    await this.syncShares();
    await this.syncComments();
    this.initRealtime();
  },

  // ── SHARES (chia sẻ dự án theo nickname) ──
  getShares(){ return JSON.parse(localStorage.getItem('spark_shares')||'[]') },
  saveShares(list){ localStorage.setItem('spark_shares', JSON.stringify(list)) },
  getSharedProjectIds(){
    const me = (this.getUser()||'').toLowerCase();
    return this.getShares().filter(s=>(s.sharedWith||'').toLowerCase()===me || (s.owner||'').toLowerCase()===me).map(s=>s.projectId);
  },
  isProjectShared(projectId){ return this.getShares().some(s=>s.projectId===projectId) },

  async shareProject(projectId, nickname){
    const name = (nickname||'').trim();
    const me = this.getUser();
    if(!name || name.toLowerCase()===me.toLowerCase()) return null;
    const list = this.getShares();
    if(list.some(s=>s.projectId===projectId && (s.sharedWith||'').toLowerCase()===name.toLowerCase())) return null;
    const share = { id:'sh_'+Date.now()+'_'+Math.random().toString(36).slice(2,8), projectId, owner:me, sharedWith:name, createdAt:Date.now() };
    list.push(share);
    this.saveShares(list);
    if(this.supabase){
      try {
        await this.supabase.from('shares').upsert(share);
        const p = this.getProject(projectId);
        if(p) await this.supabase.from('projects').upsert(this.projectToRow(p));
      } catch(_) {}
    }
    return share;
  },

  async removeShare(shareId){
    this.saveShares(this.getShares().filter(s=>s.id!==shareId));
    if(this.supabase){
      try { await this.supabase.from('shares').delete().eq('id', shareId); } catch(_) {}
    }
  },

  async syncShares(){
    if(!this.supabase) return;
    const me = this.getUser(); if(!me) return;
    try {
      // Lấy mọi share liên quan đến mình (share cho mình + mình share)
      const { data } = await this.supabase.from('shares').select('*').or(`owner.eq.${me},sharedWith.eq.${me}`);
      if(!data) return;
      const local = this.getShares();
      const mergedMap = new Map(local.map(s=>[s.id,s]));
      const freshIncoming = [];
      data.forEach(s=>{
        const existed = mergedMap.has(s.id);
        mergedMap.set(s.id,s);
        // Share mới dành cho mình → tạo thông báo
        if(!existed && (s.sharedWith||'').toLowerCase()===me.toLowerCase()) freshIncoming.push(s);
      });
      this.saveShares(Array.from(mergedMap.values()));
      freshIncoming.forEach(s => this.notifyShare(s));

      // Tải các project được share về máy
      const incoming = data.map(s=>s.projectId);
      if(incoming.length){
        const { data: remoteProjects } = await this.supabase.from('projects').select('*').in('id', incoming);
        if(remoteProjects && remoteProjects.length){
          const localProjects = this.getProjects();
          const pmap = new Map(localProjects.map(p=>[p.id,p]));
          remoteProjects.forEach(p=>{
            pmap.set(p.id, {
              ...p,
              description: p.description || p.desc || ''
            });
          });
          this.saveProjects(Array.from(pmap.values()));
        }
      }
    } catch(_) {}
  },

  async syncComments(){
    if(!this.supabase) return;
    const projects = this.getProjects();
    if(!projects.length) return;
    const ids = projects.map(p=>p.id);
    try {
      const { data } = await this.supabase.from('project_comments').select('*').in('projectId', ids);
      if(!data || !data.length) return;
      const local = this.getComments();
      const seen = new Set(local.map(c=>c.id));
      let changed = false;
      data.forEach(c=>{ if(!seen.has(c.id)){ local.push(c); changed=true; } });
      if(changed) this.saveComments(local);
    } catch(_) {}
  },

  // ── REALTIME (chat live + share) ──
  initRealtime(){
    if(!this.supabase) return;
    const me = (this.getUser()||'').toLowerCase();
    try {
      if(!this._rtChannel){
        this._rtChannel = this.supabase
          .channel('spark-project-chat')
          .on('postgres_changes', { event:'INSERT', schema:'public', table:'project_comments' }, payload => {
            this.handleLiveComment(payload.new);
          })
          .subscribe();
      }
      // Realtime nhận thông báo khi có người share project cho mình
      if(me && !this._rtShareChannel){
        this._rtShareChannel = this.supabase
          .channel('spark-share-notify')
          .on('postgres_changes', { event:'INSERT', schema:'public', table:'shares', filter:`sharedWith=eq.${me}` }, payload => {
            this.handleLiveShare(payload.new);
          })
          .subscribe();
      }
    } catch(_) {}
  },

  async handleLiveShare(s){
    if(!s || !s.id) return;
    const me = this.getUser();
    const meLow = (me||'').toLowerCase();
    const involved = (s.sharedWith||'').toLowerCase()===meLow || (s.owner||'').toLowerCase()===meLow;
    if(!involved) return;
    const local = this.getShares();
    if(local.some(x=>x.id===s.id)) return;
    local.push(s);
    this.saveShares(local);
    // Tải project được share về máy ngay
    try {
      if(this.supabase){
        const { data: p } = await this.supabase.from('projects').select('*').eq('id', s.projectId).single();
        if(p){
          const all = this.getProjects();
          if(!all.some(x=>x.id===p.id)) this.saveProjects([...all, { ...p, description: p.description || p.desc || '' }]);
        }
      }
    } catch(_) {}
    this.notifyShare(s);
    if(this.onLiveShare) this.onLiveShare(s);
  },

  notifyShare(s){
    if(!s) return;
    const me = this.getUser();
    if((s.sharedWith||'').toLowerCase() !== (me||'').toLowerCase()) return;
    if((s.owner||'').toLowerCase() === (me||'').toLowerCase()) return;
    const notif = { id:'notif_sh_'+s.id, type:'share', projectId:s.projectId, actor:s.owner,
      text:`${s.owner||'Ai đó'} đã chia sẻ dự án với bạn`, ts:s.createdAt || Date.now(), read:false };
    this.addNotification(notif);
  },

  handleLiveComment(c){
    if(!c || !c.id) return;
    const all = this.getComments();
    if(all.some(x=>x.id===c.id)) return;
    all.push({ id:c.id, projectId:c.projectId, author:c.author, content:c.content, createdAt:c.createdAt });
    this.saveComments(all);
    // Thông báo khi người khác comment
    const me = this.getUser();
    if(c.author && c.author !== (me||'Anonym')){
      const notif = { id:'notif_cmt_'+c.id, type:'comment', projectId:c.projectId, actor:c.author,
        text:`${c.author}: ${String(c.content||'').slice(0,60)}`, ts:c.createdAt || Date.now(), read:false };
      this.addNotification(notif);
    }
    if(this.onLiveComment) this.onLiveComment(c);
  },

  // ── NOTIFICATIONS (thông báo chia sẻ & comment) ──
  getNotifications(){
    try { return JSON.parse(localStorage.getItem('spark_notifications')||'[]'); } catch(_){ return []; }
  },
  saveNotifications(list){ localStorage.setItem('spark_notifications', JSON.stringify(list)); },
  addNotification(n){
    const all = this.getNotifications();
    if(all.some(x=>x.id===n.id)) return;
    all.unshift(n);
    if(all.length>50) all.length = 50;
    this.saveNotifications(all);
    if(this.onNotification) this.onNotification(n);
  },
  markNotifRead(id){
    this.saveNotifications(this.getNotifications().map(n=>n.id===id?{...n,read:true}:n));
  },
  markAllNotifsRead(){
    this.saveNotifications(this.getNotifications().map(n=>({...n,read:true})));
  },
  unreadNotifCount(){ return this.getNotifications().filter(n=>!n.read).length; },
  clearNotifications(){ this.saveNotifications([]); },

  async pushSupabase(table, payload){
    if(!this.supabase) return;
    try {
      await this.supabase.from(table).upsert(payload);
    } catch (_) {}
  },

  async deleteSupabase(table, id){
    if(!this.supabase) return;
    try {
      await this.supabase.from(table).delete().eq('id', id);
    } catch (_) {}
  },

  // ── IDEAS ──
  getIdeas(){ return JSON.parse(localStorage.getItem('spark_ideas')||'[]') },
  saveIdeas(list){ localStorage.setItem('spark_ideas', JSON.stringify(list)) },
  addIdea(idea){
    const list = this.getIdeas();
    idea.id = 'idea_' + Date.now();
    idea.createdAt = Date.now();
    idea.updatedAt = Date.now();
    idea.stage = idea.stage || 'spark';
    idea.author = idea.author || this.getUser() || 'Anonym';
    idea.images = idea.images || [];
    idea.timeline = [{ stage: idea.stage, note:'Idee erfasst', author: idea.author, ts: idea.createdAt }];
    list.unshift(idea);
    this.saveIdeas(list);
    this.pushSupabase('ideas', this.ideaToRow(idea));
    return idea;
  },
  updateIdea(id, patch){
    const list = this.getIdeas().map(i => i.id===id ? {...i,...patch, updatedAt:Date.now()} : i);
    this.saveIdeas(list);
    const updated = list.find(i=>i.id===id);
    if(updated) this.pushSupabase('ideas', this.ideaToRow(updated));
  },
  deleteIdea(id){
    this.saveIdeas(this.getIdeas().filter(i=>i.id!==id));
    this.deleteSupabase('ideas', id);
  },
  getIdea(id){ return this.getIdeas().find(i=>i.id===id) },

  // ── IDEA TIMELINE ──
  addTimelineEntry(ideaId, stage, note){
    const idea = this.getIdea(ideaId);
    if(!idea) return;
    const entry = { stage, note: note||'', author: this.getUser()||'Anonym', ts: Date.now() };
    const timeline = [...(idea.timeline||[]), entry];
    this.updateIdea(ideaId, { stage, timeline });
    return entry;
  },

  // ── BOARD (community ideas) ──
  getBoard(){ return JSON.parse(localStorage.getItem('spark_board')||'[]') },
  saveBoard(list){ localStorage.setItem('spark_board', JSON.stringify(list)) },
  addBoardIdea(idea){
    const list = this.getBoard();
    idea.id = 'board_' + Date.now();
    idea.createdAt = Date.now();
    idea.author = this.getUser() || 'Anonym';
    idea.votes = [];
    idea.claims = [];
    list.unshift(idea);
    this.saveBoard(list);
    return idea;
  },
  getBoardIdea(id){ return this.getBoard().find(b=>b.id===id) },
  toggleVote(boardId){
    const user = this.getUser()||'Anonym';
    const list = this.getBoard().map(b=>{
      if(b.id!==boardId) return b;
      const votes = b.votes||[];
      const idx = votes.indexOf(user);
      if(idx>=0) votes.splice(idx,1); else votes.push(user);
      return {...b, votes};
    });
    this.saveBoard(list);
  },
  toggleClaim(boardId){
    const user = this.getUser()||'Anonym';
    const list = this.getBoard().map(b=>{
      if(b.id!==boardId) return b;
      const claims = b.claims||[];
      const idx = claims.indexOf(user);
      if(idx>=0) claims.splice(idx,1); else claims.push(user);
      return {...b, claims};
    });
    this.saveBoard(list);
  },

  // ── PROJECTS ──
  getProjects(){ return JSON.parse(localStorage.getItem('spark_projects')||'[]') },
  saveProjects(list){ localStorage.setItem('spark_projects', JSON.stringify(list)) },
  addProject(proj){
    const list = this.getProjects();
    proj.id = 'proj_' + Date.now();
    proj.createdAt = Date.now();
    proj.updatedAt = Date.now();
    list.unshift(proj);
    this.saveProjects(list);
    return proj;
  },
  updateProject(id, patch){
    const list = this.getProjects().map(p=>p.id===id?{...p,...patch,updatedAt:Date.now()}:p);
    this.saveProjects(list);
    const updated = list.find(p=>p.id===id);
    if(updated && this.isProjectShared(id) && this.supabase){
      try { this.supabase.from('projects').upsert(this.projectToRow(updated)).then(); } catch(_) {}
    }
  },
  deleteProject(id){
    this.saveProjects(this.getProjects().filter(p=>p.id!==id));
    this.saveComments(this.getComments().filter(c=>c.projectId!==id));
    this.saveReactions(this.getReactions().filter(r=>r.projectId!==id));
  },
  getProject(id){ return this.getProjects().find(p=>p.id===id) },

  // ── CHECKLIST (per-project sub-tasks) ──
  getChecklist(projId){
    const p = this.getProject(projId);
    return p ? (p.checklist||[]) : [];
  },
  addCheckItem(projId, text){
    const p = this.getProject(projId); if(!p) return;
    const item = { id:'ck_'+Date.now(), text:text.trim(), done:false, createdAt:Date.now() };
    const checklist = [...(p.checklist||[]), item];
    this.updateProject(projId, { checklist });
    return item;
  },
  toggleCheckItem(projId, itemId){
    const p = this.getProject(projId); if(!p) return;
    const checklist = (p.checklist||[]).map(c => c.id===itemId ? {...c, done:!c.done} : c);
    this.updateProject(projId, { checklist });
  },
  deleteCheckItem(projId, itemId){
    const p = this.getProject(projId); if(!p) return;
    const checklist = (p.checklist||[]).filter(c => c.id!==itemId);
    this.updateProject(projId, { checklist });
  },

  // ── TAG COLORS ──
  getTagColors(){ try { return JSON.parse(localStorage.getItem('spark_tag_colors')||'{}'); } catch(_){ return {}; } },
  setTagColor(tag, color){ const m=this.getTagColors(); m[tag]=color; localStorage.setItem('spark_tag_colors', JSON.stringify(m)); },

  // ── COMMENTS ──
  getComments(projectId){
    const all = JSON.parse(localStorage.getItem('spark_comments')||'[]');
    return projectId ? all.filter(c=>c.projectId===projectId) : all;
  },
  saveComments(list){ localStorage.setItem('spark_comments', JSON.stringify(list)) },
  addComment(comment){
    const list = this.getComments();
    comment.id = 'cmt_' + Date.now();
    comment.createdAt = Date.now();
    list.push(comment);
    this.saveComments(list);
    // Dự án được share → đẩy lên Supabase để chat live
    if(this.isProjectShared(comment.projectId) && this.supabase){
      try { this.supabase.from('project_comments').insert(comment).then(); } catch(_) {}
    }
    return comment;
  },
  deleteComment(id){ this.saveComments(this.getComments().filter(c=>c.id!==id)) },

  // ── BOARD COMMENTS ──
  getBoardComments(boardId){
    const all = JSON.parse(localStorage.getItem('spark_board_cmts')||'[]');
    return boardId ? all.filter(c=>c.boardId===boardId) : all;
  },
  saveBoardComments(list){ localStorage.setItem('spark_board_cmts', JSON.stringify(list)) },
  addBoardComment(boardId, text){
    const all = this.getBoardComments();
    const c = { id:'bc_'+Date.now(), boardId, author: this.getUser()||'Anonym', content:text, createdAt:Date.now() };
    all.push(c);
    this.saveBoardComments(all);
    return c;
  },

  // ── REACTIONS ──
  getReactions(projectId){
    const all = JSON.parse(localStorage.getItem('spark_reactions')||'[]');
    return projectId ? all.filter(r=>r.projectId===projectId) : all;
  },
  saveReactions(list){ localStorage.setItem('spark_reactions', JSON.stringify(list)) },
  toggleReaction(projectId, emoji, author){
    const list = this.getReactions();
    const idx = list.findIndex(r=>r.projectId===projectId&&r.emoji===emoji&&r.author===author);
    if(idx>=0){ list.splice(idx,1) } else { list.push({id:'r_'+Date.now(),projectId,emoji,author,createdAt:Date.now()}) }
    this.saveReactions(list);
  },
  hasReacted(projectId, emoji, author){ return this.getReactions(projectId).some(r=>r.emoji===emoji&&r.author===author) },
  countReaction(projectId, emoji){ return this.getReactions(projectId).filter(r=>r.emoji===emoji).length },

  // ── USER ──
  getUser(){ return localStorage.getItem('spark_user') || '' },
  setUser(name){
    localStorage.setItem('spark_user', name);
    if(!localStorage.getItem('spark_since')) localStorage.setItem('spark_since', String(Date.now()));
  },
  getSince(){ return Number(localStorage.getItem('spark_since')) || Date.now() },
  getUserEmoji(){ return localStorage.getItem('spark_emoji') || '🧑' },
  setUserEmoji(e){ localStorage.setItem('spark_emoji', e) },

  // ── AI CONFIG ──
  getAISettings(){
    return {
      apiKey: localStorage.getItem('spark_ai_key') || 'sk-ADnuKTZrgCiRDNuRctxgoelq9Q5isruoqsEvVu4QArn7oAjA5QmKHADuyhmcu75b',
      endpoint: localStorage.getItem('spark_ai_endpoint') || 'https://opencode.ai/zen/v1',
      model: localStorage.getItem('spark_ai_model') || 'deepseek-v4-flash-free'
    };
  },

  setAISettings(settings){
    if(settings.apiKey !== undefined) localStorage.setItem('spark_ai_key', settings.apiKey);
    if(settings.endpoint !== undefined) localStorage.setItem('spark_ai_endpoint', settings.endpoint);
    if(settings.model !== undefined) localStorage.setItem('spark_ai_model', settings.model);
  },

  // ── CAPTURE DRAFT (never lose a half-typed idea) ──
  getDraft(){ try { return JSON.parse(localStorage.getItem('spark_capture_draft')||'null'); } catch(_) { return null; } },
  setDraft(d){ localStorage.setItem('spark_capture_draft', JSON.stringify(d)); },
  clearDraft(){ localStorage.removeItem('spark_capture_draft'); },

  // ── HELPERS ──
  async compressImage(file, maxW=900, quality=0.82){
    return new Promise(resolve=>{
      const reader = new FileReader();
      reader.onload = e=>{
        const img = new Image();
        img.onload = ()=>{
          let {width:w, height:h} = img;
          if(w>maxW){ h=Math.round(h*maxW/w); w=maxW; }
          const canvas = document.createElement('canvas');
          canvas.width=w; canvas.height=h;
          canvas.getContext('2d').drawImage(img,0,0,w,h);
          resolve(canvas.toDataURL('image/jpeg',quality));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  exportAll(){
    const data = { ideas:this.getIdeas(), board:this.getBoard(), projects:this.getProjects(), comments:this.getComments(), reactions:this.getReactions(), exportedAt:new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download='spark-backup.json'; a.click();
    URL.revokeObjectURL(url);
  },

  importAll(jsonStr){
    try {
      const data = JSON.parse(jsonStr);
      if(data.ideas) localStorage.setItem('spark_ideas', JSON.stringify(data.ideas));
      if(data.projects) localStorage.setItem('spark_projects', JSON.stringify(data.projects));
      if(data.comments) localStorage.setItem('spark_comments', JSON.stringify(data.comments));
      if(data.reactions) localStorage.setItem('spark_reactions', JSON.stringify(data.reactions));
      return true;
    } catch(_) { return false; }
  },

  clearAll(){
    ['spark_ideas','spark_projects','spark_comments','spark_reactions','spark_board','spark_board_cmts','spark_capture_draft'].forEach(k=>localStorage.removeItem(k));
  }
};
