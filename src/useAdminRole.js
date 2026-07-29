import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase.js'

const VOLUNTEER_EMAILS = ['ummatee.volunteer@gmail.com']

export function isVolunteerEmail(email) {
  return VOLUNTEER_EMAILS.includes(email)
}

// อีเมลที่เข้าหน้าแอดมินระบบเดิม (email allowlist) ได้ — ต้องตรงกับ isAdmin() ใน firestore.rules เสมอ
// ถ้าแก้ที่นี่ต้องไปแก้ใน firestore.rules ด้วย (ที่นี่คุมแค่ UI ตัวจริงบังคับที่ rules)
const ADMIN_EMAILS = [
  'akasitlove@gmail.com',
  'ummatee.thailand@gmail.com',
  'ummatee.volunteer@gmail.com',
]

export function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(email)
}

// เจ้าของระบบ — ต้องตรงกับ isFullAdmin() ใน firestore.rules (ไม่รวมบัญชี volunteer ที่แชร์กันหลายคน)
// ใช้เป็นทางออกฉุกเฉินของระบบ staff role: ถ้ายังไม่มีใครถูกตั้งเป็น role 'admin' เลย
// เจ้าของยังเข้าหน้าจัดการพนักงานไปตั้งให้คนอื่นได้ (ดูคอมเมนต์ break-glass ที่ staff/{staffId} ใน rules)
const FULL_ADMIN_EMAILS = ['akasitlove@gmail.com', 'ummatee.thailand@gmail.com']

// แอดมินสูงสุด — บัญชีเดียว ต้องตรงกับ isSuperAdmin() ใน firestore.rules
// ใช้กับ "จัดการ Staff" (ตั้ง role ให้คนอื่น) และ "ประวัติการเปลี่ยนแปลง" (ดูร่องรอยของทุกคน)
// สองอย่างนี้เป็นการให้สิทธิ์และการตรวจสอบ จึงไม่ควรกระจายให้ทุกคนที่มี role 'admin'
const SUPER_ADMIN_EMAIL = 'akasitlove@gmail.com'
export function isSuperAdminEmail(email) {
  return email === SUPER_ADMIN_EMAIL
}
export function isFullAdminEmail(email) {
  return FULL_ADMIN_EMAILS.includes(email)
}

// สถานะล็อกอินสำหรับหน้าแอดมินระบบเดิม — คืน user เฉพาะเมื่ออีเมลอยู่ใน allowlist
//
// เดิมทุกหน้าเช็คแค่ `if (!user) return <AdminLogin />` คือ "ล็อกอินแล้วก็ผ่าน" ซึ่งไม่พอ เพราะเปิด
// Google Sign-In ไว้ ใครมี Gmail ก็ล็อกอินเข้ามาเห็น UI แอดมินได้ (ข้อมูลจริงไม่รั่วเพราะ rules กัน
// แต่ useStaffRole จะสร้าง staff/{uid} ของคนแปลกหน้าทิ้งไว้เรื่อยๆ ให้แอดมินต้องมาคัดทิ้ง และถ้าเผลอ
// กดเปลี่ยน role ให้ผิดคน = ให้สิทธิ์ CRM รวม PII ผู้รับความช่วยเหลือกับคนนอกทันที)
//
// หมายเหตุ: ห้ามเอาไปใช้แทน useAdminAuth ใน StaffRoleGuard — หน้า CRM ใช้ระบบ staff/{uid} role
// ซึ่งพนักงานทั่วไปไม่ได้อยู่ใน allowlist นี้ ถ้าใช้ตัวนี้จะล็อกพนักงานออกจากระบบ CRM ทั้งหมด
export function useAllowlistedAdmin() {
  const [state, setState] = useState({ user: null, loading: true, signedInButDenied: false })
  useEffect(() => onAuthStateChanged(auth, (user) => {
    const allowed = !!user && isAdminEmail(user.email || '')
    setState({ user: allowed ? user : null, loading: false, signedInButDenied: !!user && !allowed })
  }), [])
  return state
}

// ต้อง subscribe onAuthStateChanged ไม่ใช่อ่าน auth.currentUser ตรงๆ ครั้งเดียว —
// ตอนโหลดหน้าใหม่ (hard reload) Firebase Auth ยังกู้ session จาก IndexedDB ไม่เสร็จ auth.currentUser จึงเป็น null
// ทำให้ VolunteerGuard คิดว่าไม่ใช่บัญชี volunteer แล้วปล่อยเข้าหน้าที่หวงไว้ และเมนู staff/CRM ใน AdminNav หายไป
// จนกว่าจะกดลิงก์อื่นให้ re-render (ข้อมูลจริงยังปลอดภัยเพราะ firestore.rules กันอยู่ แต่ guard ฝั่ง UI พังเงียบๆ)
//
// loading = ยังไม่รู้ว่าใครล็อกอิน — ผู้เรียกต้องรอ ห้ามตัดสินใจ allow/deny ระหว่างนี้
export function useIsVolunteer() {
  const [state, setState] = useState({ isVolunteer: false, loading: true })
  useEffect(() => onAuthStateChanged(auth, (user) => {
    setState({ isVolunteer: isVolunteerEmail(user?.email || ''), loading: false })
  }), [])
  return state
}
