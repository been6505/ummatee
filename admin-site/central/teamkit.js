const TK={
  tn:s=>String(s||'').replace(/^'/,'').trim(),
  NET:{WIFI:'Wi-Fi',wifi:'Wi-Fi',cellular:'มือถือ','4g':'4G','3g':'3G','2g':'2G','slow-2g':'2G',OFFLINE:'ไม่มีเน็ต'},
  dir:h=>h==null?'':['เหนือ','ตะวันออกเฉียงเหนือ','ตะวันออก','ตะวันออกเฉียงใต้','ใต้','ตะวันตกเฉียงใต้','ตะวันตก','ตะวันตกเฉียงเหนือ'][Math.round(((+h%360)+360)%360/45)%8],
  hasPin:c=>c&&c.lat!==''&&c.lat!=null&&isFinite(+c.lat)&&isFinite(+c.lng),
  async osrm(a,b){const u=`https://router.project-osrm.org/route/v1/driving/${a.lng.toFixed(6)},${a.lat.toFixed(6)};${b.lng.toFixed(6)},${b.lat.toFixed(6)}?overview=full&geometries=geojson`;
    const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),12000);try{const j=await fetch(u,{signal:ctl.signal}).then(r=>r.json());if(j.code!=='Ok')throw 0;const r=j.routes[0];return {coords:r.geometry.coordinates.map(c=>[c[1],c[0]]),km:r.distance/1000,min:r.duration/60}}finally{clearTimeout(tm)}},
  nearest(me,cases){return cases.map(c=>({c,d:me.distanceTo([+c.lat,+c.lng])})).sort((a,b)=>a.d-b.d)[0].c},
  eta:(km,min)=>`${km.toFixed(1)} กม.${min!=null?' · ~'+Math.max(1,Math.round(min))+' น.':''}`,
  km(a,b){const R=6371,x=(b.lat-a.lat)*Math.PI/180,y=(b.lng-a.lng)*Math.PI/180,h=Math.sin(x/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
};
TK.hq=(()=>{const H={on:false,pos:null,err:'',wid:null,rt:new Map(),busy:0,q:[]};
  try{H.on=localStorage.getItem('hm_hq_on')==='1';const p=JSON.parse(localStorage.getItem('hm_hq_pos')||'null');if(p&&Date.now()-p.at<6*3600e3)H.pos=p}catch(e){}
  const emit=()=>dispatchEvent(new CustomEvent('hm-hq'));
  function start(){if(H.wid!=null||!navigator.geolocation)return;H.err='';
    H.wid=navigator.geolocation.watchPosition(p=>{const n={lat:p.coords.latitude,lng:p.coords.longitude,acc:Math.round(p.coords.accuracy||0),at:Date.now()},moved=!H.pos||TK.km(H.pos,n)>0.05;H.pos=n;H.err='';try{localStorage.setItem('hm_hq_pos',JSON.stringify(n))}catch(e){}if(moved)emit()},
      e=>{H.err=e.code===1?'denied':'unavailable';emit()},{enableHighAccuracy:true,maximumAge:30000,timeout:30000})}
  function stop(){if(H.wid!=null)navigator.geolocation.clearWatch(H.wid);H.wid=null}
  function set(on){H.on=!!on;try{localStorage.setItem('hm_hq_on',on?'1':'')}catch(e){}if(on)start();else stop();emit()}
  function pump(){while(H.busy<2&&H.q.length){const [k,to]=H.q.shift(),from=H.pos;if(!from)continue;H.busy++;
      TK.osrm(from,to).then(r=>{H.rt.set(k,{km:r.km,min:r.min,at:Date.now(),from,to})}).catch(()=>{H.rt.set(k,{fail:true,at:Date.now(),from,to})}).finally(()=>{H.busy--;emit();pump()})}}
  function to(k,lat,lng){if(!H.on||!H.pos||lat==null||!isFinite(+lat))return null;const t={lat:+lat,lng:+lng},km=TK.km(H.pos,t),r=H.rt.get(k);
    const stale=!r||Date.now()-r.at>180e3||TK.km(r.from,H.pos)>0.3||TK.km(r.to,t)>0.3;if(stale&&!H.q.some(x=>x[0]===k)){H.q.push([k,t]);pump()}
    return {km,road:r&&!r.fail?r.km:null,min:r&&!r.fail?r.min:null,stale}}
  function label(d){if(!d)return '';const k=d.road??d.km,m=d.min??(d.km*1.3/30*60);return `${k<1?Math.round(k*1000)+' ม.':(k<10?k.toFixed(1):Math.round(k))+' กม.'} · ~${m>=60?Math.floor(m/60)+' ชม. '+Math.round(m%60)+' น.':Math.max(1,Math.round(m))+' น.'}${d.road==null?' (เส้นตรง)':''}`}
  if(H.on)start();
  return {get on(){return H.on},get pos(){return H.pos},get err(){return H.err},set,to,label}})();
