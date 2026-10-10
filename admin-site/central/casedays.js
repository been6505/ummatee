const CASEDAYS=(()=>{
  const D={n:14,day:null};
  const box=()=>document.getElementById('days-view');
  const key=t=>{const d=new Date(Number(t));return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const helpedAt=c=>Number(c.teamDoneAt)||(c.status==='done'?Number(c.doneAt||c.updatedAt)||0:0);
  const label=k=>{const [y,m,d]=k.split('-').map(Number),dt=new Date(y,m-1,d),t=key(Date.now()),yd=key(Date.now()-864e5);
    return (k===t?'วันนี้ · ':k===yd?'เมื่อวาน · ':'')+dt.toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'short'})};
  function list(){const st=$('#f-status');const keep=st.value;st.value='all';try{return filtered().filter(c=>!c.dupOf)}finally{st.value=keep}}
  function row(c,h){const s=sev(c);return `<button type="button" class="dv-case" data-dv="${esc(c.id)}"><span class="urg urg-${s}">${URG[s]}</span><b>${esc((c.needs||[]).slice(0,2).join(' · ')||'ขอความช่วยเหลือ')}</b><small>${esc(c.people||1)} คน${c.district?' · '+esc(c.district):''}${h&&c.volunteer?' · '+esc(String(c.volunteer).replace(/^'/,'')):''}</small><span class="dv-st st-${esc(stOf(c))}">${esc(ST[stOf(c)]||stOf(c))}</span></button>`}
  function draw(){const el=box();if(!el||el.hidden)return;const cs=list(),days=[];
    for(let i=0;i<D.n;i++){const t=Date.now()-i*864e5;days.push({k:key(t),inn:[],out:[]})}
    const by=new Map(days.map(d=>[d.k,d]));
    cs.forEach(c=>{const a=by.get(key(c.createdAt));if(a&&Number(c.createdAt))a.inn.push(c);const h=helpedAt(c);if(h){const b=by.get(key(h));if(b)b.out.push(c)}});
    const tin=days.reduce((s,d)=>s+d.inn.length,0),tout=days.reduce((s,d)=>s+d.out.length,0),max=Math.max(1,...days.map(d=>Math.max(d.inn.length,d.out.length)));
    const wait=cs.filter(c=>c.status==='open').length;
    if(D.day&&!by.has(D.day))D.day=null;
    const sel=D.day&&by.get(D.day);
    el.innerHTML=`<div class="dv-top"><div class="dv-sum"><div><small>เคสเข้ามา</small><b>${tin}</b></div><div class="ok"><small>ช่วยแล้ว</small><b>${tout}</b></div><div class="wt"><small>ยังรอตอนนี้</small><b>${wait}</b></div></div>
      <div class="seg dv-n" role="tablist" aria-label="ช่วงวัน">${[7,14,30].map(n=>`<button type="button" role="tab" data-dvn="${n}" aria-selected="${D.n===n}">${n} วัน</button>`).join('')}</div></div>
      <div class="dv-legend"><span class="i"></span>เข้ามา <span class="o"></span>ช่วยแล้ว</div>
      <div class="dv-chart">${days.slice().reverse().map(d=>`<button type="button" class="dv-bar${D.day===d.k?' on':''}" data-dvd="${d.k}" title="${esc(label(d.k))}: เข้ามา ${d.inn.length} · ช่วยแล้ว ${d.out.length}"><span class="dv-bs"><i class="i" style="height:${d.inn.length/max*100}%"><em>${d.inn.length||''}</em></i><i class="o" style="height:${d.out.length/max*100}%"><em>${d.out.length||''}</em></i></span><small>${new Date(d.k+'T00:00').getDate()}</small></button>`).join('')}</div>
      ${sel?`<section class="dv-day"><h3>${esc(label(sel.k))} <button type="button" class="btn ghost sm" data-dvd="${sel.k}" aria-label="ปิด"><i data-ic="close"></i></button></h3>
        <div class="dv-two"><div><h4>เข้ามา <span>${sel.inn.length}</span></h4>${sel.inn.sort((a,b)=>sev(b)-sev(a)).map(c=>row(c)).join('')||'<p class="muted small">ไม่มีเคสเข้ามา</p>'}</div>
        <div><h4 class="ok">ช่วยแล้ว <span>${sel.out.length}</span></h4>${sel.out.map(c=>row(c,1)).join('')||'<p class="muted small">ยังไม่มีเคสที่ช่วย</p>'}</div></div></section>`:''}
      <table class="dv-tbl"><thead><tr><th>วันที่</th><th>เข้ามา</th><th>ช่วยแล้ว</th><th>ส่วนต่าง</th></tr></thead><tbody>${days.map(d=>{const df=d.out.length-d.inn.length;return `<tr data-dvd="${d.k}" class="${D.day===d.k?'on':''}"><td>${esc(label(d.k))}</td><td>${d.inn.length}</td><td class="ok">${d.out.length}</td><td class="${df>0?'ok':df<0?'bad':''}">${df>0?'+':''}${df}</td></tr>`}).join('')}</tbody></table>`}
  document.addEventListener('click',e=>{const t=e.target;if(!t.closest||!t.closest('#days-view'))return;
    const n=t.closest('[data-dvn]');if(n){D.n=Number(n.dataset.dvn);draw();return}
    const c=t.closest('[data-dv]');if(c){openDrawer(c.dataset.dv);return}
    const d=t.closest('[data-dvd]');if(d){D.day=D.day===d.dataset.dvd?null:d.dataset.dvd;draw();if(D.day){const s=box().querySelector('.dv-day');if(s)s.scrollIntoView({behavior:'smooth',block:'nearest'})}}});
  return {draw};
})();
