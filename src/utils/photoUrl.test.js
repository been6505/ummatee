import { describe, it, expect } from 'vitest'
import { isUploadedPhotoUrl, cleanPhotoList, toPhotoUrl } from './photoUrl.js'
import { optImg } from './cloudinaryUrl.js'

// เทสต์ชุดนี้ตั้งใจใช้ URL "แบบที่แอปสร้างขึ้นจริง" ไม่ใช่ URL สมมติที่สะอาดเกินจริง
// ของเดิมเทสต์ด้วย .../upload/v1/a.jpg ซึ่งไม่มี transformation เลย จึงผ่านหมดทุกข้อ
// ทั้งที่รูปจริงทุกใบมี "f_auto,q_auto" ติดมา และถูกปฏิเสธเพราะ regex ไม่ยอมรับจุลภาค
const CLOUD = 'https://res.cloudinary.com/dei5jktuw/image/upload'
const RAW = `${CLOUD}/v1712/sample.jpg`
const FROM_UPLOAD = `${CLOUD}/f_auto,q_auto/v1712/sample.jpg` // ตรงกับที่ uploadToCloudinary คืนมา
const FROM_OPTIMG = optImg(RAW, 600) // ตรงกับที่ใส่ใน <img src>

describe('isUploadedPhotoUrl กับ URL ที่แอปสร้างจริง', () => {
  it('ผ่านทั้ง URL ดิบ, URL จากการอัปโหลด และ URL หลังย่อขนาด', () => {
    for (const u of [RAW, FROM_UPLOAD, FROM_OPTIMG]) {
      expect(isUploadedPhotoUrl(u), u).toBe(true)
    }
  })

  it('URL หลัง optImg มีจุลภาคจริง — กันไม่ให้ fixture หลุดกลับไปเป็นแบบสะอาดเกินจริง', () => {
    expect(FROM_OPTIMG).toContain(',')
    expect(FROM_UPLOAD).toContain('f_auto,q_auto')
  })

  it('ยอมให้มี query string ต่อท้าย', () => {
    expect(isUploadedPhotoUrl(`${RAW}?_a=BAMClq`)).toBe(true)
  })
})

describe('isUploadedPhotoUrl ยังกันของแปลกปลอมได้เหมือนเดิม', () => {
  it('ปฏิเสธโดเมนอื่น', () => {
    expect(isUploadedPhotoUrl('https://evil.example.com/x.jpg')).toBe(false)
    expect(isUploadedPhotoUrl('https://res.cloudinary.com.evil.com/x.jpg')).toBe(false)
  })
  it('ปฏิเสธ http ธรรมดา และ javascript:', () => {
    expect(isUploadedPhotoUrl('http://res.cloudinary.com/x.jpg')).toBe(false)
    expect(isUploadedPhotoUrl('javascript:alert(1)')).toBe(false)
  })
  it('ปฏิเสธค่าว่าง/ค่าที่ไม่ใช่สตริง', () => {
    expect(isUploadedPhotoUrl('')).toBe(false)
    expect(isUploadedPhotoUrl(null)).toBe(false)
    expect(isUploadedPhotoUrl({ url: RAW })).toBe(false)
  })
})

describe('toPhotoUrl', () => {
  it('ดึง .url ออกจากผลลัพธ์ของ uploadToCloudinary', () => {
    // ถ้าไม่ดึง จะได้ "[object Object]" ทั้งตอนพรีวิวและตอนบันทึก แล้วรูปหายเงียบ ๆ
    expect(toPhotoUrl({ url: FROM_UPLOAD, type: 'image', publicId: 'x' })).toBe(FROM_UPLOAD)
  })
  it('สตริงส่งผ่านตามเดิม', () => {
    expect(toPhotoUrl(RAW)).toBe(RAW)
  })
  it('ค่าที่ใช้ไม่ได้คืนค่าว่าง เพื่อให้ filter(Boolean) ตัดทิ้งได้', () => {
    expect(toPhotoUrl(undefined)).toBe('')
    expect(toPhotoUrl({})).toBe('')
  })
})

describe('เส้นทางจริงตั้งแต่อัปโหลดถึงบันทึก', () => {
  it('ผลจาก uploadToCloudinary ผ่าน toPhotoUrl แล้วรอดตัวกรอง', () => {
    const uploaded = [{ url: FROM_UPLOAD, type: 'image', publicId: 'a' }]
    const urls = uploaded.map(toPhotoUrl).filter(Boolean)
    expect(cleanPhotoList(urls, 4)).toEqual([FROM_UPLOAD])
  })

  it('ถ้าเผลอเก็บทั้ง object ต้องถูกตัดทิ้ง (พฤติกรรมเดิมที่ทำให้รูปหาย)', () => {
    expect(cleanPhotoList([{ url: FROM_UPLOAD }], 4)).toEqual([])
  })

  it('จำกัดจำนวนตาม max', () => {
    expect(cleanPhotoList(Array.from({ length: 9 }, () => RAW), 4)).toHaveLength(4)
  })
})
