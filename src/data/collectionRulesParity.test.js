import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

// ทุก collection ที่โค้ดเรียกใช้ ต้องมี match block ใน firestore.rules
//
// ถ้าไม่มี จะไปตกที่กฎปิดท้าย `match /{document=**} { allow read, write: if false }`
// แปลว่าทุกการอ่าน/เขียน collection นั้นถูกปฏิเสธ 100% — และเกือบทุกที่ในโค้ดนี้ดัก error
// ของ onSnapshot ไว้เงียบ ๆ ผลคือหน้าเว็บขึ้นว่า "ไม่มีข้อมูล" แทนที่จะบอกว่าเข้าถึงไม่ได้
// เป็นความพังที่มองไม่เห็นจากทั้งฝั่งโค้ดและฝั่งกฎ ต้องเทียบสองฝั่งเท่านั้นถึงจะเจอ

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const rules = readFileSync(join(ROOT, 'firestore.rules'), 'utf8')

// `match /databases/{database}/documents` เป็น path รากของ Firestore ไม่ใช่ collection ชื่อ databases
const ROOT_PATH_SEGMENTS = new Set(['databases'])

function ruledCollections() {
  return new Set(
    [...rules.matchAll(/match \/([A-Za-z0-9_]+)\//g)]
      .map((m) => m[1])
      .filter((c) => !ROOT_PATH_SEGMENTS.has(c))
  )
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e)
    if (statSync(f).isDirectory()) walk(f, out)
    else if (/\.jsx?$/.test(e) && !/\.test\./.test(e)) out.push(f)
  }
  return out
}

// จับทั้งแบบเขียนสตริงตรง ๆ  collection(db, 'orders')
// และแบบผ่านตัวแปร        const COL = 'publicUpdates' ... collection(db, COL)
// ถ้าจับแค่แบบแรก ไฟล์ที่เขียนแบบที่สองจะ "ดูเหมือนไม่ได้ใช้ collection ไหนเลย" แล้วเทสต์ผ่านฟรี ๆ
function usedCollections() {
  const used = new Map()
  for (const f of walk(join(ROOT, 'src'))) {
    const s = readFileSync(f, 'utf8')
    const consts = new Map(
      [...s.matchAll(/const\s+([A-Z_][A-Z0-9_]*)\s*=\s*'([A-Za-z0-9_]+)'/g)].map((m) => [m[1], m[2]])
    )
    const add = (name) => {
      if (!name) return
      if (!used.has(name)) used.set(name, new Set())
      used.get(name).add(f.slice(ROOT.length))
    }
    for (const m of s.matchAll(/(?:collection|doc)\(\s*db\s*,\s*'([A-Za-z0-9_]+)'/g)) add(m[1])
    for (const m of s.matchAll(/(?:collection|doc)\(\s*db\s*,\s*([A-Z_][A-Z0-9_]*)\s*[,)]/g)) add(consts.get(m[1]))
  }
  return used
}

describe('collection ที่โค้ดใช้ เทียบกับ firestore.rules', () => {
  it('ตัวดึงข้อมูลทำงานจริง (กัน regex พังแล้วเทสต์ผ่านเพราะไม่เจออะไรเลย)', () => {
    const used = usedCollections()
    const ruled = ruledCollections()
    expect(used.size).toBeGreaterThan(20)
    expect(ruled.size).toBeGreaterThan(20)
    // สองอันนี้ต้องเจอเสมอ: อันแรกเขียนสตริงตรง ๆ อันหลังเรียกผ่านตัวแปร
    expect(used.has('orders')).toBe(true)
    expect(used.has('publicUpdates')).toBe(true)
  })

  it('ไม่มี collection ไหนที่โค้ดใช้แล้วไม่มีกฎรองรับ', () => {
    const ruled = ruledCollections()
    const missing = [...usedCollections()]
      .filter(([c]) => !ruled.has(c))
      .map(([c, files]) => `${c} (ใช้ที่ ${[...files].join(', ')})`)
    expect(missing).toEqual([])
  })

  it('databases ไม่ถูกนับเป็น collection — มันคือ path รากของ Firestore', () => {
    expect(rules).toContain('match /databases/{database}/documents')
    expect(ruledCollections().has('databases')).toBe(false)
  })
})
