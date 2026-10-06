/* โทรหาทีม: <i data-ic="phone"></i> โทร (โทรศัพท์) · <i data-ic="chat"></i> SMS (พร้อมรายละเอียดเคส) · <i data-ic="video"></i> วิดีโอคอล (ห้องประชุมเว็บ + ส่งลิงก์ให้ทีม)
   - วิดีโอคอลใช้ Jitsi สาธารณะ meet.ffmuc.net (ไม่ต้องล็อกอิน ไม่จำกัดเวลา) เปิดในแท็บใหม่ ชื่อห้องสุ่มเดาไม่ได้
     (meet.jit.si ต้องล็อกอินผู้สร้างห้อง และถ้าฝังในหน้าเว็บจะตัดสายที่ 5 นาที · ffmuc ฝังในหน้าเว็บไม่ได้)
   - ทีมไม่มีแอปรับสาย: ระบบส่งลิงก์ห้องให้ทาง SMS / LINE / คัดลอก
   ใช้: TEAMCALL.buttons(team,{caseText}) คืน HTML ปุ่ม · TEAMCALL.open(team,{caseText}) เปิดแผ่นโทร */
const TEAMCALL=(()=>{
  const MEET='https://meet.ffmuc.net/';
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tel=p=>String(p||'').replace(/^'/,'').replace(/[^\d+]/g,'');
  const rnd=n=>{const a=new Uint8Array(n);crypto.getRandomValues(a);return [...a].map(b=>'abcdefghjkmnpqrstuvwxyz23456789'[b%31]).join('')};
  const sms=(p,body)=>`sms:${tel(p)}${/iPhone|iPad|Mac/.test(navigator.userAgent)?'&':'?'}body=${encodeURIComponent(body)}`;
  const line=t=>'https://line.me/R/share?text='+encodeURIComponent(t);
  const store=new Map();let seq=0;
  /* ข้อความแจ้งเคสสั้น ๆ สำหรับ SMS / LINE */
  function caseText(c){if(!c)return '';const where=[c.address,c.district?'เขต'+c.district:''].filter(Boolean).join(' · ');
    const pin=c.lat!==''&&c.lat!=null&&isFinite(+c.lat)?` แผนที่ https://maps.google.com/?q=${+c.lat},${+c.lng}`:'';
    return `Helpme+ แจ้งเคส #${c.id}: ${(c.needs||[]).join(', ')||'ขอความช่วยเหลือ'} · ${c.people||1} คน${where?' · '+where:''}${c.phone?' · ผู้แจ้ง '+String(c.phone).replace(/^'/,''):''}${pin}`}
  function buttons(t,opt={}){
    if(!t)return '';const k='tc'+(++seq);store.set(k,{t,opt});const p=tel(t.phone),ok=p.length>=9;
    return `<span class="call-row">${ok?`<a class="call-btn tel" href="tel:${esc(p)}" title="โทรหา ${esc(t.name)} ${esc(p)}"><i data-ic="phone"></i> โทร</a><a class="call-btn" href="${esc(sms(p,opt.caseText||'Helpme+: ติดต่อทีม '+t.name))}" title="ส่ง SMS"><i data-ic="chat"></i> SMS</a>`:'<span class="call-none">ยังไม่มีเบอร์ทีม</span>'}<button type="button" class="call-btn vid" data-tcall="${k}" title="วิดีโอคอลกับ ${esc(t.name)}"><i data-ic="video"></i> วิดีโอคอล</button>${typeof CHAT!=='undefined'?`<button type="button" class="call-btn" data-tchat="${esc(t.name)}" title="แชทกับ ${esc(t.name)}"><i data-ic="chat"></i> แชท</button>`:''}</span>`}
  function sheet(html){close();const bg=document.createElement('div');bg.className='tc-bg';bg.id='tc-bg';const d=document.createElement('div');d.className='tc-sheet';d.id='tc-sheet';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');
    d.innerHTML=html;document.body.append(bg,d);bg.onclick=close;d.querySelector('.tc-x').onclick=close;setTimeout(()=>d.querySelector('a,button:not(.tc-x)')?.focus(),30)}
  function close(){document.getElementById('tc-bg')?.remove();document.getElementById('tc-sheet')?.remove()}
  /* เปิดห้องวิดีโอคอลแล้วให้ส่งลิงก์ให้ทีม */
  function video(t,opt={}){
    const url=MEET+'Helpmeplus-'+rnd(12);window.open(url,'_blank','noopener');
    const p=tel(t.phone),msg=`Helpme+ เรียกวิดีโอคอลจากหลังบ้าน${opt.caseText?' เรื่อง '+opt.caseText:''} · กดเข้าห้อง: ${url}`;
    sheet(`<div class="tc-h"><b><i data-ic="video"></i> ส่งลิงก์ห้องให้ ${esc(t.name)}</b><button type="button" class="tc-x" aria-label="ปิด"><i data-ic="close"></i></button></div>
      <p class="tc-sub">เปิดห้องในแท็บใหม่แล้ว ส่งลิงก์นี้ให้ทีมกดเข้าร่วม (ใช้ได้ทั้งมือถือและคอม ไม่ต้องสมัคร)</p>
      <input class="tc-link" readonly value="${esc(url)}" aria-label="ลิงก์ห้องวิดีโอคอล">
      <div class="tc-acts">${p.length>=9?`<a class="btn primary" href="${esc(sms(p,msg))}"><i data-ic="chat"></i> ส่งทาง SMS</a>`:''}<a class="btn ghost" href="${esc(line(msg))}" target="_blank" rel="noopener">ส่งทาง LINE</a><button type="button" class="btn ghost" data-tc-copy>คัดลอกลิงก์</button>${navigator.share?'<button type="button" class="btn ghost" data-tc-share>แชร์…</button>':''}<a class="btn ghost" href="${esc(url)}" target="_blank" rel="noopener">เปิดห้องอีกครั้ง ↗</a></div>
      ${p.length>=9?`<p class="tc-sub">หรือโทรบอกทีมให้ดู SMS: <a href="tel:${esc(p)}"><i data-ic="phone"></i> ${esc(p)}</a></p>`:''}`);
    const d=document.getElementById('tc-sheet');
    d.querySelector('[data-tc-copy]').onclick=async e=>{try{await navigator.clipboard.writeText(url);e.target.textContent='คัดลอกแล้ว '}catch(err){d.querySelector('.tc-link').select()}};
    const sh=d.querySelector('[data-tc-share]');if(sh)sh.onclick=()=>navigator.share({title:'Helpme+ วิดีโอคอล',text:msg,url}).catch(()=>{})}
  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-tcall]');if(!b)return;e.preventDefault();e.stopPropagation();const v=store.get(b.dataset.tcall);if(v)video(v.t,v.opt)},true);
  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-tchat]');if(!b||typeof CHAT==='undefined')return;e.preventDefault();e.stopPropagation();close();CHAT.open(b.dataset.tchat)},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  return {buttons,video,caseText,close}
})();
