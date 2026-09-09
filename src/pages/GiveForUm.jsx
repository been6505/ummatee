import FadeUp from '../components/FadeUp.jsx'
import Footer from '../components/Footer.jsx'
import { useLang } from '../i18n.jsx'
import { useNavigate } from '../navContext'
import { PAGE_TO_PATH } from '../data/routes.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLaptop, faUtensils, faCartShopping, faHandsHolding, faLandmark, faGift, faHandshake, faMicrophone, faGem, faMobileScreen, faBagShopping, faPaintbrush, faCalendar, faLocationDot, faClock, faBoxOpen, faTruckFast, faClipboardCheck, faHandHoldingHeart } from '@fortawesome/free-solid-svg-icons'

const T = {
  th: {
    eyebrow: 'งาน "ให้" ครั้งที่ 6 · GIVE',
    h1: 'งาน ให้ ครั้งที่ 6',
    lead: 'เทศกาลแห่งการแบ่งปัน ออกร้านขายอาหารและเสื้อผ้า ฟังบรรยาย พบปะอินฟลูเอนเซอร์ และโซนเด็กเล่นสุดสนุก ตลอด 3 วันเต็ม',
    date: 'วัน', dateV: '3-5 กรกฎาคม 2569',
    place: 'สถานที่', placeV: 'ลานพลาซ่า หน้าอินดอร์สเตเดียมหัวหมาก',
    time: 'เวลา', timeV: '14.00 - 23.00 น.',
    campaignTitle: 'CAMPAIGN',
    campaignSub: 'วันนี้มาให้อะไร',
    campaignItems: [
      { e: faHandsHolding, h: 'ให้', p: 'มาร่วมกันให้สิ่งที่ดีที่สุด เพื่อเป็นประโยชน์แก่ผู้อื่น' },
      { e: faLaptop, h: 'คอมมือสองเพื่อน้องได้เรียน', p: 'มอบคอมพิวเตอร์มือสองให้เด็กนักเรียนที่ขาดโอกาสได้ใช้เรียนหนังสือ', cta: true, link: 'give2' },
      { e: faUtensils, h: 'อุปกรณ์ครัว', p: 'บริจาคเครื่องปั้น เตาปิ้ง และอุปกรณ์ครัว เพื่อสร้างรายได้ให้ครอบครัว', cta: true, link: 'give2cook' },
      { e: faCartShopping, h: '1 ยอดขาย 1 บาท', p: 'ทุกยอดซื้อสินค้าในงาน 1 บาทจะถูกส่งต่อเพื่อช่วยเหลือผู้ยากไร้' },
    ],
    campaignBtn: 'ร่วมส่งต่อของ →',
    receiveTitle: 'RECEIVE',
    receiveSub: 'มารับของกันเถอะ',
    receiveItems: [
      { e: faBoxOpen, h: 'เปิดกล่องแห่งการให้', p: 'รับสิ่งของที่ผู้ใจบุญบริจาค พร้อมใช้งานจริงในชีวิตประจำวัน' },
      { e: faLaptop, h: 'รับคอมมือสอง', p: 'นักเรียนและผู้ขาดโอกาสสามารถลงทะเบียนรับคอมพิวเตอร์มือสองได้ในงาน' },
      { e: faHandHoldingHeart, h: 'รับอุปกรณ์สร้างอาชีพ', p: 'เครื่องปั้น เตาปิ้ง อุปกรณ์ครัว สำหรับผู้ที่ต้องการเริ่มต้นอาชีพ' },
      { e: faClipboardCheck, h: 'ลงทะเบียนรับของ', p: 'ลงทะเบียนล่วงหน้าเพื่อรับของบริจาคที่ตรงกับความต้องการของคุณ' },
    ],
    receiveBtn: 'ลงทะเบียนรับของ →',
    stageSub: 'One Stage, One Story, One Ummah',
    exhibitionTitle: 'EXHIBITION',
    exhibitionSub: '12 ปี อุมมะตี',
    exhibitionItems: [
      { e: faLandmark, h: '12 ปี อุมมะตี', p: 'นิทรรศการย้อนรอย 12 ปีแห่งการทำงานเพื่อสังคม เส้นทางและความสำเร็จ' },
      { e: faGift, h: 'Souvenir', p: 'ของที่ระลึกพิเศษจากมูลนิธิอุมมะตี เลือกซื้อได้ในงาน' },
      { e: faHandshake, h: 'องค์กรเครือข่าย', p: 'พบปะองค์กรพันธมิตรและเครือข่ายที่ร่วมทำงานเพื่อสังคม' },
      { e: faPaintbrush, h: 'Workshop', p: 'Workshop พิเศษที่คุณจะได้เรียนรู้และสร้างประโยชน์ไปพร้อมกัน' },
      
    ],
    donationTitle: 'DONATION',
    donationSub: 'ร่วมบริจาคเพื่อสังคม',
    donationItems: [
      { e: faGem, h: 'Welcome Partner', p: 'ขอบคุณพันธมิตรและผู้สนับสนุนที่ร่วมสร้างสังคมที่ดีกว่า' },
      { e: faMobileScreen, h: 'E-Donation', p: 'บริจาคผ่าน QR Code สะดวก รวดเร็ว ปลอดภัย ถึงผู้รับเต็มจำนวน' },
      { e: faBagShopping, h: 'ร้านค้า B2UM', p: 'ซื้อสินค้า B2UM รายได้ส่วนหนึ่งสนับสนุนมูลนิธิอุมมะตีโดยตรง' },
      { e: faPaintbrush, h: 'Workshop', p: 'Workshop พิเศษที่คุณจะได้เรียนรู้และสร้างประโยชน์ไปพร้อมกัน' },
    ],
    donateBtn: 'ร่วมบริจาคออนไลน์ →',
  },
  en: {
    eyebrow: 'GIVE Event · 6th Edition',
    h1: 'GIVE — 6th Edition',
    lead: 'A festival of giving — food and clothing stalls, talks, influencer meet-ups, and a fun kids zone. Three full days.',
    date: 'Date', dateV: '3-5 July 2026',
    place: 'Venue', placeV: 'Plaza Front, Rajamangala Indoor Stadium',
    time: 'Time', timeV: '14:00 - 23:00',
    campaignTitle: 'CAMPAIGN',
    campaignSub: "What are you giving today?",
    campaignItems: [
      { e: faLaptop, h: 'Donate a Used Computer', p: 'Give a second-hand computer so underprivileged students can learn' },
      { e: faUtensils, h: 'Tools for Livelihoods', p: 'Donate cooking equipment to help families earn an income' },
      { e: faCartShopping, h: '1 Sale = 1 Baht', p: 'Every item purchased in the event — 1 baht goes to those in need' },
      { e: faHandsHolding, h: 'Pass It Forward', p: 'Bring items you no longer use and give them new purpose' },
    ],
    campaignBtn: 'Donate an item →',
    receiveTitle: 'RECEIVE',
    receiveSub: 'Come and Receive',
    receiveItems: [
      { e: faBoxOpen, h: 'Open a Box of Giving', p: 'Receive donated items ready for everyday use' },
      { e: faLaptop, h: 'Get a Used Computer', p: 'Students and underprivileged individuals can register to receive a second-hand computer' },
      { e: faHandHoldingHeart, h: 'Livelihood Equipment', p: 'Cooking tools, grills, and kitchen gear for those starting a new career' },
      { e: faClipboardCheck, h: 'Register to Receive', p: 'Pre-register to receive donations that match your needs' },
    ],
    receiveBtn: 'Register to receive →',
    exhibitionTitle: 'EXHIBITION',
    stageSub: 'Stage Activities',
    exhibitionSub: '12 Years of Ummatee',
    exhibitionItems: [
      { e: faLandmark, h: '12 Years of Ummatee', p: 'An exhibition tracing 12 years of social work, milestones and impact' },
      { e: faGift, h: 'Souvenir', p: 'Special mementos from Ummatee Foundation, available in the event' },
      { e: faHandshake, h: 'Partner Network', p: 'Meet partner organizations working together for social good' },
      { e: faMicrophone, h: 'On Stage', p: 'Live performances and talks from special speakers throughout the event' },
    ],
    donationTitle: 'DONATION',
    donationSub: 'Give to Make a Difference',
    donationItems: [
      { e: faGem, h: 'Welcome Partners', p: 'Grateful to our partners and sponsors building a better society' },
      { e: faMobileScreen, h: 'Donate via QR', p: 'Quick, secure QR code donations — 100% reaches recipients' },
      { e: faBagShopping, h: 'B2UM Store', p: 'Buy B2UM products — a portion goes directly to Ummatee Foundation' },
      { e: faPaintbrush, h: 'Workshop', p: 'Special workshops where you learn while making a positive impact' },
    ],
    donateBtn: 'Donate online →',
  },
  ar: {
    eyebrow: 'فعالية "العطاء" السادسة · GIVE',
    h1: 'العطاء — الدورة السادسة',
    lead: 'مهرجان العطاء — أكشاك طعام وملابس، محاضرات، لقاءات مع المؤثرين، ومنطقة ألعاب ممتعة للأطفال.',
    date: 'التاريخ', dateV: '3-5 يوليو 2026',
    place: 'المكان', placeV: 'ملعب راجامانجالا الوطني',
    time: 'الوقت', timeV: '14:00 - 23:00',
    campaignTitle: 'CAMPAIGN',
    campaignSub: 'ماذا ستعطي اليوم؟',
    campaignItems: [
      { e: faLaptop, h: 'تبرع بحاسوب مستعمل', p: 'أعطِ حاسوباً ليتمكن الطلاب المحتاجون من التعلم' },
      { e: faUtensils, h: 'أدوات للرزق', p: 'تبرع بمعدات طهي لمساعدة العائلات على كسب الرزق' },
      { e: faCartShopping, h: '1 بيع = 1 بات', p: 'كل منتج تشتريه — بات واحد يذهب لمن يحتاج' },
      { e: faHandsHolding, h: 'مرّر العطاء', p: 'أحضر الأشياء التي لا تستخدمها وأعطها حياة جديدة' },
    ],
    campaignBtn: 'تبرع بشيء →',
    receiveTitle: 'RECEIVE',
    receiveSub: 'تعال واستلم',
    receiveItems: [
      { e: faBoxOpen, h: 'افتح صندوق العطاء', p: 'استلم مواد مُتبرع بها جاهزة للاستخدام اليومي' },
      { e: faLaptop, h: 'احصل على حاسوب مستعمل', p: 'يمكن للطلاب والمحتاجين التسجيل لاستلام حاسوب مستعمل' },
      { e: faHandHoldingHeart, h: 'معدات لكسب الرزق', p: 'أدوات طهي وشوايات ومعدات مطبخ لمن يبدأ مهنة جديدة' },
      { e: faClipboardCheck, h: 'سجّل للاستلام', p: 'سجّل مسبقاً لاستلام تبرعات تناسب احتياجاتك' },
    ],
    receiveBtn: 'سجّل للاستلام →',
    exhibitionTitle: 'EXHIBITION',
    exhibitionSub: '12 عاماً من أمّتي',
    stageSub: 'أنشطة المسرح',
    exhibitionItems: [
      { e: faLandmark, h: '12 عاماً من أمّتي', p: 'معرض يستعرض 12 عاماً من العمل الاجتماعي والإنجازات' },
      { e: faGift, h: 'هدايا تذكارية', p: 'تذكارات خاصة من مؤسسة أمّتي متاحة في الفعالية' },
      { e: faHandshake, h: 'شبكة الشركاء', p: 'تعرّف على المنظمات الشريكة في العمل الاجتماعي' },
      { e: faMicrophone, h: 'على المسرح', p: 'عروض حية ومحاضرات من متحدثين مميزين طوال الفعالية' },
    ],
    donationTitle: 'DONATION',
    donationSub: 'تبرع لتصنع فارقاً',
    donationItems: [
      { e: faGem, h: 'الشركاء المرحب بهم', p: 'شكراً لشركائنا وداعمينا في بناء مجتمع أفضل' },
      { e: faMobileScreen, h: 'تبرع عبر QR', p: 'تبرع سريع وآمن — 100% يصل للمستحقين' },
      { e: faBagShopping, h: 'متجر B2UM', p: 'اشترِ منتجات B2UM — جزء منها يذهب لمؤسسة أمّتي' },
      { e: faPaintbrush, h: 'ورشة عمل', p: 'ورش عمل خاصة تتعلم فيها وتصنع أثراً إيجابياً' },
    ],
    donateBtn: 'تبرع عبر الإنترنت →',
  },
}

export default function GiveForUm() {
  const go = useNavigate()
  const { lang } = useLang()
  const t = T[lang]
  return (
    <main className="page give-page">
      {/* ── Hero ── */}
      <section className="give-hero">
        <div className="give-hero-bg"></div>
        <div className="inner">
          <span className="give-eyebrow"><FontAwesomeIcon icon={faHandsHolding} /> {t.eyebrow}</span>
          <h1 className="give-h1">{t.h1}</h1>
          <p className="give-lead">{t.lead}</p>
          <div className="give-info-row">
            <div className="give-info-chip"><FontAwesomeIcon icon={faCalendar} /> {t.dateV}</div>
            <div className="give-info-chip"><FontAwesomeIcon icon={faLocationDot} /> {t.placeV}</div>
            <div className="give-info-chip"><FontAwesomeIcon icon={faClock} /> {t.timeV}</div>
          </div>
        </div>
      </section>

      {/* ── CAMPAIGN ── */}
      <section className="give-section campaign-section">
        <div className="wrap">
          <FadeUp className="give-section-head">
            <div className="give-section-badge campaign-badge">CAMPAIGN</div>
            <h2>{t.campaignSub}</h2>
          </FadeUp>
          <div className="campaign-layout">
            <FadeUp className="give-campaign-poster">
              <img src="/givecam.webp" alt="Give Campaign" loading="lazy" style={{ width: '100%', height: 'auto' }} />
            </FadeUp>
            <div className="campaign-cards">
              {t.campaignItems.map((item, i) => (
                <FadeUp
                  className={`give-card campaign-card${item.cta ? ' campaign-cta-card' : ''}`}
                  key={i}
                  onClick={item.cta ? () => go(item.link || 'give2') : undefined}
                  style={item.cta ? { cursor: 'pointer' } : undefined}
                >
                  <div className="give-card-icon"><FontAwesomeIcon icon={item.e} /></div>
                  <h4>{item.h}</h4>
                  <p>{item.p}</p>
                  {item.cta && <span className="campaign-cta-link">ร่วมส่งต่อ →</span>}
                </FadeUp>
              ))}
            </div>
          </div>
          <FadeUp style={{ textAlign: 'center', marginTop: 32 }}>
            <a className="give-cta-btn" href={PAGE_TO_PATH['give2'] || '/'} onClick={(e) => { e.preventDefault(); go('give2') }}>{t.campaignBtn}</a>
          </FadeUp>
        </div>
      </section>

      {/* ── RECEIVE ── */}


      {/* ── EXHIBITION ── */}
      <section className="give-section exhibition-section">
        <div className="wrap">
          <FadeUp className="give-section-head">
            <div className="give-section-badge exhibition-badge">EXHIBITION</div>
            <h2>{t.exhibitionSub}</h2>
          </FadeUp>
          <div className="give-grid">
            {t.exhibitionItems.map((item, i) => (
              <FadeUp className="give-card exhibition-card" key={i}>
                <div className="give-card-icon"><FontAwesomeIcon icon={item.e} /></div>
                <h4>{item.h}</h4>
                <p>{item.p}</p>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── STAGE ── */}
      <section className="give-section stage-section">
        <div className="wrap">
          <FadeUp className="give-section-head">
            <div className="give-section-badge stage-badge">STAGE</div>
            <h2>{t.stageSub}</h2>
          </FadeUp>
          <FadeUp className="give-stage-poster">
            <img src="/stage.webp" alt="Stage" loading="lazy" />
          </FadeUp>
        </div>
      </section>

      {/* ── DONATION ── */}
      <section className="give-section donation-section">
        <div className="wrap">
          <FadeUp className="give-section-head">
            <div className="give-section-badge donation-badge">DONATION</div>
            <h2>{t.donationSub}</h2>
          </FadeUp>
          <div className="give-grid">
            {t.donationItems.map((item, i) => (
              <FadeUp className="give-card donation-card" key={i}>
                <div className="give-card-icon"><FontAwesomeIcon icon={item.e} /></div>
                <h4>{item.h}</h4>
                <p>{item.p}</p>
              </FadeUp>
            ))}
          </div>
          <FadeUp style={{ textAlign: 'center', marginTop: 32 }}>
            <a className="give-cta-btn donation-btn" href={PAGE_TO_PATH['donation'] || '/'} onClick={(e) => { e.preventDefault(); go('donation') }}>{t.donateBtn}</a>
          </FadeUp>
        </div>
      </section>

      <Footer />
    </main>
  )
}
