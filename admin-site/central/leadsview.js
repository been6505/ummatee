(()=>{
  const sw=document.querySelector('.view-sw'),box=document.getElementById('leads-view'),badge=document.getElementById('leads-n');
  if(!sw||!box)return;
  const caseParts=['#stats','.bar','#map-wrap','#list'].map(s=>document.querySelector(s)).filter(Boolean);
  let frame=null;
  function setBadge(n){badge.hidden=!n;badge.textContent=n>99?'99+':String(n)}
  function show(view){
    const leads=view==='leads',kbv=view==='board',dys=view==='days',board=kbv||dys,kb=document.getElementById('kanban-view'),dv=document.getElementById('days-view');
    sw.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.view===view)));
    caseParts.forEach(e=>{e.hidden=leads||(board&&!e.matches('.bar'))});box.hidden=!leads;
    {const bar=document.querySelector('.bar'),slot=document.getElementById('bar-slot');if(bar&&slot){if(!bar._home){bar._home=document.createComment('bar');bar.before(bar._home)}if(board)slot.append(bar);else bar._home.after(bar);slot.hidden=!board}}
    document.body.classList.toggle('kb-on',kbv);document.body.classList.toggle('dv-on',dys);if(kb){kb.hidden=!kbv;if(kbv&&typeof KANBAN!=='undefined')KANBAN.draw()}if(dv){dv.hidden=!dys;if(dys&&typeof CASEDAYS!=='undefined')CASEDAYS.draw()}
    if(leads&&!frame){frame=document.createElement('iframe');frame.src='./central/leads/?embed=1';frame.title='เคสจากโซเชียลรอคัด';frame.className='leads-frame';box.append(frame)}
    if(view==='cases')setTimeout(()=>window.dispatchEvent(new Event('resize')),60);
    const h=leads?'#leads':kbv?'#board':dys?'#days':'';if(location.hash!==h)history.replaceState(null,'',location.pathname+h)}
  sw.addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)show(b.dataset.view)});
  window.addEventListener('message',e=>{
    if(e.origin!==location.origin||!e.data||e.data.src!=='uh-leads')return;
    const m=e.data;
    if(m.type==='count')setBadge(m.n);
    if(m.type==='accepted'&&typeof load==='function')load();
    if(m.type==='openCase'){show('cases');const has=()=>typeof findCase==='function'?!!findCase(m.id):A.cases.some(c=>c.id===m.id),go=()=>{if(has())openDrawer(m.id)};
      if(has())go();else Promise.resolve(load()).then(()=>setTimeout(go,300))}});
  async function count(){if(!A.key)return;try{const r=await api({action:'leads',key:A.key,days:30});if(r&&r.ok)setBadge(r.leads.filter(l=>l.status==='new').length)}catch(e){}}
  count();setInterval(()=>{if(!document.hidden&&box.hidden)count()},120000);
  if(location.hash==='#leads')show('leads');else if(location.hash==='#board')show('board');else if(location.hash==='#days')show('days');
})();
