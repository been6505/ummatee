import { useNavigate } from '../navContext'
import { useLang } from '../i18n.jsx'
import SocialLinks from './SocialLinks.jsx'

// ส่วนท้ายเว็บ (โลโก้ เมนูลัด ช่องทางติดต่อ) ใช้ร่วมกันทุกหน้า public
// ข้อความแยกตามภาษา
const T = {
  th: {
    tagline: 'มูลนิธิอุมมะตี — ให้ 100 ถึง 100',
    menu: 'เมนู', home: 'หน้าหลัก', donation: 'ร่วมบริจาค', iftar: 'Iftar For Gaza',
    qurban: 'ภารกิจกุรบาน', give: 'งาน "ให้"',
    contact: 'ติดต่อ',
    rights: 'สงวนลิขสิทธิ์.', made: 'สร้างด้วย ❤️ เพื่ออุมมะฮ์',
  },
  en: {
    tagline: 'Ummatee Foundation — Give 100, Reach 100',
    menu: 'Menu', home: 'Home', donation: 'Donate', iftar: 'Iftar For Gaza',
    qurban: 'Qurban Mission', give: 'GIVE Event',
    contact: 'Contact',
    rights: 'All rights reserved.', made: 'Made with ❤️ for the Ummah',
  },
  ar: {
    tagline: 'مؤسسة أمّتي — أعطِ ١٠٠ تصل ١٠٠',
    menu: 'القائمة', home: 'الرئيسية', donation: 'تبرّع', iftar: 'إفطار من أجل غزة',
    qurban: 'مهمة الأضاحي', give: 'فعالية "العطاء"',
    contact: 'تواصل معنا',
    rights: 'جميع الحقوق محفوظة.', made: 'صُنع بـ ❤️ من أجل الأمة',
  },
}

export default function Footer() {
  const go = useNavigate()
  const { lang } = useLang()
  const t = T[lang]
  const year = new Date().getFullYear()
  const link = (e, p) => { e.preventDefault(); go(p) }

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
              {t.tagline}
            </p>
          </div>
          <div className="foot-col">
            <h5>{t.menu}</h5>
            <a href="#" onClick={(e) => link(e, 'home')}>{t.home}</a>
            <a href="#" onClick={(e) => link(e, 'donation')}>{t.donation}</a>


            <a href="#" onClick={(e) => link(e, 'qurban')}><span>🐑</span> {t.qurban}</a>
            <a href="#" onClick={(e) => link(e, 'iftar')}>{t.iftar}</a>
            <a href="#" onClick={(e) => link(e, 'give')}><span>🤲</span> {t.give}</a>

          </div>
          <div className="foot-col">
            <h5>{t.contact}</h5>
            <a href='mailto:ummatee.thailand@gmail.com'>📧 ummatee.thailand@gmail.com</a>
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
