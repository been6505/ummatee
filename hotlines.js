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
function renderHotlines(){
  const term=document.querySelector('#hotline-search').value.trim().toLowerCase();
  const filter=document.querySelector('#hotline-filter').value;
  const matches=hotlines.filter(h=>(filter==='all'||h.group===filter)&&(!term||`${h.number} ${h.name} ${h.agency} ${h.note}`.toLowerCase().includes(term)));
  const root=document.querySelector('#hotline-directory');root.replaceChildren();
  document.querySelector('#hotline-count').textContent=`${matches.length} หมายเลข`;
  hotlineGroups.forEach(group=>{
    const contacts=matches.filter(h=>h.group===group.id);if(!contacts.length)return;
    const section=document.createElement('section');section.className='hotline-section';
    const heading=document.createElement('h2');heading.textContent=group.title;section.append(heading);
    const grid=document.createElement('div');grid.className='hotline-grid';
    contacts.forEach(h=>{
      const card=document.createElement('article');card.className='hotline-card'+(h.group==='urgent'?' priority':'');
      const link=document.createElement('a');link.className='hotline-call';link.href=`tel:${h.number}`;link.setAttribute('aria-label',`โทร ${h.number} ${h.name}`);
      const number=document.createElement('strong');number.className='hotline-number';number.textContent=h.number;
      const label=document.createElement('span');label.className='call-label';label.textContent='☎ กดโทร';link.append(number,label);
      const name=document.createElement('h3');name.textContent=h.name;
      const agency=document.createElement('p');agency.className='hotline-agency';agency.textContent=h.agency;
      const note=document.createElement('p');note.className='hotline-note';note.textContent=h.note;
      const source=document.createElement('a');source.className='hotline-source';source.href=h.source;source.target='_blank';source.rel='noopener noreferrer';source.textContent=`ที่มา: ${h.sourceName} ↗`;
      const info=document.createElement('div');info.className='hotline-info';info.append(name,note);const more=document.createElement('details');more.className='hotline-more';const summary=document.createElement('summary');summary.textContent='ข้อมูลหน่วยงาน';more.append(summary);if(h.agency!==h.name)more.append(agency);more.append(source);card.append(info,link,more);grid.append(card);
    });section.append(grid);root.append(section);
  });
  if(!matches.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='ไม่พบหมายเลข ลองค้นหาด้วยชื่อหน่วยงานหรือเลือกประเภททั้งหมด';root.append(empty)}
}
document.querySelector('#hotline-search').addEventListener('input',renderHotlines);
document.querySelector('#hotline-filter').addEventListener('change',renderHotlines);
renderHotlines();
