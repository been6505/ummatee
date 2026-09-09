// สถานะของแผนคอนเทนต์ (contentPosts) — แหล่งเดียวที่ใช้ร่วมกันระหว่างปฏิทินคอนเทนต์
// (AdminCalendar) กับรายการในแดชบอร์ด Staff (AdminDashboard2) เพิ่ม/แก้สถานะที่นี่ที่เดียว
// แล้วชิป สี และคำอธิบายสีใต้ปฏิทินตรงกันทั้งระบบ
export const STATUS = { draft: 'ร่าง', wip: 'กำลังดำเนินงาน', review: 'ส่งงาน', posted: 'โพสต์แล้ว' }
export const STATUS_COLOR = { draft: '#c9a84c', wip: '#dd7f2b', review: '#2f6db5', posted: '#2e7d52' }

// ลำดับความ "ค้าง" ของงาน — ใช้เลือกสีประจำวันในปฏิทิน (เอาสถานะที่ค้างที่สุดของวันนั้น)
export const STATUS_ORDER = ['draft', 'wip', 'review', 'posted']

// แนบลิงก์ไฟล์งานใน Google Drive = ส่งงานให้ตรวจแล้ว จึงเลื่อนสถานะให้อัตโนมัติ
// เลื่อนเฉพาะงานที่ยังอยู่ก่อนขั้นตรวจ — ห้ามดึงงานที่โพสต์ไปแล้วกลับมา และไม่ต้องทำซ้ำถ้าอยู่ที่ review อยู่แล้ว
export const statusAfterDriveLink = (current) => (
  current === 'draft' || current === 'wip' ? 'review' : current
)

// ค่าที่ไม่รู้จัก (เช่น 'scheduled' ของโพสต์เก่า) ให้ถือเป็นร่าง ไม่งั้นชิปไม่ตรงกับค่าใดเลย
export const normStatus = (s) => (s in STATUS ? s : 'draft')
