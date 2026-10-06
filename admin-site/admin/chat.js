/* แชทกับทีม (ฝั่งศูนย์) — ฟองแชทมุมขวาล่างของทุกหน้าหลังบ้าน
   - รายชื่อห้องแชทของทุกทีม + ตัวเลขข้อความที่ยังไม่อ่าน · เลือกทีมจากรายชื่อทีม (roster) เพื่อเริ่มคุยใหม่ได้
   - ดึงข้อความใหม่ทุก 5 วิ ตอนเปิดหน้าต่าง (นอกนั้นทุก 20 วิ เพื่อเช็กตัวเลข)
   - ทีมคุยจากหน้า /team/ (มือถือ) ด้วยรหัสทีมเดียวกัน
   ใช้: CHAT.open(teamName) เปิดห้องของทีมนั้น (เช่นจากปุ่ม 💬 แชท บนการ์ดทีม) */
const CHAT=(()=>{
  const KEY=()=>{try{return localStorage.getItem('uh_vol_key')||sessionStorage.getItem('uh_vol_key')||''}catch(e){return ''}};
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const me=()=>{try{return localStorage.getItem('uh_staff')||localStorage.getItem('uh_team')||'ศูนย์'}catch(e){return 'ศูนย์'}};
  const S={open:false,team:null,threads:[],roster:[],msgs:[],last:0,rev:null,timer:null,unread:0};
  const api=async p=>{const r=await fetch('/api?'+new URLSearchParams({...p,key:KEY(),t:Date.now()}),{cache:'no-store'});return r.json()};
  const post=async b=>{const r=await fetch('/api',{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...b,key:KEY()})});return r.json()};
  const hhmm=t=>new Date(t).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
  const day=t=>new Date(t).toLocaleDateString('th-TH',{day:'numeric',month:'short'});
  let root;
  function build(){
    root=document.createElement('div');root.className='chat-root';
    root.innerHTML=`<button type="button" class="chat-fab" aria-label="แชทกับทีม" aria-expanded="false">💬<b class="chat-badge" hidden></b></button>
      <section class="chat-win" hidden aria-label="แชทกับทีม">
        <header class="chat-h"><button type="button" class="chat-back" aria-label="กลับไปรายชื่อทีม" hidden>‹</button><b class="chat-title">แชทกับทีม</b><a class="chat-share" target="_blank" rel="noopener" hidden title="ลิงก์หน้าแชทสำหรับทีม">🔗 ลิงก์ทีม</a><button type="button" class="chat-x" aria-label="ปิด">✕</button></header>
        <div class="chat-list"></div>
        <div class="chat-msgs" hidden aria-live="polite"></div>
        <form class="chat-form" hidden><input class="chat-in" maxlength="1000" placeholder="พิมพ์ข้อความถึงทีม…" aria-label="ข้อความ" autocomplete="off"><button class="chat-send" type="submit" aria-label="ส่ง">➤</button></form>
      </section>`;
    document.body.append(root);
    root.querySelector('.chat-fab').onclick=()=>toggle();
    root.querySelector('.chat-x').onclick=()=>toggle(false);
    root.querySelector('.chat-back').onclick=()=>{S.team=null;view()};
    root.querySelector('.chat-list').onclick=e=>{const b=e.target.closest('[data-chat-team]');if(b)openTeam(b.dataset.chatTeam)};
    root.querySelector('.chat-form').onsubmit=async e=>{e.preventDefault();const i=root.querySelector('.chat-in'),t=i.value.trim();if(!t||!S.team)return;i.value='';
      S.msgs.push({n:0,sender:'hq',name:me(),text:t,at:Date.now(),pending:true});drawMsgs();
      try{const r=await post({action:'chat_send',team:S.team,from:'hq',name:me(),text:t});if(!r.ok)throw 0}catch(err){i.value=t}poll(true)}}
  function toggle(on){S.open=on==null?!S.open:on;root.querySelector('.chat-win').hidden=!S.open;root.querySelector('.chat-fab').setAttribute('aria-expanded',String(S.open));if(S.open){view();poll(true)}schedule()}
  function view(){const inTeam=!!S.team;root.querySelector('.chat-list').hidden=inTeam;root.querySelector('.chat-msgs').hidden=!inTeam;root.querySelector('.chat-form').hidden=!inTeam;
    root.querySelector('.chat-back').hidden=!inTeam;root.querySelector('.chat-title').textContent=inTeam?S.team:'แชทกับทีม';
    const sh=root.querySelector('.chat-share');sh.hidden=!inTeam;if(inTeam)sh.href='/team/?t='+encodeURIComponent(S.team);
    if(inTeam){drawMsgs();setTimeout(()=>root.querySelector('.chat-in').focus(),30)}else drawList()}
  function drawList(){const known=new Set(S.threads.map(t=>t.team));
    const others=S.roster.map(r=>r.name).filter(n=>n&&!known.has(n));
    root.querySelector('.chat-list').innerHTML=(S.threads.length?S.threads.map(t=>`<button type="button" class="chat-row${t.unread?' new':''}" data-chat-team="${esc(t.team)}"><span class="chat-av">${esc(String(t.team).slice(0,1))}</span><span class="chat-rt"><b>${esc(t.team)}</b><small>${t.last?esc((t.last.sender==='hq'?'คุณ: ':'')+(t.last.text||(t.last.lat!=null?'📍 ส่งตำแหน่ง':''))):''}</small></span><span class="chat-rm"><small>${t.at?esc(Date.now()-t.at<864e5?hhmm(t.at):day(t.at)):''}</small>${t.unread?`<b class="chat-n">${t.unread}</b>`:''}</span></button>`).join(''):'<p class="chat-empty">ยังไม่มีแชท · เลือกทีมด้านล่างเพื่อเริ่มคุย</p>')
      +(others.length?`<p class="chat-sec">เริ่มคุยกับทีม</p>`+others.map(n=>`<button type="button" class="chat-row" data-chat-team="${esc(n)}"><span class="chat-av">${esc(n.slice(0,1))}</span><span class="chat-rt"><b>${esc(n)}</b><small>ยังไม่เคยคุย</small></span></button>`).join(''):'')}
  function drawMsgs(){const box=root.querySelector('.chat-msgs');const atBottom=box.scrollHeight-box.scrollTop-box.clientHeight<60;let lastDay='';
    box.innerHTML=S.msgs.length?S.msgs.map(m=>{const d=day(m.at),sep=d!==lastDay?`<p class="chat-day">${esc(d)}</p>`:'';lastDay=d;
      const loc=m.lat!=null?`<a class="chat-loc" href="https://maps.google.com/?q=${+m.lat},${+m.lng}" target="_blank" rel="noopener">📍 ตำแหน่งของทีม · เปิดแผนที่</a>`:'';
      return `${sep}<div class="chat-m ${m.sender==='hq'?'me':'them'}${m.pending?' pending':''}">${m.sender==='hq'?'':`<small class="chat-who">${esc(m.name||S.team)}</small>`}${m.text?`<p>${esc(m.text)}</p>`:''}${loc}<small class="chat-t">${esc(m.sender==='hq'&&m.name?m.name+' · ':'')}${hhmm(m.at)}${m.sender==='hq'?(m.readTeam?' · อ่านแล้ว':''):''}</small></div>`}).join(''):'<p class="chat-empty">ยังไม่มีข้อความ · ส่งลิงก์ 🔗 ให้ทีมเปิดหน้าแชทบนมือถือ</p>';
    if(atBottom||S.justOpened){box.scrollTop=box.scrollHeight;S.justOpened=false}}
  async function openTeam(name){if(!S.open)toggle(true);S.team=name;S.msgs=[];S.last=0;S.justOpened=true;view();await poll(true)}
  async function poll(force){if(!KEY())return;S.lastPoll=Date.now();
    try{if(S.open&&S.team){const r=await api({action:'chat',team:S.team});if(r.ok){const changed=r.messages.length!==S.msgs.filter(m=>!m.pending).length||(r.messages.slice(-1)[0]||{}).n!==(S.msgs.slice(-1)[0]||{}).n||r.messages.some((m,i)=>S.msgs[i]&&m.readTeam!==S.msgs[i].readTeam);
          S.msgs=r.messages;if(changed||force)drawMsgs();if(r.messages.some(m=>m.sender==='team'&&!m.readHq))post({action:'chat_read',team:S.team,side:'hq'})}}
      const t=await api({action:'chat_threads'});if(t.ok){S.threads=t.threads;const n=t.threads.reduce((a,x)=>a+(x.team===S.team&&S.open?0:x.unread),0);
        if(n>S.unread&&S.unread!==null&&!force)ding();S.unread=n;const b=root.querySelector('.chat-badge');b.hidden=!n;b.textContent=n>99?'99+':n;
        if(S.open&&!S.team)drawList()}
      if(S.open&&!S.roster.length){const r=await api({action:'roster'});if(r.ok){S.roster=r.roster||[];if(!S.team)drawList()}}}catch(e){}}
  function ding(){try{const a=new (window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g=a.createGain();o.frequency.value=880;g.gain.value=.05;o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+.15)}catch(e){}}
  // แท็บเบื้องหลังยังเช็กทุก 20 วิ (ตัวเลข + เสียงแจ้ง) · กลับมาที่แท็บแล้วเช็กทันที
  function schedule(){clearInterval(S.timer);S.timer=setInterval(()=>{if(!document.hidden||Date.now()-(S.lastPoll||0)>19000)poll()},S.open?5000:20000)}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&root)poll()});
  function start(){if(root||!KEY()||document.documentElement.classList.contains('embed'))return;build();poll(true);schedule()}
  /* เริ่มเมื่อเข้าระบบแล้ว (หน้าเข้าระบบยังไม่มีรหัส) */
  const wait=setInterval(()=>{if(KEY()&&!document.getElementById('app')?.hidden){clearInterval(wait);start()}},1500);
  return {open:name=>{start();openTeam(name)}}
})();
