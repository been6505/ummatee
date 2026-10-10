const PTT=(()=>{
  const LS=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){}};
  const P={cfg:null,ws:null,up:false,retry:1000,chans:[],ch:LS('ptt_ch')||'all',muted:new Set(JSON.parse(LS('ptt_muted')||'[]')),live:new Map(),rx:new Map(),
    heard:new Set(),mine:new Set(),list:[],since:-1,tx:null,stream:null,ctx:null,out:null,media:null,queue:[],playing:null,talkT:null,wasDown:0};
  const st=document.createElement('style');st.textContent=`
.ptt-talk{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 120px);transform:translateX(-50%);z-index:9000;background:#161B3D;color:#fff;border-radius:22px;padding:14px 20px;display:grid;grid-template-columns:auto 1fr auto;gap:4px 10px;align-items:center;min-width:250px;box-shadow:0 14px 40px rgba(0,0,0,.35);font-family:inherit}
.ptt-talk b{font-size:16px}.ptt-t{font-variant-numeric:tabular-nums;font-weight:700}.ptt-talk small{grid-column:1/-1;opacity:.75;font-size:12px}
.ptt-talk.wait .ptt-dot{background:#F59E0B}.ptt-dot{width:12px;height:12px;border-radius:50%;background:#E5383B;animation:pttb 1s infinite}
.ptt-lv{grid-column:1/-1;height:6px;border-radius:3px;background:rgba(255,255,255,.18);overflow:hidden}.ptt-lv i{display:block;height:100%;width:0;background:#4ADE80;transition:width .08s}
.ptt-now{position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top,0px) + 76px);z-index:8999;display:flex;align-items:center;gap:10px;background:#1F7A43;color:#fff;border-radius:16px;padding:10px 12px 10px 14px;box-shadow:0 10px 30px rgba(0,0,0,.25);font-weight:700;font-family:inherit;max-width:520px;margin:0 auto}
.ptt-now.live{background:#B3121F}.ptt-who{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ptt-x{border:0;background:rgba(255,255,255,.2);color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;flex:none}
.ptt-wave{display:flex;gap:3px;align-items:center;height:18px;flex:none}.ptt-wave i{width:4px;background:#fff;border-radius:2px;animation:pttw .8s ease-in-out infinite}.ptt-wave i:nth-child(2){animation-delay:.15s}.ptt-wave i:nth-child(3){animation-delay:.3s}
.ptt-panel{position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 110px);z-index:8998;background:#fff;color:#161B3D;border-radius:22px;padding:14px;box-shadow:0 20px 50px rgba(22,27,61,.3);max-height:70vh;display:flex;flex-direction:column;gap:10px;max-width:480px;margin:0 auto;font-family:inherit}
.ptt-ph{display:flex;align-items:center;gap:8px}.ptt-ph b{flex:1;font-size:16px}.ptt-ph button{border:0;background:#EEF1FD;color:#2D45C8;border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.ptt-conn{width:9px;height:9px;border-radius:50%;background:#E5383B;flex:none}.ptt-conn.on{background:#2E9E57}
.ptt-chs{display:grid;gap:6px;max-height:34vh;overflow:auto}.ptt-ch{display:flex;align-items:center;gap:8px;border:1.5px solid #E3E6EF;border-radius:14px;padding:8px 10px;cursor:pointer;background:#fff;font:inherit;color:inherit;text-align:left;width:100%}
.ptt-ch[aria-pressed=true]{border-color:#2D45C8;background:#EEF1FD}.ptt-ch b{flex:1;font-size:14px}.ptt-ch .lv{font-size:11px;font-weight:700;color:#fff;background:#E5383B;border-radius:999px;padding:2px 8px}
.ptt-ch .mu{border:0;background:none;font-size:16px;cursor:pointer;padding:2px 4px}.ptt-sec{font-size:12px;font-weight:700;color:#5B6386;margin:2px 2px 0}
.ptt-list{overflow:auto;display:grid;gap:6px;max-height:26vh}.ptt-it{display:grid;grid-template-columns:34px 1fr;grid-template-rows:auto auto;align-items:center;column-gap:10px;text-align:left;border:0;background:#F4F6FC;border-radius:14px;padding:8px 12px;font:inherit;color:inherit;cursor:pointer}
.ptt-it .ptt-pl{grid-row:1/3;width:34px;height:34px;border-radius:50%;background:#2D45C8;color:#fff;display:grid;place-items:center;font-size:12px}.ptt-it.hq .ptt-pl{background:#E5383B}.ptt-it.me{background:#E9F6EE}.ptt-it.me .ptt-pl{background:#1F7A43}
.ptt-it small{color:#5B6386;font-size:12px}.ptt-hint{margin:0;color:#5B6386;font-size:12.5px;text-align:center}
.ptt-toast{position:fixed;left:50%;top:90px;transform:translateX(-50%);z-index:9001;background:#161B3D;color:#fff;border-radius:999px;padding:10px 18px;font-weight:600}
.ptt-press{transform:scale(.94)}
.ptt-unlock{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 76px);transform:translateX(-50%);z-index:9002;border:0;background:#161B3D;color:#fff;border-radius:999px;padding:12px 20px;font:inherit;font-weight:700;font-size:14px;box-shadow:0 10px 30px rgba(0,0,0,.3);cursor:pointer;max-width:calc(100vw - 24px);animation:pttb 1.6s infinite}
@keyframes pttb{50%{opacity:.3}}@keyframes pttw{0%,100%{height:5px}50%{height:18px}}`;
  const el=document.createElement('div');el.className='ptt-ui';el.innerHTML=`<div class="ptt-talk" hidden><span class="ptt-dot"></span><b class="ptt-tl">กำลังพูด…</b><span class="ptt-t">0.0</span><span class="ptt-lv"><i></i></span><small class="ptt-ts">ปล่อยเพื่อส่ง · ลากนิ้วออกเพื่อยกเลิก</small></div>
    <button type="button" class="ptt-unlock" hidden>🔇 แตะเพื่อเปิดเสียงวอ</button>
    <div class="ptt-now" hidden><span class="ptt-wave"><i></i><i></i><i></i></span><span class="ptt-who"></span><button type="button" class="ptt-x" aria-label="หยุด">✕</button></div>
    <div class="ptt-panel" hidden role="dialog" aria-label="วอ"><div class="ptt-ph"><span class="ptt-conn"></span><b>📻 วอ</b><button type="button" class="ptt-close" aria-label="ปิด">✕</button></div>
      <p class="ptt-sec">ช่อง · แตะเพื่อเลือกช่องที่จะพูด · 🔔 = ฟังอยู่</p><div class="ptt-chs"></div><p class="ptt-sec">ฟังย้อนหลัง</p><div class="ptt-list"></div><p class="ptt-hint">กดค้างปุ่ม วอ เพื่อพูด</p></div>`;
  const $=s=>el.querySelector(s),esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const PAL=['#2D45C8','#1F7A43','#B45309','#7C3AED','#0E7490','#BE185D','#4D7C0F','#9333EA','#C2410C','#0369A1','#A16207','#15803D'];
  const col=it=>{if(it.kind==='hq')return '#E5383B';const k=String(it.sender||it.name||'');let h=0;for(const ch of k)h=(h*31+ch.codePointAt(0))>>>0;return PAL[h%PAL.length]};
  const hhmm=t=>new Date(t).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
  const lab=id=>(P.chans.find(c=>c.id===id)||{}).label||(id==='all'?'ช่องรวม':id);
  const toast=m=>{if(typeof window.toast==='function')window.toast(m);else{const d=document.createElement('div');d.className='ptt-toast';d.textContent=m;document.body.append(d);setTimeout(()=>d.remove(),2600)}};
  function mulaw(x){const s=x<0?0x80:0;let v=Math.min(32635,Math.abs(Math.round(x*32767)))+132;let e=7;for(let m=0x4000;!(v&m)&&e>0;e--,m>>=1);return ~(s|(e<<4)|((v>>(e+3))&0x0F))&0xFF}
  const ULAW=new Float32Array(256);for(let i=0;i<256;i++){const u=~i&0xFF,s=u&0x80,e=(u>>4)&7,m=u&0x0F;let v=((m<<3)+132)<<e;v-=132;ULAW[i]=(s?-v:v)/32768}
  function ctxGet(){if(!P.ctx){P.ctx=new (window.AudioContext||window.webkitAudioContext)();
      P.out=P.ctx.destination;if(P.cfg&&P.cfg.native&&P.ctx.createMediaStreamDestination){P.mdest=P.ctx.createMediaStreamDestination();P.media=new Audio();P.media.srcObject=P.mdest.stream;P.media.setAttribute('playsinline','')}}
    if(P.ctx.state!=='running')P.ctx.resume().catch(()=>{});if(P.media&&P.media.paused)P.media.play().catch(()=>{});return P.ctx}
  const outNode=()=>P.mdest&&document.hidden?P.mdest:P.ctx.destination;
  function spk(c,v){const hp=c.createBiquadFilter(),lp=c.createBiquadFilter(),ws=c.createWaveShaper(),g=c.createGain();hp.type='highpass';hp.frequency.value=380;lp.type='lowpass';lp.frequency.value=3100;
    if(!P.curve){const n=1024,k=new Float32Array(n);for(let i=0;i<n;i++){const x=i/(n-1)*2-1;k[i]=Math.tanh(2.2*x)/Math.tanh(2.2)}P.curve=k}ws.curve=P.curve;g.gain.value=v;hp.connect(lp);lp.connect(ws);ws.connect(g);g.connect(outNode());return hp}
  function tn(c,dst,t,f,d,type,lvl){const o=c.createOscillator(),g=c.createGain();o.type=type||'square';o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(lvl||.5,t+0.004);g.gain.setValueAtTime(lvl||.5,t+Math.max(0.005,d-0.008));g.gain.exponentialRampToValueAtTime(0.0001,t+d);o.connect(g);g.connect(dst);o.start(t);o.stop(t+d+0.02)}
  function nz(c,dst,t,d,lvl,fc,tail){if(!P.nzb){const b=c.createBuffer(1,c.sampleRate*0.6,c.sampleRate),a=b.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;P.nzb=b}
    const s=c.createBufferSource(),bp=c.createBiquadFilter(),g=c.createGain();s.buffer=P.nzb;bp.type='bandpass';bp.frequency.value=fc||1700;bp.Q.value=.6;
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(lvl,t+0.003);if(tail){g.gain.setValueAtTime(lvl,t+d*.7);g.gain.exponentialRampToValueAtTime(0.0001,t+d)}else{g.gain.exponentialRampToValueAtTime(lvl*.5,t+d*.6);g.gain.exponentialRampToValueAtTime(0.0001,t+d)}
    s.connect(bp);bp.connect(g);g.connect(dst);s.start(t,Math.random()*.3);s.stop(t+d+0.02)}
  function clk(c,dst,t,lvl){const o=c.createOscillator(),g=c.createGain();o.type='square';o.frequency.setValueAtTime(2400,t);o.frequency.exponentialRampToValueAtTime(300,t+0.012);g.gain.setValueAtTime(lvl||.6,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.015);o.connect(g);g.connect(dst);o.start(t);o.stop(t+0.03)}
  const SND={
    permit:(c,d,t)=>{clk(c,d,t,.5);[0,1,2].forEach(i=>tn(c,d,t+0.02+i*0.07,1000,0.045,'square',.32))},
    roger:(c,d,t)=>{tn(c,d,t,1250,0.06,'square',.3);tn(c,d,t+0.065,950,0.07,'square',.28);nz(c,d,t+0.14,0.17,.5,1800,true);clk(c,d,t+0.31,.35)},
    rx:(c,d,t)=>{clk(c,d,t,.45);nz(c,d,t+0.004,0.09,.45,1600)},
    over:(c,d,t)=>{tn(c,d,t,1150,0.07,'square',.28);nz(c,d,t+0.08,0.2,.5,1800,true);clk(c,d,t+0.28,.3)},
    busy:(c,d,t)=>{[0,1,2].forEach(i=>tn(c,d,t+i*0.22,420,0.15,'square',.35))},
    err:(c,d,t)=>{tn(c,d,t,300,0.12,'sawtooth',.35);tn(c,d,t+0.14,220,0.2,'sawtooth',.35)}};
  function sfx(name,vol){try{const c=ctxGet(),f=SND[name];if(f)f(c,spk(c,(vol||0.22)*1.3),c.currentTime+0.01)}catch(e){}
    try{navigator.vibrate&&navigator.vibrate({permit:35,roger:[20,40,20],busy:[60,60,60,60,60],err:120,rx:15}[name]||0)}catch(e){}}
  function beep(f,ms,at=0){sfx(f===880?'permit':f===660?'roger':f===1200?'rx':f===420?(at?'':'busy'):'err')}
  const canPlay=()=>P.ctx&&P.ctx.state==='running';
  function lockUI(){const u=$('.ptt-unlock');if(u)u.hidden=!P.cfg||canPlay()}
  function unlock(){ctxGet();setTimeout(lockUI,150);if(!P.clip){P.clip=new Audio();P.clip.preload='auto';P.clip.onended=clipDone;P.clip.onerror=clipDone}}
  function connect(){if(!P.cfg||P.ws&&P.ws.readyState<2||P.conn)return;P.conn=true;Promise.resolve(P.cfg.ws()).then(u=>{P.conn=false;if(!u)return later();if(P.ws&&P.ws.readyState<2)return;open(u)},()=>{P.conn=false;later()})}
  function open(u){let ws;try{ws=new WebSocket(u)}catch(e){return later()}P.ws=ws;ws.binaryType='arraybuffer';
    ws.onopen=()=>{P.retry=1000;clearInterval(P.ping);P.ping=setInterval(()=>{try{ws.readyState===1&&ws.send('{"t":"ping"}')}catch(e){}},25000)};
    ws.onmessage=e=>typeof e.data==='string'?onMsg(JSON.parse(e.data)):onAudio(e.data);
    ws.onclose=()=>{if(P.ws===ws){P.ws=null;P.up=false;P.wasDown=P.wasDown||Date.now();clearInterval(P.ping);if(P.tx&&P.tx.granted)stopTx(true);state();later()}}}
  function later(){clearTimeout(P.reT);P.reT=setTimeout(connect,P.retry);P.retry=Math.min(10000,P.retry*1.6)}
  function onMsg(m){
    if(m.t==='hello'){P.up=true;const known=new Set(P.chans.map(c=>c.id));P.chans=(m.chans||[]).map(id=>({id,label:(P.chans.find(c=>c.id===id)||{}).label||id}));if(!P.chans.some(c=>c.id===P.ch))P.ch='all';
      P.live.clear();(m.live||[]).forEach(f=>P.live.set(f.ch,f));loadChans();if(P.wasDown){P.wasDown=0;poll(true)}state();return}
    if(m.t==='granted'){const t=P.tx||P.last;if(!t||t.ch!==m.ch||t.id)return;t.id=m.id;if(P.tx===t){$('.ptt-talk').classList.remove('wait');$('.ptt-tl').textContent='กำลังพูด · '+lab(t.ch)}if(t.done){P.mine.add(t.id);upload(t,t.dur)}return}
    if(m.t==='busy'){const t=P.tx;if(t&&t.ch===m.ch){t.go=false;stopTx(true);sfx('busy');toast(`ช่องไม่ว่าง · ${m.kind==='hq'?'ศูนย์':m.name} กำลังพูด`)}return}
    if(m.t==='denied'){stopTx(true);sfx('err');toast('พูดในช่องนี้ไม่ได้');return}
    if(m.t==='start'){P.live.set(m.ch,m);if(!P.muted.has(m.ch)){pauseClip();ctxGet();if(canPlay())P.heard.add(m.id);else{lockUI();P.missed=Date.now()}P.rx.set(m.id,{ch:m.ch,next:0});show(m,true);sfx('rx',0.16)}state();return}
    if(m.t==='end'){P.live.delete(m.ch);const r=P.rx.get(m.id);const left=r&&P.ctx?Math.max(0,(r.next-P.ctx.currentTime)*1000):0;setTimeout(()=>{if(r&&!P.muted.has(m.ch))sfx('over',0.15);P.rx.delete(m.id);if(!P.rx.size)hideNow();nextClip()},left+150);state()}}
  function onAudio(buf){const u=new Uint8Array(buf),i=u.indexOf(124);if(i<0)return;const id=new TextDecoder().decode(u.subarray(0,i)),r=P.rx.get(id);if(!r||P.muted.has(r.ch))return;
    const c=ctxGet(),n=u.length-i-1;if(n<=0)return;const ab=c.createBuffer(1,n,8000),d=ab.getChannelData(0);for(let k=0;k<n;k++)d[k]=ULAW[u[i+1+k]];
    const s=c.createBufferSource();s.buffer=ab;s.connect(outNode());const now=c.currentTime;r.jit=r.jit||0.08;if(r.next&&r.next<now)r.jit=Math.min(0.25,r.jit+0.04);if(r.next<now+0.02)r.next=now+r.jit;s.start(r.next);r.next+=ab.duration}
  async function armTx(chOv){if(P.tx)return;unlock();if(!P.up){sfx('err');toast('วอยังไม่เชื่อมต่อ · รอสักครู่');connect();return}
    const t=P.tx={ch:chOv||P.ch,go:false,granted:false,pending:[],pcm:[],t0:Date.now(),done:false};
    try{if(!P.stream||!P.stream.active)P.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}})}
    catch(e){if(P.tx===t)P.tx=null;sfx('err');toast('ใช้ไมโครโฟนไม่ได้ · อนุญาตไมค์ในการตั้งค่าเครื่อง');return}
    if(P.tx!==t)return;const c=ctxGet(),src=c.createMediaStreamSource(P.stream),node=c.createScriptProcessor(1024,1,1),z=c.createGain();z.gain.value=0;let carry=0;
    const ratio=c.sampleRate/8000;
    node.onaudioprocess=e=>{if(P.tx!==t)return;const d=e.inputBuffer.getChannelData(0),out=[];let m=0;
      let p=carry;for(;p<d.length;p+=ratio){const a=Math.floor(p),b=Math.min(d.length,Math.max(a+1,Math.floor(p+ratio)));let s=0;for(let j=a;j<b;j++)s+=d[j];const v=Math.max(-1,Math.min(1,s/(b-a)*1.6));out.push(v);m=Math.max(m,Math.abs(v))}
      carry=p-d.length;t.lv=m;
      const f=new Float32Array(out),bytes=new Uint8Array(f.length);for(let k=0;k<f.length;k++)bytes[k]=mulaw(f[k]);
      if(t.go){t.pcm.push(f);send(bytes)}else{t.pending.push([f,bytes]);if(t.pending.length>6)t.pending.shift()}};
    src.connect(node);node.connect(z);z.connect(c.destination);t.nodes=[src,node,z];if(t.want)goTx()}
  function goTx(){const t=P.tx;if(!t){return}if(!t.nodes){t.want=true;return}if(t.go)return;
    if(P.live.has(t.ch)){const f=P.live.get(t.ch);stopTx(true);sfx('busy');toast(`ช่องไม่ว่าง · ${f.kind==='hq'?'ศูนย์':f.name} กำลังพูด`);return}
    P.ws.send(JSON.stringify({t:'talk',ch:t.ch}));t.go=true;t.granted=true;t.t0=Date.now();t.pending.forEach(([f,b])=>{t.pcm.push(f);send(b)});t.pending=[];pauseClip();
    sfx('permit');
    $('.ptt-talk').hidden=false;$('.ptt-talk').classList.add('wait');$('.ptt-tl').textContent='กำลังพูด · '+lab(t.ch);document.body.classList.add('ptt-on');
    P.talkT=setInterval(()=>{const s=(Date.now()-t.t0)/1000;$('.ptt-t').textContent=s.toFixed(1);$('.ptt-lv i').style.width=Math.min(100,(t.lv||0)*180)+'%';if(s>=40)endTx()},80)}
  function startTx(){armTx().then(goTx)}
  function send(b){try{P.ws&&P.ws.readyState===1&&P.ws.send(b)}catch(e){}}
  function teardown(t){clearInterval(P.talkT);try{t.nodes&&t.nodes.forEach(n=>n.disconnect())}catch(e){}$('.ptt-talk').hidden=true;document.body.classList.remove('ptt-on')}
  function stopTx(silent){const t=P.tx;if(!t)return;P.tx=null;teardown(t);try{t.go&&P.ws&&P.ws.send('{"t":"end"}')}catch(e){}if(!silent)sfx('roger');setTimeout(nextClip,300)}
  function endTx(cancel){const t=P.tx;if(!t)return;const dur=(Date.now()-t.t0)/1000;
    if(cancel||!t.go||dur<0.35){stopTx(true);if(!cancel&&t.go)toast('กดค้างไว้ระหว่างพูด');return}
    stopTx();t.dur=dur;t.done=true;P.last=t;if(t.id){P.mine.add(t.id);upload(t,dur)}}
  function wav(fl){const n=fl.reduce((s,a)=>s+a.length,0),pcm=new Int16Array(n);let o=0;fl.forEach(a=>{for(let i=0;i<a.length;i++)pcm[o++]=a[i]<0?a[i]*0x8000:a[i]*0x7FFF});
    const buf=new ArrayBuffer(44+n*2),dv=new DataView(buf),w=(p,s)=>{for(let i=0;i<s.length;i++)dv.setUint8(p+i,s.charCodeAt(i))};
    w(0,'RIFF');dv.setUint32(4,36+n*2,true);w(8,'WAVE');w(12,'fmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,1,true);dv.setUint32(24,8000,true);dv.setUint32(28,16000,true);dv.setUint16(32,2,true);dv.setUint16(34,16,true);w(36,'data');dv.setUint32(40,n*2,true);new Int16Array(buf,44).set(pcm);return new Uint8Array(buf)}
  async function upload(t,dur){const b=wav(t.pcm);let bin='';for(let i=0;i<b.length;i+=0x8000)bin+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));
    const it={n:'l'+t.id,ch:t.ch,talk:t.id,sender:P.cfg.me().sender,kind:P.cfg.me().kind,dur,at:Date.now(),local:true,blob:URL.createObjectURL(new Blob([b],{type:'audio/wav'}))};P.list.push(it);draw();
    for(let k=0;k<3;k++){try{const r=await P.cfg.post({action:'ptt_send',audio:btoa(bin),dur:Math.round(dur*10)/10,ch:t.ch,talk:t.id});if(r&&r.ok){it.n=r.n;it.local=false;P.mine.add(r.n);draw();return}}catch(e){}await new Promise(r=>setTimeout(r,1500))}
    it.fail=true;draw()}
  async function loadChans(){try{const r=await P.cfg.api({action:'ptt_auth'});if(r&&r.ok){P.chans=r.chans;if(!P.chans.some(c=>c.id===P.ch))P.ch='all';state()}}catch(e){}}
  async function poll(missed){if(!P.cfg)return;try{const r=await P.cfg.api({action:'ptt_list',since:Math.max(0,P.since)});if(!r||!r.ok)return;const first=P.since<0;
    (r.items||[]).forEach(it=>{if(P.list.some(x=>x.n===it.n||x.talk&&x.talk===it.talk))return;P.list.push(it);
      if(!first&&!P.heard.has(it.talk)&&!P.mine.has(it.n)&&!P.mine.has(it.talk)&&!P.muted.has(it.ch||'all')&&Date.now()-it.at<120e3)P.queue.push(it)});
    if(r.items&&r.items.length)P.since=Math.max(P.since,...r.items.map(i=>i.n));else if(first)P.since=0;P.list=P.list.slice(-60);draw();nextClip()}catch(e){}}
  function nextClip(){if(P.playing||P.tx||P.rx.size||!P.queue.length)return;const it=P.queue.shift();P.playing=it;unlock();P.clip.src=it.blob||P.cfg.url(it.n);show(it,false);P.clip.play().catch(()=>{$('.ptt-who').textContent+=' · แตะเพื่อฟัง';$('.ptt-now').onclick=()=>P.clip.play().catch(()=>{})})}
  function clipDone(){P.playing=null;hideNow();setTimeout(nextClip,250)}
  function pauseClip(){if(P.playing){P.clip.pause();P.queue.unshift(P.playing);P.playing=null}}
  function show(it,live){const n=$('.ptt-now');n.classList.toggle('live',!!live);n.style.background=live?'':col(it);n.style.borderLeft=live?`8px solid ${col(it)}`:'';$('.ptt-who').textContent=`${live?'🔴 สด · ':''}${it.kind==='hq'?(it.name&&it.name!=='ศูนย์'?it.name:'ศูนย์'):(it.name||it.sender)} · ${lab(it.ch||'all')}${live?'':' · '+hhmm(it.at)}`;n.hidden=false;n.onclick=null}
  function hideNow(){if(!P.rx.size&&!P.playing)$('.ptt-now').hidden=true}
  function state(){$('.ptt-conn').classList.toggle('on',P.up);LS('ptt_ch',P.ch);if(P.cfg&&P.cfg.onState)P.cfg.onState({up:P.up,ch:P.ch,label:lab(P.ch),live:P.live.has(P.ch)});draw()}
  function draw(){if($('.ptt-panel').hidden)return;
    $('.ptt-chs').innerHTML=P.chans.map(c=>{const lv=P.live.get(c.id);return `<div class="ptt-ch" role="button" tabindex="0" data-ch="${esc(c.id)}" aria-pressed="${c.id===P.ch}"><b>${esc(c.label)}</b>${lv?`<span class="lv">สด · ${esc(lv.kind==='hq'?'ศูนย์':lv.name)}</span>`:''}<button type="button" class="mu" data-mu="${esc(c.id)}" aria-label="${P.muted.has(c.id)?'เปิดเสียงช่อง':'ปิดเสียงช่อง'}">${P.muted.has(c.id)?'🔕':'🔔'}</button></div>`}).join('')||'<p class="ptt-hint">กำลังเชื่อมต่อ…</p>';
    const xs=P.list.filter(it=>(it.ch||'all')===P.ch).slice().reverse();
    $('.ptt-list').innerHTML=xs.map(it=>`<button type="button" class="ptt-it${it.kind==='hq'?' hq':''}${P.mine.has(it.n)||P.mine.has(it.talk)||it.local?' me':''}" data-pn="${esc(it.n)}"><span class="ptt-pl" style="background:${col(it)}">▶</span><b style="color:${col(it)}">${esc(it.kind==='hq'?(it.name||'ศูนย์'):it.sender)}</b><small>${hhmm(it.at)} · ${Number(it.dur||0).toFixed(0)} วิ${it.fail?' · อัปโหลดไม่สำเร็จ':it.local?' · กำลังบันทึก…':''}</small></button>`).join('')||'<p class="ptt-hint">ยังไม่มีเสียงในช่องนี้</p>'}
  el.addEventListener('click',e=>{const t=e.target;
    if(t.closest('.ptt-close')){$('.ptt-panel').hidden=true;return}
    if(t.closest('.ptt-x')){e.stopPropagation();if(P.playing){P.clip.pause();clipDone()}P.queue=[];$('.ptt-now').hidden=true;return}
    const mu=t.closest('[data-mu]');if(mu){e.stopPropagation();const id=mu.dataset.mu;P.muted.has(id)?P.muted.delete(id):P.muted.add(id);LS('ptt_muted',JSON.stringify([...P.muted]));draw();return}
    const ch=t.closest('[data-ch]');if(ch){P.ch=ch.dataset.ch;state();return}
    const b=t.closest('[data-pn]');if(b){const it=P.list.find(x=>String(x.n)===b.dataset.pn);if(it){unlock();if(P.playing){P.clip.pause();P.playing=null}P.queue.unshift(it);nextClip()}}});
  function bind(btn,o){o=o||{};let downAt=0,pid=null,holdT=null,talking=false;
    btn.addEventListener('contextmenu',e=>e.preventDefault());
    btn.addEventListener('pointerdown',e=>{e.preventDefault();unlock();downAt=Date.now();pid=e.pointerId;try{btn.setPointerCapture(pid)}catch(x){}btn.classList.add('ptt-press');armTx(o.ch?o.ch():null);holdT=setTimeout(()=>{talking=true;goTx()},150)});
    const end=e=>{if(pid==null)return;clearTimeout(holdT);btn.classList.remove('ptt-press');const r=btn.getBoundingClientRect(),out=e.type==='pointercancel'||e.clientX<r.left-50||e.clientX>r.right+50||e.clientY<r.top-90;
      if(talking){talking=false;endTx(out)}else{const t=P.tx;if(t&&!t.go)stopTx(true);if(Date.now()-downAt<150)(o.tap||toggle)()}pid=null};
    btn.addEventListener('pointerup',end);btn.addEventListener('pointercancel',end)}
  function toggle(){const p=$('.ptt-panel');p.hidden=!p.hidden;if(!p.hidden){loadChans();poll()}draw()}
  function init(cfg){if(P.cfg)return;P.cfg=cfg;document.head.append(st);document.body.append(el);loadChans();connect();poll();
    setInterval(()=>{if(!P.up||!document.hidden&&!$('.ptt-panel').hidden)poll()},6000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){connect();ctxGet()}});addEventListener('online',()=>{P.retry=1000;connect()});
    const tryUnlock=()=>{if(canPlay()&&P.clip&&!(P.playing&&P.clip.paused))return;unlock();setTimeout(()=>{if(!canPlay())return;if(P.playing&&P.clip.paused)P.clip.play().catch(()=>{});if(P.missed){P.missed=0;poll()}},300)};['pointerdown','keydown','touchend'].forEach(ev=>document.addEventListener(ev,tryUnlock,true));
    $('.ptt-unlock').addEventListener('click',()=>{unlock();setTimeout(()=>{lockUI();poll()},300)});setTimeout(()=>{ctxGet();lockUI()},1500)}
  return {init,bind,open:toggle,state:()=>({up:P.up,ch:P.ch,label:lab(P.ch)})}})();
