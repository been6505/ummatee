/* ตัวเลขสรุปใช้ computeStats จาก hm-stats.js (สูตรเดียวกับ helpme4u.com/#stats) · เคส HELP ME ใช้สถานะฝั่งเว็บ (hmStatus) · ส่งเบอร์โทรด้วย จึงตัดเคสซ้ำ (เบอร์เดียวกัน) ออกจากจำนวนคน */
function hmSummary(el,o){if(!el)return;const sev=c=>Math.min(4,Math.max(1,Number(c.urgency)||1)),R=computeStats((o.cases||[]).map(c=>({...c,status:c.hmStatus||c.status})),{sev});
  const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=x=>Math.round(Number(x)||0).toLocaleString('th-TH');
  const wait=ms=>{const m=Math.max(0,Math.round(ms/60000));if(m<60)return m+' นาที';const h=Math.floor(m/60);return h<24?h+' ชม. '+(m%60)+' นาที':Math.floor(h/24)+' วัน'};
  const {open,going,done,urgent,people,today,waits}=R,crit=open.filter(c=>sev(c)>=3),skipped=o.skipped!=null?o.skipped:R.skipped.length;
  const oldest=waits.oldestList.length?waits.oldestList[0].wait:null;
  const pctv=R.rate*100,pct=String(Math.round(R.rate*1000)/10),now=new Date();
  const tm=now.toLocaleDateString('th-TH',{day:'numeric',month:'short',timeZone:'Asia/Bangkok'})+' '+now.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'})+' น.';
  const seg=(x,c)=>x?`<i style="flex:${x};background:${c}"></i>`:'',clock=typeof ic==='function'?ic('clock'):'';
  const st=[[open.length,'รอช่วย','#2F3FC4','open'],[urgent.length,'ด่วนมาก + วิกฤต','#D9473F','crit'],[going.length,'กำลังไป','#D4A537','going'],[done.length,'ช่วยแล้ว','#4C9A5A','helped'],[skipped,'ไม่เข้าเกณฑ์','#9AA1AA','']];
  el.innerHTML=`<div class="wr-hero"><div class="wr-hero-top"><span>${e(o.title||'ภาพรวมทั้งหมด')}</span><span class="tm">${clock} ${e(tm)}</span></div>
    <div class="wr-hero-t"><div><b class="pc">${pct}<i>%</i></b><span>ของเคสช่วยเสร็จแล้ว</span></div>
      <div class="wr-ring"><svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18" fill="none" stroke="#8C98F5" stroke-width="4.5"/><circle cx="22" cy="22" r="18" fill="none" stroke="#6FD98A" stroke-width="4.5" pathLength="100" stroke-dasharray="${pctv.toFixed(2)} 100" transform="rotate(-90 22 22)"/></svg><div><b>${n(done.length)}</b><span>ช่วยแล้ว</span></div></div></div>
    <div class="wr-hero-n"><div><b>${n(R.total)}</b><span>เคสทั้งหมด</span></div><div><b>${n(people.all)}</b><span>คนที่แจ้ง</span></div><div><b>${n(people.doneUnique)}</b><span>คนได้รับการช่วย</span></div></div></div>
    <div class="wr-now"><div class="wr-now-h"><b>สถานะตอนนี้</b><span>แตะเพื่อดูรายการ</span></div>
      <div class="wr-st">${st.map(([v,l,c,f])=>`<button type="button" class="wr-sti"${f?` data-cst="${f}"`:''}><i style="background:${c}"></i><b>${n(v)}</b><span>${l}</span></button>`).join('')}</div>
      <div class="wr-bar" aria-hidden="true">${seg(open.length-crit.length,'#2D45C8')}${seg(crit.length,'#E5383B')}${seg(going.length,'#D4A017')}${seg(done.length,'#2E9E57')}${R.total?'':'<i style="flex:1;background:var(--line,#e8e8ec)"></i>'}</div>
      <div class="wr-ppl"><div><b>${n(people.actUnique)}<small> คน</small></b><span>คนที่ยังรอ</span></div><div class="r"><b>${n(people.urgent)}<small> คน</small></b><span>คนในเคสด่วน</span></div>
        <div><b>${n(o.online||0)}<small> /${n(o.teams||0)} ทีม</small></b><span>ทีมออนไลน์</span></div><div><b>${n(today.done)}<small> เคส</small></b><span>ช่วยแล้ววันนี้</span></div>
        <div><b>${oldest!=null?wait(oldest):'–'}</b><span>เคสรอนานสุด</span></div><div class="nw"><b>${n(today.newN)}<small> เคส</small></b><span>เคสใหม่วันนี้</span></div></div></div>`}
