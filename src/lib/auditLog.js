// เขียน audit log entry คู่กับการแก้ไขข้อมูลในคอลเลกชันใหม่ (partners/aidLocations/speakers/board/staff)
// ข้อจำกัดสำคัญ: ระบบนี้ไม่มี backend server เขียนผ่าน Firestore client SDK ตรงๆ เหมือนข้อมูลจริง
// เท่ากับ client ที่ตั้งใจแฮ็ก (เขียนผ่าน Firestore SDK ข้าม UI ตรงๆ) สามารถแก้ข้อมูลจริงสำเร็จ
// โดย "ข้าม" การเขียน audit log คู่กันได้ ไม่มีทางบังคับ atomic ทั้งสองอย่างพร้อมกันได้จริงถ้าไม่มี
// Cloud Functions/transaction ฝั่งเซิร์ฟเวอร์ตรวจสอบ นี่คือ trade-off ที่ยอมรับสำหรับเวอร์ชันนี้
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../firebase.js'

export async function writeAuditLog({ action, entityType, entityId, summary }) {
  try {
    const u = auth.currentUser
    await addDoc(collection(db, 'auditLog'), {
      staffUid: u?.uid || '',
      staffEmail: u?.email || '',
      action,
      entityType,
      entityId: String(entityId || ''),
      summary: summary || '',
      createdAt: serverTimestamp(),
    })
  } catch (e) {
    // ไม่ block การทำงานหลักถ้า audit log เขียนไม่สำเร็จ (เช่น offline) แค่ log ไว้เฉยๆ
    console.error('writeAuditLog failed', e)
  }
}
