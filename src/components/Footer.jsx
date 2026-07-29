import { useNavigate } from '../navContext'
import { PAGE_TO_PATH } from '../data/routes.js'
import { useLang } from '../i18n.jsx'
import SocialLinks from './SocialLinks.jsx'
import { useSiteContent, siteText } from '../data/siteContent.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCow, faHandHoldingHeart, faHandSparkles, faEnvelope, faLocationDot } from '@fortawesome/free-solid-svg-icons'

// ส่วนท้ายเว็บ (โลโก้ เมนูลัด ช่องทางติดต่อ) ใช้ร่วมกันทุกหน้า public
// ข้อความแยกตามภาษา
const T = {
  th: {
    tagline: 'มูลนิธิอุมมะตี — ให้ 100 ถึง 100',
    menu: 'เมนู', home: 'หน้าหลัก', donation: 'ร่วมบริจาค', iftar: 'Iftar For Gaza',
    qurban: 'ภารกิจกุรบาน', give: 'งาน "ให้"', volunteer: 'อาสาสมัคร',
    contact: 'ติดต่อ',
    rights: 'สงวนลิขสิทธิ์.', made: 'สร้างด้วย ❤️ เพื่ออุมมะฮ์',
  },
  en: {
    tagline: 'Ummatee Foundation — Give 100, Reach 100',
    menu: 'Menu', home: 'Home', donation: 'Donate', iftar: 'Iftar For Gaza',
    qurban: 'Qurban Mission', give: 'GIVE Event', volunteer: 'Volunteer',
    contact: 'Contact',
    rights: 'All rights reserved.', made: 'Made with ❤️ for the Ummah',
  },
  ar: {
    tagline: 'مؤسسة أمّتي — أعطِ ١٠٠ تصل ١٠٠',
    menu: 'القائمة', home: 'الرئيسية', donation: 'تبرّع', iftar: 'إفطار من أجل غزة',
    qurban: 'مهمة الأضاحي', give: 'فعالية "العطاء"', volunteer: 'تطوّع',
    contact: 'تواصل معنا',
    rights: 'جميع الحقوق محفوظة.', made: 'صُنع بـ ❤️ من أجل الأمة',
  },
}

export default function Footer() {
  const go = useNavigate()
  const { lang } = useLang()
  const { content } = useSiteContent()
  const t = T[lang]
  const year = new Date().getFullYear()
  const link = (e, p) => { e.preventDefault(); go(p) }
  // ข้อความติดต่อ/คำโปรย — แก้ได้จากหน้าแอดมิน (จัดการเว็บ) ไม่มีค่าที่ตั้งไว้ใน Firestore ก็ใช้ค่าเดิมแทน
  const tagline = siteText(content, `footerTagline_${lang}`, t.tagline)
  const email = siteText(content, 'footerEmail', 'ummatee.thailand@gmail.com')
  const mapUrl = siteText(content, 'footerMapUrl', 'https://maps.app.goo.gl/VhoiyQSM5brDhSD17')
  const mapLabel = siteText(content, 'footerMapLabel', 'Office Ummatee Thailand')

  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <div className="foot-brand" style={{ marginBottom: 18 }}>
              <span style={{ display: 'inline-block', background: '#fff', padding: '10px 16px', borderRadius: 14 }}>
                <img src="/logo-trim.png" alt="UMMATEE" style={{ height: 48, display: 'block' }} />
              </span>
            </div>
            <p style={{ fontWeight: 300, maxWidth: '34ch' }}>
              {tagline}
            </p>
          </div>
          <div className="foot-col">
            <h5>{t.menu}</h5>
            <a href={PAGE_TO_PATH['home'] || '/'} onClick={(e) => link(e, 'home')}>{t.home}</a>
            <a href={PAGE_TO_PATH['donation'] || '/'} onClick={(e) => link(e, 'donation')}>{t.donation}</a>
            <a href={PAGE_TO_PATH['qurban'] || '/'} onClick={(e) => link(e, 'qurban')}><FontAwesomeIcon icon={faCow} /> {t.qurban}</a>
            <a href={PAGE_TO_PATH['iftar'] || '/'} onClick={(e) => link(e, 'iftar')}>{t.iftar}</a>
            <a href={PAGE_TO_PATH['give'] || '/'} onClick={(e) => link(e, 'give')}><FontAwesomeIcon icon={faHandHoldingHeart} /> {t.give}</a>
            <a href={PAGE_TO_PATH['volunteer'] || '/'} onClick={(e) => link(e, 'volunteer')}><FontAwesomeIcon icon={faHandSparkles} /> {t.volunteer}</a>

          </div>
          <div className="foot-col">
            <h5>{t.contact}</h5>
            <a href={`mailto:${email}`}><FontAwesomeIcon icon={faEnvelope} /> {email}</a>
            <a href={mapUrl} target='_blank' rel='noopener noreferrer'><FontAwesomeIcon icon={faLocationDot} /> {mapLabel}</a>
            <SocialLinks variant="footer" />
          </div>
        </div>
        <div className="foot-bottom">
          <span>© {year} Ummatee Thailand. {t.rights}</span>
          <span>{t.made}</span>
        </div>
      </div>
    </footer>
  )
}
