import { auth } from './firebase.js'

const VOLUNTEER_EMAILS = ['ummatee.volunteer@gmail.com']

// อีเมลที่มีสิทธิ์เข้าโซน /admin — ต้องตรงกับ isAdmin() ใน firestore.rules เสมอ
// (แก้ที่ไฟล์นี้แล้วต้องไปแก้ firestore.rules ด้วย ไม่งั้นล็อกอินผ่านแต่อ่านข้อมูลไม่ได้)
//
// จำเป็นตั้งแต่เปิดให้ล็อกอินด้วย Google เพราะใครก็กดล็อกอินด้วยบัญชี Google ตัวเองได้
// Firestore rules กันชั้นข้อมูลไว้แล้ว แต่ต้องกันที่หน้าจอด้วย ไม่ให้คนนอกเข้ามาเห็นหน้า
// แอดมินแล้วเจอ error รัวๆ โดยไม่รู้ว่าเกิดอะไรขึ้น
const ALLOWED_EMAILS = [
  'akasitlove@gmail.com',
  'ummatee.thailand@gmail.com',
  'ummatee.volunteer@gmail.com',
]

export function isAllowedEmail(email) {
  return typeof email === 'string' && ALLOWED_EMAILS.includes(email.trim().toLowerCase())
}

export function isVolunteerEmail(email) {
  return VOLUNTEER_EMAILS.includes(email)
}

export function useIsVolunteer() {
  return isVolunteerEmail(auth.currentUser?.email || '')
}
