import AdminNav from './AdminNav.jsx'
import AdminLogin from './AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { isSuperAdminEmail } from '../useAdminRole.js'

// ปิดหน้าไว้ให้เฉพาะแอดมินสูงสุด (จัดการทีมงาน / audit log)
// เดิมคัดลอกโค้ดชุดนี้ไว้ในทั้ง AdminStaff.jsx และ AdminAuditLog.jsx เหมือนกันทุกบรรทัด
//
// เป็นแค่ชั้น UI — ของจริงบังคับที่ firestore.rules (isSuperAdmin) เสมอ
// ซ่อนหน้าอย่างเดียวไม่ได้กันอะไร คนที่พิมพ์ URL เองยังยิง Firestore ตรงได้อยู่ดี
export default function SuperAdminOnly({ children }) {
  const { user, loading } = useAdminAuth()
  if (loading) return null
  if (!user) return <AdminLogin />
  if (!isSuperAdminEmail(user.email || '')) {
    return (
      <main className="admin-dash">
        <AdminNav />
        <div className="admin-wrap">
          <div className="admin-card" style={{ marginTop: 40, textAlign: 'center' }}>
            <h3>เฉพาะแอดมินสูงสุดเท่านั้น</h3>
            <p>บัญชี {user.email} ไม่มีสิทธิ์เข้าหน้านี้</p>
          </div>
        </div>
      </main>
    )
  }
  return children
}
