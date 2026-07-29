// Guard สำหรับหน้าที่ใช้ระบบ staff role ใหม่ (CRM/บอร์ด/audit log/จัดการ staff)
// ต้องล็อกอินก่อน (Firebase Auth ปกติ) แล้วค่อยเช็ค role จาก staff/{uid} — allowedRoles=null คือแค่ต้องมี staff doc ที่ active
import AdminLogin from './AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import useStaffRole, { hasStaffRole } from '../useStaffRole.js'
import { isFullAdminEmail } from '../useAdminRole.js'

export default function StaffRoleGuard({ allowedRoles, children }) {
  const { user, loading: authLoading } = useAdminAuth()
  const { staff, loading: staffLoading } = useStaffRole(user)

  if (authLoading) return null
  if (!user) return <AdminLogin />
  if (staffLoading) return null

  // เจ้าของระบบ (email allowlist เดียวกับ isFullAdmin ใน rules) ผ่านได้เสมอ ไม่ต้องรอใครตั้ง role ให้
  // ถ้าไม่มีทางนี้ และยังไม่มีใครมี staff doc role 'admin' อยู่เลย จะไม่มีใครเข้าหน้าจัดการพนักงาน
  // ไปตั้ง role ให้ใครได้ตลอดไป (สมัครเองบังคับเป็น 'pending' เสมอ) = ล็อกทุกคนออกจากหน้า CRM ถาวร
  const isOwner = isFullAdminEmail(user.email || '')

  // เจ้าของอาจยังไม่มี staff doc เลย (staff === null) หรือมีแต่ยังเป็น 'pending'
  // ต้องส่ง object ที่ใช้งานได้จริงให้หน้าลูกเสมอ ไม่งั้นหน้าที่อ่าน staff.role ตรงๆ จะพังทั้งหน้า
  // และให้ถือเป็น 'admin' ไปเลย เพื่อให้พฤติกรรมสอดคล้องกับที่ guard ปล่อยผ่าน
  const effectiveStaff = isOwner ? { ...(staff || {}), role: 'admin', active: true } : staff

  if (allowedRoles && !isOwner && !hasStaffRole(staff, allowedRoles)) {
    // แยกข้อความกรณี 'pending' (เพิ่งสมัคร รอแอดมินอนุมัติ) ออกจากกรณีไม่มีสิทธิ์จริงๆ
    // ไม่งั้นคนที่เพิ่งล็อกอินครั้งแรกจะเจอ "ไม่มีสิทธิ์" แล้วนึกว่าระบบพัง ทั้งที่แค่ต้องรออนุมัติ
    const isPending = staff?.role === 'pending'
    return (
      <main className="admin-dash">
        <div className="admin-wrap">
          <div className="admin-card" style={{ marginTop: 40, textAlign: 'center' }}>
            <h3>{isPending ? 'รอแอดมินอนุมัติบัญชี' : 'ไม่มีสิทธิ์เข้าถึงหน้านี้'}</h3>
            {isPending ? (
              <p>
                บัญชี {user.email} ลงทะเบียนเข้าระบบแล้ว แต่ยังไม่ได้รับสิทธิ์การใช้งาน<br />
                กรุณาแจ้งแอดมินให้กำหนดสิทธิ์ให้ที่หน้า "จัดการพนักงาน"
              </p>
            ) : (
              <p>บัญชี {user.email} (role: {staff?.role || 'ไม่มี'}) ไม่มีสิทธิ์ในส่วนนี้ ติดต่อแอดมินหากคิดว่าควรมีสิทธิ์</p>
            )}
          </div>
        </div>
      </main>
    )
  }

  return children(effectiveStaff)
}
