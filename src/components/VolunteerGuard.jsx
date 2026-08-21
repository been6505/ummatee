import { useIsVolunteer } from '../useAdminRole.js'

export default function VolunteerGuard({ children }) {
  const { isVolunteer, loading } = useIsVolunteer()
  // ระหว่างที่ยังไม่รู้ว่าใครล็อกอิน ต้องไม่เรนเดอร์เนื้อหาที่หวงไว้ (ไม่งั้นแวบเห็นได้ตอนรีเฟรช)
  if (loading) return null
  if (!isVolunteer) return children

  return (
    <main className="admin-login">
      <div className="admin-login-box">
        <h2>⚠️ ไม่มีสิทธิ์เข้าถึง</h2>
        <p>บัญชีของคุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        <a href="/admin/dashboard" style={{ display: 'block', padding: 12, background: 'var(--green-deep)', color: '#fff', borderRadius: 10, textDecoration: 'none', fontWeight: 700, textAlign: 'center' }}>
          กลับหน้าหลัก
        </a>
      </div>
    </main>
  )
}
