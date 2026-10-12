const VERIFY=(()=>{
  const ROADS_URL='https://www.floodboard.org/api/export/roads.geojson';
  const REPORTS_URL='https://www.floodboard.org/api/export/reports.csv';
  const F={roads:[],reports:[],sensors:[],stations:[],cams:[],gauges:[],env:new Map(),envAsk:new Map(),envPending:new Set(),envTimer:null,loaded:0,error:'',loading:null};
  const LV_CM={ankle:10,knee:45,waist:90,chest:120,roof:180};
  const LV_PTS={ankle:3,knee:6,waist:12,chest:18,roof:24};
  const NEED_PTS=[[/อพยพ|ติดอยู่|ติดค้าง/,8],[/ผู้ป่วย|ป่วย|ยา|ออกซิเจน|ฟอกไต|บาดเจ็บ/,6],[/เรือ|รถสูง/,4]];
  const R_MAX=40,E_MAX=60,E_SCALE=1.2;
  const VERDICT_TH={blocked:'ผ่านไม่ได้',risky:'เสี่ยง',caution:'ระวัง',ok:'ผ่านได้'};
  const RESULT={
    confirmed:{t:'วิกฤตจริง',d:'ข้อมูลรอบจุดยืนยันว่าท่วม',k:'confirmed'},
    likely:{t:'น่าจะวิกฤต',d:'มีหลักฐานน้ำท่วมใกล้จุด',k:'likely'},
    conflict:{t:'ข้อมูลขัดแย้ง',d:'ผู้แจ้งบอกหนัก แต่ข้อมูลล่าสุดว่าน้ำลด · โทรยืนยัน',k:'conflict'},
    notcrit:{t:'ไม่น่าวิกฤต',d:'มีน้ำ แต่ไม่รุนแรง',k:'notcrit'},
    unverified:{t:'รอตรวจเพิ่ม',d:'ยังไม่มีข้อมูลใกล้จุด · โทรถาม',k:'unverified'},
    nopin:{t:'ยืนยันไม่ได้',d:'ไม่มีหมุด/ที่อยู่ · โทรถามตำแหน่ง',k:'nopin'}
  };

  function parseCSV(txt){const rows=[];let row=[],cur='',q=false;
    for(let i=0;i<txt.length;i++){const ch=txt[i];
      if(q){if(ch==='"'){if(txt[i+1]==='"'){cur+='"';i++}else q=false}else cur+=ch}
      else if(ch==='"')q=true;else if(ch===','){row.push(cur);cur=''}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&txt[i+1]==='\n')i++;row.push(cur);cur='';if(row.length>1||row[0])rows.push(row);row=[]}else cur+=ch}
    if(cur||row.length){row.push(cur);rows.push(row)}
    const h=(rows.shift()||[]).map(x=>x.replace(/^﻿/,'').trim());return rows.map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]])))}
  function verdictOf(p){const v=p.verdict;if(typeof v==='string')return v;if(!v)return '';return v.sedan||v.pickup||v.motorbike||''}
  async function load(force){
    if(F.loading)return F.loading;if(!force&&F.loaded&&Date.now()-F.loaded<10*60e3)return;
    F.loading=(async()=>{
      const base=(typeof API_URL!=='undefined'?API_URL:'/api');
      const [ro,re,wa,cc]=await Promise.allSettled([fetch(ROADS_URL,{cache:'no-store'}).then(r=>{if(!r.ok)throw 0;return r.json()}),fetch(REPORTS_URL,{cache:'no-store'}).then(r=>{if(!r.ok)throw 0;return r.text()}),
        fetch(base+'?action=water').then(r=>r.json()),fetch(base+'?action=cctv').then(r=>r.json())]);
      if(wa.status==='fulfilled'&&wa.value&&wa.value.ok){F.sensors=wa.value.sensors||[];F.stations=wa.value.stations||[]}
      // ThaiWater (429) และ dds กทม. (Cloudflare challenge 403) ปฏิเสธคำขอจาก Cloudflare Workers แต่เปิด CORS ให้เบราว์เซอร์ จึงดึงตรงจากเครื่องผู้ใช้เมื่อเซิร์ฟเวอร์ดึงไม่ได้
      if(!F.sensors.length)try{const dd=await fetch('https://floodbangkok.bangkok.go.th/bkk/dds/services/api/floods/v1/items/sensor_now?limit=-1&fields=flood_now,flood_max,timestamp,sensor_profile.code,sensor_profile.name,sensor_profile.road,sensor_profile.district,sensor_profile.lat,sensor_profile.long,sensor_profile.device_status').then(r=>r.json());
        F.sensors=(dd.data||[]).map(x=>{const p=x.sensor_profile||{};return {code:p.code||'',name:p.name||'',road:p.road||'',district:p.district||'',lat:+p.lat,lng:+p.long,
          now:x.flood_now==null?null:+x.flood_now,max:x.flood_max==null?null:+x.flood_max,status:p.device_status||'',t:x.timestamp?Date.parse(x.timestamp+(/[zZ+]/.test(x.timestamp.slice(-6))?'':'Z')):0}}).filter(x=>isFinite(x.lat)&&isFinite(x.lng))}catch(e){}
      if(!F.stations.some(s=>s.src!=='yala'))try{const tw=await fetch('https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load?province_code=10').then(r=>r.json());
        F.stations=F.stations.concat(((tw.waterlevel_data||{}).data||[]).map(x=>{const st=x.station||{},nm=st.tele_station_name||{};return {id:st.id,name:nm.th||nm.en||'',lat:+st.tele_station_lat,lng:+st.tele_station_long,
          level:x.waterlevel_msl==null?null:+x.waterlevel_msl,bank:st.min_bank==null?null:+st.min_bank,diff:x.diff_wl_bank==null?null:+x.diff_wl_bank,situation:+x.situation_level||0,
          t:x.waterlevel_datetime?Date.parse(x.waterlevel_datetime.replace(' ','T')+':00+07:00'):0,agency:((x.agency||{}).agency_shortname||{}).th||''}}).filter(x=>isFinite(x.lat)&&isFinite(x.lng)))}catch(e){}
      if(cc.status==='fulfilled'&&cc.value&&cc.value.ok)F.cams=cc.value.cams||[];
      try{const rg=await fetch('https://api-v3.thaiwater.net/api/v1/thaiwater30/public/rain_24h').then(r=>r.json());
        F.gauges=(rg.data||[]).map(x=>{const st=x.station||{};return {name:(st.tele_station_name||{}).th||'',lat:+st.tele_station_lat,lng:+st.tele_station_long,h24:+x.rain_24h||0,h1:+x.rain_1h||0,
          t:x.rainfall_datetime?Date.parse(x.rainfall_datetime.replace(' ','T')+':00+07:00'):0}}).filter(g=>isFinite(g.lat)&&isFinite(g.lng)&&g.t&&Date.now()-g.t<36*36e5)}catch(e){}
      damSync(base);
      let ok=0;
      if(ro.status==='fulfilled'){ok++;F.roads=[];(ro.value.features||[]).forEach(f=>{const g=f.geometry||{},p=f.properties||{};
        const lines=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];
        F.roads.push({name:p.name||p.nameEn||'ถนนไม่ทราบชื่อ',depth:p.depthCm==null?null:Number(p.depthCm),verdict:verdictOf(p),closed:!!p.closedAll,conf:p.conf==null?0.6:Number(p.conf),updated:Number(p.updated)||0,sources:p.sources||[],lines})})}
      if(re.status==='fulfilled'){ok++;F.reports=parseCSV(re.value).map(r=>({lat:+r.lat,lng:+r.lon,t:Date.parse(r.time_utc)||0,source:r.source||'',tier:r.tier||'',depth:r.depth_cm===''||r.depth_cm==null?null:Number(r.depth_cm),closed:r.closed_all==='true',cleared:r.cleared==='true',w:Number(r.current_weight)||0,text:r.text||'',url:r.url||''})).filter(r=>isFinite(r.lat)&&isFinite(r.lng))}
      F.error=ok===2?'':ok?'โหลดข้อมูลน้ำท่วมได้บางส่วน':'โหลดข้อมูลน้ำท่วมไม่สำเร็จ';
      if(ok)F.loaded=Date.now();
    })().finally(()=>{F.loading=null});
    return F.loading;
  }

  // เขื่อน/อ่างเก็บน้ำ: ThaiWater ปฏิเสธ worker (429) เบราว์เซอร์เจ้าหน้าที่จึงดึงแล้วส่งให้ worker บันทึกลง intel (ใช้ในสรุปสถานการณ์ของ AI) · worker บอกว่าถึงรอบหรือยัง
  async function damSync(base){
    const key=(typeof ADM!=='undefined'&&ADM.key)||(typeof A!=='undefined'&&A.key);if(!key)return;
    try{if(Date.now()-(+localStorage.getItem('uh_dam_ask')||0)<10*60e3)return;localStorage.setItem('uh_dam_ask',String(Date.now()))}catch(e){}
    const post=b=>fetch(base,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'intel_dams',key,...b})}).then(r=>r.json());
    try{if(!(await post({})).due)return;
      const d=((await fetch('https://api-v3.thaiwater.net/api/v1/thaiwater30/analyst/dam').then(r=>r.json())).data)||{},old=Date.now()-3*864e5;
      const map=(r,size)=>{const m=r.dam||{},nm=m.dam_name||{},num=v=>v==null?null:+v;return {id:m.id,name:nm.th||nm.en||'',size,lat:+m.dam_lat,lng:+m.dam_long,date:String(r.dam_date||'').slice(0,10),
        t:Date.parse(String(r.dam_date||'').slice(0,10)+'T00:00:00+07:00')||0,pct:num(r.dam_storage_percent),storage:num(r.dam_storage),inflow:num(r.dam_inflow),released:num(r.dam_released),spilled:num(r.dam_spilled),
        agency:(((r.agency||{}).agency_shortname||{}).th||'').trim()}};
      const large=(d.dam_daily||[]).map(r=>map(r,'large')).filter(x=>x.name&&x.t>=old),medium=(d.dam_medium||[]).map(r=>map(r,'medium')).filter(x=>x.name&&x.t>=old&&x.pct>=100);
      if(large.length)await post({large,medium})}catch(e){}
  }

  function proj(lat0){const kx=Math.cos(lat0*Math.PI/180)*111320,ky=110540;return (lat,lng,lng0)=>[(lng-lng0)*kx,(lat-lat0)*ky]}
  function distToLines(lat,lng,lines){const P=proj(lat);let best=Infinity;
    lines.forEach(line=>{for(let i=0;i<line.length;i++){const [x1,y1]=P(line[i][1],line[i][0],lng);
      if(i===0){best=Math.min(best,Math.hypot(x1,y1));continue}
      const [x0,y0]=P(line[i-1][1],line[i-1][0],lng),dx=x1-x0,dy=y1-y0,L=dx*dx+dy*dy;let t=L?-(x0*dx+y0*dy)/L:0;t=Math.max(0,Math.min(1,t));best=Math.min(best,Math.hypot(x0+t*dx,y0+t*dy))}});return best}
  function dist(lat,lng,lat2,lng2){const P=proj(lat);const [x,y]=P(lat2,lng2,lng);return Math.hypot(x,y)}

  const envKey=(lat,lng)=>(+lat).toFixed(3)+','+(+lng).toFixed(3);
  function envOf(lat,lng){const k=envKey(lat,lng),v=F.env.get(k),asked=F.envAsk.get(k)||0;
    if((!v||Date.now()-v._t>30*60e3||(v._retry&&Date.now()-asked>20e3))&&Date.now()-asked>(v&&!v._retry?30*60e3:v&&v._retry?20e3:2*60e3)){F.envPending.add(k);clearTimeout(F.envTimer);F.envTimer=setTimeout(flushEnv,400)}
    return v||null}
  async function flushEnv(){const ks=[...F.envPending].slice(0,300);F.envPending.clear();if(!ks.length)return;const now=Date.now();ks.forEach(k=>F.envAsk.set(k,now));
    let key='';try{key=localStorage.getItem('uh_vol_key')||sessionStorage.getItem('uh_vol_key')||''}catch(e){}const ab=typeof VERIFY.authBody==='function'?VERIFY.authBody():VERIFY.authBody,auth=ab||(key?{key}:null);if(!auth)return;
    try{const r=await fetch((typeof API_URL!=='undefined'?API_URL:'/api'),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'env_check',...auth,points:ks.map(k=>{const [a,o]=k.split(',');return {lat:+a,lng:+o}})})}).then(x=>x.json());
      if(r&&r.ok){F.gistda=!!r.gistda;Object.entries(r.points||{}).forEach(([k,v])=>{if(v.rain||v.sat){const old=F.env.get(k),tries=(old&&old._tries||0)+1,retry=r.gistda&&(!v.sat||v.sat.pending)&&tries<6;F.env.set(k,{...v,sat:v.sat&&!v.sat.pending&&!v.sat.error?v.sat:undefined,_t:Date.now(),_retry:retry,_tries:retry?tries:0})}});F.loaded=Date.now();if(typeof VERIFY.onUpdate==='function')VERIFY.onUpdate()}}catch(e){}}
  function nearestGauge(lat,lng){let g=null;F.gauges.forEach(x=>{const d=dist(lat,lng,x.lat,x.lng);if(d<=10000&&(!g||d<g.d))g={...x,d}});return g}

  function parseCctv(v){const [s,t]=String(v||'').split('|');return s==='flood'||s==='clear'?{s,t:t||''}:null}
  function sevPts(d,v,closed){if(v==='blocked'||closed||(d!=null&&d>=50))return 40;if(v==='risky'||(d!=null&&d>=30))return 30;if(v==='caution'||(d!=null&&d>=10))return 18;return 8}
  function recency(t){if(!t)return .5;const h=(Date.now()-t)/36e5;return h<=24?1:h<=72?.7:.4}
  function assess(c){const o=assess0(c),s=Number(c.sevSet);
    if(s>=1&&s<=3){o.sysLevel=o.level;o.sysWhy=o.levelWhy;o.level=s;o.manual=true;
      o.levelWhy='เจ้าหน้าที่กำหนดเอง'+(c.sevBy?` (${c.sevBy})`:'')+` · ระบบเสนอ: ${['','ทั่วไป','เร่งด่วน','วิกฤต'][o.sysLevel]||'-'}`}
    return o}
  function assess0(c){
    const vul=(Array.isArray(c.vulnerable)?c.vulnerable:String(c.vulnerable||'').split(/\s*,\s*/)).filter(Boolean);
    const LV_TH={ankle:'ข้อเท้า',knee:'เข่า',waist:'เอว',chest:'อก',roof:'มิดหัว/หลังคา'};
    const needTxt=(c.needs||[]).join(' ')+' '+String(c.notes||'').slice(0,300);
    let R=LV_PTS[c.level]||0,needPts=0;NEED_PTS.forEach(([re,p])=>{if(re.test(needTxt))needPts=Math.max(needPts,p)});R+=needPts;
    const ppl=Number(c.people)||1;R+=ppl>=50?4:ppl>=10?2:0;if(Array.isArray(c.photos)&&c.photos.length)R+=2;
    const vulCrit=vul.some(v=>['bedridden','oxygen','dialysis'].includes(v));
    R+=vulCrit?8:vul.length?4:0;R=Math.min(R_MAX,R);
    const why=[];if(c.level)why.push('น้ำถึง'+(LV_TH[c.level]||c.level));else why.push('ไม่ระบุระดับน้ำ');if(needPts)why.push('ต้องการ '+(c.needs||[]).join(', '));
    if(vul.length)why.push('มีกลุ่มเปราะบาง'+(vul.some(v=>['bedridden','oxygen','dialysis'].includes(v))?' (ติดเตียง/ออกซิเจน/ฟอกไต)':''));if(Number(c.people)>=10)why.push(c.people+' คน');
    const reporterSevere=c.level==='chest'||c.level==='roof'||vul.some(v=>['bedridden','oxygen','dialysis'].includes(v));
    const cctv=parseCctv(c.cctv);
    const out={R,E:0,score:R,ev:[],chips:[],road:null,reports:[],cctv,result:null,why,ext:[],vulCrit,hard:hardship(c),deep:['waist','chest','roof'].includes(c.level),veryDeep:['chest','roof'].includes(c.level)};
    const m=d=>d<1000?Math.round(d)+' ม.':(d/1000).toFixed(1)+' กม.',chip=(t,k)=>out.chips.push({t,k});
    const photoEv=()=>{
    const pa=c.photoAi;
    if(pa&&pa.n){if(pa.flood==='yes'){const d=pa.depth||0,pts=Math.min(20,(d>=100?18:d>=50?14:d>=20?9:5)+(pa.inside?2:0)+(pa.danger==='high'?3:0));out.E+=pts;out.photoFlood=d||10;
        out.ev.push(`AI ดูรูปผู้แจ้ง ${pa.n} รูป: เห็นน้ำท่วม${d?` ลึก ~${d} ซม.`:''}${pa.inside?' · น้ำเข้าบ้าน':''}${pa.danger==='high'?' · อันตรายสูง':''}${pa.note?' · '+pa.note:''}`);
        chip(`รูป: น้ำ${d?' ~'+d+' ซม.':'ท่วม'}${pa.inside?' ในบ้าน':''}`,d>=50||pa.danger==='high'?'bad':'warn')}
      else if(pa.flood==='no'){out.ev.push(`AI ดูรูปผู้แจ้ง ${pa.n} รูป: ไม่เห็นน้ำท่วมในภาพ`);chip('รูป: ไม่เห็นน้ำ','na')}
      else out.ev.push(`AI ดูรูปผู้แจ้ง ${pa.n} รูป: ภาพไม่ชัดพอจะบอกได้`)}
    else if(Array.isArray(c.photos)&&c.photos.length)out.ev.push('รูปจากผู้แจ้ง: รอ AI ตรวจภาพ');
    };
    const hasPin=c.lat!==''&&c.lat!=null&&c.lng!==''&&c.lng!=null&&isFinite(+c.lat)&&isFinite(+c.lng);
    const addrTxt=[c.address,c.district].filter(Boolean).join(' ').replace(/[\s\-–—.,]/g,''),clearAddr=addrTxt.length>=6;
    if(!hasPin||!clearAddr){out.result=RESULT.nopin;
      if(!hasPin){out.ev.push('ไม่มีพิกัด จึงเทียบกับแผนที่น้ำท่วมไม่ได้');chip('ไม่มีหมุด','na')}
      if(!clearAddr){out.ev.push('ไม่มีที่อยู่ / จุดสังเกตที่ชัดเจน ทีมหาบ้านไม่เจอ');chip('ที่อยู่ไม่ชัด','na')}
      if(!hasPin){photoEv();if(cctv)applyCctv(out,reporterSevere);return finish(out,reporterSevere,false)}}
    const lat=+c.lat,lng=+c.lng;
    let near=null;F.roads.forEach(r=>{const d=distToLines(lat,lng,r.lines);if(d<=800&&(!near||d<near.d))near={...r,d}});
    if(near){const base=sevPts(near.depth,near.verdict,near.closed)*recency(near.updated)*(.5+.5*Math.min(1,near.conf))*(near.d<=300?1:.6);out.E+=base;out.road=near;
      out.ev.push(`ถนนน้ำท่วม "${near.name}" ห่าง ${Math.round(near.d)} ม.${near.depth!=null?` · ลึก ~${near.depth} ซม.`:''}${near.verdict?` · ${VERDICT_TH[near.verdict]||near.verdict}`:''}`);
      chip(`ถนน ${m(near.d)} · ${near.depth!=null?near.depth+' ซม.':VERDICT_TH[near.verdict]||'มีน้ำ'}`,near.verdict==='ok'&&!(near.depth>=10)?'ok':'bad')}
    let sn=null;F.sensors.forEach(x=>{if(x.status==='malfunction'||x.now==null)return;const d=dist(lat,lng,x.lat,x.lng);if(d<=1000&&(!sn||d<sn.d))sn={...x,d}});
    let sensorClear=false;
    if(sn){out.sensor=sn;const fresh=sn.t&&Date.now()-sn.t<3*36e5,tt=sn.t?new Date(sn.t).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):'';
      if(sn.now>=5){out.E+=(sn.now>=30?25:sn.now>=15?18:10)*(sn.d<=500?1:.6)*(fresh?1:.6);out.ev.push(`เซ็นเซอร์น้ำ กทม. "${sn.name}" ห่าง ${Math.round(sn.d)} ม. วัดได้ ${sn.now} ซม.${tt?` (${tt} น.)`:''}`);chip(`เซ็นเซอร์ ${m(sn.d)} · ${sn.now} ซม.`,'bad')}
      else{if(sn.d<=500&&fresh)sensorClear=true;out.ev.push(`เซ็นเซอร์น้ำ กทม. "${sn.name}" ห่าง ${Math.round(sn.d)} ม. ไม่พบน้ำท่วมบนถนน${tt?` (${tt} น.)`:''} · ในซอย/บ้านอาจยังท่วม`);chip(`เซ็นเซอร์ ${m(sn.d)} · ถนนแห้ง`,'ok')}}
    const since=Date.now()-72*36e5,rs=F.reports.filter(r=>r.t>=since).map(r=>({...r,d:dist(lat,lng,r.lat,r.lng)})).filter(r=>r.d<=1000).sort((a,b)=>a.d-b.d);
    const active=rs.filter(r=>!r.cleared),cleared=rs.filter(r=>r.cleared&&r.d<=600&&Date.now()-r.t<24*36e5);
    let rp=0;active.forEach(r=>{const dep=r.depth==null?.35:r.depth>=50?1:r.depth>=30?.7:r.depth>=10?.45:.3;rp+=(.4+Number(r.w||0))*dep*(r.tier==='official'?1.5:1)*(r.d<=400?1:.6)*8+(r.closed?3:0)});
    rp=Math.min(20,rp);out.E+=rp;out.reports=active.slice(0,5);
    if(active.length){out.ev.push(`รายงานน้ำท่วมรอบจุด ${active.length} รายการใน 3 วัน (ใกล้สุด ${Math.round(active[0].d)} ม.)`);chip(`รายงาน ${active.length} · ใกล้สุด ${m(active[0].d)}`,'bad')}
    const recentlyCleared=cleared.length&&!active.some(r=>r.t>cleared[0].t);
    if(recentlyCleared){out.ev.push('มีรายงานล่าสุดว่าน้ำลด / ระบายแล้วใกล้จุดนี้');chip('รายงานล่าสุด: น้ำลด','ok')}
    if(cctv)applyCctv(out,reporterSevere);
    const ev2=envOf(lat,lng),sat=ev2&&ev2.sat;
    if(sat&&!sat.error)out.sat=sat;
    if(sat&&!sat.error){const dd=sat.date?new Date(sat.date).toLocaleDateString('th-TH',{day:'numeric',month:'short'}):'',fresh=sat.date&&Date.now()-Date.parse(sat.date)<3*864e5;
      if(sat.inside){out.satInside=true;out.E+=fresh?25:15;out.ev.push(`ดาวเทียม GISTDA: จุดนี้อยู่ในพื้นที่น้ำท่วม${dd?' (ภาพ '+dd+')':''}`);chip('ดาวเทียม: ท่วม'+(dd?' '+dd:''),'bad')}
      else if(sat.dM!=null&&sat.dM<=300){out.E+=fresh?15:10;out.ev.push(`ดาวเทียม GISTDA: พบน้ำท่วมห่าง ${m(sat.dM)}${dd?' (ภาพ '+dd+')':''}`);chip('ดาวเทียม: ท่วมห่าง '+m(sat.dM),'bad')}
      else if(sat.dM!=null&&sat.dM<=1000){out.E+=6;out.ev.push(`ดาวเทียม GISTDA: พบน้ำท่วมห่าง ${m(sat.dM)} · ${sat.near} จุดใน 500 ม.`);chip('ดาวเทียม: ท่วมห่าง '+m(sat.dM),'warn')}
      else{out.ev.push('ดาวเทียม GISTDA (7 วัน): ไม่พบน้ำท่วมใน 1 กม. · ในเมือง/ใต้หลังคาดาวเทียมอาจมองไม่เห็น');chip('ดาวเทียม: ไม่พบ','na')}}
    else if(ev2&&!sat)out.ev.push(F.gistda?'ดาวเทียม GISTDA: กำลังตรวจจุดนี้…':'ดาวเทียม GISTDA: ยังไม่ได้เปิดใช้');
    photoEv();
    const rain=ev2&&ev2.rain,g=nearestGauge(lat,lng),r24=Math.max(rain?rain.h24:0,g?g.h24:0);
    if(rain||g){const pts=r24>=90?12:r24>=50?8:r24>=20?4:0;out.E+=pts;
      out.ev.push(`ฝน 24 ชม.: ${rain?`~${rain.h24} มม. (3 ชม.ล่าสุด ${rain.h3} มม.)`:''}${rain&&g?' · ':''}${g?`สถานีวัดฝน "${g.name}" ห่าง ${m(g.d)} วัดได้ ${g.h24} มม.`:''}${rain&&rain.next3>=5?` · คาดฝนอีก ${rain.next3} มม. ใน 3 ชม.`:''}`);
      if(r24>=20)chip(`ฝน 24 ชม. ${Math.round(r24)} มม.`,r24>=50?'bad':'warn');
      if(rain&&rain.next3>=10){out.E+=4;chip(`ฝนหนักใน 3 ชม. (${rain.next3} มม.)`,'bad')}else if(rain&&rain.next3>=5)chip('ฝนจะตกใน 3 ชม.','warn')}
    if(sensorClear&&!active.length&&!near)out.sensorClear=true;
    if(!near&&!active.length&&!cctv&&!sn&&!(sat&&(sat.inside||sat.dM<=1000))&&!(c.photoAi&&c.photoAi.flood==='yes')){out.ev.push(F.loaded?'ไม่พบข้อมูลน้ำท่วมจาก Floodboard ใกล้จุดนี้ (อาจยังไม่มีคนรายงาน ไม่ได้แปลว่าไม่ท่วม)':'ยังโหลดข้อมูลน้ำท่วมไม่ได้');chip(F.loaded?'ไม่มีข้อมูลใกล้จุด':'กำลังโหลดข้อมูล','na')}
    return finish(out,reporterSevere,recentlyCleared);
  }
  function applyCctv(out,severe){if(out.cctv.s==='flood'){out.E+=25;out.ev.push('กล้อง CCTV: เห็นน้ำท่วม'+(out.cctv.t?` (ตรวจ ${out.cctv.t})`:''));out.chips.unshift({t:'กล้อง: เห็นน้ำ',k:'bad'})}else{out.E-=20;out.ev.push('กล้อง CCTV: ไม่เห็นน้ำท่วม'+(out.cctv.t?` (ตรวจ ${out.cctv.t})`:''));out.chips.unshift({t:'กล้อง: ไม่เห็นน้ำ',k:'ok'})}}
  function decide(out){const strong=out.E>=25,some=out.E>=10,sat=out.satInside,cam=out.cctv&&out.cctv.s==='flood',contra=out.result===RESULT.conflict;
    let lv=1,why='';
    if(!contra&&(out.score>=65&&strong||cam&&out.veryDeep||sat&&out.veryDeep||out.vulCrit&&out.deep&&strong||out.photoFlood>=80&&out.E>=20)){lv=3;why='ข้อมูลระบบยืนยันว่าน้ำท่วมรุนแรง'+(out.vulCrit?' และมีผู้ป่วยติดเตียง/ออกซิเจน/ฟอกไต':'')}
    else if(out.score>=45&&some||strong){lv=2;why='มีข้อมูลระบบยืนยันว่ามีน้ำท่วมใกล้จุด'}
    else if(out.veryDeep||out.vulCrit||out.R>=24){lv=2;why='ข้อมูลผู้แจ้งบ่งว่ารุนแรง แต่ระบบยังยืนยันไม่ได้ · โทรยืนยันก่อน'}
    else why='ยังไม่มีข้อมูลยืนยันความรุนแรง';
    if(lv<2&&out.hard&&out.hard.score>=70){lv=2;why='ครัวเรือนลำบาก/เปราะบางมาก ('+out.hard.score+'/100) · '+out.hard.why.slice(0,2).map(x=>x.t).join(' · ')}
    out.level=lv;out.levelWhy=why;return out}
  function finish(out,severe,cleared){
    out.E=Math.max(-20,Math.min(E_MAX,out.E*E_SCALE));out.score=Math.max(0,Math.min(100,Math.round(out.R+out.E)));
    if(out.result)return decide(out);
    const contra=(out.cctv&&out.cctv.s==='clear')||((cleared||out.sensorClear)&&out.E<10);
    if(severe&&contra)out.result=RESULT.conflict;
    else if(out.score>=65&&out.E>=25)out.result=RESULT.confirmed;
    else if(out.score>=45&&out.E>=10)out.result=RESULT.likely;
    else if(out.E<10)out.result=RESULT.unverified;
    else out.result=RESULT.notcrit;
    return decide(out);
  }
  // ดัชนี "ความลำบาก / เปราะบาง" 0–100 — แยกจากคะแนนน้ำท่วม (คะแนนน้ำท่วมตอบว่า "ท่วมจริงไหม" อันนี้ตอบว่า "ครัวเรือนนี้ลำบากแค่ไหน")
  // ใช้เฉพาะสภาพที่กระทบการเข้าถึงความช่วยเหลือ — ไม่ใช้เชื้อชาติ/ศาสนาเป็นตัวให้คะแนน
  const VUL_PTS={bedridden:14,oxygen:14,dialysis:14,infant:10,pregnant:10,disabled:10,elderly:8,child:8,chronic:8};
  const VUL_TH={elderly:'ผู้สูงอายุ',child:'เด็กเล็ก',infant:'ทารก',pregnant:'หญิงตั้งครรภ์',disabled:'ผู้พิการ',bedridden:'ผู้ป่วยติดเตียง',oxygen:'ใช้ออกซิเจน',dialysis:'ฟอกไต',chronic:'โรคเรื้อรัง'};
  const HARD=[[/ยากจน|ไม่มีเงิน|ไม่มีรายได้|ตกงาน|รายได้น้อย|หาเช้ากินค่ำ/,12,'ฐานะยากจน / ไม่มีรายได้'],
    [/ไม่มี(อาหาร|ข้าว)|อดอาหาร|ไม่ได้กิน|ขาดอาหาร|อาหารหมด/,14,'ขาดอาหาร'],
    [/ไร้สัญชาติ|ไม่มีบัตร|ไม่มีสถานะ|ไม่มีสัญชาติ|แรงงานต่างด้าว|ไม่มีสิทธิ/,8,'ไม่มีสถานะ/บัตร · อาจเข้าไม่ถึงความช่วยเหลือรัฐ'],
    [/บ้านพัง|ไม่มีบ้าน|ไม่มีที่อยู่|ไม่มีที่พัก|เพิงพัก|บ้านเช่า.*ท่วม|นอนข้างถนน/,8,'ที่พักเสียหาย / ไม่มีที่พัก'],
    [/อยู่คนเดียว|ไม่มีญาติ|ไม่มีคนดูแล|ถูกทิ้ง/,6,'ไม่มีคนดูแล']];
  const NEED_H=[[/อาหาร|ข้าว|น้ำดื่ม|นม/,8,'ต้องการอาหาร/น้ำดื่ม'],[/ยา|ป่วย|รักษา|หมอ/,6,'ต้องการยา/รักษา'],[/ที่นอน|เสื้อผ้า|ผ้าห่ม|ที่พัก|มุ้ง/,4,'ต้องการเครื่องนอน/เสื้อผ้า']];
  // แหล่งข้อมูล 4 ทาง: คำบรรยายผู้แจ้ง · AI ดูรูป (photoAi v2) · ศูนย์โทรถาม (hardAsk) · ทีมยืนยันหน้างาน (teamHard)
  // แต่ละหมวดใช้ค่าสูงสุดจากทุกแหล่ง (ไม่นับซ้ำ) และบอกที่มาไว้ในวงเล็บ
  const TH_TAG={nofood:'ไม่มีอาหาร',nowater:'ไม่มีน้ำดื่ม',bedridden:'ผู้ป่วยติดเตียง',meds:'ต้องการยาด่วน',infant:'มีทารก/เด็กเล็ก',elderly:'ผู้สูงอายุ',disabled:'ผู้พิการ',pregnant:'หญิงตั้งครรภ์',house:'บ้านอยู่ไม่ได้',alone:'ไม่มีคนดูแล',nodoc:'ไม่มีบัตร/สิทธิ'};
  function hardship(c){
    const txt=String(c.notes||'')+' '+(c.needs||[]).join(' '),why=[],add=(p,t)=>{if(p>0){why.push({p,t});return p}return 0};
    const pa=c.photoAi&&c.photoAi.v===2?c.photoAi:null,ask=c.hardAsk||null,tm=c.teamHard&&Array.isArray(c.teamHard.tags)?c.teamHard:null,tg=new Set(tm?tm.tags:[]);
    const SRC={t:'ผู้แจ้ง',ai:'AI ดูรูป',ph:'โทรยืนยัน',tm:'ทีมหน้างาน'};
    // กลุ่มเปราะบาง: key → แหล่งที่มา
    const vul=new Map(),vAdd=(k,src)=>{if(!vul.has(k))vul.set(k,new Set());vul.get(k).add(src)};
    (Array.isArray(c.vulnerable)?c.vulnerable:String(c.vulnerable||'').split(/\s*,\s*/)).filter(Boolean).forEach(v=>vAdd(v,'t'));
    const num=re=>{const m=txt.match(re);return m?Number(m[1]):0};
    const kids=num(/เด็ก(?:เล็ก|ๆ)?\s*(?:ประมาณ|กว่า)?\s*(\d+)/),old=num(/(?:ผู้สูงอายุ|ผู้สูงวัย|คนแก่|ผู้เฒ่า)\s*(?:อายุ\s*\d+\s*(?:ปี)?\s*)?(?:ประมาณ|กว่า)?\s*(\d+)/);
    if(kids)vAdd('child','t');if(old)vAdd('elderly','t');
    if(/ติดเตียง/.test(txt))vAdd('bedridden','t');if(/ตั้งครรภ์|ท้องแก่|คนท้อง/.test(txt))vAdd('pregnant','t');if(/พิการ/.test(txt))vAdd('disabled','t');if(/ทารก|เด็กอ่อน|แรกเกิด/.test(txt))vAdd('infant','t');
    if(pa){if(pa.elderly)vAdd('elderly','ai');if(pa.children)vAdd('child','ai');if(pa.disabled)vAdd('disabled','ai')}
    if(ask&&Array.isArray(ask.vul)){if(ask.vul.includes('none')&&ask.vul.length===1){[...vul.keys()].forEach(k=>{const s=vul.get(k);s.delete('t');s.delete('ai');if(!s.size)vul.delete(k)})}ask.vul.filter(v=>v!=='none').forEach(v=>vAdd(v,'ph'))}
    ['bedridden','infant','elderly','disabled','pregnant'].forEach(k=>{if(tg.has(k))vAdd(k,'tm')});
    const srcTxt=set=>[...set].map(x=>SRC[x]).join(', ');
    let vp=0;vul.forEach((_,v)=>vp+=VUL_PTS[v]||0);
    let S=add(Math.min(40,vp),'กลุ่มเปราะบาง: '+[...vul].map(([v,set])=>(VUL_TH[v]||v)+' ('+srcTxt(set)+')').join(', '));
    if(pa&&pa.lying&&!vul.has('bedridden'))S+=add(10,'รูปมีคนนอนกับพื้น/เตียง อาจป่วยหรือติดเตียง (AI ดูรูป) · โทรยืนยัน');
    const dep=kids+old;S+=add(dep>=20?15:dep>=10?10:dep>=4?5:0,[kids?`เด็ก ${kids} คน`:'',old?`ผู้สูงอายุ ${old} คน`:''].filter(Boolean).join(' · ')+' (ผู้แจ้ง)');
    const ppl=Number(c.people)||1;S+=add(ppl>=50?10:ppl>=20?6:ppl>=5?3:0,`${ppl} คน`);
    let np=0;const nt=[];NEED_H.forEach(([re,p,t])=>{if(re.test(txt)){np+=p;nt.push(t)}});S+=add(Math.min(15,np),nt.join(' · '));
    // หมวดที่ใช้ค่าสูงสุดจากหลายแหล่ง
    const best=(name,cands)=>{const b=cands.filter(x=>x&&x[0]>0).sort((x,y)=>y[0]-x[0])[0];return b?add(b[0],b[1]):0};
    S+=best('food',[[HARD[1][0].test(txt)?14:0,'ขาดอาหาร (ผู้แจ้ง)'],[ask&&ask.food==='0'?18:ask&&ask.food==='1-2'?10:0,ask&&ask.food==='0'?'อาหาร/น้ำหมดแล้ว (โทรยืนยัน)':'อาหาร/น้ำเหลือ 1–2 วัน (โทรยืนยัน)'],
      [tg.has('nofood')?18:0,'ไม่มีอาหาร (ทีมหน้างาน)'],[tg.has('nowater')?12:0,'ไม่มีน้ำดื่ม (ทีมหน้างาน)']]);
    S+=best('meds',[[ask&&ask.meds==='out'?10:0,'ยาประจำหมด (โทรยืนยัน)'],[tg.has('meds')?10:0,'ต้องการยาด่วน (ทีมหน้างาน)']]);
    S+=best('house',[[HARD[3][0].test(txt)?8:0,'ที่พักเสียหาย (ผู้แจ้ง)'],[ask&&ask.house==='gone'?12:ask&&ask.house==='damaged'?6:0,ask&&ask.house==='gone'?'บ้านอยู่ไม่ได้ (โทรยืนยัน)':'บ้านเสียหาย (โทรยืนยัน)'],
      [tg.has('house')?12:0,'บ้านอยู่ไม่ได้ (ทีมหน้างาน)'],[pa&&pa.shelter==='makeshift'?10:pa&&pa.shelter==='damaged'?8:0,pa&&pa.shelter==='makeshift'?'ที่พักชั่วคราว/เพิง (AI ดูรูป)':'ที่พักเสียหาย (AI ดูรูป)']]);
    S+=best('poor',[[HARD[0][0].test(txt)?12:0,'ฐานะยากจน / ไม่มีรายได้ (ผู้แจ้ง)'],[pa&&pa.hardship==='high'?12:pa&&pa.hardship==='medium'?5:0,'สภาพความเป็นอยู่ลำบาก (AI ดูรูป)'+(pa&&pa.lnote?': '+pa.lnote:'')]]);
    S+=best('nodoc',[[HARD[2][0].test(txt)?8:0,'ไม่มีสถานะ/บัตร · อาจเข้าไม่ถึงความช่วยเหลือรัฐ (ผู้แจ้ง)'],[tg.has('nodoc')?8:0,'ไม่มีบัตร/สิทธิ (ทีมหน้างาน)']]);
    S+=best('alone',[[HARD[4][0].test(txt)?6:0,'ไม่มีคนดูแล (ผู้แจ้ง)'],[tg.has('alone')?6:0,'ไม่มีคนดูแล (ทีมหน้างาน)']]);
    if(ask&&ask.aid==='none')S+=add(6,'ยังไม่ได้รับความช่วยเหลือจากที่อื่น (โทรยืนยัน)');
    const fin=c.status==='done',noTeam=!String(c.volunteer||'').replace(/^'/,'').trim(),d=(Date.now()-Number(c.createdAt||Date.now()))/864e5;
    if(!fin&&noTeam)S+=add(d>=7?15:d>=3?10:d>=1?5:0,`รอความช่วยเหลือ ${Math.floor(d)} วัน ยังไม่มีทีม`);
    S=Math.min(100,Math.round(S));
    const band=S>=70?{k:'vh',t:'สูงมาก'}:S>=45?{k:'h',t:'สูง'}:S>=25?{k:'m',t:'ปานกลาง'}:{k:'l',t:'ต่ำ'};
    // คำถามโทรยืนยัน — เฉพาะเรื่องที่ยังไม่มีใครตอบ
    const q=[];if(!(ask&&ask.food)&&!tg.has('nofood'))q.push('อาหาร/น้ำดื่มเหลือพอกี่วัน?');if(!(ask&&ask.vul&&ask.vul.length)&&!tm)q.push('มีผู้สูงอายุ เด็กเล็ก คนป่วย ติดเตียง หรือคนท้องไหม?');
    if(!(ask&&ask.meds)&&!tg.has('meds'))q.push('มีใครต้องกินยาประจำหรือยาหมดไหม?');if(!(ask&&ask.house)&&!tg.has('house'))q.push('บ้าน/ที่พักยังอยู่ได้ไหม?');if(!(ask&&ask.aid))q.push('ได้รับความช่วยเหลือจากที่อื่นแล้วหรือยัง?');
    return {score:S,band,why:why.sort((a,b)=>b.p-a.p),ask:q,vul:[...vul.keys()],src:{ai:!!pa,ph:!!(ask&&ask.at),tm:!!tm},hardAsk:ask,teamHard:tm}}
  function nearCams(lat,lng,max=3,within=6000){return F.cams.map(c=>({...c,d:dist(lat,lng,c.lat,c.lng)})).filter(c=>c.d<=within).sort((a,b)=>a.d-b.d).slice(0,max)}
  const LC=new Map();
  function level(c){const k=[c.id,c.sevSet,F.loaded,c.photoAi&&c.photoAi.at,c.level,(c.needs||[]).join(),c.people,c.lat,c.lng,c.cctv,c.vulnerable,c.status,c.volunteer,String(c.notes||'').length,JSON.stringify(c.hardAsk||''),JSON.stringify(c.teamHard||''),c.photoAi&&c.photoAi.v,Math.floor((Date.now()-Number(c.createdAt||0))/864e5)].join('|'),h=LC.get(c.id);if(h&&h.k===k)return h.v;
    const v=assess(c).level||1;LC.set(c.id,{k,v});return v}
  const VERIFY={F,load,assess,level,hardship,RESULT,VERDICT_TH,parseCctv,nearCams,dist,distToLines,onUpdate:null};return VERIFY;
})();
