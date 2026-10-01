/* ค้นหาที่อยู่ด้วย Photon (photon.komoot.io): แนะนำเมื่อพิมพ์ 3 ตัวอักษรขึ้นไป (หน่วง 350ms)
   จำกัดผลในไทย ให้ผลในกรุงเทพฯ ขึ้นก่อน และแปลงพิกัดเป็นที่อยู่ (reverse) */
const GEO={url:'https://photon.komoot.io',bbox:'97.3,5.6,105.7,20.5',bkk:{lat:13.7563,lng:100.5018}};
const GEO_ABBR=[[/(^|\s)ถ\.\s*/g,'$1ถนน'],[/(^|\s)ซ\.\s*/g,'$1ซอย'],[/(^|\s)ต\.\s*/g,'$1ตำบล'],[/(^|\s)อ\.\s*/g,'$1อำเภอ'],[/(^|\s)จ\.\s*/g,'$1จังหวัด'],[/กทม\.?/g,'กรุงเทพมหานคร']];
function geoNorm(q){let s=' '+String(q||'').trim();GEO_ABBR.forEach(([r,t])=>s=s.replace(r,t));return s.replace(/\s+/g,' ').trim()}
function geoIsBkk(p){return /กรุงเทพ|bangkok/i.test([p.city,p.state,p.county,p.district].join(' '))}
function geoLabel(p){
  const title=p.name||[p.street,p.housenumber].filter(Boolean).join(' ')||p.district||p.city||'';
  const sub=[p.street&&p.name?p.street:'',p.district||p.locality,p.city||p.county,p.state].filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i&&x!==title).join(', ');
  return {title,sub,full:[title,sub].filter(Boolean).join(', ')}}
async function geoSuggest(q,signal){
  const nq=geoNorm(q);if(nq.length<3)return [];
  const u=`${GEO.url}/api/?limit=10&lat=${GEO.bkk.lat}&lon=${GEO.bkk.lng}&location_bias_scale=0.4&bbox=${GEO.bbox}&q=${encodeURIComponent(nq)}`;
  const r=await fetch(u,{signal});if(!r.ok)throw new Error('geo '+r.status);
  const j=await r.json();const seen=new Set();
  return (j.features||[]).filter(f=>{const p=f.properties||{};return !p.countrycode||p.countrycode==='TH'}).map(f=>{const p=f.properties||{},L=geoLabel(p);
    return {lat:f.geometry.coordinates[1],lng:f.geometry.coordinates[0],title:L.title,sub:L.sub,label:L.full,bkk:geoIsBkk(p)}})
    .filter(x=>{const k=x.label+'|'+x.lat.toFixed(3);if(!x.title||seen.has(k))return false;seen.add(k);return true})
    .sort((a,b)=>(b.bkk-a.bkk)).slice(0,8);
}
async function geoReverse(lat,lng){
  try{const r=await fetch(`${GEO.url}/reverse?lat=${lat}&lon=${lng}&limit=1`);if(!r.ok)return '';
    const f=((await r.json()).features||[])[0];if(!f)return '';return geoLabel(f.properties||{}).full}catch(e){return ''}
}
/* ผูกช่องพิมพ์กับรายการแนะนำ: onPick(item) */
function geoAttach(input,list,onPick,opt={}){
  let tm=null,ctl=null,items=[],active=-1;
  const status=opt.status||null;
  const render=()=>{list.replaceChildren();list.hidden=!items.length;
    items.forEach((it,i)=>{const b=document.createElement('button');b.type='button';b.className='sug'+(i===active?' on':'');b.setAttribute('role','option');
      b.innerHTML=ic('pin')+'<span><b></b><small></small></span>';b.querySelector('b').textContent=it.title;b.querySelector('small').textContent=it.sub||'';
      b.addEventListener('click',()=>{onPick(it);items=[];render()});list.append(b)})};
  const run=async()=>{const q=input.value.trim();if(q.length<3){items=[];render();if(status)status.textContent='';return}
    if(ctl)ctl.abort();ctl=new AbortController();if(status)status.textContent='กำลังค้นหา…';
    try{items=await geoSuggest(q,ctl.signal);active=-1;render();if(status)status.textContent=items.length?'':'ไม่พบที่อยู่นี้ ลองพิมพ์ชื่อถนน ซอย หรือเขต'}
    catch(e){if(e.name!=='AbortError'&&status)status.textContent='ค้นหาไม่ได้ (ไม่มีสัญญาณ?) ใช้ตำแหน่งตอนนี้ หรือปักหมุดบนแผนที่แทน'}};
  input.addEventListener('input',()=>{clearTimeout(tm);tm=setTimeout(run,350)});
  input.addEventListener('keydown',e=>{if(!items.length)return;
    if(e.key==='ArrowDown'){active=Math.min(items.length-1,active+1);render();e.preventDefault()}
    else if(e.key==='ArrowUp'){active=Math.max(0,active-1);render();e.preventDefault()}
    else if(e.key==='Enter'){e.preventDefault();const it=items[active<0?0:active];if(it){onPick(it);items=[];render()}}});
  return {clear(){items=[];render()},run};
}
