const hotlineGroups = [
  {id:'urgent',title:'แจ้งเหตุเร่งด่วน'},
  {id:'rescue',title:'กู้ชีพและกู้ภัย'},
  {id:'power',title:'ไฟฟ้า'},
  {id:'travel',title:'เส้นทางและการเดินทาง'},
  {id:'other',title:'ความช่วยเหลืออื่น'}
];
const prdSource='https://www.prd.go.th/th/content/category/detail/id/9/iid/244070?id=2467&search=&season=&start=';
const hotlines = [
  {number:'1669',name:'เจ็บป่วยฉุกเฉิน',agency:'สถาบันการแพทย์ฉุกเฉินแห่งชาติ',note:'ติดต่อบริการการแพทย์ฉุกเฉิน',group:'urgent',source:'https://www.niems.go.th/',sourceName:'สพฉ.'},
  {number:'1555',name:'แจ้งเหตุและร้องทุกข์ กทม.',agency:'กรุงเทพมหานคร',note:'ประสานปัญหาและเหตุในพื้นที่กรุงเทพฯ',group:'urgent',source:prdSource,sourceName:'กรมประชาสัมพันธ์'},
  {number:'1784',name:'แจ้งสาธารณภัย',agency:'กรมป้องกันและบรรเทาสาธารณภัย',note:'สายด่วนนิรภัย · ปภ.',group:'urgent',source:'https://www.disaster.go.th/contact/map',sourceName:'ปภ.'},
  {number:'191',name:'เหตุด่วนเหตุร้าย',agency:'สำนักงานตำรวจแห่งชาติ',note:'แจ้งเหตุกับเจ้าหน้าที่ตำรวจ',group:'urgent',source:prdSource,sourceName:'กรมประชาสัมพันธ์'},
  {number:'1199',name:'สายด่วนกรมเจ้าท่า',agency:'กรมเจ้าท่า',note:'ติดต่อเรื่องการเดินทางและเหตุทางน้ำ',group:'rescue',source:'https://md.go.th/',sourceName:'กรมเจ้าท่า'},
  {number:'1418',name:'สายด่วนป่อเต็กตึ๊ง',agency:'มูลนิธิป่อเต็กตึ๊ง',note:'ประสานความช่วยเหลือกู้ชีพและกู้ภัย',group:'rescue',source:prdSource,sourceName:'กรมประชาสัมพันธ์'},
  {number:'1554',name:'หน่วยแพทย์กู้ชีวิต วชิรพยาบาล',agency:'โรงพยาบาลวชิรพยาบาล',note:'บริการการแพทย์ฉุกเฉินในกรุงเทพฯ',group:'rescue',source:'https://vajirafoundation.org/index.php/post08/',sourceName:'มูลนิธิวชิรพยาบาล'},
  {number:'1130',name:'การไฟฟ้านครหลวง',agency:'MEA',note:'กรุงเทพฯ นนทบุรี และสมุทรปราการ',group:'power',source:'https://eservice.mea.or.th/new_eservice/index.php?st=100',sourceName:'การไฟฟ้านครหลวง'},
  {number:'1129',name:'การไฟฟ้าส่วนภูมิภาค',agency:'PEA',note:'สอบถามและแจ้งปัญหาในพื้นที่บริการ PEA',group:'power',source:'https://www.pea.co.th/news/corporate-news/1918',sourceName:'การไฟฟ้าส่วนภูมิภาค'},
  {number:'1543',name:'การทางพิเศษแห่งประเทศไทย',agency:'EXAT',note:'ติดต่อเรื่องทางด่วน / ทางพิเศษ',group:'travel',source:prdSource,sourceName:'กรมประชาสัมพันธ์'},
  {number:'1586',name:'กรมทางหลวง',agency:'กรมทางหลวง',note:'สอบถามเส้นทางในความรับผิดชอบ',group:'travel',source:'https://tdmc.mot.go.th/',sourceName:'กระทรวงคมนาคม'},
  {number:'1146',name:'กรมทางหลวงชนบท',agency:'กรมทางหลวงชนบท',note:'สอบถามเส้นทางในความรับผิดชอบ',group:'travel',source:'https://tdmc.mot.go.th/',sourceName:'กระทรวงคมนาคม'},
  {number:'1193',name:'ตำรวจทางหลวง',agency:'กองบังคับการตำรวจทางหลวง',note:'ติดต่อเจ้าหน้าที่ตำรวจทางหลวง',group:'travel',source:prdSource,sourceName:'กรมประชาสัมพันธ์'},
  {number:'1584',name:'ร้องเรียนรถโดยสารสาธารณะ',agency:'กรมการขนส่งทางบก',note:'ศูนย์คุ้มครองผู้โดยสารรถสาธารณะ',group:'travel',source:'https://datagov.mot.go.th/dataset/1584',sourceName:'กระทรวงคมนาคม'},
  {number:'1137',name:'จส.100',agency:'สถานีวิทยุ จส.100',note:'แจ้งเหตุและประสานงานบนท้องถนน',group:'travel',source:prdSource,sourceName:'กรมประชาสัมพันธ์'},
  {number:'1300',name:'ศูนย์ช่วยเหลือสังคม',agency:'กระทรวงการพัฒนาสังคมและความมั่นคงของมนุษย์',note:'แจ้งปัญหาสังคมและขอรับความช่วยเหลือ',group:'other',source:'https://www.thangrath.go.th/feature/thangrat-hotline-1300/',sourceName:'ทางรัฐ'},
  {number:'1155',name:'ตำรวจท่องเที่ยว',agency:'กองบัญชาการตำรวจท่องเที่ยว',note:'ประสานเหตุที่เกี่ยวข้องกับนักท่องเที่ยว',group:'other',source:prdSource,sourceName:'กรมประชาสัมพันธ์'},
  {number:'1192',name:'ศูนย์รับแจ้งรถหาย',agency:'สำนักงานตำรวจแห่งชาติ',note:'แจ้งกรณีรถถูกโจรกรรม',group:'other',source:prdSource,sourceName:'กรมประชาสัมพันธ์'}
];
/* แท็บ "ฉุกเฉิน": ที่เดียวที่แสดงเบอร์ · ค้นหา + กรองหมวด · ปุ่มโทร + ⓘ แหล่งที่มา */
const HL_ICON={urgent:'alert',rescue:'ambulance',power:'info',travel:'road',other:'heart'};
let hlCat='all';
function renderHotlineCats(){
  const el=document.getElementById('hotline-cats');
  el.innerHTML=[['all','ทั้งหมด'],...hotlineGroups.map(g=>[g.id,g.title])].map(([k,t])=>`<button type="button" role="tab" data-cat="${k}" aria-selected="${hlCat===k}">${t}</button>`).join('');
}
function renderHotlines(){
  const term=document.getElementById('hotline-search').value.trim().toLowerCase();
  const matches=hotlines.filter(h=>(hlCat==='all'||h.group===hlCat)&&(!term||`${h.number} ${h.name} ${h.agency} ${h.note}`.toLowerCase().includes(term)));
  const root=document.getElementById('hotline-directory');root.replaceChildren();
  hotlineGroups.forEach(g=>{const list=matches.filter(h=>h.group===g.id);if(!list.length)return;
    const h2=document.createElement('h2');h2.textContent=g.title;root.append(h2);
    list.forEach(h=>{const row=document.createElement('article');row.className='hl';
      row.innerHTML=`<span class="hl-ic">${ic(HL_ICON[h.group]||'phone')}</span><div class="hl-txt"><b><span class="hl-num"></span><button type="button" class="hl-info" aria-label="แหล่งที่มา" aria-expanded="false">${ic('info')}</button></b><small class="hl-name"></small><div class="hl-src" hidden></div></div><a class="hl-call">${ic('phone')}โทร</a>`;
      row.querySelector('.hl-num').textContent=h.number;row.querySelector('.hl-name').textContent=h.name+' · '+h.agency;
      const call=row.querySelector('.hl-call');call.href='tel:'+h.number;call.setAttribute('aria-label','โทร '+h.number+' '+h.name);
      const src=row.querySelector('.hl-src');src.innerHTML='ที่มา: <a target="_blank" rel="noopener noreferrer"></a>';const a=src.querySelector('a');a.href=h.source;a.textContent=(h.sourceName||'แหล่งข้อมูล')+' ↗';
      const info=row.querySelector('.hl-info');info.onclick=()=>{src.hidden=!src.hidden;info.setAttribute('aria-expanded',String(!src.hidden))};
      root.append(row)})});
  if(!matches.length)root.innerHTML='<p class="empty">ไม่พบหมายเลข ลองค้นหาด้วยชื่อหน่วยงาน</p>';
}
document.getElementById('hotline-search').addEventListener('input',renderHotlines);
document.getElementById('hotline-cats').addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(!b)return;hlCat=b.dataset.cat;renderHotlineCats();renderHotlines()});
renderHotlineCats();renderHotlines();
