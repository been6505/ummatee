const KANBAN=(()=>{
  const COLS=[['open','รอความช่วยเหลือ'],['going','ทีมกำลังไป'],['helped','ช่วยเหลือแล้ว · รอปิด'],['done','ปิดเคส (24 ชม.)']];
  const K={drag:null,ghost:null,timer:null,start:null,moved:false,order:{},orderAt:0};
  async function loadOrder(force){if(!force&&Date.now()-K.orderAt<20000)return;K.orderAt=Date.now();try{const r=await api({action:'kb_order',key:A.key});if(r&&r.ok){const ch=JSON.stringify(r.order||{})!==JSON.stringify(K.order);K.order=r.order||{};if(ch)draw()}}catch(e){}}
  const rk=c=>K.order[c.id]!=null?Number(K.order[c.id]):null;
  async function reorder(to,id,idx){const col=document.querySelector(`#kanban-view [data-kbcol="${to}"]`);if(!col)return;const ids=[...col.querySelectorAll('.kb-card')].map(c=>c.dataset.kb).filter(x=>x!==String(id));ids.splice(Math.min(idx,ids.length),0,String(id));ids.forEach((x,i)=>{K.order[x]=i});draw();try{const r=await post({action:'kb_order',key:A.key,ids});if(!r||!r.ok)throw 0}catch(e){toast('บันทึกลำดับไม่สำเร็จ')}}
  const box=()=>document.getElementById('kanban-view');
  const vol=c=>String(c.volunteer||'').replace(/^'/,'').trim();
  function list(){const st=$('#f-status');const keep=st.value;st.value='all';let cs;try{cs=filtered()}finally{st.value=keep}
    const day=Date.now()-864e5;return cs.filter(c=>!c.dupOf&&(c.status!=='done'||Number(c.doneAt||c.updatedAt||0)>day))}
  const PH={m:{},at:0,t:'',busy:false};
  async function phLoad(force){if(PH.busy||(!force&&Date.now()-PH.at<60000))return;PH.busy=true;try{const[r,t]=await Promise.all([api({action:'photo_index',key:A.key}),typeof HMT!=='undefined'?HMT.get():'']);if(r&&r.ok){const ch=JSON.stringify(r.m)!==JSON.stringify(PH.m)||PH.t!==t;PH.m=r.m;PH.t=t;PH.at=Date.now();if(ch)draw()}}catch(e){}finally{PH.busy=false}}
  addEventListener('hm-rev',()=>phLoad(true));
  const phU=n=>'/api?'+new URLSearchParams({action:'case_photo',n,t:PH.t});
  function card(c){const s=sev(c),p=(c.photos||[])[0],ho=(PH.t&&(c.teamDoneAt||c.status==='done')&&PH.m[String(c.id)])||[];
    return `<article class="kb-card u${s}" data-kb="${esc(c.id)}">
      ${p?`<img class="kb-img" alt="" loading="lazy" src="https://drive.google.com/thumbnail?id=${encodeURIComponent(p)}&sz=w200">`:''}
      <div class="kb-tx"><span class="urg urg-${s}">${URG[s]}</span><b>${esc((c.needs||[]).slice(0,2).join(' · ')||'ขอความช่วยเหลือ')}</b>
      <small>${esc(c.people||1)} คน${c.district?' · '+esc(c.district):''}</small>${vol(c)&&c.status!=='open'?`<small class="kb-team"><i data-ic="users"></i> ${esc(vol(c))}</small>`:''}
      ${c.teamIssue&&c.status==='going'?`<small class="kb-iss">ทีมแจ้ง: ${esc(c.teamIssue.split(' · ')[0])}</small>`:''}<small class="kb-ago">${esc(ago(c.createdAt))}</small>${ho.length?`<div class="kb-ho" title="ภาพส่งมอบจากทีม">${ho.slice(0,3).map((n,i)=>`<a href="${phU(n)}" target="_blank" rel="noopener" draggable="false" data-kbho="${esc(c.id)}" data-i="${i}"><img src="${phU(n)}" alt="ภาพส่งมอบ ${i+1}" loading="lazy" draggable="false">${i===2&&ho.length>3?`<b>+${ho.length-3}</b>`:''}</a>`).join('')}</div>`:''}</div></article>`}
  function draw(){const el=box();if(!el||el.hidden)return;phLoad();loadOrder();if(D.on||K.ghost||document.querySelector('.kb-pick')){K.pend=true;return}K.pend=false;const sx=(el.querySelector('.kb-cols')||{}).scrollLeft||0,sy=[...el.querySelectorAll('.kb-list')].map(x=>x.scrollTop);const cs=list();
    el.innerHTML=`<div class="kb-top"><button type="button" class="btn ghost sm" id="rt-board-btn" aria-pressed="${!!(typeof RTBOARD!=='undefined'&&RTBOARD.open)}" onclick="RTBOARD.toggle()"><i data-ic="route"></i> จัดเส้นทาง · มอบเคสให้ทีมทั้งเส้น</button></div><div class="kb-cols${K.showDone?'':' fold'}">${COLS.map(([k,t])=>{const xs=cs.filter(c=>stOf(c)===k).sort((a,b)=>{const ra=rk(a),rb=rk(b);if(ra!=null||rb!=null)return ra==null?1:rb==null?-1:ra-rb;return sev(b)-sev(a)||Number(a.createdAt)-Number(b.createdAt)});
      if(k==='done'&&!K.showDone)return `<section class="kb-col kb-done kb-fold" data-kbcol="done"><h3>ปิดเคส <span>${xs.length}</span></h3><div class="kb-list"><p class="kb-empty"><i data-ic="check"></i><br>ลากการ์ดมาวาง<br>เพื่อปิดเคส</p>${xs.length?`<button type="button" class="btn ghost sm kb-show" data-kbshow>ดูเคสที่ปิด (24 ชม.)</button>`:''}</div></section>`;
      return `<section class="kb-col kb-${k}" data-kbcol="${k}"><h3>${t} <span>${xs.length}</span>${k==='done'?'<button type="button" class="kb-hide" data-kbshow aria-label="ซ่อนเคสที่ปิด" title="ซ่อนเคสที่ปิด"><i data-ic="eyeoff"></i></button>':''}</h3><div class="kb-list">${xs.slice(0,150).map(card).join('')||'<p class="kb-empty">วางการ์ดที่นี่</p>'}${xs.length>150?`<p class="kb-empty">+${xs.length-150} เคส · ใช้ตัวกรองเพื่อดูเพิ่ม</p>`:''}</div></section>`}).join('')}</div>`;
    const nc=el.querySelector('.kb-cols');if(nc)nc.scrollLeft=sx;el.querySelectorAll('.kb-list').forEach((x,i)=>{x.scrollTop=sy[i]||0});
    if(typeof ic==='function')el.querySelectorAll('i[data-ic]').forEach(i=>{i.outerHTML=ic(i.dataset.ic)})}
  async function drop(id,to,idx){const c=A.cases.find(x=>String(x.id)===String(id));if(!c)return;if(stOf(c)===to){if(idx!=null&&(to!=='done'||K.showDone))await reorder(to,id,idx==null?0:idx);return}const before=c.status+'|'+(c.teamDoneAt||'');
    if((to==='going'&&!(stOf(c)==='helped'&&vol(c)))||(to==='helped'&&(!vol(c)||c.status!=='going'))){const team=await pickTeam(c);if(!team)return;await changeStatus(c.id,to,null,team)}
    else if(to==='done'){if(!c.teamDoneAt&&c.status==='going'&&!confirm('ทีมยังไม่ได้แจ้งว่าช่วยเหลือแล้ว · ปิดเคสเลยหรือไม่?'))return;await changeStatus(c.id,'done')}
    else if(to==='open'){if(c.status!=='open'&&!confirm('คืนเคสเป็น "รอความช่วยเหลือ" และเอาออกจากทีม?'))return;await changeStatus(c.id,'open')}
    else await changeStatus(c.id,to);
    if(idx!=null&&stOf(c)===to&&(to!=='done'||K.showDone)&&before!==c.status+'|'+(c.teamDoneAt||''))await reorder(to,id,idx);else draw()}
  function pickTeam(c){return new Promise(async res=>{if(!A.roster)await loadRoster();
    const d=document.createElement('dialog');d.className='kb-pick';const load={};A.cases.forEach(x=>{if(x.status==='going'&&vol(x))load[vol(x)]=(load[vol(x)]||0)+1});
    const RS={ready:'ว่าง',out:'ทีมกำลังไป',rest:'พัก'},teams=(A.roster||[]).filter(t=>t.status!=='rest');
    d.innerHTML=`<h3>มอบเคสให้ทีม</h3><p class="muted small">${esc((c.needs||[]).join(' · ')||'เคส')} · ${esc(c.district||'')}</p><div class="kb-teams">${teams.map(t=>`<button type="button" data-t="${esc(t.name)}"><b>${esc(t.name)}</b><small>${esc(RS[t.status]||'')}${load[t.name]?' · มีงาน '+load[t.name]+' เคส':''}</small></button>`).join('')||'<p class="muted">ยังไม่มีทีม · สร้างทีมได้ในรายละเอียดเคส</p>'}</div><button type="button" class="btn ghost" data-x>ยกเลิก</button>`;
    document.body.append(d);d.showModal();
    d.onclick=e=>{const b=e.target.closest('[data-t]');if(b){d.close();res(b.dataset.t)}else if(e.target.closest('[data-x]')||e.target===d){d.close();res(null)}};d.onclose=()=>{d.remove();res(null);if(K.pend)setTimeout(draw,50)}})}
  const D={};
  function cardsIn(l){return [...l.querySelectorAll('.kb-card')].filter(c=>c!==D.el)}
  function flip(l,fn){const cs=cardsIn(l),a=new Map(cs.map(c=>[c,c.getBoundingClientRect().top]));fn();cs.forEach(c=>{const d=a.get(c)-c.getBoundingClientRect().top;if(!d)return;c.style.transition='none';c.style.transform=`translateY(${d}px)`;requestAnimationFrame(()=>{c.style.transition='transform .16s ease';c.style.transform=''})})}
  function place(x,y){const hit=document.elementFromPoint(x,y),col=hit&&hit.closest&&hit.closest('#kanban-view [data-kbcol]');
    if(col!==D.col){if(D.col)D.col.classList.remove('over');D.col=col;if(col)col.classList.add('over')}
    if(!col||col.classList.contains('kb-fold')){if(D.ph.parentNode){const l=D.ph.parentNode;flip(l,()=>D.ph.remove())}D.idx=null;return}
    const l=col.querySelector('.kb-list'),cs=cardsIn(l);let i=cs.findIndex(c=>{const r=c.getBoundingClientRect(),t=parseFloat(c.style.transform.replace(/[^\d.-]/g,''))||0;return y<r.top-t+r.height/2});if(i<0)i=cs.length;
    if(D.ph.parentNode===l&&D.idx===i)return;D.idx=i;
    const old=D.ph.parentNode,ins=()=>{if(cs[i])cs[i].before(D.ph);else{const last=cs[cs.length-1];if(last)last.after(D.ph);else l.prepend(D.ph)}};
    if(old&&old!==l)flip(old,()=>D.ph.remove());flip(l,ins);const e=l.querySelector('.kb-empty');if(e&&!e.classList.contains('kb-show'))e.hidden=true}
  function scrollTick(){if(!D.on)return;const {x,y}=D.p,sp=(d,z)=>d<z?Math.ceil((z-d)/z*18):0;
    const cols=document.querySelector('#kanban-view .kb-cols');if(cols){const r=cols.getBoundingClientRect();cols.scrollLeft+=sp(r.right-x,70)-sp(x-r.left,70)}
    const l=D.col&&D.col.querySelector('.kb-list');if(l){const r=l.getBoundingClientRect();const v=sp(r.bottom-y,60)-sp(y-r.top,60);if(v){l.scrollTop+=v;place(x,y)}}
    const w=innerHeight,v2=sp(w-y,50)-sp(y,50);if(v2)scrollBy(0,v2);D.raf=requestAnimationFrame(scrollTick)}
  function begin(){const c=D.el,r=c.getBoundingClientRect();D.on=true;D.ox=D.sx-r.left;D.oy=D.sy-r.top;
    D.g=c.cloneNode(true);D.g.classList.add('kb-ghost');D.g.style.width=r.width+'px';document.body.append(D.g);
    D.ph=document.createElement('div');D.ph.className='kb-ph';D.ph.style.height=r.height+'px';c.after(D.ph);c.classList.add('dragging');document.body.classList.add('kb-dragging');
    D.idx=null;D.col=null;try{D.pt==='touch'&&navigator.vibrate&&navigator.vibrate(15)}catch(e){}D.p={x:D.sx,y:D.sy};paint();place(D.sx,D.sy);D.raf=requestAnimationFrame(scrollTick)}
  function paint(){D.q=0;if(D.g)D.g.style.transform=`translate3d(${D.p.x-D.ox}px,${D.p.y-D.oy}px,0) rotate(${Math.max(-4,Math.min(4,(D.p.x-(D.lx??D.p.x))*.4))}deg)`;D.lx=D.p.x}
  function finish(ok){cancelAnimationFrame(D.raf);clearTimeout(D.t);const id=D.el&&D.el.dataset.kb,col=D.col,idx=D.idx;
    if(D.g){const g=D.g,ph=D.ph;if(ok&&ph&&ph.parentNode){const r=ph.getBoundingClientRect();g.style.transition='transform .14s ease';g.style.transform=`translate3d(${r.left}px,${r.top}px,0)`;setTimeout(()=>g.remove(),150)}else g.remove();if(ph)ph.remove()}
    if(D.el)D.el.classList.remove('dragging');if(col)col.classList.remove('over');document.body.classList.remove('kb-dragging');const was=D.on;Object.keys(D).forEach(k=>delete D[k]);
    if(was){K.justDragged=Date.now();K.ghost=null;if(ok&&col&&id&&idx!=null)drop(id,col.dataset.kbcol,idx);else draw()}}
  document.addEventListener('pointerdown',e=>{if(e.button>0||D.el)return;const c=e.target.closest&&e.target.closest('#kanban-view .kb-card');if(!c||e.target.closest('a,button,input,select'))return;
    Object.assign(D,{el:c,sx:e.clientX,sy:e.clientY,pt:e.pointerType,id:e.pointerId});if(e.pointerType!=='mouse')D.t=setTimeout(()=>{if(D.el&&!D.on){K.ghost=1;begin()}},220)},{passive:true});
  document.addEventListener('pointermove',e=>{if(!D.el||e.pointerId!==D.id)return;const mv=Math.hypot(e.clientX-D.sx,e.clientY-D.sy);
    if(!D.on){if(D.pt==='mouse'&&mv>5){K.ghost=1;begin()}else if(D.pt!=='mouse'&&mv>10){clearTimeout(D.t);Object.keys(D).forEach(k=>delete D[k])}if(!D.on)return}
    e.preventDefault();D.p={x:e.clientX,y:e.clientY};if(!D.q){D.q=requestAnimationFrame(()=>{paint();place(D.p.x,D.p.y)})}},{passive:false});
  document.addEventListener('pointerup',e=>{if(!D.el||e.pointerId!==D.id)return;if(!D.on){clearTimeout(D.t);Object.keys(D).forEach(k=>delete D[k]);return}D.p={x:e.clientX,y:e.clientY};place(e.clientX,e.clientY);finish(true)});
  document.addEventListener('pointercancel',e=>{if(D.el&&e.pointerId===D.id)finish(false)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&D.on)finish(false)});
  document.addEventListener('touchmove',e=>{if(D.on)e.preventDefault()},{passive:false});
  document.addEventListener('dragstart',e=>{if(e.target.closest&&e.target.closest('#kanban-view'))e.preventDefault()});
  document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('#kanban-view [data-kbshow]')){K.showDone=!K.showDone;draw();return}const c=e.target.closest&&e.target.closest('#kanban-view .kb-card');if(!c||Date.now()-(K.justDragged||0)<400)return;openDrawer(c.dataset.kb)});
  document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('#kanban-view [data-kbho]');if(!a||typeof hoView!=='function')return;e.preventDefault();e.stopPropagation();const c=A.cases.find(x=>String(x.id)===a.dataset.kbho);hoView((PH.m[a.dataset.kbho]||[]).map(n=>({src:phU(n),team:c?vol(c):'',at:null})),+a.dataset.i)},true);
  document.addEventListener('contextmenu',e=>{if(e.target.closest&&e.target.closest('#kanban-view .kb-card'))e.preventDefault()});
  return {draw};
})();
