/* ตรวจสอบพื้นที่วิกฤต: เทียบข้อมูลผู้แจ้งกับแผนที่น้ำท่วม Floodboard + ผลตรวจกล้อง CCTV
   ใช้ร่วมกันระหว่างหน้าจัดการเคส (admin.html) และแดชบอร์ด (admin/dashboard/)
   ผลลัพธ์เป็น "ข้อมูลช่วยตัดสินใจ" — แอดมินเป็นผู้ตัดสินขั้นสุดท้าย */
const VERIFY=(()=>{
  const ROADS_URL='https://www.floodboard.org/api/export/roads.geojson';
  const REPORTS_URL='https://www.floodboard.org/api/export/reports.csv';
  const F={roads:[],reports:[],loaded:0,error:'',loading:null};
  const LV_CM={ankle:10,knee:45,waist:90,chest:120,roof:180};
  const LV_PTS={ankle:2,knee:5,waist:10,chest:15,roof:20};
  const VERDICT_TH={blocked:'ผ่านไม่ได้',risky:'เสี่ยง',caution:'ระวัง',ok:'ผ่านได้'};
  const RESULT={
    confirmed:{t:'วิกฤตจริง',d:'ข้อมูลน้ำท่วมรอบจุดตรงกับที่ผู้แจ้งบอก',k:'confirmed'},
    likely:{t:'น่าจะวิกฤต',d:'มีหลักฐานน้ำท่วมใกล้จุดบางส่วน',k:'likely'},
    conflict:{t:'ข้อมูลขัดแย้ง',d:'ผู้แจ้งบอกว่าหนัก แต่กล้องหรือรายงานล่าสุดบอกว่าน้ำลด/ไม่ท่วม ควรโทรยืนยัน',k:'conflict'},
    notcrit:{t:'ไม่น่าวิกฤต',d:'มีน้ำท่วมแต่ไม่รุนแรงตามข้อมูลที่มี',k:'notcrit'},
    unverified:{t:'รอตรวจเพิ่ม',d:'ไม่มีข้อมูลน้ำท่วมใกล้จุดนี้ ควรดูกล้องหรือโทรถาม',k:'unverified'},
    nopin:{t:'ยืนยันไม่ได้',d:'ไม่มีพิกัดหรือที่อยู่ที่ชัดเจน ต้องโทรถามตำแหน่งก่อน',k:'nopin'}
  };

  /* ---------- โหลดข้อมูล ---------- */
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
      const [ro,re]=await Promise.allSettled([fetch(ROADS_URL,{cache:'no-store'}).then(r=>{if(!r.ok)throw 0;return r.json()}),fetch(REPORTS_URL,{cache:'no-store'}).then(r=>{if(!r.ok)throw 0;return r.text()})]);
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

  /* ---------- ระยะทาง (เมตร) ---------- */
  function proj(lat0){const kx=Math.cos(lat0*Math.PI/180)*111320,ky=110540;return (lat,lng,lng0)=>[(lng-lng0)*kx,(lat-lat0)*ky]}
  function distToLines(lat,lng,lines){const P=proj(lat);let best=Infinity;
    lines.forEach(line=>{for(let i=0;i<line.length;i++){const [x1,y1]=P(line[i][1],line[i][0],lng);
      if(i===0){best=Math.min(best,Math.hypot(x1,y1));continue}
      const [x0,y0]=P(line[i-1][1],line[i-1][0],lng),dx=x1-x0,dy=y1-y0,L=dx*dx+dy*dy;let t=L?-(x0*dx+y0*dy)/L:0;t=Math.max(0,Math.min(1,t));best=Math.min(best,Math.hypot(x0+t*dx,y0+t*dy))}});return best}
  function dist(lat,lng,lat2,lng2){const P=proj(lat);const [x,y]=P(lat2,lng2,lng);return Math.hypot(x,y)}

  /* ---------- ประเมิน ---------- */
  function parseCctv(v){const [s,t]=String(v||'').split('|');return s==='flood'||s==='clear'?{s,t:t||''}:null}
  function sevPts(d,v,closed){if(v==='blocked'||closed||(d!=null&&d>=50))return 40;if(v==='risky'||(d!=null&&d>=30))return 30;if(v==='caution'||(d!=null&&d>=10))return 18;return 8}
  function recency(t){if(!t)return .5;const h=(Date.now()-t)/36e5;return h<=24?1:h<=72?.7:.4}
  function assess(c){
    const sev=Math.min(3,Math.max(1,Number(c.urgency)||1)),vul=(Array.isArray(c.vulnerable)?c.vulnerable:String(c.vulnerable||'').split(/\s*,\s*/)).filter(Boolean);
    // 1) ข้อมูลจากผู้แจ้ง (0–50)
    let R=({3:25,2:15,1:5})[sev]+(LV_PTS[c.level]||0);
    R+=vul.some(v=>['bedridden','oxygen','dialysis'].includes(v))?8:vul.length?4:0;R=Math.min(50,R);
    const reporterSevere=sev===3||c.level==='chest'||c.level==='roof';
    const cctv=parseCctv(c.cctv);
    const out={R,E:0,score:R,ev:[],road:null,reports:[],cctv,result:null};
    const hasPin=c.lat!==''&&c.lat!=null&&c.lng!==''&&c.lng!=null&&isFinite(+c.lat)&&isFinite(+c.lng);
    // ต้องมีทั้งพิกัดและที่อยู่ที่ชัดเจน ไม่งั้นถือว่า "ยืนยันไม่ได้"
    const addrTxt=[c.address,c.district].filter(Boolean).join(' ').replace(/[\s\-–—.,]/g,''),clearAddr=addrTxt.length>=6;
    if(!hasPin||!clearAddr){out.result=RESULT.nopin;
      if(!hasPin)out.ev.push('ไม่มีพิกัด จึงเทียบกับแผนที่น้ำท่วมไม่ได้');
      if(!clearAddr)out.ev.push('ไม่มีที่อยู่ / จุดสังเกตที่ชัดเจน ทีมหาบ้านไม่เจอ');
      if(!hasPin){if(cctv)applyCctv(out,reporterSevere);return finish(out,reporterSevere,false)}}
    const lat=+c.lat,lng=+c.lng;
    // 2) ถนนน้ำท่วมจาก Floodboard (ใกล้สุดใน 800 ม.)
    let near=null;F.roads.forEach(r=>{const d=distToLines(lat,lng,r.lines);if(d<=800&&(!near||d<near.d))near={...r,d}});
    if(near){const base=sevPts(near.depth,near.verdict,near.closed)*recency(near.updated)*(.5+.5*Math.min(1,near.conf))*(near.d<=300?1:.6);out.E+=base;out.road=near;
      out.ev.push(`ถนนน้ำท่วม "${near.name}" ห่าง ${Math.round(near.d)} ม.${near.depth!=null?` · ลึก ~${near.depth} ซม.`:''}${near.verdict?` · ${VERDICT_TH[near.verdict]||near.verdict}`:''}`)}
    // 3) รายงานน้ำท่วมรอบจุด (1 กม. · 72 ชม.)
    const since=Date.now()-72*36e5,rs=F.reports.filter(r=>r.t>=since).map(r=>({...r,d:dist(lat,lng,r.lat,r.lng)})).filter(r=>r.d<=1000).sort((a,b)=>a.d-b.d);
    const active=rs.filter(r=>!r.cleared),cleared=rs.filter(r=>r.cleared&&r.d<=600&&Date.now()-r.t<24*36e5);
    let rp=0;active.forEach(r=>{const dep=r.depth==null?.35:r.depth>=50?1:r.depth>=30?.7:r.depth>=10?.45:.3;rp+=(.4+Number(r.w||0))*dep*(r.tier==='official'?1.5:1)*(r.d<=400?1:.6)*8+(r.closed?3:0)});
    rp=Math.min(20,rp);out.E+=rp;out.reports=active.slice(0,5);
    if(active.length)out.ev.push(`รายงานน้ำท่วมรอบจุด ${active.length} รายการใน 3 วัน (ใกล้สุด ${Math.round(active[0].d)} ม.)`);
    const recentlyCleared=cleared.length&&!active.some(r=>r.t>cleared[0].t);
    if(recentlyCleared)out.ev.push('มีรายงานล่าสุดว่าน้ำลด / ระบายแล้วใกล้จุดนี้');
    if(cctv)applyCctv(out,reporterSevere);
    if(!near&&!active.length&&!cctv)out.ev.push(F.loaded?'ไม่พบข้อมูลน้ำท่วมจาก Floodboard ใกล้จุดนี้ (อาจยังไม่มีคนรายงาน ไม่ได้แปลว่าไม่ท่วม)':'ยังโหลดข้อมูลน้ำท่วมไม่ได้');
    return finish(out,reporterSevere,recentlyCleared);
  }
  function applyCctv(out,severe){if(out.cctv.s==='flood'){out.E+=25;out.ev.push('กล้อง CCTV: เห็นน้ำท่วม'+(out.cctv.t?` (ตรวจ ${out.cctv.t})`:''))}else{out.E-=20;out.ev.push('กล้อง CCTV: ไม่เห็นน้ำท่วม'+(out.cctv.t?` (ตรวจ ${out.cctv.t})`:''))}}
  function finish(out,severe,cleared){
    out.E=Math.max(-20,Math.min(50,out.E));out.score=Math.max(0,Math.min(100,Math.round(out.R+out.E)));
    if(out.result)return out;   // ไม่มีหมุด
    const contra=(out.cctv&&out.cctv.s==='clear')||(cleared&&out.E<10);
    if(severe&&contra)out.result=RESULT.conflict;
    else if(out.score>=70&&out.E>=25)out.result=RESULT.confirmed;
    else if(out.score>=50&&out.E>=10)out.result=RESULT.likely;
    else if(out.E<10)out.result=RESULT.unverified;
    else out.result=RESULT.notcrit;
    return out;
  }
  return {F,load,assess,RESULT,VERDICT_TH,parseCctv};
})();
