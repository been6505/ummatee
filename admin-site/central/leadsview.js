/* แท็บ "จัดการเคส": สลับระหว่าง เคสในระบบ กับ เคสจากโซเชียลรอคัด (หน้า admin/leads ฝังในกรอบ)
   - admin.html#leads เปิดมุมมองรอคัดทันที (ลิงก์จากแดชบอร์ด)
   - กรอบส่งข้อความกลับมา: count = จำนวนรอคัด, accepted = รับเป็นเคสแล้ว (โหลดเคสใหม่), openCase = เปิดเคสในหน้านี้
   ใช้ตัวแปรจาก admin.js: A, api, load, openDrawer */
(()=>{
  const sw=document.querySelector('.view-sw'),box=document.getElementById('leads-view'),badge=document.getElementById('leads-n');
  if(!sw||!box)return;
  const caseParts=['#stats','.bar','#map-wrap','#list'].map(s=>document.querySelector(s)).filter(Boolean);
  let frame=null;
  function setBadge(n){badge.hidden=!n;badge.textContent=n>99?'99+':String(n)}
  function show(view){
    const leads=view==='leads',board=view==='board',kb=document.getElementById('kanban-view');
    sw.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.view===view)));
    caseParts.forEach(e=>{e.hidden=leads||(board&&!e.matches('.bar'))});box.hidden=!leads;
    document.body.classList.toggle('kb-on',board);if(kb){kb.hidden=!board;if(board&&typeof KANBAN!=='undefined')KANBAN.draw()}
    if(leads&&!frame){frame=document.createElement('iframe');frame.src='./central/leads/?embed=1';frame.title='เคสจากโซเชียลรอคัด';frame.className='leads-frame';box.append(frame)}
    if(view==='cases')setTimeout(()=>window.dispatchEvent(new Event('resize')),60);
    const h=leads?'#leads':board?'#board':'';if(location.hash!==h)history.replaceState(null,'',location.pathname+h)}
  sw.addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)show(b.dataset.view)});
  window.addEventListener('message',e=>{
    if(e.origin!==location.origin||!e.data||e.data.src!=='uh-leads')return;
    const m=e.data;
    if(m.type==='count')setBadge(m.n);
    if(m.type==='accepted'&&typeof load==='function')load();
    if(m.type==='openCase'){show('cases');const has=()=>typeof findCase==='function'?!!findCase(m.id):A.cases.some(c=>c.id===m.id),go=()=>{if(has())openDrawer(m.id)};
      if(has())go();else Promise.resolve(load()).then(()=>setTimeout(go,300))}});
  // จำนวนรอคัดบนปุ่ม (ไม่ต้องเปิดมุมมองก่อน)
  async function count(){if(!A.key)return;try{const r=await api({action:'leads',key:A.key,days:30});if(r&&r.ok)setBadge(r.leads.filter(l=>l.status==='new').length)}catch(e){}}
  count();setInterval(()=>{if(!document.hidden&&box.hidden)count()},120000);
  if(location.hash==='#leads')show('leads');else if(location.hash==='#board')show('board');
})();
