import { useEffect, useState } from 'react'
import { useNavigate } from '../navContext'
import { PAGE_TO_PATH } from '../data/routes.js'
import { useLang } from '../i18n.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFilm, faStore, faEarthAsia, faHouse, faHandHoldingHeart } from '@fortawesome/free-solid-svg-icons'

// แถบเมนูหลักของเว็บ (desktop + drawer มือถือ) พร้อมตัวสลับภาษา TH/EN/AR
// ภาษาที่รองรับทั้งหมด
const LANGS = [
  { code: 'th', short: 'TH', label: 'ไทย', flag: '🇹🇭' },
  { code: 'en', short: 'EN', label: 'English', flag: '🇬🇧' },
  { code: 'ar', short: 'AR', label: 'العربية', flag: '🇸🇦' },
]

// ข้อความเมนูแยกตามภาษา (d* = ข้อความใน drawer มือถือ)
const T = {
  th: { home: 'หน้าหลัก', donation: 'ร่วมบริจาค', iftar: 'Iftar For Gaza', give: 'งาน "ให้"', qurban: 'ภารกิจกุรบาน', shop: 'um-shop', volunteer: 'อาสาสมัคร', missions: 'ภารกิจ', updates: 'ความคืบหน้า', naza: 'รับชมภาพยนตร์ NAZA', dNaza: 'รับชมภาพยนตร์ NAZA', cta: 'บริจาคเลย', dHome: ' หน้าหลัก', dDonation: ' ร่วมบริจาค', dIftar: 'ลงทะเบียน Iftar For Gaza', dGive: 'งาน "ให้" ครั้งที่ 6', dQurban: 'ภารกิจกุรบาน 1447', dShop: ' um-shop', dVolunteer: ' สมัครอาสาสมัคร', dMissions: ' ภารกิจของเรา', dUpdates: ' ความคืบหน้าการช่วยเหลือ' },
  en: { home: 'Home', donation: 'Donate', iftar: 'Iftar For Gaza', give: 'GIVE Event', qurban: 'Qurban Mission', shop: 'um-shop', volunteer: 'Volunteer', missions: 'Missions', updates: 'Updates', naza: 'Watch NAZA', dNaza: 'Watch the NAZA film', cta: 'Donate Now', dHome: ' Home', dDonation: ' Donate', dIftar: 'Register · Iftar For Gaza', dGive: 'GIVE Event · 6th Edition', dQurban: 'Qurban Mission 1447', dShop: ' um-shop', dVolunteer: ' Volunteer', dMissions: ' Our Missions', dUpdates: ' Aid Updates' },
  ar: { home: 'الرئيسية', donation: 'تبرّع', iftar: 'إفطار من أجل غزة', give: 'فعالية "العطاء"', qurban: 'مهمة الأضاحي', shop: 'um-shop', volunteer: 'تطوّع', missions: 'المهمات', updates: 'المستجدات', naza: 'شاهد فيلم NAZA', dNaza: 'شاهد فيلم NAZA', cta: 'تبرّع الآن', dHome: ' الرئيسية', dDonation: ' تبرّع', dIftar: 'التسجيل · إفطار من أجل غزة', dGive: 'فعالية "العطاء" السادسة', dQurban: 'مهمة الأضاحي 1447', dShop: ' um-shop', dVolunteer: ' تطوّع', dMissions: ' مهماتنا', dUpdates: ' مستجدات المساعدات' },
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
          {show('shop') && <li><a href={PAGE_TO_PATH['shop'] || '/'} onClick={(e) => link(e, 'shop')}><FontAwesomeIcon icon={faStore} /> {t.shop}</a></li>}
          {show('naza') && <li><a href={PAGE_TO_PATH['naza'] || '/'} onClick={(e) => link(e, 'naza')} style={{ color: '#ff6b78', fontWeight: 600 }}><FontAwesomeIcon icon={faFilm} /> {t.naza}</a></li>}
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
      <div className={`nav-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        {/* ทรงแผ่นแบบ iOS: หัวเรื่องตัวใหญ่ + ปุ่มปิดวงกลมกระจก, งานเด่นเป็นการ์ดบนสุด, ที่เหลือเป็นรายการจัดกลุ่ม */}
        <div className="drawer-head">
          <span className="drawer-title">{t.home === 'Home' ? 'Menu' : t.home === 'الرئيسية' ? 'القائمة' : 'เมนู'}</span>
          <button className="drawer-close" onClick={close} aria-label="close">×</button>
        </div>
        {show('naza') && (
          <a href={PAGE_TO_PATH['naza'] || '/'} onClick={(e) => link(e, 'naza', true)} className="iftar-link drawer-feature">
            <span className="df-icon"><FontAwesomeIcon icon={faFilm} /></span>
            <span className="df-text"><b>{t.dNaza}</b><small>6–8 พ.ย. 2569 · Meeting Mall</small></span>
            <span className="df-chev" aria-hidden="true">›</span>
          </a>
        )}
        <div className="drawer-group">
          <a href={PAGE_TO_PATH['home'] || '/'} onClick={(e) => link(e, 'home', true)}>
            <span className="dg-icon" style={{ '--tile': '#8e8e93' }}><FontAwesomeIcon icon={faHouse} /></span>{t.dHome.trim()}
          </a>
          {show('donation') && (
            <a href={PAGE_TO_PATH['donation'] || '/'} onClick={(e) => link(e, 'donation', true)}>
              <span className="dg-icon" style={{ '--tile': '#c9a84c' }}><FontAwesomeIcon icon={faHandHoldingHeart} /></span>{t.dDonation.trim()}
            </a>
          )}
          {show('missions') && (
            <a href={PAGE_TO_PATH['missions'] || '/'} onClick={(e) => link(e, 'missions', true)}>
              <span className="dg-icon" style={{ '--tile': '#34c759' }}><FontAwesomeIcon icon={faEarthAsia} /></span>{t.dMissions.trim()}
            </a>
          )}
          {show('shop') && (
            <a href={PAGE_TO_PATH['shop'] || '/'} onClick={(e) => link(e, 'shop', true)}>
              <span className="dg-icon" style={{ '--tile': '#007aff' }}><FontAwesomeIcon icon={faStore} /></span>{t.dShop.trim()}
            </a>
          )}
        </div>
      </div>
    </>
  )
}
