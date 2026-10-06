/* โทรหาทีม: <i data-ic="phone"></i> โทร (โทรศัพท์) · <i data-ic="chat"></i> SMS (พร้อมรายละเอียดเคส) · โทรเสียง / วิดีโอคอลผ่านเน็ต (ห้องประชุมเว็บ)
   - โทรผ่านเน็ต: ระบบสร้างห้องแล้วส่ง "สายเข้า" ไปหน้าทีม (/team/) ทีมกดรับได้ทันที · ทีมไม่ได้เปิดหน้า ส่งลิงก์ทาง SMS / LINE ได้
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
  const KEY=()=>{try{return localStorage.getItem('uh_vol_key')||sessionStorage.getItem('uh_vol_key')||''}catch(e){return ''}};
  const who=()=>{try{return localStorage.getItem('uh_staff')||'ศูนย์'}catch(e){return 'ศูนย์'}};
  /* ข้อความแจ้งเคสสั้น ๆ สำหรับ SMS / LINE */
  function caseText(c){if(!c)return '';const where=[c.address,c.district?'เขต'+c.district:''].filter(Boolean).join(' · ');
    const pin=c.lat!==''&&c.lat!=null&&isFinite(+c.lat)?` แผนที่ https://maps.google.com/?q=${+c.lat},${+c.lng}`:'';
    return `Helpme+ แจ้งเคส #${c.id}: ${(c.needs||[]).join(', ')||'ขอความช่วยเหลือ'} · ${c.people||1} คน${where?' · '+where:''}${c.phone?' · ผู้แจ้ง '+String(c.phone).replace(/^'/,''):''}${pin}`}
  function buttons(t,opt={}){
    if(!t)return '';const k='tc'+(++seq);store.set(k,{t,opt});const p=tel(t.phone),ok=p.length>=9;
    return `<span class="call-row">${ok?`<a class="call-btn tel" href="tel:${esc(p)}" title="โทรหา ${esc(t.name)} ${esc(p)}"><i data-ic="phone"></i> โทร</a><a class="call-btn" href="${esc(sms(p,opt.caseText||'Helpme+: ติดต่อทีม '+t.name))}" title="ส่ง SMS"><i data-ic="chat"></i> SMS</a>`:'<span class="call-none">ยังไม่มีเบอร์ทีม</span>'}<button type="button" class="call-btn vid" data-tcall="${k}" data-mode="voice" title="โทรเสียงผ่านเน็ต · ทีมเห็นสายเข้าในหน้าทีม"><i data-ic="wifi"></i> โทรเน็ต</button><button type="button" class="call-btn vid" data-tcall="${k}" data-mode="video" title="วิดีโอคอลกับ ${esc(t.name)}"><i data-ic="video"></i> วิดีโอ</button>${typeof CHAT!=='undefined'?`<button type="button" class="call-btn" data-tchat="${esc(t.name)}" title="แชทกับ ${esc(t.name)}"><i data-ic="chat"></i> แชท</button>`:''}</span>`}
  function sheet(html){close();const bg=document.createElement('div');bg.className='tc-bg';bg.id='tc-bg';const d=document.createElement('div');d.className='tc-sheet';d.id='tc-sheet';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');
    d.innerHTML=html;document.body.append(bg,d);bg.onclick=close;d.querySelector('.tc-x').onclick=close;setTimeout(()=>d.querySelector('a,button:not(.tc-x)')?.focus(),30)}
  function close(){document.getElementById('tc-bg')?.remove();document.getElementById('tc-sheet')?.remove()}
  /* เปิดห้องวิดีโอคอลแล้วให้ส่งลิงก์ให้ทีม */
  async function video(t,opt={},mode='video'){
    const w=window.open('about:blank','_blank');if(w)w.opener=null;let url='';
    try{const r=await(await fetch('/api',{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'hq_call',key:KEY(),team:t.name,mode,name:who()})})).json();if(r.ok)url=r.link}catch(e){}
    const rang=!!url;if(!url)url=MEET+'Helpmeplus-'+rnd(12)+(mode==='voice'?'#config.startWithVideoMuted=true&config.startAudioOnly=true':'');
    if(w)w.location=url;else window.open(url,'_blank','noopener');
    const label=mode==='voice'?'โทรเสียง':'วิดีโอคอล';
    const p=tel(t.phone),msg=`Helpme+ ${label}จากศูนย์${opt.caseText?' เรื่อง '+opt.caseText:''} · กดเข้าห้อง: ${url}`;
    sheet(`<div class="tc-h"><b><i data-ic="${mode==='voice'?'wifi':'video'}"></i> ${label} ${esc(t.name)}</b><button type="button" class="tc-x" aria-label="ปิด"><i data-ic="close"></i></button></div>
      <p class="tc-sub">${rang?'ส่งสายเข้าไปหน้าทีมแล้ว · ถ้าทีมไม่ได้เปิดหน้าทีม ส่งลิงก์ด้านล่าง':'ส่งสายเข้าไม่ได้ · ส่งลิงก์ให้ทีมกดเข้าร่วม'}</p>
      <input class="tc-link" readonly value="${esc(url)}" aria-label="ลิงก์ห้องวิดีโอคอล">
      <div class="tc-acts">${p.length>=9?`<a class="btn primary" href="${esc(sms(p,msg))}"><i data-ic="chat"></i> ส่งทาง SMS</a>`:''}<a class="btn ghost" href="${esc(line(msg))}" target="_blank" rel="noopener">ส่งทาง LINE</a><button type="button" class="btn ghost" data-tc-copy>คัดลอกลิงก์</button>${navigator.share?'<button type="button" class="btn ghost" data-tc-share>แชร์…</button>':''}<a class="btn ghost" href="${esc(url)}" target="_blank" rel="noopener">เปิดห้องอีกครั้ง ↗</a></div>
      ${p.length>=9?`<p class="tc-sub">หรือโทรบอกทีมให้ดู SMS: <a href="tel:${esc(p)}"><i data-ic="phone"></i> ${esc(p)}</a></p>`:''}`);
    const d=document.getElementById('tc-sheet');
    d.querySelector('[data-tc-copy]').onclick=async e=>{try{await navigator.clipboard.writeText(url);e.target.textContent='คัดลอกแล้ว '}catch(err){d.querySelector('.tc-link').select()}};
    const sh=d.querySelector('[data-tc-share]');if(sh)sh.onclick=()=>navigator.share({title:'Helpme+ '+label,text:msg,url}).catch(()=>{})}
  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-tcall]');if(!b)return;e.preventDefault();e.stopPropagation();const v=store.get(b.dataset.tcall);if(v)video(v.t,v.opt,b.dataset.mode||'video')},true);
  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-tchat]');if(!b||typeof CHAT==='undefined')return;e.preventDefault();e.stopPropagation();close();CHAT.open(b.dataset.tchat)},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  return {buttons,video,caseText,close}
})();
