// แหล่งงานของหน้า "งานของฉัน" (/admin/my-work) และ role ที่อ่านแต่ละแหล่งได้จริง
//
// ⚠️ ตัวเลขในไฟล์นี้ต้องตรงกับ firestore.rules เป๊ะ ๆ ถ้าไม่ตรงจะเกิดอาการที่แย่ที่สุดแบบหนึ่ง:
// หน้าเปิดได้ปกติ แต่ listener ของแหล่งที่ไม่มีสิทธิ์ล้มด้วย permission-denied เงียบ ๆ
// แล้วหน้าก็ขึ้นว่า "ยังไม่มีงานที่มอบหมายให้คุณ" ทั้งที่มีงานอยู่จริง — คนอ่านไม่มีทางรู้เลยว่ามันพัง
//
// อ้างอิงจาก firestore.rules:
//   match /contentPosts/{id} → isStaffRole(['admin','staff','social'])
//   match /boardCards/{id}   → isStaffRole(['admin','staff','field'])
// สังเกตว่า 'field' อ่าน contentPosts ไม่ได้ และ 'social' อ่าน boardCards ไม่ได้

export const WORK_SOURCES = [
  { key: 'contentPosts', roles: ['admin', 'staff', 'social'], label: 'ปฏิทินคอนเทนต์' },
  { key: 'boardCards', roles: ['admin', 'staff', 'field'], label: 'บอร์ดวางแผน' },
]

// role ที่เข้าหน้านี้ได้ = ทุก role ที่อ่านได้อย่างน้อยหนึ่งแหล่ง (คำนวณเอา ไม่ต้องมาไล่แก้สองที่)
export const MY_WORK_ROLES = [...new Set(WORK_SOURCES.flatMap((s) => s.roles))]

export const canRead = (role, key) =>
  WORK_SOURCES.find((s) => s.key === key)?.roles.includes(role) === true

// แหล่งที่ role นี้เปิด listener ได้ — แหล่งที่อ่านไม่ได้ต้อง "ไม่ subscribe เลย"
// ไม่ใช่ subscribe แล้วปล่อยให้ error เพราะนอกจากไม่ได้ข้อมูลแล้ว ยังเปลืองการเชื่อมต่อและรก console
export const readableSources = (role) => WORK_SOURCES.filter((s) => s.roles.includes(role))

// แหล่งที่ role นี้ "มองไม่เห็น" — เอาไปบอกผู้ใช้ตรง ๆ ว่าหน้านี้ยังไม่ครบ ดีกว่าปล่อยให้เข้าใจว่าไม่มีงาน
export const hiddenSources = (role) => WORK_SOURCES.filter((s) => !s.roles.includes(role))
