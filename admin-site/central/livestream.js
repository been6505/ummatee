/* ตำแหน่งทีมแบบเรียลไทม์ (Server-Sent Events) · ใช้ร่วม: หน้าจัดทีม + War Room
   LIVE.start(rows=>...) ได้เฉพาะทีมที่ขยับ ทันทีที่เซิร์ฟเวอร์ได้จุดใหม่ · LIVE.ok() = เชื่อมต่ออยู่ (หน้าเว็บลดการถามซ้ำลง)
   ซ่อนแท็บ = ตัดการเชื่อมต่อ (ประหยัด) · กลับมา = ต่อใหม่ · เบราว์เซอร์ที่ไม่มี EventSource ใช้การถามซ้ำแบบเดิม */
const LIVE=(()=>{let es=null,cb=null,since=0;
  function open(){if(!window.EventSource||!ADM.key||document.hidden)return;close();
    es=new EventSource(API_URL+'?'+new URLSearchParams({action:'live_stream',key:ADM.key,since}));
    es.onmessage=e=>{let rows;try{rows=JSON.parse(e.data)}catch(x){return}if(!Array.isArray(rows)||!rows.length)return;
      since=Math.max(since,...rows.map(r=>Number(r.updatedAt)||0));try{cb&&cb(rows)}catch(x){}}}
  function close(){if(es){es.close();es=null}}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)close();else if(cb)open()});
  return {start(f){cb=f;open()},ok:()=>!!(es&&es.readyState===1)}})();
/* รวมจุดใหม่เข้ารายการตำแหน่งเดิม (แทนที่ตามชื่อทีม) */
function mergeLive(list,rows){const m=new Map((list||[]).map(l=>[l.team,l]));rows.forEach(r=>m.set(r.team,{...(m.get(r.team)||{}),...r}));return [...m.values()]}
