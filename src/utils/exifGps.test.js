import { describe, it, expect } from 'vitest'
import { readExif, formatLatLng } from './exifGps.js'

// สร้างไฟล์ JPEG จำลองที่มี EXIF (IFD0 + Exif IFD + GPS IFD) แบบ little-endian
// ไว้ทดสอบตัวอ่าน EXIF โดยไม่ต้องพึ่งรูปถ่ายจริงในรีโป
function buildExifTiff({ lat = [13, 44, 12.18], latRef = 'N', lng = [100, 31, 23.47], lngRef = 'E', alt = 12.5, altRef = 0, orientation = 6, taken = '2026:08:21 14:03:52' } = {}) {
  const tiff = new DataView(new ArrayBuffer(222))
  const u8 = new Uint8Array(tiff.buffer)
  const ascii = (off, s, len) => { for (let i = 0; i < len; i++) u8[off + i] = i < s.length ? s.charCodeAt(i) : 0 }
  const rational = (off, v) => { tiff.setUint32(off, Math.round(v * 10000), true); tiff.setUint32(off + 4, 10000, true) }
  const entry = (off, tag, type, count, writeValue) => {
    tiff.setUint16(off, tag, true); tiff.setUint16(off + 2, type, true); tiff.setUint32(off + 4, count, true); writeValue(off + 8)
  }

  const EXIF_IFD = 50, DT_STR = 68, GPS_IFD = 88, LAT_DATA = 166, LNG_DATA = 190, ALT_DATA = 214

  ascii(0, 'II', 2)
  tiff.setUint16(2, 0x002A, true)
  tiff.setUint32(4, 8, true)          // offset ของ IFD0

  tiff.setUint16(8, 3, true)          // IFD0 มี 3 entry
  entry(10, 0x0112, 3, 1, (o) => tiff.setUint16(o, orientation, true))
  entry(22, 0x8769, 4, 1, (o) => tiff.setUint32(o, EXIF_IFD, true))
  entry(34, 0x8825, 4, 1, (o) => tiff.setUint32(o, GPS_IFD, true))
  tiff.setUint32(46, 0, true)         // ไม่มี IFD1

  tiff.setUint16(EXIF_IFD, 1, true)
  entry(EXIF_IFD + 2, 0x9003, 2, 20, (o) => tiff.setUint32(o, DT_STR, true))
  tiff.setUint32(EXIF_IFD + 14, 0, true)
  ascii(DT_STR, taken, 20)

  tiff.setUint16(GPS_IFD, 6, true)
  entry(GPS_IFD + 2, 0x0001, 2, 2, (o) => ascii(o, latRef, 2))
  entry(GPS_IFD + 14, 0x0002, 5, 3, (o) => tiff.setUint32(o, LAT_DATA, true))
  entry(GPS_IFD + 26, 0x0003, 2, 2, (o) => ascii(o, lngRef, 2))
  entry(GPS_IFD + 38, 0x0004, 5, 3, (o) => tiff.setUint32(o, LNG_DATA, true))
  entry(GPS_IFD + 50, 0x0005, 1, 1, (o) => u8.set([altRef], o))
  entry(GPS_IFD + 62, 0x0006, 5, 1, (o) => tiff.setUint32(o, ALT_DATA, true))
  tiff.setUint32(GPS_IFD + 74, 0, true)
  lat.forEach((v, i) => rational(LAT_DATA + i * 8, v))
  lng.forEach((v, i) => rational(LNG_DATA + i * 8, v))
  rational(ALT_DATA, alt)

  return u8
}

// ห่อ TIFF block เป็นไฟล์แต่ละฟอร์แมต — ทั้ง 3 แบบต้องอ่านพิกัดได้เหมือนกัน
function buildJpegWithExif(opts) {
  const u8 = buildExifTiff(opts)
  const app1Len = 2 + 6 + u8.length
  const head = new Uint8Array(4 + 2 + 6)
  head.set([0xFF, 0xD8, 0xFF, 0xE1, app1Len >> 8, app1Len & 0xFF])
  head.set([0x45, 0x78, 0x69, 0x66, 0, 0], 6) // "Exif\0\0"
  return new Blob([head, u8, new Uint8Array([0xFF, 0xD9])], { type: 'image/jpeg' })
}

// HEIC: กล่อง ftyp + meta แล้ว EXIF item วางไว้ในกล่อง mdat (แบบเดียวกับไฟล์จริงจาก iPhone)
function buildHeicWithExif(opts, { padding = 0, magic = 'Exif' } = {}) {
  const u8 = buildExifTiff(opts)
  const box = (type, payload) => {
    const b = new Uint8Array(8 + payload.length)
    new DataView(b.buffer).setUint32(0, b.length)
    for (let i = 0; i < 4; i++) b[4 + i] = type.charCodeAt(i)
    b.set(payload, 8)
    return b
  }
  const ftyp = box('ftyp', new Uint8Array([...'heic'].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0])))
  const filler = box('free', new Uint8Array(padding))
  const head = magic === 'Exif' ? [0x45, 0x78, 0x69, 0x66, 0, 0] : [0x43, 0x4D, 0x54, 0x31] // "Exif\0\0" หรือ "CMT1" (CR3)
  const mdat = box('mdat', new Uint8Array([...head, ...u8]))
  return new Blob([ftyp, filler, mdat], { type: 'image/heic' })
}

// RAW แบบ TIFF (DNG/CR2/NEF/ARW): ตัวไฟล์เป็น TIFF ตรงๆ ไม่มีอะไรห่อ
function buildRawWithExif(opts) {
  return new Blob([buildExifTiff(opts)], { type: 'image/x-adobe-dng' })
}

describe('readExif', () => {
  it('อ่านพิกัด GPS ซีกโลกเหนือ/ตะวันออกได้ถูกต้อง', async () => {
    const { gps } = await readExif(buildJpegWithExif())
    expect(gps.lat).toBeCloseTo(13 + 44 / 60 + 12.18 / 3600, 5)
    expect(gps.lng).toBeCloseTo(100 + 31 / 60 + 23.47 / 3600, 5)
    expect(gps.altitude).toBeCloseTo(12.5, 2)
  })

  it('ทิศ S/W ต้องได้ค่าติดลบ', async () => {
    const { gps } = await readExif(buildJpegWithExif({ latRef: 'S', lngRef: 'W' }))
    expect(gps.lat).toBeLessThan(0)
    expect(gps.lng).toBeLessThan(0)
  })

  it('ความสูงต่ำกว่าระดับน้ำทะเล (altRef=1) ต้องติดลบ', async () => {
    const { gps } = await readExif(buildJpegWithExif({ altRef: 1 }))
    expect(gps.altitude).toBeCloseTo(-12.5, 2)
  })

  it('อ่าน orientation และวันเวลาที่ถ่ายได้', async () => {
    const { orientation, takenAt, takenAtText } = await readExif(buildJpegWithExif())
    expect(orientation).toBe(6)
    expect(takenAtText).toBe('2026:08:21 14:03:52')
    expect(new Date(takenAt).getFullYear()).toBe(2026)
  })

  it('ไฟล์ที่ไม่มี EXIF คืน gps เป็น null โดยไม่ throw', async () => {
    const plain = new Blob([new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9])], { type: 'image/jpeg' })
    expect((await readExif(plain)).gps).toBeNull()
    expect((await readExif(new Blob([new Uint8Array([1, 2, 3, 4])]))).gps).toBeNull()
  })

  it('พิกัด 0,0 (กล้องไม่ได้ล็อกดาวเทียม) ไม่นับว่ามี GPS', async () => {
    const { gps } = await readExif(buildJpegWithExif({ lat: [0, 0, 0], lng: [0, 0, 0] }))
    expect(gps).toBeNull()
  })
})

describe('readExif — HEIC / RAW', () => {
  it('อ่านพิกัดจากไฟล์ HEIC (กล่อง ISOBMFF) ได้', async () => {
    const { gps, format, takenAtText } = await readExif(buildHeicWithExif())
    expect(format).toBe('isobmff')
    expect(gps.lat).toBeCloseTo(13 + 44 / 60 + 12.18 / 3600, 5)
    expect(gps.lng).toBeCloseTo(100 + 31 / 60 + 23.47 / 3600, 5)
    expect(takenAtText).toBe('2026:08:21 14:03:52')
  })

  it('อ่านพิกัดจาก CR3 ที่ EXIF อยู่ในกล่อง CMT1 (ไม่มีหัว Exif นำ) ได้', async () => {
    const { gps } = await readExif(buildHeicWithExif({}, { magic: 'CMT1' }))
    expect(gps).not.toBeNull()
    expect(gps.lng).toBeCloseTo(100 + 31 / 60 + 23.47 / 3600, 5)
  })

  it('HEIC ที่ EXIF อยู่ลึกในไฟล์ (เลยช่วงที่อ่านรอบแรก) ยังอ่านได้', async () => {
    const { gps } = await readExif(buildHeicWithExif({}, { padding: 4 * 1024 * 1024 }))
    expect(gps).not.toBeNull()
    expect(gps.lat).toBeCloseTo(13 + 44 / 60 + 12.18 / 3600, 5)
  })

  it('อ่านพิกัดจากไฟล์ RAW แบบ TIFF (DNG/CR2/NEF/ARW) ได้', async () => {
    const { gps, format, orientation } = await readExif(buildRawWithExif())
    expect(format).toBe('tiff')
    expect(orientation).toBe(6)
    expect(gps.altitude).toBeCloseTo(12.5, 2)
  })

  it('ไฟล์ ISOBMFF ที่ไม่มี EXIF คืน gps null โดยไม่ throw', async () => {
    const ftyp = new Uint8Array([0, 0, 0, 12, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])
    const { gps, format } = await readExif(new Blob([ftyp], { type: 'image/heic' }))
    expect(gps).toBeNull()
    expect(format).toBe('isobmff')
  })
})

describe('formatLatLng', () => {
  it('จัดรูปแบบพิกัดเป็นทศนิยม 6 ตำแหน่ง', () => {
    expect(formatLatLng(13.7367171, 100.5231876)).toBe('13.736717, 100.523188')
    expect(formatLatLng(null, 100)).toBe('')
  })
})
