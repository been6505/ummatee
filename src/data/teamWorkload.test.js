import { describe, it, expect } from 'vitest'
import { buildWorkload, bucketOf, toTasks, BUCKETS } from './teamWorkload.js'

const TODAY = '2026-08-10'
const members = [{ id: 'u1', name: 'นาซนีน' }, { id: 'u2', name: 'อิบรอฮีม' }]

const post = (o) => ({ id: Math.random().toString(36).slice(2), title: 'โพสต์', ...o })
const card = (o) => ({ id: Math.random().toString(36).slice(2), title: 'การ์ด', ...o })

describe('bucketOf', () => {
  it('แยกเลยกำหนด / วันนี้ / กำลังจะถึง', () => {
    expect(bucketOf('2026-08-09', TODAY)).toBe('overdue')
    expect(bucketOf('2026-08-10', TODAY)).toBe('today')
    expect(bucketOf('2026-08-11', TODAY)).toBe('upcoming')
  })

  it('ไม่มีวันที่ = ยังไม่กำหนดวัน ไม่ใช่เลยกำหนด', () => {
    // ถ้าตีเป็น overdue งานที่ยังไม่ได้วางแผนจะขึ้นแดงทั้งกระดาน จนสีแดงหมดความหมาย
    expect(bucketOf('', TODAY)).toBe('noDate')
    expect(bucketOf(undefined, TODAY)).toBe('noDate')
  })

  it('เทียบเป็นสตริง ไม่แปลงเป็น Date — งานครบกำหนดวันนี้ต้องไม่กลายเป็นเลยกำหนด', () => {
    // new Date('2026-08-10') คือเที่ยงคืน UTC = 07:00 ตามเวลาไทย ถ้าเผลอเทียบแบบนั้นจะเพี้ยนทั้งวัน
    expect(bucketOf(TODAY, TODAY)).toBe('today')
    expect(bucketOf('2026-12-31', '2027-01-01')).toBe('overdue')
    expect(bucketOf('2027-01-01', '2026-12-31')).toBe('upcoming')
  })
})

describe('toTasks', () => {
  it('อ่านวันครบกำหนดจากคนละฟิลด์ได้ถูก (date ของโพสต์ / dueDate ของการ์ด)', () => {
    const t = toTasks([post({ date: '2026-08-01' })], [card({ dueDate: '2026-08-02' })])
    expect(t.map((x) => x.date).sort()).toEqual(['2026-08-01', '2026-08-02'])
  })

  it('ตัดงานที่จบแล้วออก ไม่นับเป็นภาระ', () => {
    const t = toTasks([post({ status: 'posted' }), post({ status: 'wip' })], [card({ done: true }), card({})])
    expect(t).toHaveLength(2)
  })

  it('แยกชนิดงานไว้ให้รู้ว่ามาจากปฏิทินหรือบอร์ด', () => {
    const t = toTasks([post({})], [card({})])
    expect(t.map((x) => x.kind)).toEqual(['content', 'board'])
  })

  it('id ไม่ชนกันแม้ doc id จะซ้ำข้ามคอลเลกชัน', () => {
    const t = toTasks([{ id: 'same' }], [{ id: 'same' }])
    expect(new Set(t.map((x) => x.id)).size).toBe(2)
  })
})

describe('buildWorkload', () => {
  it('นับงานเข้าคนที่รับผิดชอบ แยกตามความเร่งด่วน', () => {
    const { rows } = buildWorkload({
      posts: [post({ assignedToStaffId: 'u1', date: '2026-08-09' }), post({ assignedToStaffId: 'u1', date: TODAY })],
      cards: [card({ assignedToStaffId: 'u2', dueDate: '2026-08-20' })],
      members, todayKey: TODAY,
    })
    const u1 = rows.find((r) => r.id === 'u1')
    expect(u1).toMatchObject({ overdue: 1, today: 1, upcoming: 0, total: 2 })
    expect(rows.find((r) => r.id === 'u2')).toMatchObject({ upcoming: 1, total: 1 })
  })

  it('คนที่ยังไม่มีงานเลยก็ต้องขึ้นในตาราง — ไม่งั้นมองไม่ออกว่าใครรับงานเพิ่มได้', () => {
    const { rows } = buildWorkload({ posts: [], cards: [], members, todayKey: TODAY })
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.total === 0)).toBe(true)
  })

  it('งานที่ไม่มีผู้รับผิดชอบถูกแยกออกมาต่างหาก ไม่ปนกับของใคร', () => {
    const { unassigned, rows } = buildWorkload({
      posts: [post({ date: '2026-08-09' }), post({ assignedToStaffId: '', date: TODAY })],
      cards: [], members, todayKey: TODAY,
    })
    expect(unassigned.total).toBe(2)
    expect(unassigned.overdue).toBe(1)
    expect(rows.every((r) => r.total === 0)).toBe(true)
  })

  it('งานของคนที่ออกจากทีมไปแล้วต้องยังเห็นอยู่ ไม่หายเงียบ', () => {
    const { rows } = buildWorkload({
      posts: [post({ assignedToStaffId: 'ghost', date: TODAY })],
      cards: [], members, todayKey: TODAY,
    })
    const g = rows.find((r) => r.id === 'ghost')
    expect(g).toBeTruthy()
    expect(g.missing).toBe(true)
    expect(g.total).toBe(1)
  })

  it('เรียงคนที่มีงานเลยกำหนดมากสุดขึ้นก่อน', () => {
    const { rows } = buildWorkload({
      posts: [
        post({ assignedToStaffId: 'u1', date: '2026-09-01' }),
        post({ assignedToStaffId: 'u1', date: '2026-09-02' }),
        post({ assignedToStaffId: 'u2', date: '2026-08-01' }),
      ],
      cards: [], members, todayKey: TODAY,
    })
    expect(rows[0].id).toBe('u2') // งานน้อยกว่า แต่เลยกำหนด
  })

  it('ยอดรวมตรงกับผลรวมของทุกแถวบวกงานที่ยังไม่มีคนรับ', () => {
    const r = buildWorkload({
      posts: [post({ assignedToStaffId: 'u1', date: TODAY }), post({ date: TODAY })],
      cards: [card({ assignedToStaffId: 'u2', dueDate: '' })],
      members, todayKey: TODAY,
    })
    const summed = r.rows.reduce((s, x) => s + x.total, 0) + r.unassigned.total
    expect(summed).toBe(r.totals.total)
    expect(r.totals.total).toBe(3)
  })

  it('ไม่พังเมื่อไม่มีข้อมูลอะไรเลย', () => {
    const r = buildWorkload({ posts: undefined, cards: undefined, members: undefined, todayKey: TODAY })
    expect(r.rows).toEqual([])
    expect(r.totals.total).toBe(0)
  })

  it('BUCKETS ครบและ key ไม่ซ้ำ', () => {
    expect(new Set(BUCKETS.map((b) => b.key)).size).toBe(BUCKETS.length)
    const r = buildWorkload({ posts: [], cards: [], members, todayKey: TODAY })
    for (const b of BUCKETS) expect(r.totals).toHaveProperty(b.key)
  })
})
