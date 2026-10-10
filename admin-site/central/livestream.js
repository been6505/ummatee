/* CENTRAL แบบเรียลไทม์ (Server-Sent Events · สายเดียวต่อหน้า) · โหลดในทุกหน้า CENTRAL
   - ตำแหน่ง + ข้อมูลเครื่องของทีม: LIVE.start(rows=>...) ได้เฉพาะทีมที่ขยับ ทันทีที่เซิร์ฟเวอร์ได้จุดใหม่
   - ข้อมูลเปลี่ยน (เคส/ทีม/สต็อก = rev · แชท = chat): ส่งเหตุการณ์ 'hm-rev' ให้ทุกหน้าโหลดใหม่ทันที (window.addEventListener('hm-rev', e=>e.detail.what))
   - LIVE.ok() = เชื่อมต่ออยู่ (หน้าเว็บลดการถามซ้ำลง) · ซ่อนแท็บ = ตัดสาย · กลับมา = ต่อใหม่ (ส่งค่าล่าสุดที่รู้ไป ไม่พลาดการเปลี่ยนแปลงระหว่างหลุด) */
const LIVE=(()=>{let es=null,cbs=[],since=0,rev='',chat='';
  const key=()=>{try{return (typeof ADM!=='undefined'&&ADM.key)||(typeof A!=='undefined'&&A.key)||localStorage.getItem('uh_vol_key')||sessionStorage.getItem('uh_vol_key')||''}catch(e){return ''}};
  function open(){if(!window.EventSource||!key()||document.hidden)return;close();
    es=new EventSource('/api?'+new URLSearchParams({action:'live_stream',key:key(),since,rev,chat}));
    es.onmessage=e=>{let rows;try{rows=JSON.parse(e.data)}catch(x){return}if(!Array.isArray(rows)||!rows.length)return;
      since=Math.max(since,...rows.map(r=>Number(r.updatedAt)||0));cbs.forEach(f=>{try{f(rows)}catch(x){}})};
    es.addEventListener('rev',e=>{let m;try{m=JSON.parse(e.data)}catch(x){return}const base=!rev&&!chat,what=[];if((m.rev||'')!==rev)what.push('rev');if((m.chat||'')!==chat)what.push('chat');
      rev=m.rev||'';chat=m.chat||'';if(!base&&what.length)window.dispatchEvent(new CustomEvent('hm-rev',{detail:{rev,chat,what}}))})}
  function close(){if(es){es.close();es=null}}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)close();else open()});
  const boot=()=>{if(key())open();else setTimeout(boot,2000)};setTimeout(boot,800);
  return {start(f){if(f)cbs.push(f);if(!es)open()},ok:()=>!!(es&&es.readyState===1),reopen:open}})();
/* รวมจุดใหม่เข้ารายการตำแหน่งเดิม (แทนที่ตามชื่อทีม) */
function mergeLive(list,rows){const m=new Map((list||[]).map(l=>[l.team,l]));rows.forEach(r=>m.set(r.team,{...(m.get(r.team)||{}),...r}));return [...m.values()]}
