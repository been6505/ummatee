const TK={
  tn:s=>String(s||'').replace(/^'/,'').trim(),
  NET:{WIFI:'Wi-Fi',wifi:'Wi-Fi',cellular:'มือถือ','4g':'4G','3g':'3G','2g':'2G','slow-2g':'2G',OFFLINE:'ไม่มีเน็ต'},
  dir:h=>h==null?'':['เหนือ','ตะวันออกเฉียงเหนือ','ตะวันออก','ตะวันออกเฉียงใต้','ใต้','ตะวันตกเฉียงใต้','ตะวันตก','ตะวันตกเฉียงเหนือ'][Math.round(((+h%360)+360)%360/45)%8],
  hasPin:c=>c&&c.lat!==''&&c.lat!=null&&isFinite(+c.lat)&&isFinite(+c.lng),
  async osrm(a,b){const u=`https://router.project-osrm.org/route/v1/driving/${a.lng.toFixed(6)},${a.lat.toFixed(6)};${b.lng.toFixed(6)},${b.lat.toFixed(6)}?overview=full&geometries=geojson`;
    const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),12000);try{const j=await fetch(u,{signal:ctl.signal}).then(r=>r.json());if(j.code!=='Ok')throw 0;const r=j.routes[0];return {coords:r.geometry.coordinates.map(c=>[c[1],c[0]]),km:r.distance/1000,min:r.duration/60}}finally{clearTimeout(tm)}},
  nearest(me,cases){return cases.map(c=>({c,d:me.distanceTo([+c.lat,+c.lng])})).sort((a,b)=>a.d-b.d)[0].c},
  eta:(km,min)=>`${km.toFixed(1)} กม.${min!=null?' · ~'+Math.max(1,Math.round(min))+' น.':''}`
};
