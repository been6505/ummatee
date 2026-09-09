// ตรวจ URL รูปที่รับจากฟอร์มสาธารณะ — ใช้ร่วมกันทุกที่ที่ผู้ใช้แนบรูปได้
//
// ทำไมต้องตรวจ: ฟอร์มพวกนี้ "ใครก็ส่งได้" (ลูกค้าไม่ได้ล็อกอิน) และค่าที่ได้ไปโผล่ใน <img src>
// บนหน้าสาธารณะ ถ้ารับ URL อะไรก็ได้ ก็เท่ากับเปิดให้ฝังรูปจากที่อื่น (หรือ javascript:) ผ่านเว็บมูลนิธิ
// firestore.rules ตรวจได้แค่ว่า photos เป็น list และไม่เกินจำนวน — วน regex ทีละสมาชิกไม่ได้
// ด่านนี้จึงต้องมีทั้งตอนบันทึกและตอนแสดงผล
//
// ⚠️ เครื่องหมายจุลภาคสำคัญมาก: URL ที่ uploadToCloudinary คืนมามี transformation ติดมาด้วยเสมอ
// (".../upload/f_auto,q_auto/...") และ optImg ยังเติม "w_600,q_auto,f_auto" เข้าไปอีก
// regex ที่ไม่ยอมรับ "," จะปฏิเสธรูปทุกใบที่แอปสร้างขึ้นจริง โดยผ่านเฉพาะ URL สมมติในเทสต์เท่านั้น
export const isUploadedPhotoUrl = (u) =>
  /^https:\/\/res\.cloudinary\.com\/[\w.,/-]+(\?[\w=&.%-]*)?$/i.test(String(u || ''))

export const cleanPhotoList = (list, max) =>
  (Array.isArray(list) ? list : []).filter(isUploadedPhotoUrl).slice(0, max)

// uploadToCloudinary คืน { url, type, publicId } ไม่ใช่สตริง — ต้องดึง .url ออกมาก่อนเก็บ
// ถ้าเผลอเก็บทั้ง object ไว้ มันจะกลายเป็น "[object Object]" ทั้งตอนพรีวิวและตอนบันทึก
// แล้วรูปจะหายไปเงียบ ๆ โดยที่ฟอร์มยังดูเหมือนทำงานปกติ
export const toPhotoUrl = (r) => (typeof r === 'string' ? r : r?.url || '')
