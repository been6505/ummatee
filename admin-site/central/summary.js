/* การ์ดสรุปแบบหน้า "สรุป" ของ helpme4u.com: การ์ดดำ (% ช่วยเสร็จ · วงแหวน · ตัวเลขใหญ่) + สถานะตอนนี้ (จุดสี · แถบสัดส่วน · ตัวเลขคน)
   ใช้: hmSummary(el,{cases,title,online,teams,sev}) · ปุ่มสถานะมี data-cst="open|crit|going|done" ให้หน้าที่เรียกจับคลิกเอง */
function hmSummary(el,o){if(!el)return;const cases=(o.cases||[]).filter(c=>!c.dupOf),sev=o.sev||(c=>Math.min(3,Math.max(1,Number(c.urgency)||1)));
  const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=x=>Number(x).toLocaleString('th-TH'),pp=c=>Math.max(1,Number(c.people)||1),sum=l=>l.reduce((a,c)=>a+pp(c),0);
  const wait=t=>{const m=Math.max(0,Math.round((Date.now()-t)/60000));if(m<60)return m+' นาที';const h=Math.floor(m/60);return h<24?h+' ชม. '+(m%60)+' นาที':Math.floor(h/24)+' วัน'};
  const act=cases.filter(c=>c.status!=='done'),open=act.filter(c=>c.status!=='going'),going=act.filter(c=>c.status==='going'),done=cases.filter(c=>c.status==='done');
  const crit=open.filter(c=>sev(c)===3),urg=open.filter(c=>sev(c)>=2);
  const t0=new Date();t0.setHours(0,0,0,0);const doneToday=done.filter(c=>(c.doneAt||c.updatedAt)>=t0.getTime());
  const oldest=open.reduce((m,c)=>Math.min(m,c.createdAt||Infinity),Infinity),ppl=sum(crit);
  const pctv=cases.length?done.length/cases.length*100:0,pct=pctv.toFixed(1).replace(/\.0$/,''),now=new Date();
  const tm=now.toLocaleDateString('th-TH',{day:'numeric',month:'short'})+' '+now.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})+' น.';
  const seg=(x,c)=>x?`<i style="flex:${x};background:${c}"></i>`:'',clock=typeof ic==='function'?ic('clock'):'';
  const st=[[open.length,'รอช่วย','#2F3FC4','open'],[urg.length,'ด่วนมาก + วิกฤต','#D9473F','crit'],[going.length,'กำลังไป','#D4A537','going'],[done.length,'ช่วยแล้ว','#4C9A5A','done']];
  el.innerHTML=`<div class="wr-hero"><div class="wr-hero-top"><span>${e(o.title||'ภาพรวมทั้งหมด')}</span><span class="tm">${clock} ${e(tm)}</span></div>
    <div class="wr-hero-t"><div><b class="pc">${pct}<i>%</i></b><span>ของเคสช่วยเสร็จแล้ว</span></div>
      <div class="wr-ring"><svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18" fill="none" stroke="#8C98F5" stroke-width="4.5"/><circle cx="22" cy="22" r="18" fill="none" stroke="#6FD98A" stroke-width="4.5" pathLength="100" stroke-dasharray="${pctv.toFixed(2)} 100" transform="rotate(-90 22 22)"/></svg><div><b>${n(done.length)}</b><span>ช่วยแล้ว</span></div></div></div>
    <div class="wr-hero-n"><div><b>${n(cases.length)}</b><span>เคสทั้งหมด</span></div><div><b>${n(sum(cases))}</b><span>คนที่แจ้ง</span></div><div><b>${n(sum(done))}</b><span>คนได้รับการช่วย</span></div></div></div>
    <div class="wr-now"><div class="wr-now-h"><b>สถานะตอนนี้</b><span>แตะเพื่อดูรายการ</span></div>
      <div class="wr-st">${st.map(([v,l,c,f])=>`<button type="button" class="wr-sti" data-cst="${f}"><i style="background:${c}"></i><b>${n(v)}</b><span>${l}</span></button>`).join('')}</div>
      <div class="wr-bar" aria-hidden="true">${seg(open.length-crit.length,'#2D45C8')}${seg(crit.length,'#E5383B')}${seg(going.length,'#D4A017')}${seg(done.length,'#2E9E57')}${cases.length?'':'<i style="flex:1;background:var(--line,#e8e8ec)"></i>'}</div>
      <div class="wr-ppl"><div><b>${n(sum(open))}<small> คน</small></b><span>คนที่ยังรอ</span></div><div class="r"><b>${n(ppl)}<small> คน</small></b><span>คนในเคสวิกฤต</span></div>
        <div><b>${n(o.online||0)}<small> /${n(o.teams||0)} ทีม</small></b><span>ทีมออนไลน์</span></div><div><b>${n(doneToday.length)}<small> เคส</small></b><span>ช่วยแล้ววันนี้</span></div>
        <div><b>${isFinite(oldest)?wait(oldest):'–'}</b><span>เคสรอนานสุด</span></div></div></div>`}
