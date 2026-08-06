import { describe, it, expect } from 'vitest'
import {
  HOOK_CATEGORIES, HOOK_CATEGORY_LABEL, normHookCategory, cleanHookText, matchesHook, sortHooks, MAX_HOOK_LEN,
} from './hooks.js'

describe('normHookCategory', () => {
  it('หมวดที่ถูกต้องคงเดิม', () => {
    for (const c of HOOK_CATEGORIES) expect(normHookCategory(c.key)).toBe(c.key)
  })
  it('หมวดที่ไม่รู้จัก/ว่าง ตกมาที่หมวดแรก ไม่ใช่ค่าว่างที่หลุดจากทุกตัวกรอง', () => {
    expect(normHookCategory(undefined)).toBe('question')
    expect(normHookCategory('')).toBe('question')
    expect(normHookCategory('zzz')).toBe('question')
  })
})

describe('cleanHookText', () => {
  it('ยุบช่องว่างซ้ำและตัดหัวท้าย', () => {
    expect(cleanHookText('  รู้ไหมว่า   คนไทย 70%  ')).toBe('รู้ไหมว่า คนไทย 70%')
  })
  it('ขึ้นบรรทัดใหม่กลายเป็นช่องว่างเดียว — hook คือประโยคเปิด ไม่ใช่แคปชันหลายย่อหน้า', () => {
    expect(cleanHookText('บรรทัดหนึ่ง\n\nบรรทัดสอง')).toBe('บรรทัดหนึ่ง บรรทัดสอง')
  })
  it('ตัดที่ความยาวสูงสุด', () => {
    expect(cleanHookText('ก'.repeat(500))).toHaveLength(MAX_HOOK_LEN)
  })
  it('ค่าว่าง/null ได้สตริงว่าง ไม่โยน error', () => {
    expect(cleanHookText(null)).toBe('')
    expect(cleanHookText(undefined)).toBe('')
  })
})

describe('matchesHook', () => {
  const h = { text: 'รู้ไหมว่าคนไทย 70% ยังไม่เคยบริจาค', category: 'number', note: 'ใช้กับแคมเปญปลายปี' }
  it('คำค้นว่าง = ผ่านทุกอัน', () => {
    expect(matchesHook(h, '')).toBe(true)
    expect(matchesHook(h, '   ')).toBe(true)
  })
  it('ค้นจากเนื้อ hook ได้', () => {
    expect(matchesHook(h, 'คนไทย')).toBe(true)
  })
  it('ค้นจากชื่อหมวดได้ (ผู้ใช้เห็นชื่อหมวด ไม่เห็น key)', () => {
    expect(matchesHook(h, 'ตัวเลข')).toBe(true)
  })
  it('ค้นจากโน้ตได้', () => {
    expect(matchesHook(h, 'ปลายปี')).toBe(true)
  })
  it('ไม่ตรงก็คือไม่ตรง', () => {
    expect(matchesHook(h, 'กุรบาน')).toBe(false)
  })
  it('ไม่สนตัวพิมพ์ใหญ่เล็กและช่องว่างเกิน', () => {
    const e = { text: 'Free Palestine', category: 'news' }
    expect(matchesHook(e, '  free   palestine ')).toBe(true)
  })
  it('hook ที่ข้อมูลไม่ครบไม่ทำให้พัง', () => {
    expect(() => matchesHook({}, 'อะไร')).not.toThrow()
    expect(() => matchesHook(null, 'อะไร')).not.toThrow()
  })
})

describe('sortHooks', () => {
  it('ที่ใช้บ่อยกว่าอยู่บน', () => {
    const r = sortHooks([{ text: 'ข', useCount: 1 }, { text: 'ก', useCount: 9 }])
    expect(r.map((h) => h.text)).toEqual(['ก', 'ข'])
  })
  it('ใช้เท่ากันเรียงตามตัวอักษรไทย', () => {
    const r = sortHooks([{ text: 'ข', useCount: 2 }, { text: 'ก', useCount: 2 }])
    expect(r.map((h) => h.text)).toEqual(['ก', 'ข'])
  })
  it('ไม่มี useCount ถือเป็น 0 ไม่ใช่ NaN ที่ทำให้ลำดับมั่ว', () => {
    const r = sortHooks([{ text: 'ยังไม่เคยใช้' }, { text: 'เคยใช้', useCount: 3 }])
    expect(r[0].text).toBe('เคยใช้')
  })
  it('ไม่แก้ array ต้นฉบับ', () => {
    const src = [{ text: 'ข', useCount: 1 }, { text: 'ก', useCount: 9 }]
    sortHooks(src)
    expect(src[0].text).toBe('ข')
  })
  it('ลิสต์ว่าง/undefined ไม่โยน error', () => {
    expect(sortHooks(undefined)).toEqual([])
  })
})

describe('ความครบถ้วนของหมวด', () => {
  it('ทุกหมวดมี label และ hint', () => {
    for (const c of HOOK_CATEGORIES) {
      expect(c.label?.trim()).toBeTruthy()
      expect(c.hint?.trim()).toBeTruthy()
    }
  })
  it('key ไม่ซ้ำ', () => {
    expect(new Set(HOOK_CATEGORIES.map((c) => c.key)).size).toBe(HOOK_CATEGORIES.length)
  })
})
