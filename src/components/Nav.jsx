import { useState } from 'react'
import { useNavigate } from '../navContext'
import { useLang } from '../i18n.jsx'

const LANGS = [
  { code: 'th', short: 'TH', label: 'ไทย', flag: '🇹🇭' },
  { code: 'en', short: 'EN', label: 'English', flag: '🇬🇧' },
  { code: 'ar', short: 'AR', label: 'العربية', flag: '🇸🇦' },
]

const T = {
  th: { home: 'หน้าหลัก', donation: 'ร่วมบริจาค', iftar: 'Iftar For Gaza', give: 'งาน "ให้"', qurban: 'ภารกิจกุรบาน', cta: 'บริจาคเลย', dHome: '🏠 หน้าหลัก', dDonation: '💚 ร่วมบริจาค', dIftar: 'ลงทะเบียน Iftar For Gaza', dGive: 'งาน "ให้" ครั้งที่ 6', dQurban: 'ภารกิจกุรบาน 1447' },
  en: { home: 'Home', donation: 'Donate', iftar: 'Iftar For Gaza', give: 'GIVE Event', qurban: 'Qurban Mission', cta: 'Donate Now', dHome: '🏠 Home', dDonation: '💚 Donate', dIftar: 'Register · Iftar For Gaza', dGive: 'GIVE Event · 6th Edition', dQurban: 'Qurban Mission 1447' },
  ar: { home: 'الرئيسية', donation: 'تبرّع', iftar: 'إفطار من أجل غزة', give: 'فعالية "العطاء"', qurban: 'مهمة الأضاحي', cta: 'تبرّع الآن', dHome: '🏠 الرئيسية', dDonation: '💚 تبرّع', dIftar: 'التسجيل · إفطار من أجل غزة', dGive: 'فعالية "العطاء" السادسة', dQurban: 'مهمة الأضاحي 1447' },
}

export default function Nav({ scrolled }) {
  const go = useNavigate()
  const { lang, setLang } = useLang()
  const t = T[lang]
  const [open, setOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const close = () => setOpen(false)
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
           <li><a href="#" onClick={(e) => link(e, 'qurban')}><span>🐑</span> {t.qurban}</a></li>
         
          <li><a href="#" onClick={(e) => link(e, 'iftar')} style={{ color: '#ff6b78', fontWeight: 600 }}><span>🇵🇸</span> {t.iftar}</a></li>
          <li><a href="#" onClick={(e) => link(e, 'give')}><span>🤲</span> {t.give}</a></li>
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

      <div className={`scrim ${open ? 'show' : ''}`} onClick={close}></div>
      <div className={`nav-drawer ${open ? 'open' : ''}`}>
        <button className="drawer-close" onClick={close} aria-label="close">×</button>
        <a href="#" onClick={(e) => link(e, 'home', true)}>{t.dHome}</a>
        <a href="#" onClick={(e) => link(e, 'donation', true)}>{t.dDonation}</a>
        <a href="#" onClick={(e) => link(e, 'iftar', true)} className="iftar-link"> <span>🇵🇸</span> {t.dIftar}</a>
        <a href="#" onClick={(e) => link(e, 'give', true)}> <span>🤲</span> {t.dGive}</a>
        <a href="#" onClick={(e) => link(e, 'qurban', true)}> <span>🐑</span> {t.dQurban}</a>
        <div className="drawer-langs">
          {LANGS.map((l) => (
            <button key={l.code} className={`lang-opt ${l.code === lang ? 'active' : ''}`} onClick={() => chooseLang(l.code)}>
              <span>{l.flag}</span> {l.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
