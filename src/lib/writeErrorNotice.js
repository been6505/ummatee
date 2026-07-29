// แจ้งเตือนเมื่อการเขียนข้อมูลลง Firestore ล้มเหลวโดยไม่มีใครดักไว้
//
// ปัญหาที่แก้: หน้าแอดมินหลายจุดเขียนแบบ `await updateDoc(...)` ในตัวจัดการปุ่มโดยไม่มี try/catch
// ถ้า rules ปฏิเสธ (สิทธิ์ไม่พอ) หรือเน็ตหลุด promise จะ reject แล้วหายไปเงียบๆ
// ผู้ใช้เห็นแค่ "กดปุ่มแล้วไม่มีอะไรเกิดขึ้น" ซึ่งแยกไม่ออกเลยว่าปุ่มเสีย ระบบล่ม หรือไม่มีสิทธิ์
//
// ดักที่ระดับ window ทีเดียวจบ ครอบคลุมทุกจุดที่ลืมดัก และไม่ต้องไปแก้ call site ทีละอัน
// (จุดที่ดักเองอยู่แล้วจะไม่เข้าเงื่อนไขนี้ เพราะ .catch ทำให้ไม่เป็น unhandled rejection)

const MESSAGES = {
  'permission-denied': 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้ — ติดต่อแอดมินหากคิดว่าควรมีสิทธิ์',
  unauthenticated: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
  unavailable: 'เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
  'failed-precondition': 'ทำรายการไม่สำเร็จ (ข้อมูลถูกแก้ไขจากที่อื่นระหว่างนี้) กรุณาลองใหม่',
  'deadline-exceeded': 'ใช้เวลานานเกินไป กรุณาลองใหม่',
}

let toastEl = null
let hideTimer = null

function showToast(text) {
  if (!toastEl) {
    toastEl = document.createElement('div')
    toastEl.className = 'write-error-toast'
    toastEl.setAttribute('role', 'alert')
    document.body.appendChild(toastEl)
  }
  toastEl.textContent = text
  toastEl.classList.add('show')
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => toastEl.classList.remove('show'), 6000)
}

export function initWriteErrorNotice() {
  window.addEventListener('unhandledrejection', (e) => {
    const err = e.reason
    const code = err?.code
    if (!code) return // ไม่ใช่ error ของ Firebase — ปล่อยให้ ErrorBoundary/คอนโซลจัดการตามเดิม

    // ตัด prefix ของ Firestore ('firestore/permission-denied') ให้เหลือเฉพาะรหัส
    const short = String(code).includes('/') ? String(code).split('/').pop() : String(code)
    const msg = MESSAGES[short]
    if (!msg) return // รหัสที่ไม่รู้จัก ไม่เดาข้อความให้ผู้ใช้ ปล่อยขึ้นคอนโซลตามปกติ

    showToast(msg)
    // ไม่เรียก preventDefault() — ยังอยากให้ error ขึ้นคอนโซลไว้ให้ดีบักได้เหมือนเดิม
  })
}
