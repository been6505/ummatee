import { describe, it, expect } from 'vitest'
import { B2UM_STATUS, B2UM_STATUS_COLOR, B2UM_STATUS_ORDER, normB2umStatus } from './b2umStatus.js'

describe('normB2umStatus', () => {
  it('ใบสมัครเก่าที่ไม่มีฟิลด์ status ถือเป็นใบสมัครใหม่ ไม่ใช่ค่าว่าง', () => {
    expect(normB2umStatus(undefined)).toBe('new')
    expect(normB2umStatus(null)).toBe('new')
    expect(normB2umStatus('')).toBe('new')
  })
  it('ค่าที่ไม่รู้จัก (พิมพ์ผิด/ของเก่าคนละชุด) ตกมาเป็นใบสมัครใหม่ ไม่หลุดจากทุกตัวกรอง', () => {
    expect(normB2umStatus('zzz')).toBe('new')
  })
  it('ค่าที่ถูกต้องคงเดิม', () => {
    for (const k of B2UM_STATUS_ORDER) expect(normB2umStatus(k)).toBe(k)
  })
})

describe('ความครบถ้วนของตาราง', () => {
  it('ทุกสถานะมีทั้งป้ายชื่อและสี — ขาดสีแล้วชิปจะกลายเป็นพื้นโปร่ง อ่านไม่ออก', () => {
    for (const k of B2UM_STATUS_ORDER) {
      expect(B2UM_STATUS[k]).toBeTruthy()
      expect(B2UM_STATUS_COLOR[k]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
  it('ORDER ครอบคลุมทุก key ใน B2UM_STATUS ไม่มีสถานะไหนตกหล่นจากแถบตัวกรอง', () => {
    expect([...B2UM_STATUS_ORDER].sort()).toEqual(Object.keys(B2UM_STATUS).sort())
  })
})
