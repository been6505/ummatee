const OFM=(()=>{
  const CFG={
    road:'https://tiles.openfreemap.org/styles/liberty',dark:'https://tiles.openfreemap.org/styles/dark',
    attr:'แผนที่ <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> ข้อมูล © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    mlJs:'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js',mlJsSri:'sha384-5+cfbwT0iiub6VsQAdn6yz16nr6sDiQoHx6tm4O8OVYXHYOxcffFmCJBL0dgdvGp',
    mlCss:'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css',mlCssSri:'sha384-uTttxo/aOKbdE5RlD/SPzSDoDmNvGlUYPjONi2MN/b7c9HPSvW07OIuyP7uL6jxK',
    plug:'https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.1.4/leaflet-maplibre-gl.js',plugSri:'sha384-tXYNKOHx4T02jMP7YYCtBxPIv1B5gaA5mcVPBzqMp6d7VzWzxJgI2aWF/nJLrQdS'};
  function webgl(){try{const c=document.createElement('canvas');return !!(window.WebGL2RenderingContext&&c.getContext('webgl2'))||!!(c.getContext('webgl')||c.getContext('experimental-webgl'))}catch(e){return false}}
  const script=(src,sri)=>new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.integrity=sri;s.crossOrigin='anonymous';
    const tm=setTimeout(()=>{s.remove();rej(new Error('timeout'))},20000);s.onload=()=>{clearTimeout(tm);res()};s.onerror=()=>{clearTimeout(tm);s.remove();rej(new Error('load'))};document.head.append(s)});
  let libP=null;
  function libs(){if(window.maplibregl&&L.maplibreGL)return Promise.resolve();if(libP)return libP;
    const css=document.createElement('link');css.rel='stylesheet';css.href=CFG.mlCss;css.integrity=CFG.mlCssSri;css.crossOrigin='anonymous';document.head.append(css);
    libP=(window.maplibregl?Promise.resolve():script(CFG.mlJs,CFG.mlJsSri)).then(()=>L.maplibreGL?null:script(CFG.plug,CFG.plugSri)).catch(e=>{libP=null;throw e});return libP}
  const styles={};
  async function thai(url){if(styles[url])return JSON.parse(JSON.stringify(styles[url]));
    const st=await (await fetch(url)).json(),name=['coalesce',['get','name:th'],['get','name'],['get','name:latin']];
    st.layers.forEach(l=>{const tf=l.layout&&l.layout['text-field'];if(tf&&JSON.stringify(tf).includes('name'))l.layout['text-field']=name});
    styles[url]=st;return JSON.parse(JSON.stringify(st))}
  async function layer(kind){
    if(!webgl())return null;
    try{await libs();const st=await thai(kind==='dark'?CFG.dark:CFG.road);return L.maplibreGL({style:st,attribution:CFG.attr,interactive:false})}
    catch(e){return null}}
  return {layer,webgl,ATTR:CFG.attr}
})();
