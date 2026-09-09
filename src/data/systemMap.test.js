import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { CORE, GROUPS, OUTPUT, allSystemMapHrefs } from './systemMap.js'

// path ทั้งหมดที่ App.jsx รู้จัก — อ่านจากไฟล์เป็นข้อความ เพราะ import App.jsx เข้ามาจะลาก firebase
// (ซึ่งต้องมี document) ติดมาด้วย
const APP = fs.readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
const KNOWN_PATHS = new Set([...APP.matchAll(/'(\/[^']*)':\s*'[a-z0-9-]+'/g)].map((m) => m[1]))

describe('ผังระบบชี้ไปหน้าที่มีอยู่จริง', () => {
  it('อ่าน PATH_TO_PAGE จาก App.jsx ได้ (กันเทสต์ผ่านเพราะ regex ไม่แมตช์อะไรเลย)', () => {
    expect(KNOWN_PATHS.size).toBeGreaterThan(30)
    expect(KNOWN_PATHS.has('/admin/calendar')).toBe(true)
  })

  it('ทุกลิงก์ในผังมีเส้นทางจริง — ผังที่ชี้ไปหน้าที่ไม่มี แย่กว่าไม่มีผังเลย', () => {
    const dead = allSystemMapHrefs().filter((h) => !KNOWN_PATHS.has(h))
    expect(dead).toEqual([])
  })
})

describe('โครงของผัง', () => {
  it('ไม่มีลิงก์ซ้ำข้ามกลุ่ม — ของชิ้นเดียวควรอยู่ที่เดียวในผัง', () => {
    const hrefs = GROUPS.flatMap((g) => g.items.map((i) => i.href))
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('ทุกกลุ่มมี key ไม่ซ้ำและมีรายการอย่างน้อยหนึ่งอัน', () => {
    expect(new Set(GROUPS.map((g) => g.key)).size).toBe(GROUPS.length)
    for (const g of GROUPS) expect(g.items.length).toBeGreaterThan(0)
  })

  it('ทุกรายการมีทั้งชื่อและคำอธิบาย — ชื่ออย่างเดียวไม่พอให้คนเข้าใหม่รู้ว่าใช้ทำอะไร', () => {
    for (const it of [...CORE, ...GROUPS.flatMap((g) => g.items), ...OUTPUT]) {
      expect(it.label?.trim()).toBeTruthy()
      expect(it.desc?.trim()).toBeTruthy()
    }
  })
})
