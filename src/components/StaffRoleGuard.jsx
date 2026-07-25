// Guard สำหรับหน้าที่ใช้ระบบ staff role ใหม่ (CRM/บอร์ด/audit log/จัดการ staff)
// ต้องล็อกอินก่อน (Firebase Auth ปกติ) แล้วค่อยเช็ค role จาก staff/{uid} — allowedRoles=null คือแค่ต้องมี staff doc ที่ active
import AdminLogin from './AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import useStaffRole, { hasStaffRole } from '../useStaffRole.js'

export default function StaffRoleGuard({ allowedRoles, children }) {
  const { user, loading: authLoading } = useAdminAuth()
  const { staff, loading: staffLoading } = useStaffRole(user)

  if (authLoading) return null
  if (!user) return <AdminLogin />
  if (staffLoading) return null

  if (allowedRoles && !hasStaffRole(staff, allowedRoles)) {
    return (
      <main className="admin-dash">
        <div className="admin-wrap">
          <div className="admin-card" style={{ marginTop: 40, textAlign: 'center' }}>
            <h3>ไม่มีสิทธิ์เข้าถึงหน้านี้</h3>
            <p>บัญชี {user.email} (role: {staff?.role || 'ไม่มี'}) ไม่มีสิทธิ์ในส่วนนี้ ติดต่อแอดมินหากคิดว่าควรมีสิทธิ์</p>
          </div>
        </div>
      </main>
    )
  }

  return children(staff)
}
