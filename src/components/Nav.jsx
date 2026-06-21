import { useState } from 'react'
import { useNavigate } from '../navContext'
import { useLang } from '../i18n.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMoon, faHandHoldingHeart, faHandSparkles, faCow, faFlag, faStore, faEarthAsia } from '@fortawesome/free-solid-svg-icons'

// แถบเมนูหลักของเว็บ (desktop + drawer มือถือ) พร้อมตัวสลับภาษา TH/EN/AR
// ภาษาที่รองรับทั้งหมด
const LANGS = [
  { code: 'th', short: 'TH', label: 'ไทย', flag: '🇹🇭' },
  { code: 'en', short: 'EN', label: 'English', flag: '🇬🇧' },
  { code: 'ar', short: 'AR', label: 'العربية', flag: '🇸🇦' },
]

// ข้อความเมนูแยกตามภาษา (d* = ข้อความใน drawer มือถือ)
const T = {
  th: { home: 'หน้าหลัก', donation: 'ร่วมบริจาค', iftar: 'Iftar For Gaza', give: 'งาน "ให้"', qurban: 'ภารกิจกุรบาน', shop: 'Um Shop', volunteer: 'อาสาสมัคร', missions: 'ภารกิจ', cta: 'บริจาคเลย', dHome: ' หน้าหลัก', dDonation: ' ร่วมบริจาค', dIftar: 'ลงทะเบียน Iftar For Gaza', dGive: 'งาน "ให้" ครั้งที่ 6', dQurban: 'ภารกิจกุรบาน 1447', dShop: ' Um Shop', dVolunteer: ' สมัครอาสาสมัคร', dMissions: ' ภารกิจของเรา' },
  en: { home: 'Home', donation: 'Donate', iftar: 'Iftar For Gaza', give: 'GIVE Event', qurban: 'Qurban Mission', shop: 'Um Shop', volunteer: 'Volunteer', missions: 'Missions', cta: 'Donate Now', dHome: ' Home', dDonation: ' Donate', dIftar: 'Register · Iftar For Gaza', dGive: 'GIVE Event · 6th Edition', dQurban: 'Qurban Mission 1447', dShop: ' Um Shop', dVolunteer: ' Volunteer', dMissions: ' Our Missions' },
  ar: { home: 'الرئيسية', donation: 'تبرّع', iftar: 'إفطار من أجل غزة', give: 'فعالية "العطاء"', qurban: 'مهمة الأضاحي', shop: 'Um Shop', volunteer: 'تطوّع', missions: 'المهمات', cta: 'تبرّع الآن', dHome: ' الرئيسية', dDonation: ' تبرّع', dIftar: 'التسجيل · إفطار من أجل غزة', dGive: 'فعالية "العطاء" السادسة', dQurban: 'مهمة الأضاحي 1447', dShop: ' Um Shop', dVolunteer: ' تطوّع', dMissions: ' مهماتنا' },
}

export default function Nav({ scrolled }) {
  const go = useNavigate()
  const { lang, setLang } = useLang()
  const t = T[lang]
  const [open, setOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const close = () => setOpen(false)
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
        <a className="nav-logo" href="#" onClick={(e) => link(e, 'home')}>
          <img src="/logo-trim.png" alt="UMMATEE มูลนิธิอุมมะตี" />
        </a>
        <ul className="nav-links">
          <li><a href="#" onClick={(e) => link(e, 'home')}>{t.home}</a></li>
          <li><a href="#" onClick={(e) => link(e, 'donation')}>{t.donation}</a></li>
          <li><a href="#" onClick={(e) => link(e, 'missions')}><FontAwesomeIcon icon={faEarthAsia} /> {t.missions}</a></li>
          <li><a href="#" onClick={(e) => link(e, 'qurban')}><FontAwesomeIcon icon={faCow} /> {t.qurban}</a></li>
          <li><a href="#" onClick={(e) => link(e, 'shop')}><FontAwesomeIcon icon={faStore} /> {t.shop}</a></li>
          <li><a href="#" onClick={(e) => link(e, 'iftar')} style={{ color: '#ff6b78', fontWeight: 600 }}><FontAwesomeIcon icon={faFlag} /> {t.iftar}</a></li>
          <li><a href="#" onClick={(e) => link(e, 'give')} className="give-nav-link"><FontAwesomeIcon icon={faHandHoldingHeart} /> {t.give}</a></li>
          <li><a href="#" onClick={(e) => link(e, 'volunteer')}><FontAwesomeIcon icon={faHandSparkles} /> {t.volunteer}</a></li>
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
          <a href="#" className="nav-cta" onClick={(e) => link(e, 'donation')}>{t.cta}</a>
          <button className="nav-hamburger" onClick={() => setOpen(true)} aria-label="menu">
            <span></span><span></span><span></span>
          </button>
        </div>
      </nav>

      {/* ฉากมืดด้านหลัง + เมนู drawer สำหรับจอมือถือ */}
      <div className={`scrim ${open ? 'show' : ''}`} onClick={close}></div>
      <div className={`nav-drawer ${open ? 'open' : ''}`}>
        <button className="drawer-close" onClick={close} aria-label="close">×</button>
        <a href="#" onClick={(e) => link(e, 'home', true)}>{t.dHome}</a>
        <a href="#" onClick={(e) => link(e, 'donation', true)}>{t.dDonation}</a>
        <a href="#" onClick={(e) => link(e, 'iftar', true)} className="iftar-link"><FontAwesomeIcon icon={faFlag} /> {t.dIftar}</a>
        <a href="#" onClick={(e) => link(e, 'give', true)} className="give-nav-link"><FontAwesomeIcon icon={faHandHoldingHeart} /> {t.dGive}</a>
        <a href="#" onClick={(e) => link(e, 'volunteer', true)}><FontAwesomeIcon icon={faHandSparkles} /> {t.dVolunteer}</a>
        <a href="#" onClick={(e) => link(e, 'missions', true)}><FontAwesomeIcon icon={faEarthAsia} /> {t.dMissions}</a>
        <a href="#" onClick={(e) => link(e, 'qurban', true)}><FontAwesomeIcon icon={faCow} /> {t.dQurban}</a>
        <a href="#" onClick={(e) => link(e, 'shop', true)}><FontAwesomeIcon icon={faStore} /> {t.dShop}</a>
        
      </div>
    </>
  )
}
