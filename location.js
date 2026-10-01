/* แผนที่: Leaflet 1.9.4 + พื้นแผนที่ 3 แบบ (ถนน / ดาวเทียม / มืด) ไม่ต้องใช้ key */
let leafletLoading=null;
function loadLeaflet(){
  if(window.L)return Promise.resolve();
  if(leafletLoading)return leafletLoading;
  leafletLoading=new Promise((resolve,reject)=>{
    const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';css.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';css.crossOrigin='';document.head.append(css);
    const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';s.crossOrigin='';
    const tm=setTimeout(()=>{leafletLoading=null;reject(new Error('timeout'))},15000);
    s.onload=()=>{clearTimeout(tm);resolve()};s.onerror=()=>{clearTimeout(tm);leafletLoading=null;s.remove();reject(new Error('load'))};document.head.append(s);
  });
  return leafletLoading;
}
const ESRI='https://server.arcgisonline.com/ArcGIS/rest/services/';
const ESRI_ATTR='Tiles &copy; Esri';
const OSM_ATTR='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const BASES={road:'ถนน',sat:'ดาวเทียม',dark:'มืด'};
const isDesktop=()=>matchMedia('(min-width:1024px)').matches;
function makeMap(el,opt={}){
  const map=L.map(el,{zoomControl:false,attributionControl:true,preferCanvas:true,tap:true,...(opt.leaflet||{})}).setView(opt.center||[13.7563,100.5018],opt.zoom||12);
  if(isDesktop()||opt.zoom===true)L.control.zoom({position:'topleft'}).addTo(map);
  L.control.scale({metric:true,imperial:false,position:'bottomleft'}).addTo(map);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  let base=null,fellBack=0;
  const layer=(u,a,o={})=>L.tileLayer(u,{maxZoom:19,attribution:a,crossOrigin:true,...o});
  map.setBase=name=>{
    if(base)base.remove();
    if(name==='sat')base=L.layerGroup([layer(ESRI+'World_Imagery/MapServer/tile/{z}/{y}/{x}',ESRI_ATTR),layer(ESRI+'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',''),layer(ESRI+'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}','')]);
    else if(name==='dark')base=L.layerGroup([layer(ESRI+'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',ESRI_ATTR,{maxZoom:16,maxNativeZoom:16}),layer(ESRI+'Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}','',{maxZoom:16,maxNativeZoom:16})]);
    else{
      /* ถนน: แผนที่โทนเทาอ่อน (CARTO จากข้อมูล OpenStreetMap) ถ้าโหลดไม่ได้ → OpenStreetMap → Esri World Street Map อัตโนมัติ */
      const chain=[['https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',OSM_ATTR+' &copy; CARTO',true],
        ['https://tile.openstreetmap.org/{z}/{x}/{y}.png',OSM_ATTR,false],[ESRI+'World_Street_Map/MapServer/tile/{z}/{y}/{x}',ESRI_ATTR,false]];
      const step=Math.min(fellBack,chain.length-1),[u,a,labels]=chain[step];
      const t=layer(u,a,{subdomains:'abcd'});
      base=labels?L.layerGroup([t,layer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png','',{subdomains:'abcd',pane:'shadowPane'})]):t;
      let bad=0,good=0;t.on('tileload',()=>good++);t.on('tileerror',()=>{bad++;if(!good&&bad>=4&&fellBack===step&&step<chain.length-1){fellBack=step+1;map.setBase('road')}});
    }
    base.addTo(map);if(base.bringToBack)base.bringToBack();map.currentBase=name;
    el.classList.toggle('base-dark',name==='dark'||name==='sat');
    try{localStorage.setItem('uh_base',name)}catch(e){}
  };
  let saved='road';try{saved=localStorage.getItem('uh_base')||'road'}catch(e){}
  map.setBase(BASES[saved]?saved:'road');
  requestAnimationFrame(()=>map.invalidateSize());
  return map;
}
/* GPS ครั้งเดียว → Promise {lat,lng,accuracy} */
function getGPS(timeout=12000){
  return new Promise((res,rej)=>{if(!navigator.geolocation)return rej(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(p=>res({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy}),rej,{enableHighAccuracy:true,timeout,maximumAge:30000})});
}
function pinIcon(cls,label){return L.divIcon({className:'um-pin '+cls,html:`<span>${label||''}</span>`,iconSize:[30,38],iconAnchor:[15,36],popupAnchor:[0,-32]})}
function meIcon(){return L.divIcon({className:'me-dot',html:'<span></span>',iconSize:[22,22],iconAnchor:[11,11]})}
