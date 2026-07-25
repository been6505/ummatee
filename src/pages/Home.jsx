import { useEffect, useState } from 'react'
import { useNavigate } from '../navContext'
import { useLang } from '../i18n.jsx'
import FadeUp from '../components/FadeUp.jsx'
import Footer from '../components/Footer.jsx'
import SocialLinks from '../components/SocialLinks.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMoon, faHandHoldingHeart, faHands, faHandSparkles, faHandshake, faUtensils, faMosque, faBookOpen, faHeart, faFlag, faArrowRight, faChevronLeft, faChevronRight, faPlay, faShareNodes, faCheck } from '@fortawesome/free-solid-svg-icons'
import { MISSIONS, QURBAN_CARD } from '../data/missions.js'
import { useHomeCards, DEFAULT_HOME_CARDS, L } from '../data/homeCards.js'
import { useFocusCards, DEFAULT_FOCUS_CARDS } from '../data/focusCards.js'
import { useNavVisibility, navKeyForPath } from '../data/navVisibility.js'
import { optImg } from '../utils/cloudinaryUrl.js'
import useParallax from '../hooks/useParallax.js'

// นำทางไป path ใดๆ แบบ SPA (การ์ดที่แอดมินสร้างใส่ path อิสระได้ ไม่จำกัดแค่ชื่อหน้าใน go())
// pushState แล้วยิง popstate ให้ App.jsx จับและเรนเดอร์หน้าใหม่ — ไม่ต้อง reload ทั้งเว็บ
const goPath = (path) => {
  const p = path || '/'
  // ลิงก์ภายนอก (http/https ต่างโดเมน หรือ mailto/tel) — เปิดแท็บใหม่ ไม่ใช้ pushState (จะ throw SecurityError ถ้าข้ามโดเมน)
  if (/^(https?:)?\/\//i.test(p) || /^(mailto:|tel:)/i.test(p)) {
    try {
      const dest = new URL(p, window.location.origin)
      if (dest.origin !== window.location.origin) { window.open(dest.href, '_blank', 'noopener'); return }
      // ลิงก์เต็มแต่เป็นโดเมนเดียวกัน → นำทางภายในด้วย path ของมัน
      window.history.pushState({}, '', dest.pathname + dest.search + dest.hash)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch { window.open(p, '_blank', 'noopener') }
    return
  }
  window.history.pushState({}, '', p)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

// ปุ่มแชร์การ์ดหน้าแรก — แนบรูปโปสเตอร์ + ลิงก์ไปด้วยกัน (Web Share API) ถ้าไม่รองรับก็คัดลอกลิงก์แทน
function ShareCardBtn({ title, desc, link, image, className, iconOnly }) {
  const [done, setDone] = useState(false)
  const onShare = async (e) => {
    e.preventDefault(); e.stopPropagation()
    const url = `${window.location.origin}${link || '/'}`
    const shareData = { title: title || 'Ummatee', text: desc || title || '', url }
    if (image && navigator.share && navigator.canShare) {
      try {
        const res = await fetch(image)
        const blob = await res.blob()
        const file = new File([blob], 'ummatee.jpg', { type: blob.type || 'image/jpeg' })
        if (navigator.canShare({ files: [file] })) { await navigator.share({ ...shareData, files: [file] }); return }
      } catch { /* ไปแชร์แบบไม่มีรูปต่อ */ }
    }
    if (navigator.share) { try { await navigator.share(shareData); return } catch { /* cancelled */ } }
    try { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 1800) } catch { /* noop */ }
  }
  return (
    <button type="button" className={className} onClick={onShare} aria-label="แชร์" title="แชร์">
      <FontAwesomeIcon icon={done ? faCheck : faShareNodes} />{iconOnly ? '' : ` ${done ? 'คัดลอกแล้ว' : 'แชร์'}`}
    </button>
  )
}

const isVideo = (url) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url)

function PosterCarousel({ images, alt, onClick }) {
  const [idx, setIdx] = useState(0)
  const total = images.length
  useEffect(() => {
    if (total <= 1) return
    const t = setInterval(() => setIdx((i) => (i + 1) % total), 4000)
    return () => clearInterval(t)
  }, [total])
  const safeIdx = idx < total ? idx : 0
  return (
    <a href="#" onClick={(e) => { e.preventDefault(); onClick() }} className="hf-card-poster-link hf-poster-carousel">
      <img src={images[safeIdx]} alt={alt} className="hf-poster" fetchPriority={safeIdx === 0 ? 'high' : 'auto'} />
      {total > 1 && (
        <div className="hf-poster-dots">
          {images.map((_, i) => <span key={i} className={`hf-poster-dot${i === safeIdx ? ' active' : ''}`} />)}
        </div>
      )}
    </a>
  )
}

const GAZA = MISSIONS.find((m) => m.key === 'gaza')

function GazaCarousel({ items, lang, go }) {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const total = items.length
  const prev = () => setIdx((i) => (i - 1 + total) % total)
  const next = () => setIdx((i) => (i + 1) % total)
  useEffect(() => {
    if (total <= 1 || paused) return
    const t = setInterval(() => setIdx((i) => (i + 1) % total), 3500)
    return () => clearInterval(t)
  }, [total, paused])
  if (!total) return null
  const safeIdx = idx < total ? idx : 0  // กัน idx ค้างเกินขอบเขตเมื่อจำนวนรูปลดลง
  const cur = items[safeIdx]
  const tx = GAZA[lang] || GAZA.th
  return (
    <div className="hm-gaza-wrap">
      {/* ซ้าย: carousel 1:1 */}
      <div className="hm-gaza-left">
        <div className="hm-gaza-stage"
          onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)} onTouchEnd={() => setTimeout(() => setPaused(false), 2000)}>
          {isVideo(cur)
            ? <video key={idx} src={cur} controls preload="metadata" playsInline className="hm-gaza-media" onPlay={() => setPaused(true)} onPause={() => setPaused(false)} />
            : <img key={idx} src={cur} alt="Gaza" loading="lazy" className="hm-gaza-media" />}
          {isVideo(cur) && <span className="hm-gaza-play"><FontAwesomeIcon icon={faPlay} /></span>}
          {total > 1 && <>
            <button className="hm-gaza-btn hm-gaza-prev" onClick={prev}><FontAwesomeIcon icon={faChevronLeft} /></button>
            <button className="hm-gaza-btn hm-gaza-next" onClick={next}><FontAwesomeIcon icon={faChevronRight} /></button>
          </>}
        </div>
        {total > 1 && (
          <div className="hm-gaza-dots">
            {items.map((_, i) => <button key={i} className={`hm-gaza-dot${i === safeIdx ? ' active' : ''}`} onClick={() => setIdx(i)} />)}
          </div>
        )}
      </div>
      {/* ขวา: พื้นขาว + ข้อความ */}
      <div className="hm-gaza-right">
        <div className="hm-gaza-tag"><FontAwesomeIcon icon={GAZA.icon} /> GAZA</div>
        <h3 className="hm-gaza-title">{tx.name}</h3>
        <p className="hm-gaza-desc">{tx.desc}</p>
        <button className="hm-gaza-cta" onClick={() => go('missions')}>
          {lang === 'ar' ? 'عرض الصور والفيديوهات' : lang === 'en' ? 'View photos & videos' : 'ดูภาพและวิดีโอ'} <FontAwesomeIcon icon={faArrowRight} />
        </button>
      </div>
    </div>
  )
}

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
      { n: '7', l: 'โครงการช่วยเหลือ' },
      { n: '31+', l: 'ประเทศที่เข้าถึง' },
      { n: '100%', l: 'ส่งต่อถึงมือผู้รับ' },
      { n: '24/7', l: 'พร้อมรับบริจาค' },
    ],
    waysEyebrow: 'สองหนทางแห่งการให้', waysTitle: 'เริ่มต้นทำความดีได้ตั้งแต่วันนี้',
    waysSub: 'ไม่ว่าจะเป็นการมาร่วมแบ่งปันมื้ออาหารกับพี่น้อง หรือการบริจาคเพื่อหล่อเลี้ยงชีวิต — ทุกก้าวเล็ก ๆ ของคุณสร้างความเปลี่ยนแปลงที่ยิ่งใหญ่',
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
    missionsEyebrow: 'MISSIONS · ภารกิจ', missionsTitle: 'ทุกโครงการของเรา', missionsCta: 'ดูภาพและวิดีโอทุกภารกิจ',
  },
  en: {
    eyebrow: 'Ummatee Foundation · Ummatee Thailand',
    title1: 'A hand reaching out', title2: 'is ', titleAccent: 'hope', title3: ' for someone',
    sub: 'We connect generous hearts with the poor, disaster victims, and those waiting for help — in Thailand and around the world. Every gift you give is a bridge of mercy.',
    ctaIftar: 'Register for Iftar For Gaza', ctaDonate: 'Donate to Help Those in Need',
    stats: [
      { n: '7', l: 'Aid Programs' },
      { n: '31+', l: 'Countries Reached' },
      { n: '100%', l: 'Delivered in Full' },
      { n: '24/7', l: 'Open for Donations' },
    ],
    waysEyebrow: 'Two Ways to Give', waysTitle: 'Start Doing Good Today',
    waysSub: 'Whether sharing a meal with your brothers and sisters or donating to sustain lives — every small step you take creates great change.',
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
    missionsEyebrow: 'MISSIONS', missionsTitle: 'All Our Projects', missionsCta: 'View photos & videos of every mission',
  },
  ar: {
    eyebrow: 'مؤسسة أمّتي · تايلاند',
    title1: 'يدٌ تمتدّ للعطاء', title2: 'هي ', titleAccent: 'الأمل', title3: ' لشخصٍ ما',
    sub: 'نصل بين أصحاب القلوب الرحيمة وبين الفقراء والمنكوبين ومن ينتظرون العون، في تايلاند وحول العالم. كل عطاءٍ منك جسرٌ من الرحمة.',
    ctaIftar: 'سجّل في إفطار من أجل غزة', ctaDonate: 'تبرّع لمساعدة المحتاجين',
    stats: [
      { n: '7', l: 'برامج إغاثية' },
      { n: '+31', l: 'دولة نصل إليها' },
      { n: '100%', l: 'تصل كاملةً للمستحقين' },
      { n: '24/7', l: 'نستقبل تبرعاتكم' },
    ],
    waysEyebrow: 'طريقان للعطاء', waysTitle: 'ابدأ فعل الخير اليوم',
    waysSub: 'سواء بمشاركة وجبة مع إخوانك أو بالتبرع لإحياء النفوس — كل خطوة صغيرة منك تصنع تغييراً عظيماً.',
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
    missionsEyebrow: 'المهمات', missionsTitle: 'كل مشاريعنا', missionsCta: 'عرض صور وفيديوهات كل مهمة',
  },
}

export default function Home() {
  const go = useNavigate()
  const { lang } = useLang()
  const t = T[lang]
  const [gazaMedia, setGazaMedia] = useState([])
  const [announcement, setAnnouncement] = useState(null)
  // การ์ด Hero Feed จากแอดมิน (config/homeCards) — null = ยังไม่ตั้งค่า ให้ใช้การ์ดมาตรฐาน 3 ใบเดิม
  // ต้องใช้ loading แยกจาก cards ด้วย เพราะ cards เป็น null ทั้งตอน "ยังโหลดไม่เสร็จ" และ "แอดมินไม่เคยตั้งค่า"
  const { cards: adminCards, loading: cardsLoading } = useHomeCards()
  // การ์ดทางลัดใต้หัวข้อ "สองหนทางแห่งการให้" (config/focusCards) — null = ยังไม่ตั้งค่า ใช้ชุดตั้งต้น
  const { cards: focusAdminCards, loading: focusLoading } = useFocusCards()
  // ผูกกับการเปิด/ปิดเมนู — ปิดเมนูไหน การ์ดที่ลิงก์ไปหน้านั้นถูกซ่อนตามด้วย
  const { visibility: navVis } = useNavVisibility()
  const ctaParallaxRef = useParallax(0.15) // ลาย fc-pattern ของแถบ CTA ท้ายหน้าแรก เลื่อนช้ากว่าเนื้อหาตอน scroll
  const navHidden = (link) => { const k = navKeyForPath(link); return !!k && !!navVis && navVis[k] === false }
  const customCards = adminCards ? adminCards.filter((c) => c.enabled !== false && !navHidden(c.link)) : null
  const [dismissedAt, setDismissedAt] = useState(() => localStorage.getItem('umAnnouncementDismissed') || '')
  // โหลด Firestore แบบ dynamic import — กันไม่ให้ firestore (~500KB) ถูกรวมใน bundle หลัก
  // (Home โหลดทันทีไม่ lazy จึงต้องเลี่ยง static import เหมือนตัวนับผู้เข้าชมใน App.jsx)
  useEffect(() => {
    let unsub1 = () => {}
    let unsub2 = () => {}
    let cancelled = false
    Promise.all([import('../firebase.js'), import('firebase/firestore')])
      .then(([{ db }, { doc, onSnapshot }]) => {
        if (cancelled) return
        unsub1 = onSnapshot(doc(db, 'missionMedia', 'gaza'), (d) => {
          setGazaMedia(d.exists() ? (d.data().media || []) : [])
        }, () => {})
        unsub2 = onSnapshot(doc(db, 'config', 'announcement'), (d) => {
          setAnnouncement(d.exists() ? d.data() : null)
        }, () => {})
      })
      .catch(() => {})
    return () => { cancelled = true; unsub1(); unsub2() }
  }, [])

  // ปิดแบนเนอร์ได้ต่อเครื่อง — เก็บ updatedAt ของประกาศที่ปิดไว้ ถ้าแอดมินแก้ประกาศใหม่ (updatedAt เปลี่ยน) จะกลับมาแสดงอีกครั้ง
  const showAnnouncement = announcement?.enabled && announcement?.text && String(announcement.updatedAt || '') !== dismissedAt
  const dismissAnnouncement = () => {
    const key = String(announcement?.updatedAt || '')
    localStorage.setItem('umAnnouncementDismissed', key)
    setDismissedAt(key)
  }

  return (
    <main className="page">
      {showAnnouncement && (
        <div className="site-announcement">
          <span className="site-announcement-text">
            {announcement.text}
            {announcement.linkUrl && (
              <a href={announcement.linkUrl} className="site-announcement-link">{announcement.linkText || 'ดูเพิ่มเติม'}</a>
            )}
          </span>
          <button type="button" className="site-announcement-close" onClick={dismissAnnouncement} aria-label="ปิดประกาศ">×</button>
        </div>
      )}
      {/* ── Hero Feed ── */}
      <section className="hero-feed">
        <div className="hero-feed-brand">
          
          <div className="hf-brand-text">
            <div className="hf-brand-name">Ummatee Foundation</div>
            <div className="hf-brand-sub">{t.eyebrow}</div>
          </div>
        </div>

        <div className="hf-feed">
          {/* การ์ด Hero Feed — ใช้ชุดที่แอดมินตั้งค่า ถ้ายังไม่ตั้งใช้การ์ดมาตรฐาน (DEFAULT_HOME_CARDS) จัดการได้จาก /admin/website
              ระหว่างโหลดต้องโชว์ skeleton ห้าม fallback ไป DEFAULT_HOME_CARDS เพราะจะกลายเป็นการ์ดเก่าที่แอดมิน
              ลบไปแล้วแวบขึ้นมาทุกครั้งที่รีเฟรช (cards=null ยังแยกไม่ได้ว่า "ยังไม่รู้" หรือ "ไม่เคยตั้งค่า") */}
          {cardsLoading ? (
            <div className="hf-card hf-card-skeleton">
              <div className="hf-poster sk-block" />
              <div className="hf-card-body">
                <div className="sk-line" style={{ width: '38%', height: 20 }} />
                <div className="sk-line" style={{ width: '72%', height: 28 }} />
                <div className="sk-line" style={{ width: '100%', height: 14 }} />
                <div className="sk-line" style={{ width: '48%', height: 44, borderRadius: 99 }} />
              </div>
            </div>
          ) : (customCards !== null ? customCards : DEFAULT_HOME_CARDS.filter((c) => !navHidden(c.link))).map((c, i) => {
            const gradIcon = c.color === 'give' ? faHandHoldingHeart : c.color === 'volunteer' ? faHandSparkles : faMoon
            const cTitle = L(c.title, lang), cDesc = L(c.desc, lang), cBtn = L(c.btnText, lang)
            return (
              <FadeUp className="hf-card" key={i} delay={i * 80}>
                <ShareCardBtn
                  className="hf-card-share hf-card-share-float"
                  iconOnly
                  title={cTitle} desc={cDesc} link={c.link}
                  image={c.images?.[0] ? optImg(c.images[0], 800) : ''}
                />
                {c.images?.length > 0 ? (
                  <PosterCarousel
                    images={c.images.map((u) => optImg(u, 900))}
                    alt={cTitle}
                    onClick={() => goPath(c.link || '/')}
                  />
                ) : (
                  // การ์ดไม่มีรูป → พื้นไล่สีตามสีของการ์ด (เช่น การ์ดอาสาสมัคร)
                  <button type="button" className={`hf-card-gradient-hero hf-gradient-${c.color || 'iftar'}`} onClick={() => goPath(c.link || '/')} style={{ border: 'none', width: '100%', cursor: 'pointer' }}>
                    <span className="hf-gradient-icon"><FontAwesomeIcon icon={gradIcon} /></span>
                    {c.tag && <div className="hf-gradient-label">{c.tag}</div>}
                  </button>
                )}
                <div className="hf-card-body">
                  {(c.tag || c.tag2) && (
                    <div className="hf-card-tags">
                      {c.tag && <span className={`hf-tag ${c.color === 'give' ? 'hf-tag-purple' : c.color === 'volunteer' ? 'hf-tag-teal' : 'hf-tag-green'}`}>{c.tag}</span>}
                      {c.tag2 && <span className="hf-tag hf-tag-muted">{c.tag2}</span>}
                    </div>
                  )}
                  {cTitle && <h2 className="hf-card-title">{cTitle}</h2>}
                  {cDesc && <p className="hf-card-desc">{cDesc}</p>}
                  {cBtn && (
                    <a href={c.link || '/'} className={`hf-card-btn hf-btn-${c.color || 'iftar'}`} onClick={(e) => { e.preventDefault(); goPath(c.link || '/') }}>
                      {cBtn} →
                    </a>
                  )}
                </div>
              </FadeUp>
            )
          })}
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

      {/* ── แทบดำ: ภารกิจทั้งหมด ── */}
      <section className="hm-missions-band">
        <div className="hm-missions-inner">
          <FadeUp className="hm-missions-head">
            <span className="hm-missions-eyebrow">{t.missionsEyebrow}</span>
            <h2 className="hm-missions-title">{t.missionsTitle}</h2>
          </FadeUp>
          <GazaCarousel items={gazaMedia} lang={lang} go={go} />
          <div className="hm-missions-scroll">
            {[...MISSIONS, QURBAN_CARD].map((m) => {
              const tx = m[lang] || m.th
              return (
                <button key={m.key} className="hm-mission-chip" style={{ '--accent': m.accent }} onClick={() => go('missions')}>
                  <span className="hm-chip-icon"><FontAwesomeIcon icon={m.icon} /></span>
                  <span className="hm-chip-name">{tx.name}</span>
                </button>
              )
            })}
          </div>
          <FadeUp>
            <button className="hm-missions-cta" onClick={() => go('missions')}>
              {t.missionsCta} <FontAwesomeIcon icon={faArrowRight} />
            </button>
          </FadeUp>
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
          {/* การ์ดทางลัด (เดิม hardcode 3 ใบ) — แอดมินจัดการได้จาก /admin/website (config/focusCards)
              ระหว่างโหลดไม่เรนเดอร์อะไรเลย ห้าม fallback ไป DEFAULT_FOCUS_CARDS เพราะการ์ดที่แอดมินลบไปแล้ว
              จะแวบขึ้นมาทุกครั้งที่รีเฟรช (cards=null ยังแยกไม่ได้ว่า "ยังโหลดไม่เสร็จ" หรือ "ไม่เคยตั้งค่า") */}
          {!focusLoading && (
            <div className="focus-grid focus-grid-3">
              {/* กรองด้วยสวิตช์เปิด/ปิดของการ์ดเองเท่านั้น — ไม่ผูกกับการซ่อนเมนู (navHidden) เพราะแอดมิน
                  ปิดเมนู Iftar/อาสาสมัครไว้ การ์ด 2 ใบจะหายจากหน้าแรกไปเงียบๆ ทั้งที่ยังอยากโชว์อยู่
                  ตอนนี้มีสวิตช์ต่อการ์ดใน /admin/website ให้สั่งซ่อนตรงๆ ได้แล้ว ชัดเจนกว่า */}
              {(focusAdminCards !== null ? focusAdminCards : DEFAULT_FOCUS_CARDS)
                .filter((c) => c.enabled !== false)
                .map((c, i) => (
                  <FadeUp className={`focus-card focus-${c.variant || 'iftar'}`} key={i} onClick={() => goPath(c.link || '/')}>
                    <div className="fc-pattern hero-pattern"></div>
                    <span className="fc-tag">{L(c.tag, lang)}</span>
                    <h3>{L(c.title, lang)}</h3>
                    <p>{L(c.desc, lang)}</p>
                    <span className="fc-link">{L(c.linkText, lang)} <span className="arrow">→</span></span>
                  </FadeUp>
                ))}
            </div>
          )}
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
            <div className="fc-pattern hero-pattern" ref={ctaParallaxRef}></div>
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
