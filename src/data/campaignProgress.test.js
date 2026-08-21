import { describe, it, expect } from 'vitest'
import { campaignProgress } from './campaignProgress.js'

describe('campaignProgress', () => {
  it('คิดเปอร์เซ็นต์จากยอดปัจจุบันเทียบเป้า', () => {
    expect(campaignProgress({ goalAmount: 200000, currentAmount: 50000 }).pct).toBe(25)
  })

  it('ยังไม่ตั้งเป้า = ไม่ต้องโชว์แถบความคืบหน้า (hasGoal เป็น false ไม่ใช่หาร 0)', () => {
    const r = campaignProgress({ currentAmount: 5000 })
    expect(r.hasGoal).toBe(false)
    expect(r.pct).toBe(0)
    expect(Number.isNaN(r.pct)).toBe(false)
  })

  it('เป้าเป็น 0 หรือติดลบก็ไม่หาร (กัน Infinity ที่ทำให้แถบยาวทะลุจอ)', () => {
    expect(campaignProgress({ goalAmount: 0, currentAmount: 100 }).hasGoal).toBe(false)
    expect(campaignProgress({ goalAmount: -5, currentAmount: 100 }).hasGoal).toBe(false)
  })

  it('ได้เกินเป้า: แถบตันที่ 100 แต่ยังบอกตัวเลขจริงไว้ใน rawPct', () => {
    const r = campaignProgress({ goalAmount: 100, currentAmount: 250 })
    expect(r.pct).toBe(100)
    expect(r.rawPct).toBe(250)
  })

  it('ค่าที่เป็นข้อความ (มาจาก input) ยังคำนวณได้ ไม่กลายเป็น NaN', () => {
    expect(campaignProgress({ goalAmount: '1000', currentAmount: '500' }).pct).toBe(50)
  })

  it('ข้อมูลหาย/เป็น null ไม่โยน error', () => {
    expect(() => campaignProgress(null)).not.toThrow()
    expect(campaignProgress(null).hasGoal).toBe(false)
    expect(campaignProgress({}).current).toBe(0)
  })
})
