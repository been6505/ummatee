/* วอ · กดค้างพูดแบบ Zello (ใช้ร่วม: แอปทีม + CENTRAL)
   - กดค้างปุ่ม = อัดเสียง · ปล่อย = ส่ง (ต่ำกว่า 0.4 วิ = ยกเลิก · สูงสุด 30 วิ ตัดเอง) · แตะสั้น ๆ = เปิดรายการเสียงล่าสุด
   - อัดเป็น WAV 8 kHz 16-bit โมโน: เล่นได้ทุกเครื่อง (iPhone/Android/คอม) โดยไม่ต้องแปลง
   - ฟัง: ดึงรายการใหม่ทุก 2 วิ (เฉพาะตอนเปิดหน้าอยู่) · เสียงของคนอื่นเล่นต่อกันอัตโนมัติ + แถบบอกว่าใครพูด
   ใช้: PTT.init({ api(params)→json, post(body)→json, url(n)→ลิงก์ไฟล์เสียง, me:{sender,kind} }) แล้ว PTT.bind(ปุ่ม) */
const PTT=(()=>{
  const P={cfg:null,since:-1,queue:[],playing:null,mine:new Set(),rec:null,stream:null,ctx:null,list:[],timer:null,muted:false};
  try{P.muted=localStorage.getItem('ptt_mute')==='1'}catch(e){}
  const el=document.createElement('div');el.className='ptt-ui';el.innerHTML=`<div class="ptt-talk" hidden><span class="ptt-dot"></span><b>กำลังพูด…</b><span class="ptt-t">0.0</span><span class="ptt-lv"><i></i></span><small>ปล่อยเพื่อส่ง · เลื่อนออกเพื่อยกเลิก</small></div>
    <div class="ptt-now" hidden><span class="ptt-wave"><i></i><i></i><i></i></span><span class="ptt-who"></span><button type="button" class="ptt-x" aria-label="หยุดเล่น">✕</button></div>
    <div class="ptt-panel" hidden role="dialog" aria-label="วอ · เสียงล่าสุด"><div class="ptt-ph"><b>📻 วอ · ช่องรวม</b><button type="button" class="ptt-mute"></button><button type="button" class="ptt-close" aria-label="ปิด">✕</button></div><div class="ptt-list"></div><p class="ptt-hint">กดค้างปุ่ม วอ เพื่อพูด · ทุกทีมและศูนย์ได้ยิน</p></div>`;
  const st=document.createElement('style');st.textContent=`
.ptt-talk{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 120px);transform:translateX(-50%);z-index:9000;background:#161B3D;color:#fff;border-radius:22px;padding:14px 20px;display:grid;grid-template-columns:auto 1fr auto;gap:4px 10px;align-items:center;min-width:240px;box-shadow:0 14px 40px rgba(0,0,0,.35);font-family:inherit}
.ptt-talk b{font-size:16px}.ptt-t{font-variant-numeric:tabular-nums;font-weight:700}.ptt-talk small{grid-column:1/-1;opacity:.7;font-size:12px}
.ptt-dot{width:12px;height:12px;border-radius:50%;background:#E5383B;animation:pttb 1s infinite}
.ptt-lv{grid-column:1/-1;height:6px;border-radius:3px;background:rgba(255,255,255,.18);overflow:hidden}.ptt-lv i{display:block;height:100%;width:0;background:#4ADE80;transition:width .1s}
.ptt-now{position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top,0px) + 76px);z-index:8999;display:flex;align-items:center;gap:10px;background:#1F7A43;color:#fff;border-radius:16px;padding:10px 12px 10px 14px;box-shadow:0 10px 30px rgba(0,0,0,.25);font-weight:700;font-family:inherit;max-width:520px;margin:0 auto}
.ptt-who{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ptt-x{border:0;background:rgba(255,255,255,.2);color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer}
.ptt-wave{display:flex;gap:3px;align-items:center;height:18px}.ptt-wave i{width:4px;background:#fff;border-radius:2px;animation:pttw .8s ease-in-out infinite}.ptt-wave i:nth-child(2){animation-delay:.15s}.ptt-wave i:nth-child(3){animation-delay:.3s}
.ptt-panel{position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 110px);z-index:8998;background:#fff;color:#161B3D;border-radius:22px;padding:14px;box-shadow:0 20px 50px rgba(22,27,61,.3);max-height:60vh;display:flex;flex-direction:column;gap:8px;max-width:480px;margin:0 auto;font-family:inherit}
.ptt-ph{display:flex;align-items:center;gap:8px}.ptt-ph b{flex:1;font-size:16px}.ptt-ph button{border:0;background:#EEF1FD;color:#2D45C8;border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.ptt-list{overflow:auto;display:grid;gap:6px}.ptt-it{display:grid;grid-template-columns:34px 1fr;grid-template-rows:auto auto;align-items:center;column-gap:10px;text-align:left;border:0;background:#F4F6FC;border-radius:14px;padding:8px 12px;font:inherit;color:inherit;cursor:pointer}
.ptt-it .ptt-pl{grid-row:1/3;width:34px;height:34px;border-radius:50%;background:#2D45C8;color:#fff;display:grid;place-items:center;font-size:12px}.ptt-it.hq .ptt-pl{background:#E5383B}.ptt-it.me{background:#E9F6EE}.ptt-it.me .ptt-pl{background:#1F7A43}
.ptt-it small{color:#5B6386;font-size:12px}.ptt-hint{margin:0;color:#5B6386;font-size:12.5px;text-align:center}
.ptt-toast{position:fixed;left:50%;top:90px;transform:translateX(-50%);z-index:9001;background:#161B3D;color:#fff;border-radius:999px;padding:10px 18px;font-weight:600}
.ptt-press{transform:scale(.94)}
@keyframes pttb{50%{opacity:.3}}@keyframes pttw{0%,100%{height:5px}50%{height:18px}}`;
  const audio=new Audio();audio.preload='auto';
  const $=s=>el.querySelector(s),esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hhmm=t=>new Date(t).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
  function beep(f,ms){try{const c=P.ctx||(P.ctx=new (window.AudioContext||window.webkitAudioContext)());const o=c.createOscillator(),g=c.createGain();o.frequency.value=f;g.gain.value=.08;o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+ms/1000)}catch(e){}}
  function unlock(){try{audio.muted=true;audio.play().catch(()=>{}).finally(()=>{audio.pause();audio.muted=false})}catch(e){}try{P.ctx&&P.ctx.resume()}catch(e){}}
  /* ---------- อัดเสียง ---------- */
  async function start(){if(P.rec)return;unlock();
    try{if(!P.stream||!P.stream.active)P.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}})}
    catch(e){toast('ใช้ไมโครโฟนไม่ได้ · อนุญาตไมค์ในการตั้งค่าเครื่อง');return}
    const ctx=P.ctx||(P.ctx=new (window.AudioContext||window.webkitAudioContext)());await ctx.resume().catch(()=>{});
    const src=ctx.createMediaStreamSource(P.stream),node=ctx.createScriptProcessor(4096,1,1),bufs=[];let lv=0;
    node.onaudioprocess=e=>{const d=e.inputBuffer.getChannelData(0);bufs.push(new Float32Array(d));let m=0;for(let i=0;i<d.length;i+=32)m=Math.max(m,Math.abs(d[i]));lv=m};
    const mute=ctx.createGain();mute.gain.value=0;src.connect(node);node.connect(mute);mute.connect(ctx.destination);
    pause();P.rec={src,node,mute,bufs,rate:ctx.sampleRate,t0:Date.now(),cancel:false};beep(880,90);try{navigator.vibrate&&navigator.vibrate(30)}catch(e){}
    $('.ptt-talk').hidden=false;document.body.classList.add('ptt-on');
    P.timer=setInterval(()=>{const s=(Date.now()-P.rec.t0)/1000;$('.ptt-t').textContent=s.toFixed(1);$('.ptt-lv i').style.width=Math.min(100,lv*180)+'%';if(s>=30)stop()},100)}
  function stop(cancel){const r=P.rec;if(!r)return;P.rec=null;clearInterval(P.timer);$('.ptt-talk').hidden=true;document.body.classList.remove('ptt-on');
    try{r.src.disconnect();r.node.disconnect();r.mute.disconnect()}catch(e){}
    const dur=(Date.now()-r.t0)/1000;if(cancel||dur<0.4){if(!cancel)toast('กดค้างไว้ระหว่างพูด');resume();return}
    beep(660,70);const wav=encode(r.bufs,r.rate);send(wav,dur);resume()}
  function encode(bufs,rate){const n=bufs.reduce((s,b)=>s+b.length,0),all=new Float32Array(n);let o=0;bufs.forEach(b=>{all.set(b,o);o+=b.length});
    const R=8000,ratio=rate/R,len=Math.floor(n/ratio),pcm=new Int16Array(len);
    for(let i=0;i<len;i++){const a=Math.floor(i*ratio),b=Math.min(n,Math.floor((i+1)*ratio));let s=0;for(let j=a;j<b;j++)s+=all[j];const v=Math.max(-1,Math.min(1,(s/Math.max(1,b-a))*1.6));pcm[i]=v<0?v*0x8000:v*0x7FFF}
    const buf=new ArrayBuffer(44+pcm.length*2),dv=new DataView(buf),w=(p,s)=>{for(let i=0;i<s.length;i++)dv.setUint8(p+i,s.charCodeAt(i))};
    w(0,'RIFF');dv.setUint32(4,36+pcm.length*2,true);w(8,'WAVE');w(12,'fmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,1,true);dv.setUint32(24,R,true);dv.setUint32(28,R*2,true);dv.setUint16(32,2,true);dv.setUint16(34,16,true);w(36,'data');dv.setUint32(40,pcm.length*2,true);
    new Int16Array(buf,44).set(pcm);return new Uint8Array(buf)}
  async function send(wav,dur){let bin='';for(let i=0;i<wav.length;i+=0x8000)bin+=String.fromCharCode.apply(null,wav.subarray(i,i+0x8000));
    const item={n:'local'+Date.now(),sender:P.cfg.me().sender,kind:P.cfg.me().kind,dur,at:Date.now(),local:true,blob:URL.createObjectURL(new Blob([wav],{type:'audio/wav'}))};P.list.push(item);draw();
    try{const r=await P.cfg.post({action:'ptt_send',audio:btoa(bin),dur:Math.round(dur*10)/10});if(!r||!r.ok)throw 0;P.mine.add(r.n);item.n=r.n;item.local=false;toast('ส่งเสียงแล้ว')}
    catch(e){item.fail=true;draw();toast('ส่งเสียงไม่สำเร็จ ตรวจอินเทอร์เน็ต')}}
  /* ---------- ฟัง ---------- */
  async function poll(){if(!P.cfg||document.hidden)return;try{const r=await P.cfg.api({action:'ptt_list',since:Math.max(0,P.since)});if(!r||!r.ok)return;
    const first=P.since<0;(r.items||[]).forEach(it=>{if(P.list.some(x=>x.n===it.n))return;P.list.push(it);if(!first&&!P.mine.has(it.n)&&!P.muted)P.queue.push(it)});
    if(r.items&&r.items.length)P.since=Math.max(P.since,...r.items.map(i=>i.n));else if(first)P.since=0;
    P.list=P.list.slice(-40);draw();next()}catch(e){}}
  function next(){if(P.playing||P.rec||!P.queue.length)return;play(P.queue.shift())}
  function play(it){P.playing=it;audio.src=it.blob||P.cfg.url(it.n);$('.ptt-who').textContent=`${it.kind==='hq'?'ศูนย์':it.sender}${it.name&&it.kind==='hq'?' · '+it.name:''} · ${hhmm(it.at)}`;$('.ptt-now').hidden=false;
    beep(1200,40);audio.play().catch(()=>{$('.ptt-who').textContent+=' · แตะเพื่อฟัง';$('.ptt-now').onclick=()=>{audio.play().catch(()=>{})}})}
  function done(){P.playing=null;$('.ptt-now').hidden=true;$('.ptt-now').onclick=null;setTimeout(next,250)}
  audio.onended=done;audio.onerror=done;
  function pause(){if(P.playing){audio.pause();P.queue.unshift(P.playing);P.playing=null;$('.ptt-now').hidden=true}}
  function resume(){setTimeout(next,400)}
  function draw(){const l=$('.ptt-list');if(!l||$('.ptt-panel').hidden)return;
    l.innerHTML=P.list.slice().reverse().map(it=>`<button type="button" class="ptt-it${it.kind==='hq'?' hq':''}${P.mine.has(it.n)||it.local?' me':''}" data-pn="${esc(it.n)}"><span class="ptt-pl">▶</span><b>${esc(it.kind==='hq'?'ศูนย์'+(it.name?' · '+it.name:''):it.sender)}</b><small>${hhmm(it.at)} · ${Number(it.dur||0).toFixed(0)} วิ${it.fail?' · ส่งไม่สำเร็จ':it.local?' · กำลังส่ง…':''}</small></button>`).join('')||'<p class="ptt-hint">ยังไม่มีเสียงในช่อง</p>';
    $('.ptt-mute').textContent=P.muted?'🔇 ปิดเสียงอยู่':'🔊 เล่นอัตโนมัติ'}
  el.addEventListener('click',e=>{const t=e.target;
    if(t.closest('.ptt-close')){$('.ptt-panel').hidden=true;return}
    if(t.closest('.ptt-x')){e.stopPropagation();audio.pause();P.queue=[];done();return}
    if(t.closest('.ptt-mute')){P.muted=!P.muted;try{localStorage.setItem('ptt_mute',P.muted?'1':'0')}catch(x){}draw();return}
    const b=t.closest('[data-pn]');if(b){const it=P.list.find(x=>String(x.n)===b.dataset.pn);if(it){audio.pause();P.playing=null;P.queue.unshift(it);next()}}});
  function toast(m){if(typeof window.toast==='function')window.toast(m);else{const d=document.createElement('div');d.className='ptt-toast';d.textContent=m;document.body.append(d);setTimeout(()=>d.remove(),2600)}}
  /* ปุ่ม: กดค้าง = พูด · แตะ = เปิดรายการ */
  function bind(btn){let downAt=0,pid=null,holdT=null,talking=false;
    btn.addEventListener('contextmenu',e=>e.preventDefault());
    btn.addEventListener('pointerdown',e=>{e.preventDefault();unlock();downAt=Date.now();pid=e.pointerId;try{btn.setPointerCapture(pid)}catch(x){}btn.classList.add('ptt-press');
      holdT=setTimeout(()=>{talking=true;start()},250)});
    const end=e=>{if(pid==null)return;clearTimeout(holdT);btn.classList.remove('ptt-press');const r=btn.getBoundingClientRect(),out=e.type==='pointercancel'||(e.clientX<r.left-40||e.clientX>r.right+40||e.clientY<r.top-80);
      if(talking){talking=false;stop(out)}else if(Date.now()-downAt<250)togglePanel();pid=null};
    btn.addEventListener('pointerup',end);btn.addEventListener('pointercancel',end)}
  function togglePanel(){const p=$('.ptt-panel');p.hidden=!p.hidden;draw()}
  function init(cfg){if(P.cfg)return;P.cfg=cfg;document.head.append(st);document.body.append(el);poll();setInterval(poll,2000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll()});
    document.addEventListener('pointerdown',unlock,{once:true})}
  return {init,bind,open:togglePanel}})();
