import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { WORK_SOURCES, MY_WORK_ROLES, canRead, readableSources, hiddenSources } from './workSources.js'

describe('สิทธิ์อ่านแหล่งงาน', () => {
  it('social เห็นคอนเทนต์ แต่ไม่เห็นบอร์ด', () => {
    expect(canRead('social', 'contentPosts')).toBe(true)
    expect(canRead('social', 'boardCards')).toBe(false)
  })

  it('field เห็นบอร์ด แต่ไม่เห็นคอนเทนต์', () => {
    expect(canRead('field', 'boardCards')).toBe(true)
    expect(canRead('field', 'contentPosts')).toBe(false)
  })

  it('admin กับ staff เห็นครบทุกแหล่ง', () => {
    for (const r of ['admin', 'staff']) {
      expect(readableSources(r)).toHaveLength(WORK_SOURCES.length)
      expect(hiddenSources(r)).toHaveLength(0)
    }
  })

  it('role ที่ไม่รู้จักไม่เห็นอะไรเลย ไม่ใช่เห็นทุกอย่าง', () => {
    expect(readableSources('pending')).toHaveLength(0)
    expect(canRead(undefined, 'boardCards')).toBe(false)
  })

  it('MY_WORK_ROLES คือ union ของทุกแหล่ง ไม่มีตัวซ้ำ', () => {
    expect([...MY_WORK_ROLES].sort()).toEqual(['admin', 'field', 'social', 'staff'])
  })
})

// เทสต์ที่สำคัญที่สุดในไฟล์นี้: ตารางข้างบนต้องตรงกับ firestore.rules จริง ๆ
// ถ้าใครไปแก้ rules แล้วลืมแก้ที่นี่ (หรือกลับกัน) หน้า "งานของฉัน" จะโกหกว่าไม่มีงาน
describe('ตารางสิทธิ์ตรงกับ firestore.rules', () => {
  const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8')

  for (const src of WORK_SOURCES) {
    it(`${src.key} ตรงกับกฎที่ deploy จริง`, () => {
      const m = rules.match(new RegExp(`match /${src.key}/\\{[^}]+\\}\\s*\\{([\\s\\S]*?)\\n    \\}`))
      expect(m, `ไม่พบ match /${src.key} ใน firestore.rules`).toBeTruthy()
      const roles = [...m[1].matchAll(/isStaffRole\(\[([^\]]*)\]\)/g)]
        .flatMap((x) => [...x[1].matchAll(/'([^']+)'/g)].map((y) => y[1]))
      expect(new Set(roles)).toEqual(new Set(src.roles))
    })
  }
})
