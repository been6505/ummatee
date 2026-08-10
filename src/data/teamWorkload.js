// ภาระงานของทีม — รวมงานที่มอบหมายไว้ทั้งจากปฏิทินคอนเทนต์และบอร์ดวางแผน แล้วแยกตามคน
//
// /admin/my-work ตอบว่า "ฉันมีงานอะไร" แต่ไม่มีที่ไหนตอบว่า "ทีมมีงานอะไรอยู่บ้าง ใครล้นมือ ใครยังว่าง
// และงานไหนยังไม่มีคนรับ" ซึ่งเป็นสิ่งที่ต้องรู้ตอนวางแผน ไม่ใช่ตอนลงมือทำ
//
// ไฟล์นี้ไม่แตะ firebase (เทสต์ได้โดยไม่ต้องมี DOM) — รับข้อมูลดิบเข้ามา คืนตารางที่พร้อมแสดงผล

// จัดกลุ่มตามความเร่งด่วน ไม่ใช่เรียงตามวัน — คนเปิดดูอยากรู้ว่า "อะไรเลยกำหนดแล้ว"
export const BUCKETS = [
  { key: 'overdue', label: 'เลยกำหนด', color: '#c62828' },
  { key: 'today', label: 'วันนี้', color: '#b45309' },
  { key: 'upcoming', label: 'กำลังจะถึง', color: '#2e7d32' },
  { key: 'noDate', label: 'ยังไม่กำหนดวัน', color: '#6b7280' },
]

// เทียบวันแบบสตริง YYYY-MM-DD ล้วน ๆ ห้ามแปลงเป็น Date
// new Date('2026-08-01') ถูกตีความเป็น UTC พอเป็นเวลาไทย (+07) จะกลายเป็นวันก่อนหน้า
// งานที่ครบกำหนด "วันนี้" จะถูกนับเป็น "เลยกำหนด" ทั้งแผง
export function bucketOf(dateStr, todayKey) {
  if (!dateStr) return 'noDate'
  if (dateStr < todayKey) return 'overdue'
  if (dateStr === todayKey) return 'today'
  return 'upcoming'
}

const EMPTY = () => ({ overdue: 0, today: 0, upcoming: 0, noDate: 0, total: 0 })

// งานที่ถือว่าจบแล้ว ไม่ต้องนับเป็นภาระ — โพสต์ที่ขึ้นแล้ว/การ์ดที่ปิดแล้ว
const isDone = (item) => item?.status === 'posted' || item?.done === true

// normalise งานสองชนิดให้อยู่ในรูปเดียวกันก่อนนับ
// contentPosts ใช้ฟิลด์ `date` ส่วน boardCards ใช้ `dueDate` — จุดที่พลาดง่ายถ้าไปนับแยกกันคนละที่
export function toTasks(posts, cards) {
  return [
    ...(posts || []).filter((p) => !isDone(p)).map((p) => ({
      id: 'post-' + p.id, kind: 'content', title: p.title || '(ไม่มีชื่อ)',
      date: p.date || '', assignee: p.assignedToStaffId || '',
    })),
    ...(cards || []).filter((c) => !isDone(c)).map((c) => ({
      id: 'card-' + c.id, kind: 'board', title: c.title || '(ไม่มีชื่อ)',
      date: c.dueDate || '', assignee: c.assignedToStaffId || '',
    })),
  ]
}

// members: [{ id, name }] จาก staffDirectory — คนที่ไม่มีงานเลยก็ยังต้องขึ้นในตาราง
// (การไม่เห็นชื่อคนที่ว่าง คือการมองไม่เห็นว่าใครรับงานเพิ่มได้ ซึ่งเป็นครึ่งหนึ่งของประโยชน์หน้านี้)
export function buildWorkload({ posts, cards, members, todayKey }) {
  const tasks = toTasks(posts, cards)
  const byId = new Map()
  for (const m of members || []) byId.set(m.id, { id: m.id, name: m.name || m.id, ...EMPTY() })

  const unassigned = { id: '', name: 'ยังไม่มีผู้รับผิดชอบ', ...EMPTY() }

  for (const t of tasks) {
    const b = bucketOf(t.date, todayKey)
    let row
    if (!t.assignee) {
      row = unassigned
    } else if (byId.has(t.assignee)) {
      row = byId.get(t.assignee)
    } else {
      // คนที่ออกจากทีมไปแล้ว (ไม่มีใน staffDirectory) แต่ยังมีงานค้างชื่อเขาอยู่
      // ต้องเห็น ไม่ใช่หายไปเฉย ๆ ไม่งั้นงานพวกนี้จะตกหล่นโดยไม่มีใครรู้ว่ามันมีอยู่
      row = byId.get(t.assignee) || { id: t.assignee, name: 'ไม่พบในสมุดรายชื่อ', missing: true, ...EMPTY() }
      byId.set(t.assignee, row)
    }
    row[b] += 1
    row.total += 1
  }

  // เรียงคนที่มีงานเลยกำหนดมากสุดขึ้นก่อน แล้วค่อยดูจำนวนงานรวม
  const rows = [...byId.values()].sort((a, b) =>
    b.overdue - a.overdue || b.total - a.total || String(a.name).localeCompare(String(b.name), 'th'))

  const totals = tasks.reduce((acc, t) => {
    const b = bucketOf(t.date, todayKey)
    acc[b] += 1; acc.total += 1
    return acc
  }, EMPTY())

  return { rows, unassigned, totals, taskCount: tasks.length }
}
