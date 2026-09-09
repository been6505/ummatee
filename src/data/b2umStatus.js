// สถานะร้านค้าที่สมัครเข้าโครงการ B2UM
//
// ใบสมัครที่ส่งเข้ามาจากหน้า public ไม่มีสถานะติดมาเลย (ดู B2um.jsx) — ทุกใบจึงเป็น 'new' โดยปริยาย
// ที่ต้องมีสถานะเพราะรายชื่อดิบใช้ทำงานเป็นทีมไม่ได้: ไม่มีใครรู้ว่าร้านไหนติดต่อไปแล้ว
// สองคนโทรหาร้านเดียวกันซ้ำได้ และร้านที่ตกหล่นก็ไม่มีใครเห็น
export const B2UM_STATUS = {
  new: 'ใบสมัครใหม่',
  contacted: 'ติดต่อแล้ว',
  joined: 'เข้าร่วมแล้ว',
  declined: 'ไม่เข้าร่วม',
}

export const B2UM_STATUS_COLOR = {
  new: '#6b7280',
  contacted: '#b45309',
  joined: '#2e7d32',
  declined: '#c62828',
}

export const B2UM_STATUS_ORDER = ['new', 'contacted', 'joined', 'declined']

// ใบสมัครเก่าไม่มีฟิลด์ status — ถือเป็น 'new' ไม่ใช่ค่าว่างที่ทำให้หลุดจากทุกตัวกรอง
export const normB2umStatus = (s) => (B2UM_STATUS[s] ? s : 'new')
