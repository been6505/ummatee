// สถานะของแผนคอนเทนต์ (contentPosts) — แหล่งเดียวที่ใช้ร่วมกันระหว่างปฏิทินคอนเทนต์
// (AdminCalendar) กับรายการในแดชบอร์ด Staff (AdminDashboard2) เพิ่ม/แก้สถานะที่นี่ที่เดียว
// แล้วชิป สี และคำอธิบายสีใต้ปฏิทินตรงกันทั้งระบบ
export const STATUS = { draft: 'ร่าง', review: 'ส่งตรวจ', posted: 'โพสต์แล้ว' }
export const STATUS_COLOR = { draft: '#c9a84c', review: '#2f6db5', posted: '#2e7d52' }

// ค่าที่ไม่รู้จัก (เช่น 'scheduled' ของโพสต์เก่า) ให้ถือเป็นร่าง ไม่งั้นชิปไม่ตรงกับค่าใดเลย
export const normStatus = (s) => (s in STATUS ? s : 'draft')
