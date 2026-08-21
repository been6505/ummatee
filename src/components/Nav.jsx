import { useEffect, useState } from 'react'
import { useNavigate } from '../navContext'
import { PAGE_TO_PATH } from '../data/routes.js'
import { useLang } from '../i18n.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMoon, faHandHoldingHeart, faHandSparkles, faCow, faFlag, faStore, faEarthAsia, faNewspaper } from '@fortawesome/free-solid-svg-icons'

// แถบเมนูหลักของเว็บ (desktop + drawer มือถือ) พร้อมตัวสลับภาษา TH/EN/AR
// ภาษาที่รองรับทั้งหมด
const LANGS = [
  { code: 'th', short: 'TH', label: 'ไทย', flag: '🇹🇭' },
  { code: 'en', short: 'EN', label: 'English', flag: '🇬🇧' },
  { code: 'ar', short: 'AR', label: 'العربية', flag: '🇸🇦' },
]

// ข้อความเมนูแยกตามภาษา (d* = ข้อความใน drawer มือถือ)
const T = {
  th: { home: 'หน้าหลัก', donation: 'ร่วมบริจาค', iftar: 'Iftar For Gaza', give: 'งาน "ให้"', qurban: 'ภารกิจกุรบาน', shop: 'um-shop', volunteer: 'อาสาสมัคร', missions: 'ภารกิจ', updates: 'ความคืบหน้า', cta: 'บริจาคเลย', dHome: ' หน้าหลัก', dDonation: ' ร่วมบริจาค', dIftar: 'ลงทะเบียน Iftar For Gaza', dGive: 'งาน "ให้" ครั้งที่ 6', dQurban: 'ภารกิจกุรบาน 1447', dShop: ' um-shop', dVolunteer: ' สมัครอาสาสมัคร', dMissions: ' ภารกิจของเรา', dUpdates: ' ความคืบหน้าการช่วยเหลือ' },
  en: { home: 'Home', donation: 'Donate', iftar: 'Iftar For Gaza', give: 'GIVE Event', qurban: 'Qurban Mission', shop: 'um-shop', volunteer: 'Volunteer', missions: 'Missions', updates: 'Updates', cta: 'Donate Now', dHome: ' Home', dDonation: ' Donate', dIftar: 'Register · Iftar For Gaza', dGive: 'GIVE Event · 6th Edition', dQurban: 'Qurban Mission 1447', dShop: ' um-shop', dVolunteer: ' Volunteer', dMissions: ' Our Missions', dUpdates: ' Aid Updates' },
  ar: { home: 'الرئيسية', donation: 'تبرّع', iftar: 'إفطار من أجل غزة', give: 'فعالية "العطاء"', qurban: 'مهمة الأضاحي', shop: 'um-shop', volunteer: 'تطوّع', missions: 'المهمات', updates: 'المستجدات', cta: 'تبرّع الآن', dHome: ' الرئيسية', dDonation: ' تبرّع', dIftar: 'التسجيل · إفطار من أجل غزة', dGive: 'فعالية "العطاء" السادسة', dQurban: 'مهمة الأضاحي 1447', dShop: ' um-shop', dVolunteer: ' تطوّع', dMissions: ' مهماتنا', dUpdates: ' مستجدات المساعدات' },
}

export default function Nav({ scrolled }) {
  const go = useNavigate()
  const { lang, setLang } = useLang()
  const t = T[lang]
  const [open, setOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [navVis, setNavVis] = useState(null) // null = ยังไม่โหลด (แสดงทุกรายการไปก่อนกันเมนูกระพริบหาย) — key ไหนเป็น false = ซ่อน
  const close = () => setOpen(false)
  const show = (key) => navVis?.[key] !== false

  // โหลด Firestore แบบ dynamic import — กันไม่ให้ firestore (~500KB) ถูกรวมใน bundle หลัก (Nav โหลดทันทีไม่ lazy)
  useEffect(() => {
    let unsub = () => {}
    let cancelled = false
    Promise.all([import('../firebase.js'), import('firebase/firestore')])
      .then(([{ db }, { doc, onSnapshot }]) => {
        if (cancelled) return
        unsub = onSnapshot(doc(db, 'config', 'navVisibility'), (d) => {
          setNavVis(d.exists() ? d.data() : {})
        }, () => {})
      })
      .catch(() => {})
    return () => { cancelled = true; unsub() }
  }, [])
  // คลิกลิงก์: กัน reload หน้า แล้วใช้ go() เปลี่ยนหน้าแบบ SPA (ปิด drawer ด้วยถ้าระบุ)
  const link = (e, p, alsoClose) => {
    e.preventDefault()
    go(p)
    if (alsoClose) close()
  }
  const chooseLang = (code) => {
    setLang(code)
    setLangOpen(false)
  }
  const currentLang = LANGS.find((l) => l.code === lang) || LANGS[0]

  return (
    <>
      <nav id="main-nav" className={scrolled ? 'scrolled' : ''}>
        <a className="nav-logo" href={PAGE_TO_PATH['home'] || '/'} onClick={(e) => link(e, 'home')}>
          <img src="/logo-trim.png" alt="UMMATEE มูลนิธิอุมมะตี" />
        </a>
        <ul className="nav-links">
          <li><a href={PAGE_TO_PATH['home'] || '/'} onClick={(e) => link(e, 'home')}>{t.home}</a></li>
          {show('donation') && <li><a href={PAGE_TO_PATH['donation'] || '/'} onClick={(e) => link(e, 'donation')}>{t.donation}</a></li>}
          {show('missions') && <li><a href={PAGE_TO_PATH['missions'] || '/'} onClick={(e) => link(e, 'missions')}><FontAwesomeIcon icon={faEarthAsia} /> {t.missions}</a></li>}
          {show('updates') && <li><a href={PAGE_TO_PATH['updates'] || '/'} onClick={(e) => link(e, 'updates')}><FontAwesomeIcon icon={faNewspaper} /> {t.updates}</a></li>}
          {show('qurban') && <li><a href={PAGE_TO_PATH['qurban'] || '/'} onClick={(e) => link(e, 'qurban')}><FontAwesomeIcon icon={faCow} /> {t.qurban}</a></li>}
          {show('shop') && <li><a href={PAGE_TO_PATH['shop'] || '/'} onClick={(e) => link(e, 'shop')}><FontAwesomeIcon icon={faStore} /> {t.shop}</a></li>}
          {show('iftar') && <li><a href={PAGE_TO_PATH['iftar'] || '/'} onClick={(e) => link(e, 'iftar')} style={{ color: '#ff6b78', fontWeight: 600 }}><FontAwesomeIcon icon={faFlag} /> {t.iftar}</a></li>}
          {show('give') && <li><a href={PAGE_TO_PATH['give'] || '/'} onClick={(e) => link(e, 'give')} className="give-nav-link"><FontAwesomeIcon icon={faHandHoldingHeart} /> {t.give}</a></li>}
          {show('volunteer') && <li><a href={PAGE_TO_PATH['volunteer'] || '/'} onClick={(e) => link(e, 'volunteer')}><FontAwesomeIcon icon={faHandSparkles} /> {t.volunteer}</a></li>}
        </ul>
        <div className="nav-right">
          <div className="lang-switch">
            <button className="lang-btn" onClick={() => setLangOpen((v) => !v)}>
              <span>{currentLang.flag}</span> {currentLang.short} <span className="lang-caret">▾</span>
            </button>
            {langOpen && (
              <div className="lang-menu">
                {LANGS.map((l) => (
                  <button key={l.code} className={`lang-opt ${l.code === lang ? 'active' : ''}`} onClick={() => chooseLang(l.code)}>
                    <span>{l.flag}</span> {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <a href={PAGE_TO_PATH['donation'] || '/'} className="nav-cta" onClick={(e) => link(e, 'donation')}>{t.cta}</a>
          <button className="nav-hamburger" onClick={() => setOpen(true)} aria-label="menu">
            <span></span><span></span><span></span>
          </button>
        </div>
      </nav>

      {/* ฉากมืดด้านหลัง + เมนู drawer สำหรับจอมือถือ */}
      <div className={`scrim ${open ? 'show' : ''}`} onClick={close}></div>
      <div className={`nav-drawer ${open ? 'open' : ''}`}>
        <button className="drawer-close" onClick={close} aria-label="close">×</button>
        <a href={PAGE_TO_PATH['home'] || '/'} onClick={(e) => link(e, 'home', true)}>{t.dHome}</a>
        {show('donation') && <a href={PAGE_TO_PATH['donation'] || '/'} onClick={(e) => link(e, 'donation', true)}>{t.dDonation}</a>}
        {show('iftar') && <a href={PAGE_TO_PATH['iftar'] || '/'} onClick={(e) => link(e, 'iftar', true)} className="iftar-link"><FontAwesomeIcon icon={faFlag} /> {t.dIftar}</a>}
        {show('give') && <a href={PAGE_TO_PATH['give'] || '/'} onClick={(e) => link(e, 'give', true)} className="give-nav-link"><FontAwesomeIcon icon={faHandHoldingHeart} /> {t.dGive}</a>}
        {show('volunteer') && <a href={PAGE_TO_PATH['volunteer'] || '/'} onClick={(e) => link(e, 'volunteer', true)}><FontAwesomeIcon icon={faHandSparkles} /> {t.dVolunteer}</a>}
        {show('missions') && <a href={PAGE_TO_PATH['missions'] || '/'} onClick={(e) => link(e, 'missions', true)}><FontAwesomeIcon icon={faEarthAsia} /> {t.dMissions}</a>}
        {show('updates') && <a href={PAGE_TO_PATH['updates'] || '/'} onClick={(e) => link(e, 'updates', true)}><FontAwesomeIcon icon={faNewspaper} /> {t.dUpdates}</a>}
        {show('qurban') && <a href={PAGE_TO_PATH['qurban'] || '/'} onClick={(e) => link(e, 'qurban', true)}><FontAwesomeIcon icon={faCow} /> {t.dQurban}</a>}
        {show('shop') && <a href={PAGE_TO_PATH['shop'] || '/'} onClick={(e) => link(e, 'shop', true)}><FontAwesomeIcon icon={faStore} /> {t.dShop}</a>}

      </div>
    </>
  )
}
