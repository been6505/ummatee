import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'

// หน้าแรกของระบบ admin (/admin/dashboard) — ล็อกอินด้วยอีเมล/รหัสผ่านก่อน แล้วเลือกเข้าดูแดชบอร์ดแต่ละตัว

// การ์ดลิงก์ไปยังแดชบอร์ดย่อย
const LINKS = [
  { href: '/admin/event/iftar2026', icon: '🇵🇸', title: 'Iftar For Gaza', desc: 'รายชื่อผู้ลงทะเบียน + กราฟสรุปข้อมูลผู้เข้าร่วมงาน' },
  { href: '/admin/missions/qurban2026', icon: '🐑', title: 'Qurban 2026', desc: 'สรุปการแจกจ่ายกุรบาน 1447 / 2026 แยกตามประเทศ' },
  { href: '/admin/donations', icon: '💰', title: 'เงินบริจาค', desc: 'บันทึกและสรุปยอดบริจาคแยกตาม 8 บัญชี ibank' },
  { href: '/admin/calendar', icon: '📅', title: 'ปฏิทินคอนเทนต์', desc: 'วางแผนกิจกรรม ตั้งเวลาโพสต์ แนบรูป/วิดีโอ หลายแพลตฟอร์ม' },
  { href: '/admin/shop', icon: '🛍️', title: 'Um Shop', desc: 'จัดการสินค้า เพิ่ม/แก้ไข/ลบ พร้อมค้นหา กรอง เรียงลำดับ' },
]

export default function AdminHome() {
  const { user, loading } = useAdminAuth()

  if (loading) return null
  if (!user) return <AdminLogin />

  return (
    <main className="admin-dash">
      <AdminNav />
      <div></div>
      <div className="admin-wrap">
        

        <div className="admin-grid">
          {LINKS.map((l) => (
            <a key={l.href} className="admin-card admin-link-card" href={l.href}>
              <div className="he" style={{ fontSize: '2rem', marginBottom: 10 }}>{l.icon}</div>
              <h4>{l.title}</h4>
              <p style={{ color: 'var(--ink-soft)', fontSize: '.9rem', marginTop: 6 }}>{l.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </main>
  )
}
