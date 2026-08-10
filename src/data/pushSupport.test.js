import { describe, it, expect } from 'vitest'
import { pushBlockedReason, buildTokenDoc, isSubscribed, UNSUPPORTED } from './pushSupport.js'

// เบราว์เซอร์ปกติที่รองรับครบและยังไม่เคยถูกถาม
const ok = {
  vapidKey: 'BKxxx', hasNotification: true, hasServiceWorker: true, hasPushManager: true,
  permission: 'default', isIOS: false, isStandalone: false,
}

describe('pushBlockedReason', () => {
  it('เบราว์เซอร์ที่พร้อม = ไม่มีอะไรขวาง', () => {
    expect(pushBlockedReason(ok)).toBeNull()
  })

  it('ยังไม่ได้ตั้ง VAPID key = ปิดสนิท ไม่ใช่โชว์ปุ่มแล้วกดไม่ได้', () => {
    // ถ้าปล่อยให้ปุ่มขึ้น ผู้ใช้จะกดแล้วเจอ error ที่เขาแก้อะไรไม่ได้เลย
    expect(pushBlockedReason({ ...ok, vapidKey: '' })).toBe(UNSUPPORTED.notConfigured)
  })

  it('VAPID key ถูกเช็คก่อนอย่างอื่น', () => {
    expect(pushBlockedReason({ ...ok, vapidKey: '', permission: 'denied' })).toBe(UNSUPPORTED.notConfigured)
  })

  it('เบราว์เซอร์ที่ไม่มี API เลย', () => {
    expect(pushBlockedReason({ ...ok, hasPushManager: false })).toBe(UNSUPPORTED.noApi)
    expect(pushBlockedReason({ ...ok, hasNotification: false })).toBe(UNSUPPORTED.noApi)
    expect(pushBlockedReason({ ...ok, hasServiceWorker: false })).toBe(UNSUPPORTED.noApi)
  })

  it('iPhone ที่ยังเปิดใน Safari ปกติ ต้องบอกให้ติดตั้งก่อน', () => {
    // iOS รองรับ web push ตั้งแต่ 16.4 แต่เฉพาะตอนเปิดจากหน้าจอโฮม
    // ถ้าตอบว่า "ไม่รองรับ" เฉย ๆ ผู้ใช้จะเลิกทั้งที่จริงทำได้
    expect(pushBlockedReason({ ...ok, isIOS: true, isStandalone: false })).toBe(UNSUPPORTED.iosNeedsInstall)
  })

  it('iPhone รุ่นเก่าที่ไม่มี PushManager ก็ยังตอบเรื่องติดตั้งก่อน (ทางที่ช่วยได้จริงกว่า)', () => {
    expect(pushBlockedReason({ ...ok, isIOS: true, isStandalone: false, hasPushManager: false }))
      .toBe(UNSUPPORTED.iosNeedsInstall)
  })

  it('iPhone ที่ติดตั้งเป็นแอปแล้ว ใช้ได้ปกติ', () => {
    expect(pushBlockedReason({ ...ok, isIOS: true, isStandalone: true })).toBeNull()
  })

  it('เคยกดปฏิเสธไว้ = ต้องไปเปิดในตั้งค่าเบราว์เซอร์ เว็บขอซ้ำไม่ได้', () => {
    expect(pushBlockedReason({ ...ok, permission: 'denied' })).toBe(UNSUPPORTED.denied)
  })

  it('เคยอนุญาตแล้ว ไม่ถือว่าถูกขวาง', () => {
    expect(pushBlockedReason({ ...ok, permission: 'granted' })).toBeNull()
  })

  it('ไม่พังเมื่อไม่ได้ส่ง env มา', () => {
    expect(pushBlockedReason(undefined)).toBe(UNSUPPORTED.notConfigured)
  })
})

describe('isSubscribed', () => {
  it('เฉพาะ granted เท่านั้นที่ถือว่าเปิดอยู่', () => {
    expect(isSubscribed('granted')).toBe(true)
    expect(isSubscribed('default')).toBe(false)
    expect(isSubscribed('denied')).toBe(false)
  })
})

describe('buildTokenDoc', () => {
  it('ใช้ token เป็น id ของ doc — กันซ้ำในตัว', () => {
    const r = buildTokenDoc({ token: 'abc123', lang: 'th', now: 5 })
    expect(r.ok).toBe(true)
    expect(r.id).toBe('abc123')
  })

  it('ไม่เก็บอะไรที่ระบุตัวบุคคลได้', () => {
    const r = buildTokenDoc({ token: 'abc', lang: 'th', now: 1 })
    expect(Object.keys(r.value).sort()).toEqual(['lang', 'updatedAt'])
  })

  it('ภาษาที่ไม่รู้จักตกมาที่ th', () => {
    expect(buildTokenDoc({ token: 'a', lang: 'zz', now: 1 }).value.lang).toBe('th')
    expect(buildTokenDoc({ token: 'a', now: 1 }).value.lang).toBe('th')
  })

  it('เก็บภาษาที่รองรับไว้ถูกต้อง', () => {
    for (const l of ['th', 'en', 'ar']) {
      expect(buildTokenDoc({ token: 'a', lang: l, now: 1 }).value.lang).toBe(l)
    }
  })

  it('token ว่างหรือยาวเกินเหตุ = ไม่ผ่าน', () => {
    expect(buildTokenDoc({ token: '', now: 1 }).ok).toBe(false)
    expect(buildTokenDoc({ token: '  ', now: 1 }).ok).toBe(false)
    expect(buildTokenDoc({ token: 'x'.repeat(5000), now: 1 }).ok).toBe(false)
  })

  it('เวลาที่ใช้ไม่ได้กลายเป็น 0 ไม่ใช่ NaN ที่ทำให้ rules ปฏิเสธทั้ง doc', () => {
    expect(buildTokenDoc({ token: 'a', now: undefined }).value.updatedAt).toBe(0)
  })
})
