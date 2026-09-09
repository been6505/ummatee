// ตรวจ URL ก่อนใส่ลง <a href>/<img src> ตรงๆ — กัน scheme อันตรายเช่น javascript: หรือ data:
// React ไม่บล็อก href="javascript:..." ให้ (แค่ warn) จึงต้องกรองเอง ทุกที่ที่ URL มาจากคนอื่น
// (ผู้เยี่ยมชมที่ไม่ล็อกอิน หรือแอดมินคนละคน — บัญชี ummatee.volunteer แชร์กันหลายคน ความน่าเชื่อถือต่ำกว่า)
//
// อยู่ในไฟล์แยกที่ไม่ import firebase เลย เพราะหน้าแรก (Home.jsx) ไม่ lazy — ถ้าไปดึงจาก data/chat.js
// จะลาก firebase/firestore (~700KB) เข้า bundle หลักไปด้วย
export const isSafeHttpUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u)
