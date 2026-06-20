import { useNavigate } from '../navContext'
import { useLang } from '../i18n.jsx'
import FadeUp from '../components/FadeUp.jsx'
import Footer from '../components/Footer.jsx'
import SocialLinks from '../components/SocialLinks.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMoon, faHandHoldingHeart, faHands, faHandSparkles, faHandshake, faUtensils, faMosque, faBookOpen, faHeart, faFlag } from '@fortawesome/free-solid-svg-icons'

// ไอคอน FA สำหรับ help grid — เรียงตามลำดับเดียวกับ t.help array
const HELP_ICONS = [faUtensils, faMosque, faBookOpen, faHandshake]

// หน้าแรกของเว็บ — hero, แถบสถิติ, การ์ดกิจกรรม 2 ใบ, สิ่งที่เราช่วยเหลือ และ CTA ท้ายหน้า
// ข้อความทุกส่วนของหน้าแยกตามภาษา th/en/ar
const T = {
  th: {
    eyebrow: 'มูลนิธิอุมมะตี · Ummatee Thailand',
    title1: 'มือที่ยื่นออกไป', title2: 'คือ ', titleAccent: 'ความหวัง', title3: 'ของใครบางคน',
    sub: 'เราเชื่อมพี่น้องผู้มีจิตศรัทธาเข้ากับผู้ยากไร้ ผู้ประสบภัย และผู้ที่รอคอยความช่วยเหลือ ทั้งในประเทศไทยและทั่วโลก ทุกการให้ของคุณ คือสะพานแห่งความเมตตา',
    ctaIftar: 'ลงทะเบียนเข้าร่วมงาน Iftar For Gaza', ctaDonate: 'ร่วมบริจาคช่วยเหลือผู้ยากไร้',
    stats: [
      { n: '8', l: 'โครงการช่วยเหลือ' },
      { n: '12+', l: 'ประเทศที่เข้าถึง' },
      { n: '100%', l: 'ส่งต่อถึงมือผู้รับ' },
      { n: '24/7', l: 'พร้อมรับบริจาค' },
    ],
    waysEyebrow: 'สองหนทางแห่งการให้', waysTitle: 'เริ่มต้นทำความดีได้ตั้งแต่วันนี้',
    waysSub: 'ไม่ว่าจะเป็นการมาร่วมแบ่งปันมื้ออาหารกับพี่น้อง หรือการบริจาคเพื่อหล่อเลี้ยงชีวิต — ทุกก้าวเล็ก ๆ ของคุณสร้างความเปลี่ยนแปลงที่ยิ่งใหญ่',
    fcEventTag: '🌙 EVENT · กิจกรรม', fcEventTitle: 'Iftar For Gaza',
    fcEventP: 'ร่วมละศีลอดเพื่อกาซา แบ่งปันมื้ออาหารและดุอาอ์ให้พี่น้องผู้ถูกกดขี่ ลงทะเบียนเข้าร่วมงานฟรี',
    fcEventLink: 'ลงทะเบียนเข้าร่วมงาน',
    fcDonTag: '💚 DONATE · บริจาค', fcDonTitle: 'ช่วยเหลือผู้ยากไร้',
    fcDonP: 'บริจาคผ่านบัญชีมูลนิธิอุมมะตี เลือกได้ทั้งซะกาต ช่วยในไทย ปาเลสไตน์ ซีเรีย และอาหารทั่วโลก',
    fcDonLink: 'ดูบัญชีบริจาค',
    fcVolTag: '🤝 VOLUNTEER · อาสาสมัคร', fcVolTitle: 'เป็นส่วนหนึ่งของพวกเรา',
    fcVolP: 'ร่วมเป็นอาสาสมัครมูลนิธิอุมมะตี ช่วยเหลือกิจกรรม งานมนุษยธรรม และการสนับสนุนชุมชน สมัครได้เลย',
    fcVolLink: 'สมัครอาสาสมัคร',
    helpEyebrow: 'เราช่วยเหลืออะไรบ้าง', helpTitle: 'ความเมตตาที่ส่งถึงทุกชีวิต',
    help: [
      { e: '🍚', h: 'อาหาร', p: 'มื้ออาหารและน้ำสะอาดสำหรับผู้หิวโหยทั่วโลก' },
      { e: '🕌', h: 'ซะกาต', p: 'จัดการซะกาตของคุณให้ถึงมือผู้มีสิทธิ์อย่างถูกต้อง' },
      { e: '📖', h: 'วะกัฟกุรอาน', p: 'มอบกุรอานเป็นวะกัฟ ผลบุญต่อเนื่องไม่สิ้นสุด' },
      { e: '🤝', h: 'บรรเทาภัย', p: 'ช่วยเหลือผู้ประสบภัยในไทย ปาเลสไตน์ และซีเรีย' },
    ],
    ctaStripTitle: 'พร้อมจะเป็นส่วนหนึ่งของการให้แล้วหรือยัง?',
    ctaStripP: 'เลือกหนทางของคุณ — มาร่วมงาน Iftar For Gaza หรือเริ่มบริจาคได้ทันที',
    ctaStripIftar: 'ลงทะเบียน Iftar For Gaza', ctaStripDonate: 'ร่วมบริจาค',
    followTitle: 'ติดตามอุมมะตีได้ทุกช่องทาง', followP: 'อัปเดตภารกิจช่วยเหลือและกิจกรรมล่าสุดของเราได้ที่โซเชียลมีเดียทุกแพลตฟอร์ม',
  },
  en: {
    eyebrow: 'Ummatee Foundation · Ummatee Thailand',
    title1: 'A hand reaching out', title2: 'is ', titleAccent: 'hope', title3: ' for someone',
    sub: 'We connect generous hearts with the poor, disaster victims, and those waiting for help — in Thailand and around the world. Every gift you give is a bridge of mercy.',
    ctaIftar: 'Register for Iftar For Gaza', ctaDonate: 'Donate to Help Those in Need',
    stats: [
      { n: '8', l: 'Aid Programs' },
      { n: '12+', l: 'Countries Reached' },
      { n: '100%', l: 'Delivered in Full' },
      { n: '24/7', l: 'Open for Donations' },
    ],
    waysEyebrow: 'Two Ways to Give', waysTitle: 'Start Doing Good Today',
    waysSub: 'Whether sharing a meal with your brothers and sisters or donating to sustain lives — every small step you take creates great change.',
    fcEventTag: '🌙 EVENT', fcEventTitle: 'Iftar For Gaza',
    fcEventP: 'Break fast together for Gaza, share meals and dua for our oppressed brothers and sisters. Free registration.',
    fcEventLink: 'Register Now',
    fcDonTag: '💚 DONATE', fcDonTitle: 'Help Those in Need',
    fcDonP: 'Donate via Ummatee Foundation accounts — zakat, aid for Thailand, Palestine, Syria, and food worldwide.',
    fcDonLink: 'View Donation Accounts',
    fcVolTag: '🤝 VOLUNTEER', fcVolTitle: 'Join Our Team',
    fcVolP: 'Become an Ummatee volunteer — help with events, humanitarian work, and community support. Register today.',
    fcVolLink: 'Register as Volunteer',
    helpEyebrow: 'What We Do', helpTitle: 'Mercy That Reaches Every Life',
    help: [
      { e: '🍚', h: 'Food', p: 'Meals and clean water for the hungry around the world' },
      { e: '🕌', h: 'Zakat', p: 'Your zakat managed and delivered to those entitled, correctly' },
      { e: '📖', h: 'Quran Waqf', p: 'Give a Quran as waqf — continuous, never-ending reward' },
      { e: '🤝', h: 'Disaster Relief', p: 'Helping disaster victims in Thailand, Palestine, and Syria' },
    ],
    ctaStripTitle: 'Ready to Be Part of the Giving?',
    ctaStripP: 'Choose your path — join Iftar For Gaza or start donating right away',
    ctaStripIftar: 'Register · Iftar For Gaza', ctaStripDonate: 'Donate',
    followTitle: 'Follow Ummatee Everywhere', followP: 'Stay updated on our latest aid missions and activities on every platform',
  },
  ar: {
    eyebrow: 'مؤسسة أمّتي · تايلاند',
    title1: 'يدٌ تمتدّ للعطاء', title2: 'هي ', titleAccent: 'الأمل', title3: ' لشخصٍ ما',
    sub: 'نصل بين أصحاب القلوب الرحيمة وبين الفقراء والمنكوبين ومن ينتظرون العون، في تايلاند وحول العالم. كل عطاءٍ منك جسرٌ من الرحمة.',
    ctaIftar: 'سجّل في إفطار من أجل غزة', ctaDonate: 'تبرّع لمساعدة المحتاجين',
    stats: [
      { n: '8', l: 'برامج إغاثية' },
      { n: '+12', l: 'دولة نصل إليها' },
      { n: '100%', l: 'تصل كاملةً للمستحقين' },
      { n: '24/7', l: 'نستقبل تبرعاتكم' },
    ],
    waysEyebrow: 'طريقان للعطاء', waysTitle: 'ابدأ فعل الخير اليوم',
    waysSub: 'سواء بمشاركة وجبة مع إخوانك أو بالتبرع لإحياء النفوس — كل خطوة صغيرة منك تصنع تغييراً عظيماً.',
    fcEventTag: '🌙 فعالية', fcEventTitle: 'إفطار من أجل غزة',
    fcEventP: 'شارك في إفطارٍ جماعي من أجل غزة، وشارك الطعام والدعاء لإخواننا المستضعفين. التسجيل مجاني.',
    fcEventLink: 'سجّل الآن',
    fcDonTag: '💚 تبرّع', fcDonTitle: 'مساعدة المحتاجين',
    fcDonP: 'تبرّع عبر حسابات مؤسسة أمّتي — زكاة، إغاثة في تايلاند وفلسطين وسوريا، وإطعام حول العالم.',
    fcDonLink: 'عرض حسابات التبرع',
    fcVolTag: '🤝 تطوّع', fcVolTitle: 'كن جزءاً منّا',
    fcVolP: 'انضم إلى متطوعي مؤسسة أمّتي — ساعدنا في الفعاليات والعمل الإنساني ودعم المجتمع. سجّل الآن.',
    fcVolLink: 'سجّل كمتطوع',
    helpEyebrow: 'مجالات عملنا', helpTitle: 'رحمةٌ تصل إلى كل حياة',
    help: [
      { e: '🍚', h: 'الطعام', p: 'وجبات ومياه نظيفة للجائعين حول العالم' },
      { e: '🕌', h: 'الزكاة', p: 'ندير زكاتك ونوصلها لمستحقيها بالطريقة الصحيحة' },
      { e: '📖', h: 'وقف المصاحف', p: 'قدّم مصحفاً وقفاً — أجرٌ جارٍ لا ينقطع' },
      { e: '🤝', h: 'الإغاثة', p: 'إغاثة المنكوبين في تايلاند وفلسطين وسوريا' },
    ],
    ctaStripTitle: 'هل أنت مستعد لتكون جزءاً من العطاء؟',
    ctaStripP: 'اختر طريقك — انضم إلى إفطار من أجل غزة أو ابدأ التبرع فوراً',
    ctaStripIftar: 'سجّل · إفطار من أجل غزة', ctaStripDonate: 'تبرّع',
    followTitle: 'تابع أمّتي على كل المنصات', followP: 'تابع آخر مهماتنا الإغاثية وأنشطتنا على جميع وسائل التواصل الاجتماعي',
  },
}

export default function Home() {
  const go = useNavigate()
  const { lang } = useLang()
  const t = T[lang]
  return (
    <main className="page">
      {/* ── Hero Feed ── */}
      <section className="hero-feed">
        <div className="hero-feed-brand">
          
          <div className="hf-brand-text">
            <div className="hf-brand-name">Ummatee Foundation</div>
            <div className="hf-brand-sub">{t.eyebrow}</div>
          </div>
        </div>

        <div className="hf-feed">
          {/* Card 1 — Iftar For Gaza */}
          <FadeUp className="hf-card">
            <a href="#" onClick={(e) => { e.preventDefault(); go('iftar') }} className="hf-card-poster-link">
              <img
                src="/poster-iftar-gaza.png"
                alt="Iftar For Gaza"
                className="hf-poster"
              />
            </a>
            <div className="hf-card-body">
              <div className="hf-card-tags">
                <span className="hf-tag hf-tag-green"><FontAwesomeIcon icon={faMoon} /> EVENT</span>
                <span className="hf-tag hf-tag-muted"><FontAwesomeIcon icon={faFlag} /> Gaza</span>
              </div>
              <h2 className="hf-card-title">{t.fcEventTitle}</h2>
              <p className="hf-card-desc">{t.fcEventP}</p>
              <a href="#" className="hf-card-btn hf-btn-iftar" onClick={(e) => { e.preventDefault(); go('iftar') }}>
                {t.fcEventLink} →
              </a>
            </div>
          </FadeUp>

          {/* Card 2 — งาน ให้ */}
          <FadeUp className="hf-card" delay={80}>
            <a href="#" onClick={(e) => { e.preventDefault(); go('give') }} className="hf-card-poster-link">
              <img
                src="/721119853_1607959538003595_185415737813897318_n.jpg"
                alt="งาน ให้ ครั้งที่ 6"
                className="hf-poster"
              />
            </a>
            <div className="hf-card-body">
              <div className="hf-card-tags">
                <span className="hf-tag hf-tag-purple"><FontAwesomeIcon icon={faHandHoldingHeart} /> EVENT</span>
                <span className="hf-tag hf-tag-muted">3–5 ก.ค. 2569</span>
              </div>
              <h2 className="hf-card-title">{lang === 'ar' ? 'العطاء — الدورة السادسة' : lang === 'en' ? 'GIVE — 6th Edition' : 'งาน "ให้" ครั้งที่ 6'}</h2>
              <p className="hf-card-desc">{lang === 'ar' ? 'مهرجان العطاء — أكشاك طعام، محاضرات، وأنشطة عائلية. ثلاثة أيام كاملة.' : lang === 'en' ? 'A festival of giving — food stalls, talks, influencer meet-ups, and a fun kids zone. Three full days.' : 'เทศกาลแห่งการแบ่งปัน ออกร้านอาหาร ฟังบรรยาย และส่งต่อสิ่งของ ลานพลาซ่า อินดอร์สเตเดียมหัวหมาก'}</p>
              <a href="#" className="hf-card-btn hf-btn-give" onClick={(e) => { e.preventDefault(); go('give') }}>
                {lang === 'ar' ? 'اعرف أكثر ←' : lang === 'en' ? 'Learn More →' : 'ดูรายละเอียด →'}
              </a>
            </div>
          </FadeUp>

          {/* Card 3 — อาสาสมัคร */}
          <FadeUp className="hf-card" delay={160}>
            <div className="hf-card-gradient-hero hf-gradient-volunteer">
              <span className="hf-gradient-icon"><FontAwesomeIcon icon={faHandSparkles} /></span>
              <div className="hf-gradient-label">Volunteer</div>
            </div>
            <div className="hf-card-body">
              <div className="hf-card-tags">
                <span className="hf-tag hf-tag-teal"><FontAwesomeIcon icon={faHands} /> JOIN US</span>
                <span className="hf-tag hf-tag-muted">งาน ให้ ครั้งที่ 6</span>
              </div>
              <h2 className="hf-card-title">{lang === 'en' ? 'Volunteer with Us' : lang === 'ar' ? 'تطوع معنا' : 'สมัครอาสาสมัคร'}</h2>
              <p className="hf-card-desc">{lang === 'en' ? 'Join our volunteer team for GIVE 6th edition — help set up, guide guests, and make the event a success.' : lang === 'ar' ? 'انضم إلى فريق التطوع لنسخة العطاء السادسة وساعد في جعل الحدث ناجحاً.' : 'ร่วมเป็นทีมอาสาในงาน "ให้" ครั้งที่ 6 ช่วยเตรียมงาน ต้อนรับแขก และสร้างบรรยากาศที่อบอุ่น'}</p>
              <a href="#" className="hf-card-btn hf-btn-volunteer" onClick={(e) => { e.preventDefault(); go('volunteer') }}>
                {lang === 'en' ? 'Sign Up →' : lang === 'ar' ? 'سجّل الآن ←' : 'สมัครเลย →'}
              </a>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* แถบตัวเลขสถิติ 4 ช่อง */}
      <section className="stats-band">
        <div className="stats-inner">
          {t.stats.map((s, i) => (
            <FadeUp className="stat-block" key={i}>
              <div className="stat-number">{s.n}</div>
              <div className="stat-label">{s.l}</div>
            </FadeUp>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <FadeUp className="section-head">
            <span className="eyebrow-sm">{t.waysEyebrow}</span>
            <h2>{t.waysTitle}</h2>
            <p>{t.waysSub}</p>
            <div className="gold-rule"></div>
          </FadeUp>
          {/* การ์ดทางลัด 3 ใบ: ลงทะเบียน Iftar / บริจาค / อาสาสมัคร */}
          <div className="focus-grid focus-grid-3">
            <FadeUp className="focus-card focus-iftar" onClick={() => go('iftar')}>
              <div className="fc-pattern hero-pattern"></div>
              <span className="fc-tag">{t.fcEventTag}</span>
              <h3>{t.fcEventTitle}</h3>
              <p>{t.fcEventP}</p>
              <span className="fc-link">{t.fcEventLink} <span className="arrow">→</span></span>
            </FadeUp>
            <FadeUp className="focus-card focus-donate" onClick={() => go('donation')}>
              <div className="fc-pattern hero-pattern"></div>
              <span className="fc-tag">{t.fcDonTag}</span>
              <h3>{t.fcDonTitle}</h3>
              <p>{t.fcDonP}</p>
              <span className="fc-link">{t.fcDonLink} <span className="arrow">→</span></span>
            </FadeUp>
            <FadeUp className="focus-card focus-volunteer" onClick={() => go('volunteer')}>
              <div className="fc-pattern hero-pattern"></div>
              <span className="fc-tag">{t.fcVolTag}</span>
              <h3>{t.fcVolTitle}</h3>
              <p>{t.fcVolP}</p>
              <span className="fc-link">{t.fcVolLink} <span className="arrow">→</span></span>
            </FadeUp>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <FadeUp className="section-head">
            <span className="eyebrow-sm">{t.helpEyebrow}</span>
            <h2>{t.helpTitle}</h2>
            <div className="gold-rule"></div>
          </FadeUp>
          <div className="help-grid">
            {t.help.map((h, i) => (
              <FadeUp className="help-item" key={i}>
                <div className="he"><FontAwesomeIcon icon={HELP_ICONS[i]} /></div>
                <h4>{h.h}</h4>
                <p>{h.p}</p>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '0 0 96px' }}>
        <div className="wrap">
          <FadeUp className="cta-strip">
            <div className="fc-pattern hero-pattern"></div>
            <h2>{t.ctaStripTitle}</h2>
            <p>{t.ctaStripP}</p>
            <div className="hero-actions">
              <a href="#" className="btn btn-iftar" onClick={(e) => { e.preventDefault(); go('iftar') }}><FontAwesomeIcon icon={faMoon} /> {t.ctaStripIftar}</a>
              <a href="#" className="btn btn-donate" onClick={(e) => { e.preventDefault(); go('donation') }}><FontAwesomeIcon icon={faHeart} /> {t.ctaStripDonate}</a>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ช่วงท้ายหน้าแรก: ชวนติดตามโซเชียลมีเดียของอุมมะตี */}
      <section className="social-section">
        <div className="wrap">
          <FadeUp className="social-card">
            <div className="fc-pattern hero-pattern"></div>
            <h2>{t.followTitle}</h2>
            <p>{t.followP}</p>
            <SocialLinks />
          </FadeUp>
        </div>
      </section>

      <Footer />
    </main>
  )
}
