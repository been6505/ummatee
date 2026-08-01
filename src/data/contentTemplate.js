// แม่แบบโพสต์ — เอาโพสต์ที่เคยทำไว้แล้วกลับมาใช้ซ้ำ โดยไม่ต้องพิมพ์ใหม่ทั้งหมด
//
// ไฟล์นี้ไม่แตะ firebase (เทสต์ได้โดยไม่ต้องมี DOM — เหตุผลเดียวกับ weekView.js / liveSchedule.js)
// หน้าที่มันมีอย่างเดียวคือตัดสินว่า "ฟิลด์ไหนใช้ซ้ำได้ ฟิลด์ไหนต้องเริ่มใหม่ทุกครั้ง"
//
// แยกให้ชัดว่าอะไรคือ "รูปแบบของโพสต์" (ใช้ซ้ำได้) กับอะไรคือ "ของครั้งนั้นครั้งเดียว":
//   ใช้ซ้ำได้ — ชื่อเรื่อง แคปชัน แพลตฟอร์ม ชนิดคอนเทนต์ แคมเปญ แหล่งอ้างอิง ข้อมูลไลฟ์ รูปที่แนบ
//   ห้ามใช้ซ้ำ — วันเวลา (ต้องเลือกใหม่), สถานะ (เริ่มที่ร่างเสมอ), ลิงก์ไฟล์งานใน Drive
//                 (เป็นไฟล์ของงานใบนั้นโดยเฉพาะ ถ้าติดมาด้วยจะดูเหมือนใบใหม่ส่งงานแล้ว),
//                 การทำซ้ำรายสัปดาห์ (ตั้งใหม่ทุกครั้ง ไม่งั้นเผลอสร้างทีละหลายสิบใบ)

export const TEMPLATE_FIELDS = [
  'title', 'text', 'platforms', 'contentType', 'campaignId',
  'sources', 'mediaUrls', 'mediaPublicIds',
  'liveHost', 'livePlatforms',
]

// ฟิลด์ที่ต้องเริ่มใหม่เสมอเมื่อเอาแม่แบบมาใช้ — ค่าที่ผู้เรียกกำหนดเองทับได้
const FRESH = {
  date: '',
  time: '10:00',
  status: 'draft',
  driveUrl: '',
  repeatDays: [],
  liveScheduledAt: '',
  assignedToStaffId: null,
}

// ดึงเฉพาะส่วนที่ใช้ซ้ำได้ออกจากโพสต์/ฟอร์ม
export function templateFrom(post) {
  const out = {}
  for (const k of TEMPLATE_FIELDS) {
    const v = post?.[k]
    if (Array.isArray(v)) out[k] = [...v]
    else if (v !== undefined && v !== null) out[k] = v
  }
  return out
}

// รวมแม่แบบเข้ากับฟอร์มเปล่า — emptyForm คือ EMPTY_FORM ของหน้าปฏิทิน
// fresh ให้ผู้เรียกส่งวัน/เวลาที่ต้องการมาทับได้ (เช่นวันที่เลือกอยู่ในปฏิทิน)
export function applyTemplate(emptyForm, tpl, fresh = {}) {
  return { ...emptyForm, ...templateFrom(tpl), ...FRESH, ...fresh }
}

// ชื่อแม่แบบที่จะเสนอให้ตอนกดบันทึก — ใช้ชื่อโพสต์เป็นค่าตั้งต้น
export const suggestTemplateName = (post) => String(post?.title || '').trim() || 'แม่แบบไม่มีชื่อ'

export const MAX_TEMPLATE_NAME = 80
