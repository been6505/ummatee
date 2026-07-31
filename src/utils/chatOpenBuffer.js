// พักคำสั่ง "เปิดแชท" ที่ถูกกดก่อน ChatWidget จะโหลดเสร็จ
//
// ChatWidget ลากทั้ง Firebase SDK เข้ามา (ผ่าน data/chat.js) ถ้า import แบบธรรมดาใน App.jsx
// firebase จะไปอยู่ใน entry chunk ที่ผู้เข้าเว็บทุกคนต้องโหลดก่อนเห็นหน้าแรก จึงเปลี่ยนเป็น lazy
//
// ผลข้างเคียงคือมีช่วงสั้นๆ ที่ตัว widget ยังโหลดไม่เสร็จและยังไม่มี listener ของตัวเอง
// ถ้าผู้ใช้กดปุ่มแชทพอดีในช่วงนั้น event จะหายไปเงียบๆ — ไฟล์นี้เล็กและไม่แตะ firebase
// จึงอยู่ใน entry ได้ ทำหน้าที่จำไว้ว่ามีการกด แล้วให้ widget มารับช่วงต่อตอน mount
let pending = null

const capture = (e) => { pending = { product: e?.detail?.product || null } }

if (typeof window !== 'undefined') window.addEventListener('ummatee-open-chat', capture)

// คืนคำสั่งที่ค้างอยู่ (ถ้ามี) แล้วเลิกดักฟัง — ตั้งแต่จุดนี้ ChatWidget มี listener ของตัวเองแล้ว
// ถ้าปล่อยให้ดักต่อ ค่าจะค้างสะสมโดยไม่มีใครมาเอาไป
export function takePendingChatOpen() {
  if (typeof window !== 'undefined') window.removeEventListener('ummatee-open-chat', capture)
  const p = pending
  pending = null
  return p
}
