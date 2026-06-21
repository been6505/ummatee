// ปุ่มลิงก์โซเชียลมีเดียของอุมมะตี — ใช้ซ้ำได้ทั้งหน้าแรกและ footer
// variant: 'strip' = ปุ่มใหญ่สีแบรนด์ (หน้าแรก), 'footer' = ปุ่มเล็กโทนขาว (ส่วนท้าย)
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFacebook, faInstagram, faTiktok, faYoutube, faLine, faThreads } from '@fortawesome/free-brands-svg-icons'
import { faComment } from '@fortawesome/free-solid-svg-icons'

export const SOCIALS = [
  { name: 'Facebook', icon: faFacebook, color: '#1877f2', url: 'https://www.facebook.com/UmmateeinThailand' },
  { name: 'Instagram', icon: faInstagram, color: '#e1306c', url: 'https://www.instagram.com/ummatee.thailand' },
  { name: 'TikTok', icon: faTiktok, color: '#010101', url: 'https://www.tiktok.com/@ummatee.thailand' },
  { name: 'YouTube', icon: faYoutube, color: '#ff0000', url: 'https://www.youtube.com/@ummateethailand' },
  { name: 'LINE', icon: faLine, color: '#06c755', url: 'https://line.me/R/ti/p/@745bvvgx' },
  { name: 'Threads', icon: faThreads, color: '#000000', url: 'https://www.threads.com/@ummatee.thailand' },
]

export default function SocialLinks({ variant = 'strip' }) {
  return (
    <div className={variant === 'footer' ? 'social-row-footer' : 'social-row'}>
      {SOCIALS.map((s) => (
        <a
          key={s.name}
          className={variant === 'footer' ? 'social-btn-sm' : 'social-btn'}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          style={variant === 'footer' ? undefined : { background: s.color }}
          aria-label={s.name}
        >
          <span className="si"><FontAwesomeIcon icon={s.icon} /></span> {s.name}
        </a>
      ))}
    </div>
  )
}
