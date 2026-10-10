/* หน้าจัดการเคส · มุมมอง "บอร์ด": เคสเป็นการ์ดในคอลัมน์สถานะ · ลากการ์ดไปคอลัมน์อื่นเพื่อเปลี่ยนสถานะ
   รอความช่วยเหลือ → ทีมกำลังไป (เลือกทีมตอนวาง) → ช่วยเหลือแล้ว (รอปิดเคส) → ปิดเคส
   ลากได้ทั้งเมาส์และนิ้ว (แตะค้างเล็กน้อยแล้วลาก) · แตะการ์ด = เปิดรายละเอียดเคส · ใช้ตัวกรอง/ค้นหาเดียวกับรายการ
   ใช้ตัวแปรจาก admin.js: A, filtered, sev, URG, stOf, changeStatus, openDrawer, loadRoster, esc, toast, ago */
const KANBAN=(()=>{
  const COLS=[['open','รอความช่วยเหลือ'],['going','ทีมกำลังไป'],['helped','ช่วยเหลือแล้ว · รอปิด'],['done','ปิดเคส (24 ชม.)']];
  const K={drag:null,ghost:null,timer:null,start:null,moved:false};
  const box=()=>document.getElementById('kanban-view');
  const vol=c=>String(c.volunteer||'').replace(/^'/,'').trim();
  function list(){const st=$('#f-status');const keep=st.value;st.value='all';let cs;try{cs=filtered()}finally{st.value=keep}
    const day=Date.now()-864e5;return cs.filter(c=>!c.dupOf&&(c.status!=='done'||Number(c.doneAt||c.updatedAt||0)>day))}
  function card(c){const s=sev(c),p=(c.photos||[])[0];
    return `<article class="kb-card u${s}" data-kb="${esc(c.id)}" draggable="true">
      ${p?`<img class="kb-img" alt="" loading="lazy" src="https://drive.google.com/thumbnail?id=${encodeURIComponent(p)}&sz=w200">`:''}
      <div class="kb-tx"><span class="urg urg-${s}">${URG[s]}</span><b>${esc((c.needs||[]).slice(0,2).join(' · ')||'ขอความช่วยเหลือ')}</b>
      <small>${esc(c.people||1)} คน${c.district?' · '+esc(c.district):''}</small>${vol(c)&&c.status!=='open'?`<small class="kb-team"><i data-ic="users"></i> ${esc(vol(c))}</small>`:''}
      ${c.teamIssue&&c.status==='going'?`<small class="kb-iss">ทีมแจ้ง: ${esc(c.teamIssue.split(' · ')[0])}</small>`:''}<small class="kb-ago">${esc(ago(c.createdAt))}</small></div></article>`}
  function draw(){const el=box();if(!el||el.hidden)return;if(K.drag||K.ghost||document.querySelector('.kb-pick')){K.pend=true;return}K.pend=false;const sx=(el.querySelector('.kb-cols')||{}).scrollLeft||0,sy=[...el.querySelectorAll('.kb-list')].map(x=>x.scrollTop);const cs=list();
    el.innerHTML=`<p class="kb-tip">ลากการ์ดเพื่อเปลี่ยนสถานะ (มือถือ: แตะค้างแล้วลาก) · แตะ = ดูรายละเอียด</p><div class="kb-cols">${COLS.map(([k,t])=>{const xs=cs.filter(c=>stOf(c)===k).sort((a,b)=>sev(b)-sev(a)||Number(a.createdAt)-Number(b.createdAt));
      return `<section class="kb-col kb-${k}" data-kbcol="${k}"><h3>${t} <span>${xs.length}</span></h3><div class="kb-list">${xs.slice(0,150).map(card).join('')||'<p class="kb-empty">วางการ์ดที่นี่</p>'}${xs.length>150?`<p class="kb-empty">+${xs.length-150} เคส · ใช้ตัวกรองเพื่อดูเพิ่ม</p>`:''}</div></section>`}).join('')}</div>`;
    const nc=el.querySelector('.kb-cols');if(nc)nc.scrollLeft=sx;el.querySelectorAll('.kb-list').forEach((x,i)=>{x.scrollTop=sy[i]||0});
    if(typeof ic==='function')el.querySelectorAll('i[data-ic]').forEach(i=>{i.outerHTML=ic(i.dataset.ic)})}
  /* วางลงคอลัมน์ */
  async function drop(id,to){const c=A.cases.find(x=>String(x.id)===String(id));if(!c||stOf(c)===to)return;
    if((to==='going'&&!(stOf(c)==='helped'&&vol(c)))||(to==='helped'&&(!vol(c)||c.status!=='going'))){const team=await pickTeam(c);if(!team)return;await changeStatus(c.id,to,null,team)}
    else if(to==='done'){if(!c.teamDoneAt&&c.status==='going'&&!confirm('ทีมยังไม่ได้แจ้งว่าช่วยเหลือแล้ว · ปิดเคสเลยหรือไม่?'))return;await changeStatus(c.id,'done')}
    else if(to==='open'){if(c.status!=='open'&&!confirm('คืนเคสเป็น "รอความช่วยเหลือ" และเอาออกจากทีม?'))return;await changeStatus(c.id,'open')}
    else await changeStatus(c.id,to);
    draw()}
  /* เลือกทีมตอนวางลง "ทีมกำลังไป" */
  function pickTeam(c){return new Promise(async res=>{if(!A.roster)await loadRoster();
    const d=document.createElement('dialog');d.className='kb-pick';const load={};A.cases.forEach(x=>{if(x.status==='going'&&vol(x))load[vol(x)]=(load[vol(x)]||0)+1});
    const RS={ready:'ว่าง',out:'ออกปฏิบัติ',rest:'พัก'},teams=(A.roster||[]).filter(t=>t.status!=='rest');
    d.innerHTML=`<h3>มอบเคสให้ทีม</h3><p class="muted small">${esc((c.needs||[]).join(' · ')||'เคส')} · ${esc(c.district||'')}</p><div class="kb-teams">${teams.map(t=>`<button type="button" data-t="${esc(t.name)}"><b>${esc(t.name)}</b><small>${esc(RS[t.status]||'')}${load[t.name]?' · มีงาน '+load[t.name]+' เคส':''}</small></button>`).join('')||'<p class="muted">ยังไม่มีทีม · สร้างทีมได้ในรายละเอียดเคส</p>'}</div><button type="button" class="btn ghost" data-x>ยกเลิก</button>`;
    document.body.append(d);d.showModal();
    d.onclick=e=>{const b=e.target.closest('[data-t]');if(b){d.close();res(b.dataset.t)}else if(e.target.closest('[data-x]')||e.target===d){d.close();res(null)}};d.onclose=()=>{d.remove();res(null);if(K.pend)setTimeout(draw,50)}})}
  /* ลาก: เมาส์ (HTML5) */
  document.addEventListener('dragstart',e=>{const c=e.target.closest&&e.target.closest('#kanban-view .kb-card');if(!c)return;K.drag=c.dataset.kb;e.dataTransfer.effectAllowed='move';c.classList.add('dragging')});
  document.addEventListener('dragend',e=>{K.drag=null;if(K.pend)setTimeout(draw,50);document.querySelectorAll('.kb-card.dragging').forEach(x=>x.classList.remove('dragging'));document.querySelectorAll('.kb-col.over').forEach(x=>x.classList.remove('over'))});
  document.addEventListener('dragover',e=>{const col=e.target.closest&&e.target.closest('#kanban-view [data-kbcol]');if(!col||!K.drag)return;e.preventDefault();document.querySelectorAll('.kb-col.over').forEach(x=>x!==col&&x.classList.remove('over'));col.classList.add('over')});
  document.addEventListener('drop',e=>{const col=e.target.closest&&e.target.closest('#kanban-view [data-kbcol]');if(!col||!K.drag)return;e.preventDefault();const id=K.drag;K.drag=null;col.classList.remove('over');drop(id,col.dataset.kbcol)});
  /* ลาก: นิ้ว (แตะค้าง 250 มิลลิวินาที แล้วลาก) */
  document.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;const c=e.target.closest&&e.target.closest('#kanban-view .kb-card');if(!c)return;K.start={x:e.clientX,y:e.clientY,id:c.dataset.kb,el:c};K.moved=false;
    clearTimeout(K.timer);K.timer=setTimeout(()=>{if(!K.start)return;const r=c.getBoundingClientRect();K.ghost=c.cloneNode(true);K.ghost.className+=' kb-ghost';K.ghost.style.width=r.width+'px';document.body.append(K.ghost);c.classList.add('dragging');try{navigator.vibrate&&navigator.vibrate(20)}catch(err){}move(e.clientX,e.clientY)},250)},{passive:true});
  function move(x,y){if(!K.ghost)return;K.ghost.style.transform=`translate(${x-K.ghost.offsetWidth/2}px,${y-30}px)`;const col=document.elementFromPoint(x,y);document.querySelectorAll('.kb-col.over').forEach(c=>c.classList.remove('over'));const kc=col&&col.closest&&col.closest('#kanban-view [data-kbcol]');if(kc)kc.classList.add('over');
    const cols=document.querySelector('#kanban-view .kb-cols');if(cols){const r=cols.getBoundingClientRect();if(x>r.right-40)cols.scrollLeft+=14;else if(x<r.left+40)cols.scrollLeft-=14}}
  document.addEventListener('pointermove',e=>{if(!K.start)return;if(!K.ghost){if(Math.hypot(e.clientX-K.start.x,e.clientY-K.start.y)>10){clearTimeout(K.timer);K.start=null}return}e.preventDefault();K.moved=true;move(e.clientX,e.clientY)},{passive:false});
  const end=e=>{clearTimeout(K.timer);if(K.ghost){const col=document.elementFromPoint(e.clientX,e.clientY),kc=col&&col.closest&&col.closest('#kanban-view [data-kbcol]'),id=K.start&&K.start.id;K.ghost.remove();K.ghost=null;document.querySelectorAll('.kb-card.dragging,.kb-col.over').forEach(x=>x.classList.remove('dragging','over'));K.start=null;if(kc&&id)drop(id,kc.dataset.kbcol);else if(K.pend)draw();K.justDragged=Date.now();return}K.start=null};
  document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end);
  document.addEventListener('touchmove',e=>{if(K.ghost)e.preventDefault()},{passive:false});
  document.addEventListener('click',e=>{const c=e.target.closest&&e.target.closest('#kanban-view .kb-card');if(!c||Date.now()-(K.justDragged||0)<400)return;openDrawer(c.dataset.kb)});
  document.addEventListener('contextmenu',e=>{if(e.target.closest&&e.target.closest('#kanban-view .kb-card'))e.preventDefault()});
  return {draw};
})();
