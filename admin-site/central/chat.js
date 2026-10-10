/* แชทกับทีม (ฝั่งศูนย์) — ฟองแชทมุมขวาล่างของทุกหน้าหลังบ้าน
   - รายชื่อห้องแชทของทุกทีม + ตัวเลขข้อความที่ยังไม่อ่าน · เลือกทีมจากรายชื่อทีม (roster) เพื่อเริ่มคุยใหม่ได้
   - ดึงข้อความใหม่ทุก 5 วิ ตอนเปิดหน้าต่าง (นอกนั้นทุก 20 วิ เพื่อเช็กตัวเลข)
   - ทีมคุยจากหน้า /team/?id=… (ลิงก์เฉพาะทีม)
   - แจ้งเตือนทุกหน้า: SOS จากทีม (แถบแดงจนกว่าจะรับทราบ) และสายที่ทีมโทรเข้า (เสียงเรียก + ปุ่มรับสาย)
   ใช้: CHAT.open(teamName) เปิดห้องของทีมนั้น (เช่นจากปุ่ม <i data-ic="chat"></i> แชท บนการ์ดทีม) */
const CHAT=(()=>{
  const KEY=()=>{try{return localStorage.getItem('uh_vol_key')||sessionStorage.getItem('uh_vol_key')||''}catch(e){return ''}};
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const me=()=>{try{return localStorage.getItem('uh_staff')||localStorage.getItem('uh_team')||'ศูนย์'}catch(e){return 'ศูนย์'}};
  const S={scope:null,open:false,team:null,threads:[],roster:[],msgs:[],last:0,rev:null,timer:null,unread:0,alerts:{sos:[],calls:[],silent:[]},ring:null};
  /* ขอบเขต (War Room): เหลือเฉพาะทีมของห้อง · info(team) = สถานะลงพื้นที่/เคสที่รับอยู่ */
  const inScope=t=>!S.scope||!S.scope.teams||S.scope.teams.includes(t);
  const title=()=>S.scope&&S.scope.title||'แชทกับทีม';
  const info=t=>S.scope&&S.scope.info?S.scope.info(t):null;
  const seenCall=()=>{try{return +localStorage.getItem('uh_call_seen')||0}catch(e){return 0}},setSeen=n=>{try{localStorage.setItem('uh_call_seen',String(n))}catch(e){}};
  const api=async p=>{const r=await fetch('/api?'+new URLSearchParams({...p,key:KEY(),t:Date.now()}),{cache:'no-store'});return r.json()};
  const post=async b=>{const r=await fetch('/api',{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...b,key:KEY()})});return r.json()};
  const hhmm=t=>new Date(t).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
  const day=t=>new Date(t).toLocaleDateString('th-TH',{day:'numeric',month:'short'});
  let root;
  function build(){
    root=document.createElement('div');root.className='chat-root';
    root.innerHTML=`<button type="button" class="chat-fab" aria-label="แชทกับทีม" aria-expanded="false"><i data-ic="chat"></i><b class="chat-badge" hidden></b></button>
      <section class="chat-win" hidden aria-label="แชทกับทีม">
        <header class="chat-h"><button type="button" class="chat-back" aria-label="กลับไปรายชื่อทีม" hidden><i data-ic="back"></i></button><span class="chat-tw"><b class="chat-title">แชทกับทีม</b><small class="chat-sub" hidden></small></span><a class="chat-share" target="_blank" rel="noopener" hidden title="ลิงก์หน้าแชทสำหรับทีม"><i data-ic="link"></i> ลิงก์ทีม</a><button type="button" class="chat-x" aria-label="ปิด"><i data-ic="close"></i></button></header>
        <div class="chat-list"></div>
        <div class="chat-msgs" hidden aria-live="polite"></div>
        <form class="chat-form" hidden><input class="chat-in" maxlength="1000" placeholder="พิมพ์ข้อความถึงทีม…" aria-label="ข้อความ" autocomplete="off"><button class="chat-draft" type="button" title="ให้ AI HELP ร่างคำตอบ (แก้ก่อนส่งได้)" hidden>✦ ร่าง</button><button class="chat-send" type="submit" aria-label="ส่ง"><i data-ic="send"></i></button></form>
      </section>`;
    document.body.append(root);
    const al=document.createElement('div');al.className='alert-stack';al.setAttribute('aria-live','assertive');document.body.append(al);S.al=al;
    al.onclick=e=>{const a=e.target.closest('[data-al]');if(!a)return;const k=a.dataset.al,v=a.dataset.v;
      if(k==='chat'){openTeam(v);return}
      if(k==='answer'){e.preventDefault();const c=S.alerts.calls.find(x=>String(x.n)===v);setSeen(Math.max(seenCall(),+v));drawAlerts();if(c)callPane(c);return}
      if(k==='answer'||k==='decline'){const c=S.alerts.calls.find(x=>String(x.n)===v);setSeen(Math.max(seenCall(),+v));if(c&&k==='decline')post({action:'chat_send',team:c.team,from:'hq',name:me(),text:'ศูนย์ไม่ว่างรับสาย · จะโทรกลับ'});drawAlerts();return}
      if(k==='silentall'){a.disabled=true;const l=(S.alerts.silent||[]).filter(x=>inScope(x.name));Promise.all(l.map(x=>post({action:'silent_ack',team:x.name}))).then(()=>poll());S.alerts.silent=[];drawAlerts();return}
      if(k==='silent'){a.disabled=true;post({action:'silent_ack',team:v}).then(()=>poll());S.alerts.silent=(S.alerts.silent||[]).filter(x=>x.name!==v);drawAlerts();return}
      if(k==='ack'){const s=S.alerts.sos.find(x=>String(x.id)===v);if(s){a.disabled=true;post({action:'sos_ack',id:s.id,team:s.name,by:me()}).then(()=>poll())}}};
    root.querySelector('.chat-fab').onclick=()=>toggle();
    window.addEventListener('hm-rev',e=>{if(e.detail.what.includes('chat'))poll(true)}); // เรียลไทม์: แชท/แจ้งเตือนใหม่ทันที
    // วอ (กดค้างพูด) · ช่องรวมทุกทีม + ศูนย์ · ไม่เปิดให้ War Room ย่อย
    // รวมพล: ปุ่มลอยเหนือปุ่ม วอ · หน้าจัดทีม = เปิด/ปิดแผงรวมพล · หน้าอื่น = ไปหน้าจัดทีมพร้อมเปิดแผง
    if(KEY()&&!/^wr/.test(KEY())){const rb=document.createElement('button');rb.type='button';rb.className='rally-fab';rb.setAttribute('aria-label','รวมพล · เรียกทีมไปจุดเดียวกัน');rb.title='รวมพล';rb.innerHTML='<i data-ic="megaphone"></i><b>รวมพล</b>';document.body.append(rb);
      rb.onclick=()=>{if(document.getElementById('rally')){document.body.classList.toggle('rl-open');setTimeout(()=>window.dispatchEvent(new Event('resize')),80)}else{const base=location.pathname.includes('/central/')?location.pathname.replace(/\/central\/.*$/,'/central/teams/'):'./central/teams/';location.href=base+'?rally=open'}}}
    if(typeof PTT!=='undefined'&&KEY()){const pb=document.createElement('button');pb.type='button';pb.className='ptt-fab';pb.setAttribute('aria-label','วอ · กดค้างเพื่อพูด แตะเพื่อดูเสียงล่าสุด');pb.title='วอ · กดค้างเพื่อพูด';pb.innerHTML='<i data-ic="mic"></i><b>วอ</b>';document.body.append(pb);
      PTT.init({api,post:b=>post({...b,by:(()=>{try{return localStorage.getItem('uh_staff')||''}catch(e){return ''}})()}),url:n=>'/api?'+new URLSearchParams({action:'ptt_audio',n,key:KEY()}),me:()=>({sender:'ศูนย์',kind:'hq'}),
        ws:()=>((()=>{try{return localStorage.getItem('ptt_ws')}catch(e){return ''}})()||(/helpme4u\.com$/.test(location.hostname)?'wss://'+location.host:'wss://central.helpme4u.com'))+'/ptt/ws?'+new URLSearchParams({key:KEY()}),
        onState:s=>{pb.classList.toggle('ptt-off',!s.up);pb.title='วอ · '+s.label+' · กดค้างเพื่อพูด'}});PTT.bind(pb)}
    root.querySelector('.chat-x').onclick=()=>toggle(false);
    root.querySelector('.chat-back').onclick=()=>{S.team=null;view()};
    root.querySelector('.chat-list').onclick=e=>{const b=e.target.closest('[data-chat-team]');if(b)openTeam(b.dataset.chatTeam)};
    root.querySelector('.chat-draft').onclick=async e=>{const b=e.currentTarget,i=root.querySelector('.chat-in');if(!S.team||typeof HERMES==='undefined')return;b.disabled=true;const old=b.textContent;b.textContent='กำลังร่าง…';
      try{i.value=await HERMES.draft(S.team,S.msgs);i.focus()}catch(err){alert(err.message||'ร่างไม่สำเร็จ')}finally{b.disabled=false;b.textContent=old}};
    root.querySelector('.chat-form').onsubmit=async e=>{e.preventDefault();const i=root.querySelector('.chat-in'),t=i.value.trim();if(!t||!S.team)return;i.value='';
      S.msgs.push({n:0,sender:'hq',name:me(),text:t,at:Date.now(),pending:true});drawMsgs();
      try{const r=await post({action:'chat_send',team:S.team,from:'hq',name:me(),text:t});if(!r.ok)throw 0}catch(err){i.value=t}poll(true)}}
  function toggle(on){S.open=on==null?!S.open:on;root.querySelector('.chat-win').hidden=!S.open;root.querySelector('.chat-fab').setAttribute('aria-expanded',String(S.open));if(S.open){view();poll(true)}schedule()}
  function view(){const inTeam=!!S.team;root.querySelector('.chat-list').hidden=inTeam;root.querySelector('.chat-msgs').hidden=!inTeam;root.querySelector('.chat-form').hidden=!inTeam;
    root.querySelector('.chat-back').hidden=!inTeam;root.querySelector('.chat-draft').hidden=!(inTeam&&typeof LOCALAI!=='undefined'&&LOCALAI.on());root.querySelector('.chat-title').textContent=inTeam?S.team:title();const f=info(S.team);root.querySelector('.chat-sub').hidden=!(inTeam&&f);if(inTeam&&f)root.querySelector('.chat-sub').textContent=f.text;
    share();
    if(inTeam){drawMsgs();setTimeout(()=>root.querySelector('.chat-in').focus(),30)}else drawList()}
  function share(){const sh=root.querySelector('.chat-share'),tk=S.team&&(S.roster.find(r=>r.name===S.team)||{}).token;sh.hidden=!tk;if(tk)sh.href='/team/?id='+encodeURIComponent(tk)}
  function drawList(){if(!root)return;const th=S.threads.filter(t=>inScope(t.team)),known=new Set(th.map(t=>t.team));
    const pool=S.scope&&S.scope.teams?S.scope.teams:S.roster.map(r=>r.name);
    const tag=t=>{const f=info(t);return f?`<span class="chat-tag ${f.field?'on':''}">${esc(f.tag)}</span>`:''};
    const fieldFirst=(a,b)=>((info(b)||{}).field?1:0)-((info(a)||{}).field?1:0);
    const others=pool.filter(n=>n&&!known.has(n)).sort(fieldFirst);
    const last=t=>t.last?(t.last.sender==='hq'?'คุณ: ':'')+(t.last.kind==='sos'?'SOS · ':'')+(t.last.text||(t.last.lat!=null?'ส่งตำแหน่ง':'')):'';
    root.querySelector('.chat-list').innerHTML=(S.scope&&S.scope.note?`<p class="chat-note">${esc(S.scope.note)}</p>`:'')
      +th.map(t=>`<button type="button" class="chat-row${t.unread?' new':''}" data-chat-team="${esc(t.team)}"><span class="chat-av">${esc(String(t.team).slice(0,1))}</span><span class="chat-rt"><b>${esc(t.team)} ${tag(t.team)}</b><small>${esc(last(t))}</small></span><span class="chat-rm"><small>${t.at?esc(Date.now()-t.at<864e5?hhmm(t.at):day(t.at)):''}</small>${t.unread?`<b class="chat-n">${t.unread}</b>`:''}</span></button>`).join('')
      +(others.length?`<p class="chat-sec">${S.scope?'ทีมของห้องนี้ · เริ่มคุย':'เริ่มคุยกับทีม'}</p>`+others.map(n=>{const f=info(n);return `<button type="button" class="chat-row" data-chat-team="${esc(n)}"><span class="chat-av">${esc(n.slice(0,1))}</span><span class="chat-rt"><b>${esc(n)} ${tag(n)}</b><small>${esc(f&&f.text||'ยังไม่เคยคุย')}</small></span></button>`}).join(''):'')
      ||`<p class="chat-note">${S.scope?'ยังไม่มีทีมในห้องนี้ · เพิ่มทีมที่แท็บ "ทีม"':'ยังไม่มีทีม'}</p>`}
  function drawMsgs(){const box=root.querySelector('.chat-msgs');const atBottom=box.scrollHeight-box.scrollTop-box.clientHeight<60;let lastDay='';
    box.innerHTML=S.msgs.length?S.msgs.map(m=>{const d=day(m.at),sep=d!==lastDay?`<p class="chat-day">${esc(d)}</p>`:'';lastDay=d;
      const loc=m.lat!=null?`<a class="chat-loc" href="https://maps.google.com/?q=${+m.lat},${+m.lng}" target="_blank" rel="noopener"><i data-ic="pin"></i> ตำแหน่งของทีม · เปิดแผนที่</a>`:'';
      const call=m.kind==='call'&&m.link?`<a class="chat-join" href="${esc(m.link)}" target="_blank" rel="noopener"><i data-ic="${m.text==='วิดีโอคอล'?'video':'phone'}"></i> เข้าร่วมสาย</a>`:'';
      const voice=m.kind==='voice'&&m.link?`<audio class="chat-voice" controls preload="none" src="${esc(m.link)}&${new URLSearchParams({key:KEY()})}"></audio>`:'';
      const cs=m.kind==='case'&&m.caseId?`<span class="chat-case">📋 การ์ดเคส #${esc(m.caseId)}</span>`:'';
      return `${sep}<div class="chat-m ${m.sender==='hq'?'me':'them'}${m.pending?' pending':''}${m.kind==='sos'?' sos':''}">${m.sender==='hq'?'':`<small class="chat-who">${esc(m.name||S.team)}</small>`}${cs}${m.text?`<p>${esc(m.text)}</p>`:''}${voice}${call}${loc}<small class="chat-t">${esc(m.sender==='hq'&&m.name?m.name+' · ':'')}${hhmm(m.at)}${m.sender==='hq'?(m.readTeam?' · อ่านแล้ว':''):''}</small></div>`}).join(''):'<p class="chat-empty">ยังไม่มีข้อความ · ส่งลิงก์ <i data-ic="link"></i> ให้ทีมเปิดหน้าแชทบนมือถือ</p>';
    if(atBottom||S.justOpened){box.scrollTop=box.scrollHeight;S.justOpened=false}}
  async function openTeam(name){if(!S.open)toggle(true);S.team=name;S.msgs=[];S.last=0;S.justOpened=true;view();await poll(true)}
  async function poll(force){if(!KEY())return;S.lastPoll=Date.now();
    try{if(S.open&&S.team){const r=await api({action:'chat',team:S.team});if(r.ok){const changed=r.messages.length!==S.msgs.filter(m=>!m.pending).length||(r.messages.slice(-1)[0]||{}).n!==(S.msgs.slice(-1)[0]||{}).n||r.messages.some((m,i)=>S.msgs[i]&&m.readTeam!==S.msgs[i].readTeam);
          S.msgs=r.messages;if(changed||force)drawMsgs();if(r.messages.some(m=>m.sender==='team'&&!m.readHq))post({action:'chat_read',team:S.team,side:'hq'})}}
      const t=await api({action:'chat_threads'});if(t.ok){S.threads=t.threads;if(t.alerts){S.alerts=t.alerts;drawAlerts()}const n=t.threads.filter(x=>inScope(x.team)).reduce((a,x)=>a+(x.team===S.team&&S.open?0:x.unread),0);
        if(n>S.unread&&S.unread!==null&&!force)ding();S.unread=n;const b=root.querySelector('.chat-badge');b.hidden=!n;b.textContent=n>99?'99+':n;
        if(S.open&&!S.team)drawList()}
      if(S.open&&!S.roster.length){const r=await api({action:'roster'});if(r.ok){S.roster=r.roster||[];if(!S.team)drawList();else share()}}}catch(e){}}
  /* แถบแจ้งเตือน: SOS (จนกว่าจะรับทราบ) + สายเข้าจากทีม (ดังจนกด รับ/ไม่รับ หรือครบ 2 นาที) */
  function drawAlerts(){if(!S.al)return;const calls=[...new Map(S.alerts.calls.filter(c=>c.n>seenCall()&&inScope(c.team)).sort((a,b)=>a.n-b.n).map(c=>[c.team,c])).values()],sos=(S.alerts.sos||[]).filter(x=>inScope(x.name));
    S.al.innerHTML=sos.map(s=>`<div class="al al-sos" role="alert"><b><i data-ic="alert"></i> SOS · ${esc(s.name)}</b><small>${esc(hhmm(s.sosAt))}${s.lat!=null?` · <a href="https://maps.google.com/?q=${+s.lat},${+s.lng}" target="_blank" rel="noopener">ตำแหน่ง</a>`:''}</small>
        <span>${String(s.phone||'').replace(/\D/g,'').length>=9?`<a class="al-b" href="tel:${esc(String(s.phone).replace(/[^\d+]/g,''))}"><i data-ic="phone"></i></a>`:''}<button class="al-b" data-al="chat" data-v="${esc(s.name)}" aria-label="แชท"><i data-ic="chat"></i></button><button class="al-b al-ok" data-al="ack" data-v="${esc(s.id)}">รับทราบ</button></span></div>`).join('')
      +((sl=>sl.length>1?[`<div class="al al-silent" role="status"><b><i data-ic="clock"></i> ${sl.length} ทีมขาดการติดต่อ</b><small>${sl.map(x=>esc(x.name)).join(' · ')} · ไม่ส่งตำแหน่ง/ข้อความเกิน 30 นาที</small><span><a class="al-b" href="${location.pathname.includes('/central/')?'../teams/':'./central/teams/'}">ดูทีม</a><button class="al-b al-ok" data-al="silentall">รับทราบ</button></span></div>`]:sl.map(s=>`<div class="al al-silent" role="status"><b><i data-ic="clock"></i> ${esc(s.name)} เงียบไป${s.last?' '+esc(agoMin(s.last)):''}</b><small>ถือเคส ${esc(s.cases)} เคส · ไม่ส่งตำแหน่ง/ข้อความเกิน 30 นาที${s.lat!=null?` · <a href="https://maps.google.com/?q=${+s.lat},${+s.lng}" target="_blank" rel="noopener">จุดล่าสุด</a>`:''}</small>
        <span>${String(s.phone||'').replace(/\D/g,'').length>=9?`<a class="al-b" href="tel:${esc(String(s.phone).replace(/[^\d+]/g,''))}" aria-label="โทร"><i data-ic="phone"></i></a>`:''}<button class="al-b" data-al="chat" data-v="${esc(s.name)}" aria-label="แชท"><i data-ic="chat"></i></button><a class="al-b" href="${location.pathname.includes('/central/')?'../teams/':'./central/teams/'}?rally=${encodeURIComponent(s.name)}#rally" title="เรียกรวมพลที่จุดล่าสุดของทีมนี้">📣</a><button class="al-b al-ok" data-al="silent" data-v="${esc(s.name)}">รับทราบ</button></span></div>`))((S.alerts.silent||[]).filter(x=>inScope(x.name)))).join('')
      +calls.map(c=>`<div class="al al-call" role="alert"><b><i data-ic="phone"></i> ${esc(c.team)} โทรมา</b><small>${esc(c.text)}${c.name?' · '+esc(c.name):''}</small>
        <span><button class="al-b al-no" data-al="decline" data-v="${esc(c.n)}">ไม่รับ</button><a class="al-b al-ok" data-al="answer" data-v="${esc(c.n)}" href="${esc(c.link)}" target="_blank" rel="noopener">รับสาย</a></span></div>`).join('');
    clearInterval(S.ring);if(calls.length||sos.length)S.ring=setInterval(()=>{if(!S.al.children.length){clearInterval(S.ring);return}calls.length?(ding(660),setTimeout(()=>ding(880),250)):ding(990)},calls.length?2000:6000)}
  /* รับสายในหน้าเดิม: เปิดหน้าจอโทรเป็นกรอบเต็มจอบนหน้านี้ (ไม่เปิดแท็บใหม่) · ปิดกรอบ = วางสาย */
  function callPane(c){const old=document.getElementById('call-pane');if(old)old.remove();
    const d=document.createElement('div');d.id='call-pane';d.className='call-pane';d.setAttribute('role','dialog');d.setAttribute('aria-label','สายจาก '+c.team);
    d.innerHTML=`<div class="cp-bar"><b>${esc(c.team)}</b><small>${esc(c.text||'')}</small><button type="button" class="cp-x" aria-label="วางสายและปิด">วางสาย</button></div><iframe src="${esc(c.link)}" allow="microphone; camera; autoplay; display-capture" title="หน้าจอโทร"></iframe>`;
    document.body.append(d);d.querySelector('.cp-x').onclick=()=>{d.remove()};}
  addEventListener('message',e=>{if(e.origin===location.origin&&e.data&&e.data.hmCall==='ended'){const d=document.getElementById('call-pane');if(d)setTimeout(()=>d.remove(),1500)}});
  function agoMin(t){const m=Math.round((Date.now()-t)/60000);return m<60?m+' นาที':Math.floor(m/60)+' ชม. '+(m%60)+' นาที'}
  function ding(f=880){try{const a=new (window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g=a.createGain();o.frequency.value=f;g.gain.value=.05;o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+.15)}catch(e){}}
  // แท็บเบื้องหลังยังเช็กทุก 20 วิ (ตัวเลข + เสียงแจ้ง) · กลับมาที่แท็บแล้วเช็กทันที
  function schedule(){clearInterval(S.timer);S.timer=setInterval(()=>{const lv=(typeof LIVE!=='undefined'&&LIVE.ok()),gap=lv?(S.open?20000:30000):(S.open?5000:8000);if(Date.now()-(S.lastPoll||0)>=gap-500&&(!document.hidden||Date.now()-(S.lastPoll||0)>gap))poll()},5000)}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&root)poll()});
  function start(){if(root||!KEY()||document.documentElement.classList.contains('embed'))return;build();poll(true);schedule()}
  /* เริ่มเมื่อเข้าระบบแล้ว (หน้าเข้าระบบยังไม่มีรหัส) */
  const wait=setInterval(()=>{if(KEY()&&!document.getElementById('app')?.hidden){clearInterval(wait);start()}},1500);
  function setScope(sc){S.scope=sc||null;if(!root)return;if(S.open)view();else drawList();drawAlerts();
    const n=S.threads.filter(x=>inScope(x.team)).reduce((a,x)=>a+x.unread,0),b=root.querySelector('.chat-badge');S.unread=n;b.hidden=!n;b.textContent=n>99?'99+':n;
    root.querySelector('.chat-fab').setAttribute('aria-label',title())}
  return {open:name=>{start();openTeam(name)},setScope}
})();
