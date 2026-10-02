/* พื้นที่ที่องค์กรอื่นรับไปแล้ว (จาก Google Sheet ที่ทีมกรอก)
   - ดึงจากชีตสาธารณะ (gviz CSV) หรือจาก /api?action=covered ถ้าระบบหลังบ้านรองรับ (ได้พิกัดจากลิงก์ Google Maps)
   - ถ้าไม่มีพิกัด จะหาพิกัดโดยประมาณจากชื่อพื้นที่ (Photon) และเทียบชื่อพื้นที่กับที่อยู่ของเคส
   ใช้ร่วม: หน้าจัดการเคส, แดชบอร์ด, จัดทีม */
const COVERED=(()=>{
  const SHEET_ID='1QwVsFfWqNBP8qJMBBk_PrvbSm6gNFOF0CGwJl5BNaFc';
  const SHEET_URL='https://docs.google.com/spreadsheets/d/'+SHEET_ID+'/edit';
  const CSV_URL='https://docs.google.com/spreadsheets/d/'+SHEET_ID+'/gviz/tq?tqx=out:csv';
  const NEAR_M=800;
  const C={rows:[],loaded:0,error:'',loading:null,source:''};
  const norm=s=>String(s||'').normalize('NFC').replace(/\s+/g,' ').replace(/ซ\.\s*/g,'ซอย').replace(/ถ\.\s*/g,'ถนน').toLowerCase().trim();
  function parseCSV(t){const rows=[];let row=[],cur='',q=false;for(let i=0;i<t.length;i++){const ch=t[i];
    if(q){if(ch==='"'){if(t[i+1]==='"'){cur+='"';i++}else q=false}else cur+=ch}else if(ch==='"')q=true;else if(ch===','){row.push(cur);cur=''}
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&t[i+1]==='\n')i++;row.push(cur);cur='';rows.push(row);row=[]}else cur+=ch}
    if(cur||row.length){row.push(cur);rows.push(row)}return rows}
  function fromCells(r){const [org,area,date,link]=r.map(x=>String(x||'').trim());return {org,area,date,link,lat:null,lng:null,approx:false}}
  /* วันที่ในชีตเขียนหลายแบบ (2/10/69, 1/10/2569, 1/10/26) → แสดงตามที่กรอก แต่แปลงเป็นเวลาไว้เรียง */
  function dateMs(s){const m=String(s||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(!m)return 0;let y=+m[3];if(y<100)y=y>=50?2500+y-543:2000+y;else if(y>2400)y-=543;return Date.UTC(y,+m[2]-1,+m[1])}
  const geoCache=(()=>{try{return JSON.parse(localStorage.getItem('uh_cov_geo')||'{}')}catch(e){return {}}})();
  function saveGeo(){try{localStorage.setItem('uh_cov_geo',JSON.stringify(geoCache))}catch(e){}}
  async function geocode(r){const k=norm(r.area);if(geoCache[k]!==undefined){const g=geoCache[k];if(g){r.lat=g[0];r.lng=g[1];r.approx=true}return false}
    try{const j=await fetch('https://photon.komoot.io/api/?limit=1&lat=13.75&lon=100.6&location_bias_scale=0.5&bbox=99.8,13.3,101.4,14.3&q='+encodeURIComponent(r.area.replace(/\d+\s*ชุด/,'')+' กรุงเทพ')).then(x=>x.json());
      const f=(j.features||[])[0];geoCache[k]=f?[f.geometry.coordinates[1],f.geometry.coordinates[0]]:null}catch(e){return}
    saveGeo();if(geoCache[k]){r.lat=geoCache[k][0];r.lng=geoCache[k][1];r.approx=true}return true}
  async function load(apiUrl,key){
    if(C.loading)return C.loading;if(C.loaded&&Date.now()-C.loaded<5*60e3)return;
    C.loading=(async()=>{
      let rows=null;
      if(apiUrl&&apiUrl.charAt(0)==='/'){try{const j=await fetch(apiUrl+'?action=covered&key='+encodeURIComponent(key||'')+'&t='+Date.now()).then(x=>x.json());if(j&&j.ok&&Array.isArray(j.items)){rows=j.items;C.source='api'}}catch(e){}}
      if(!rows){try{const t=await fetch(CSV_URL+'&t='+Math.floor(Date.now()/60000)).then(x=>{if(!x.ok)throw 0;return x.text()});
        const all=parseCSV(t);rows=all.slice(1).filter(r=>r[1]&&String(r[1]).trim()).map(fromCells);C.source='sheet'}catch(e){C.error='โหลดข้อมูลพื้นที่องค์กรอื่นไม่สำเร็จ';return}}
      rows.forEach(r=>{r.t=dateMs(r.date);r.n=norm(r.area);if(r.lat!=null&&r.lat!=='')r.lat=+r.lat,r.lng=+r.lng;else r.lat=r.lng=null});
      C.rows=rows;C.error='';C.loaded=Date.now();
      // หาพิกัดโดยประมาณทีละแถว (เฉพาะที่ยังไม่มีพิกัด) ไม่ให้ยิงคำขอถี่เกิน
      for(const r of rows.filter(x=>x.lat==null)){if(await geocode(r))await new Promise(s=>setTimeout(s,300))}
      C.loaded=Date.now();
    })().finally(()=>{C.loading=null});
    return C.loading;
  }
  function distM(a,b,c,d){const R=6371e3,x=(c-a)*Math.PI/180,y=(d-b)*Math.PI/180,h=Math.sin(x/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
  /* คำสำคัญจากชื่อพื้นที่: ชื่อซอย/ถนน/ชุมชน + เลขซอย (เช่น "บึงขวาง 3", "อ่อนนุช 61", "หลวงแพ่ง") */
  const STOP=/^(ชุมชน|หมู่บ้าน|มัสยิด|สุเหร่า|โรงเรียน|ซอย|ถนน|เขต|แขวง|แยก|พื้นที่|และ|ชุด|ศูนย์พักพิงชั่วคราว|ร้านข้าวเช้า|มูลนิธิ)$/;
  const GENERIC=/^(โซน|แฟลต|แยก|หมู่|หมู่ที่|เลขที่|คลอง|เขต|พื้นที่|อาคาร|ตึก|ชั้น|บ้าน|ห้อง)$/;
  function keys(n){const out=new Set();const t=n.replace(/\d+\s*ชุด/g,' ').replace(/[(),]/g,' ').replace(/พื้นที่\s*\d+/g,' ').replace(/ชุมชน|หมู่บ้าน|ซอย|ถนน|และแยก|และ/g,' ');
    (t.match(/[ก-๙a-z]{3,}\s*\d+(\s*แยก\s*\d+)?/g)||[]).forEach(x=>{const k=x.replace(/\s+/g,' ').trim();if(!GENERIC.test(k.replace(/\s*\d.*$/,'')))out.add(k)});
    return [...out].filter(k=>k.length>=4&&!STOP.test(k))}
  /* ที่อยู่มีคำสำคัญนี้ไหม (เลขต้องไม่ติดเลขอื่น เช่น "บึงขวาง 8" ไม่ตรงกับ "บึงขวาง 81") */
  function hasKey(addr,k){const a=addr.replace(/\s+/g,''),m=k.replace(/\s+/g,'').match(/^([^\d]+)(\d.*)$/);if(!m)return '';
    /* ภาษาไทยไม่เว้นวรรค: ชื่อในชีตอาจมีคำนำหน้าติดมา ("อาปาเช่อ่อนนุช 46") จึงลองตัดหน้าทีละตัว เหลืออย่างน้อย 6 ตัวอักษร */
    for(let L=m[1].length;L>=Math.min(6,m[1].length);L--){const kk=m[1].slice(-L)+m[2];let i=a.indexOf(kk);while(i>=0){if(!/\d/.test(a.charAt(i+kk.length)))return (m[1].slice(-L)+' '+m[2]).replace(/(\d)แยก(\d)/,'$1 แยก $2');i=a.indexOf(kk,i+1)}}return ''}
  function match(c){
    if(!C.rows.length)return null;const hits=[];
    const has=c.lat!==''&&c.lat!=null&&isFinite(+c.lat);
    if(has)C.rows.forEach(r=>{if(r.lat==null)return;const d=distM(+c.lat,+c.lng,r.lat,r.lng);if(d<=(r.approx?NEAR_M*1.5:NEAR_M))hits.push({r,d,how:r.approx?'ใกล้ (พิกัดโดยประมาณ)':'ใกล้'})});
    const addr=norm([c.address,c.district].filter(Boolean).join(' ')).replace(/ซอย|ถนน/g,' ');
    if(addr.length>=4)C.rows.forEach(r=>{if(hits.some(h=>h.r===r))return;let k='';keys(r.n).forEach(x=>{const h=hasKey(addr,x);if(h.length>k.length)k=h});if(k)hits.push({r,d:null,len:k.length,how:'ชื่อพื้นที่คล้ายกัน "'+k+'" (อาจเป็นที่เดียวกัน)'})});
    if(!hits.length)return null;
    hits.sort((a,b)=>(a.d==null?1e9:a.d)-(b.d==null?1e9:b.d)||(b.len||0)-(a.len||0)||b.r.t-a.r.t);
    return {best:hits[0],all:hits};
  }
  return {C,load,match,SHEET_URL,distM,keys};
})();
