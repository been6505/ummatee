import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

// เทสต์กันบั๊กทั้ง "ตระกูล" ไม่ใช่ตัวเดียว
//
// หน้าแอดมินแต่ละหน้ามี allowedRoles ของตัวเอง และอ่าน collection ของตัวเอง
// ถ้า allowedRoles กว้างกว่าที่ firestore.rules ยอมให้อ่าน จะเกิดอาการที่มองไม่เห็นจากทั้งสองฝั่ง:
// หน้าเปิดได้ปกติ แต่ listener ล้มด้วย permission-denied แล้วหน้าก็แสดงว่า "ไม่มีข้อมูล"
// ซึ่งแยกไม่ออกจาก "ไม่มีข้อมูลจริง ๆ" — เคยเกิดมาแล้วที่ /admin/my-work
//
// เทสต์นี้จึงล็อกรายการที่ "รู้อยู่แล้วและจัดการในโค้ดแล้ว" ไว้ ถ้ามีคู่ใหม่โผล่มาต้องมาดูด้วยตาก่อน

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const rules = readFileSync(join(ROOT, 'firestore.rules'), 'utf8')

// คู่ที่ยอมรับได้ เพราะโค้ดจัดการกรณีสิทธิ์ไม่ถึงไว้ชัดเจนแล้ว (ไม่ได้เงียบ)
const HANDLED = new Set([
  // ปฏิทินคอนเทนต์เปิดให้ 'social' แต่ campaigns อ่านได้แค่ admin/staff/field
  // → ไม่ subscribe เลย และช่องเลือกแคมเปญขึ้นว่า "สิทธิ์ไม่ถึง" แทนที่จะว่างเปล่าเฉย ๆ
  'AdminCalendar.jsx:campaigns',
  // หน้าแคมเปญเปิดให้ 'field' แต่ contentPosts อ่านได้แค่ admin/staff/social
  // → ตัวนับแสดง "—" ไม่ใช่ 0 ที่อ่านเหมือนว่าไม่มีคอนเทนต์ผูกอยู่จริง
  'AdminCampaigns.jsx:contentPosts',
])

// role ที่แต่ละ collection ยอมให้อ่าน ตามกฎที่ deploy จริง
function readRolesByCollection() {
  const map = {}
  for (const m of rules.matchAll(/match \/([A-Za-z0-9_]+)\/\{[^}]+\}\s*\{([\s\S]*?)\n {4}\}/g)) {
    const body = m[2]
    if (!/allow (read|list|get)/.test(body)) continue
    const roles = new Set()
    for (const r of body.matchAll(/isStaffRole\(\[([^\]]*)\]\)/g))
      for (const q of r[1].matchAll(/'([^']+)'/g)) roles.add(q[1])
    if (roles.size) map[m[1]] = roles
  }
  return map
}

function findMismatches() {
  const colRoles = readRolesByCollection()
  const dir = join(ROOT, 'src/pages')
  const out = []
  for (const f of readdirSync(dir).filter((x) => /^Admin.*\.jsx$/.test(x))) {
    const s = readFileSync(join(dir, f), 'utf8')
    const g = s.match(/allowedRoles=\{\[([^\]]*)\]\}/)
    if (!g) continue
    const guard = [...g[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
    const cols = new Set([...s.matchAll(/collection\(db, *'([A-Za-z0-9_]+)'/g)].map((x) => x[1]))
    for (const c of cols) {
      const allowed = colRoles[c]
      if (!allowed) continue
      const extra = guard.filter((r) => !allowed.has(r))
      if (extra.length) out.push(`${f}:${c}`)
    }
  }
  return out
}

describe('allowedRoles ของหน้าแอดมิน เทียบกับสิทธิ์อ่านใน firestore.rules', () => {
  it('อ่านกฎออกได้จริง (กันกรณี regex พังแล้วเทสต์ผ่านเพราะไม่เจออะไรเลย)', () => {
    const map = readRolesByCollection()
    expect(Object.keys(map).length).toBeGreaterThan(5)
    expect(map.contentPosts).toEqual(new Set(['admin', 'staff', 'social']))
    expect(map.boardCards).toEqual(new Set(['admin', 'staff', 'field']))
  })

  it('เจอหน้าแอดมินที่มี allowedRoles จริง', () => {
    const dir = join(ROOT, 'src/pages')
    const n = readdirSync(dir)
      .filter((x) => /^Admin.*\.jsx$/.test(x))
      .filter((f) => /allowedRoles=/.test(readFileSync(join(dir, f), 'utf8'))).length
    expect(n).toBeGreaterThan(10)
  })

  it('ไม่มีคู่ใหม่ที่ role เข้าหน้าได้แต่อ่าน collection ไม่ได้', () => {
    const unexpected = findMismatches().filter((k) => !HANDLED.has(k))
    // ถ้าเทสต์นี้แดง: อย่าเพิ่งเติมลง HANDLED — ไปดูก่อนว่าหน้านั้นแสดงอะไรตอนโดน permission-denied
    // ถ้ามันเงียบแล้วขึ้นว่า "ไม่มีข้อมูล" นั่นคือบั๊ก ต้องแก้ที่โค้ดหรือแก้ allowedRoles ไม่ใช่ปิดเทสต์
    expect(unexpected).toEqual([])
  })

  it('รายการใน HANDLED ยังมีอยู่จริง — ถ้าแก้ไปแล้วต้องเอาออก ไม่ปล่อยให้ค้าง', () => {
    const found = new Set(findMismatches())
    for (const k of HANDLED) expect(found.has(k), `${k} ไม่ใช่ mismatch แล้ว เอาออกจาก HANDLED ได้`).toBe(true)
  })
})
