// อ่าน EXIF จากไฟล์รูปในเบราว์เซอร์แบบไม่ต้องพึ่งไลบรารีนอก (bundle ไม่โต)
// ใช้กับหน้า /admin/photo-frame — ดึงพิกัด GPS ที่กล้อง/มือถือฝังมากับไฟล์ตอนถ่าย
//
// ฟอร์แมตที่รองรับ — ทั้งหมดจบลงที่ TIFF block เดียวกัน ต่างกันแค่ "หาให้เจอว่าอยู่ตรงไหน":
//   JPEG              → มาร์กเกอร์ APP1 ที่ขึ้นต้นด้วย "Exif\0\0"
//   HEIC/HEIF/AVIF    → กล่อง ISOBMFF — EXIF เก็บเป็น item แยก หาโดยไล่หา "Exif\0\0" ในไฟล์
//   CR3 (Canon)       → ISOBMFF เหมือนกัน แต่ EXIF อยู่ในกล่อง CMT1 ไม่มีหัว "Exif\0\0" นำ
//   RAW แบบ TIFF      → DNG/CR2/NEF/ARW/RW2 — ตัวไฟล์เป็น TIFF อยู่แล้ว TIFF block เริ่มที่ byte 0
//
// ไฟล์ที่ไม่มี EXIF (เช่น PNG/WebP หรือรูปที่ผ่านแอปแชทมาแล้วโดนลบ metadata) คืน gps: null
// เฉยๆ ไม่ถือเป็น error

// ขนาดข้อมูลต่อ 1 หน่วย ตามชนิดของ EXIF tag (1=BYTE 2=ASCII 3=SHORT 4=LONG 5=RATIONAL ...)
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 }

const TAG_ORIENTATION = 0x0112
const TAG_EXIF_IFD = 0x8769
const TAG_GPS_IFD = 0x8825
const TAG_DATETIME_ORIGINAL = 0x9003
const TAG_DATETIME = 0x0132

// EXIF อยู่ต้นไฟล์เกือบเสมอ — อ่านแค่ส่วนหัวพอ ไม่ต้องโหลดรูปทั้งไฟล์เข้าหน่วยความจำ
// (RAW ไฟล์ละ 25–60MB ถ้าอ่านทั้งไฟล์ทุกใบตอนเลือกรูปหลายสิบใบ แท็บจะบวมทันที)
// ถ้ารอบแรกไม่เจอค่อยขยายเป็นรอบสอง — HEIC บางตัววาง EXIF ไว้ใน mdat ที่อยู่ค่อนไปทางท้ายไฟล์
const HEAD_BYTES = 3 * 1024 * 1024
const HEAD_BYTES_RETRY = 24 * 1024 * 1024

// ── ตัวช่วยอ่าน TIFF/IFD ────────────────────────────────────────────────

// อ่านค่าของ 1 entry ใน IFD — คืน string (ASCII) หรือ array ของตัวเลข
function readEntryValue(view, tiffStart, entryOff, little) {
  const type = view.getUint16(entryOff + 2, little)
  const count = view.getUint32(entryOff + 4, little)
  const unit = TYPE_SIZE[type]
  if (!unit || count === 0 || count > 100000) return null
  const total = unit * count
  // ค่าไม่เกิน 4 ไบต์ฝังอยู่ในช่อง value เลย ถ้าเกินนั้นช่องนี้จะเป็น offset ชี้ไปที่อื่นแทน
  const dataOff = total > 4 ? tiffStart + view.getUint32(entryOff + 8, little) : entryOff + 8
  if (dataOff < 0 || dataOff + total > view.byteLength) return null

  if (type === 2) {
    let s = ''
    for (let i = 0; i < count; i++) {
      const c = view.getUint8(dataOff + i)
      if (c === 0) break
      s += String.fromCharCode(c)
    }
    return s
  }

  const out = []
  for (let i = 0; i < count; i++) {
    const o = dataOff + i * unit
    if (type === 1 || type === 7) out.push(view.getUint8(o))
    else if (type === 6) out.push(view.getInt8(o))
    else if (type === 3) out.push(view.getUint16(o, little))
    else if (type === 8) out.push(view.getInt16(o, little))
    else if (type === 4 || type === 11) out.push(view.getUint32(o, little))
    else if (type === 9) out.push(view.getInt32(o, little))
    else if (type === 5) { const n = view.getUint32(o, little), d = view.getUint32(o + 4, little); out.push(d ? n / d : 0) }
    else if (type === 10) { const n = view.getInt32(o, little), d = view.getInt32(o + 4, little); out.push(d ? n / d : 0) }
    else return null
  }
  return out
}

// อ่าน IFD ทั้งบล็อก → { tags: { [tag]: value }, nextIfd }
export function readIfd(view, tiffStart, ifdOff, little) {
  const tags = {}
  if (ifdOff < 0 || ifdOff + 2 > view.byteLength) return { tags, nextIfd: 0 }
  const n = view.getUint16(ifdOff, little)
  if (n > 512) return { tags, nextIfd: 0 } // จำนวน entry เกินจริง = ไฟล์เพี้ยน
  for (let i = 0; i < n; i++) {
    const e = ifdOff + 2 + i * 12
    if (e + 12 > view.byteLength) break
    tags[view.getUint16(e, little)] = readEntryValue(view, tiffStart, e, little)
  }
  const nextOff = ifdOff + 2 + n * 12
  const nextIfd = nextOff + 4 <= view.byteLength ? view.getUint32(nextOff, little) : 0
  return { tags, nextIfd }
}

// เช็คว่าตำแหน่งนี้เป็นหัว TIFF จริงไหม ("II" + 42 หรือ "MM" + 42)
export function isTiffHeader(view, off) {
  if (off < 0 || off + 8 > view.byteLength) return false
  const bom = view.getUint16(off)
  if (bom !== 0x4949 && bom !== 0x4D4D) return false
  return view.getUint16(off + 2, bom === 0x4949) === 0x002A
}

export const isLittleEndianTiff = (view, tiffStart) => view.getUint16(tiffStart) === 0x4949

// ── หาว่า TIFF block เริ่มตรงไหน แยกตามฟอร์แมตไฟล์ ──────────────────────

// ค้นหาลำดับไบต์ (ใช้หา "Exif\0\0" / "CMT1" ในไฟล์ ISOBMFF)
function indexOfBytes(view, pattern, from) {
  const end = view.byteLength - pattern.length
  outer:
  for (let i = from; i <= end; i++) {
    for (let j = 0; j < pattern.length; j++) if (view.getUint8(i + j) !== pattern[j]) continue outer
    return i
  }
  return -1
}

const EXIF_MAGIC = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00] // "Exif\0\0"
const CMT1_MAGIC = [0x43, 0x4D, 0x54, 0x31]             // "CMT1" (กล่อง EXIF ของ Canon CR3)

// JPEG — ไล่มาร์กเกอร์ตามสเปกจนเจอ APP1
function findTiffStartJpeg(view) {
  let off = 2
  while (off + 4 <= view.byteLength) {
    const marker = view.getUint16(off)
    if ((marker & 0xFF00) !== 0xFF00) return -1 // โครงสร้างเพี้ยน
    if (marker === 0xFFDA || marker === 0xFFD9) return -1 // ถึงข้อมูลภาพแล้ว = ไม่มี EXIF
    const size = view.getUint16(off + 2)
    if (size < 2) return -1 // กัน loop ไม่รู้จบเมื่อไฟล์เสีย
    if (marker === 0xFFE1 && off + 12 <= view.byteLength
      && view.getUint32(off + 4) === 0x45786966 && view.getUint16(off + 8) === 0) {
      return off + 10
    }
    off += 2 + size
  }
  return -1
}

// ISOBMFF (HEIC/HEIF/AVIF/CR3) — ไล่กล่อง iloc/iinf ให้ถูกสเปกต้องเขียนอีกหลายสิบบรรทัดและมี
// เคสแตกต่างตามเวอร์ชันกล่อง เลยใช้วิธีค้นหา magic แล้ว "ยืนยันด้วยหัว TIFF" แทน — ถ้าไบต์ถัดไป
// ไม่ใช่หัว TIFF ที่ถูกต้องก็ค้นต่อ จึงไม่หลุดไปอ่านขยะ (ตัว parser ตรวจ bounds ทุกจุดอยู่แล้ว)
function findTiffStartIsoBmff(view) {
  for (let i = indexOfBytes(view, EXIF_MAGIC, 0); i >= 0; i = indexOfBytes(view, EXIF_MAGIC, i + 1)) {
    if (isTiffHeader(view, i + EXIF_MAGIC.length)) return i + EXIF_MAGIC.length
  }
  for (let i = indexOfBytes(view, CMT1_MAGIC, 0); i >= 0; i = indexOfBytes(view, CMT1_MAGIC, i + 1)) {
    if (isTiffHeader(view, i + CMT1_MAGIC.length)) return i + CMT1_MAGIC.length
  }
  return -1
}

// แยกชนิดไฟล์จากไบต์จริง ไม่ใช่จากนามสกุล (ผู้ใช้เปลี่ยนนามสกุลเองได้)
export function detectFormat(view) {
  if (view.byteLength >= 4 && view.getUint16(0) === 0xFFD8) return 'jpeg'
  if (view.byteLength >= 12 && view.getUint32(4) === 0x66747970) return 'isobmff' // 'ftyp' — HEIC/AVIF/CR3
  if (isTiffHeader(view, 0)) return 'tiff' // DNG/CR2/NEF/ARW/RW2 และ TIFF ธรรมดา
  if (view.byteLength >= 8 && view.getUint32(0) === 0x89504E47) return 'png'
  return 'other'
}

function findTiffStart(view, format) {
  if (format === 'jpeg') return findTiffStartJpeg(view)
  if (format === 'isobmff') return findTiffStartIsoBmff(view)
  if (format === 'tiff') return 0
  return -1
}

// ── แปลงค่า ──────────────────────────────────────────────────────────────

// [องศา, ลิปดา, ฟิลิปดา] + ทิศ (N/S/E/W) → ทศนิยม
function dmsToDecimal(dms, ref) {
  if (!Array.isArray(dms) || dms.length < 2) return null
  const [d = 0, m = 0, s = 0] = dms
  const val = d + m / 60 + s / 3600
  if (!Number.isFinite(val)) return null
  const negative = typeof ref === 'string' && /^[SW]/i.test(ref.trim())
  return negative ? -val : val
}

// "2026:08:21 14:03:52" (รูปแบบของ EXIF) → epoch ms — ตีความเป็นเวลาท้องถิ่นของเครื่องที่เปิดดู
function exifDateToMs(str) {
  if (typeof str !== 'string') return null
  const m = str.trim().match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (!m) return null
  const t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime()
  return Number.isFinite(t) ? t : null
}

// อ่าน TIFF block 1 ก้อน → ข้อมูลที่หน้า admin ต้องใช้
// truncated = true แปลว่าเจอ pointer ที่ชี้เลยขอบข้อมูลที่อ่านมา (ต้องอ่านไฟล์เพิ่มแล้วลองใหม่)
function parseTiff(view, tiffStart) {
  const out = { gps: null, orientation: 1, takenAtText: '', truncated: false }
  const little = isLittleEndianTiff(view, tiffStart)
  const ifd0Off = view.getUint32(tiffStart + 4, little)
  const { tags: ifd0 } = readIfd(view, tiffStart, tiffStart + ifd0Off, little)

  if (Array.isArray(ifd0[TAG_ORIENTATION])) out.orientation = ifd0[TAG_ORIENTATION][0] || 1

  // วันเวลาที่ถ่าย — DateTimeOriginal (Exif IFD) ตรงกว่า DateTime ของ IFD0 ที่เปลี่ยนตอนแก้ไฟล์
  const exifPtr = Array.isArray(ifd0[TAG_EXIF_IFD]) ? ifd0[TAG_EXIF_IFD][0] : null
  if (exifPtr) {
    const { tags: exifIfd } = readIfd(view, tiffStart, tiffStart + exifPtr, little)
    if (typeof exifIfd[TAG_DATETIME_ORIGINAL] === 'string') out.takenAtText = exifIfd[TAG_DATETIME_ORIGINAL]
  }
  if (!out.takenAtText && typeof ifd0[TAG_DATETIME] === 'string') out.takenAtText = ifd0[TAG_DATETIME]

  const gpsPtr = Array.isArray(ifd0[TAG_GPS_IFD]) ? ifd0[TAG_GPS_IFD][0] : null
  if (!gpsPtr) return out
  // GPS IFD ของไฟล์ RAW บางรุ่นอยู่ไกลจากหัวไฟล์ — ถ้าเลยขอบข้อมูลที่อ่านมา บอกให้อ่านเพิ่ม
  if (tiffStart + gpsPtr + 2 > view.byteLength) { out.truncated = true; return out }

  const { tags: g } = readIfd(view, tiffStart, tiffStart + gpsPtr, little)
  const lat = dmsToDecimal(g[0x0002], g[0x0001])
  const lng = dmsToDecimal(g[0x0004], g[0x0003])
  if (lat === null || lng === null) {
    // มี GPS IFD แต่อ่านค่าไม่ได้ อาจเพราะค่า rational ถูกวางไว้นอกช่วงที่อ่านมา
    if (g[0x0002] === null || g[0x0004] === null) out.truncated = true
    return out
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return out

  let altitude = Array.isArray(g[0x0006]) ? g[0x0006][0] : null
  if (altitude !== null && Array.isArray(g[0x0005]) && g[0x0005][0] === 1) altitude = -altitude // ref 1 = ต่ำกว่าระดับน้ำทะเล
  out.gps = {
    lat: Math.round(lat * 1e7) / 1e7,
    lng: Math.round(lng * 1e7) / 1e7,
    altitude: Number.isFinite(altitude) ? Math.round(altitude * 100) / 100 : null,
  }
  return out
}

/**
 * อ่าน EXIF ของไฟล์รูป 1 ไฟล์ (JPEG / HEIC / RAW)
 * คืนเสมอ ไม่ throw: { gps, orientation, takenAt, takenAtText, format }
 *   gps    = { lat, lng, altitude } | null   — altitude เป็นเมตร (null ถ้าไม่มี)
 *   format = 'jpeg' | 'isobmff' | 'tiff' | 'png' | 'other'
 */
export async function readExif(file) {
  const empty = { gps: null, orientation: 1, takenAt: null, takenAtText: '', format: 'other' }
  try {
    let readBytes = Math.min(file.size, HEAD_BYTES)
    let result = null
    let format = 'other'

    // อ่านหัวไฟล์ก่อน ถ้าเจอ pointer ที่ชี้เลยขอบ (RAW/HEIC ไฟล์ใหญ่) ค่อยอ่านเพิ่มอีกรอบเดียว
    for (let attempt = 0; attempt < 2; attempt++) {
      const view = new DataView(await file.slice(0, readBytes).arrayBuffer())
      format = detectFormat(view)
      const tiffStart = findTiffStart(view, format)
      if (tiffStart < 0 || !isTiffHeader(view, tiffStart)) {
        // ยังไม่เจอ EXIF — ถ้ายังอ่านไฟล์ไม่หมดและไฟล์เป็นชนิดที่ EXIF อาจอยู่ลึก ลองอ่านเพิ่ม
        if (attempt === 0 && readBytes < file.size && (format === 'isobmff' || format === 'tiff')) {
          readBytes = Math.min(file.size, HEAD_BYTES_RETRY)
          continue
        }
        return { ...empty, format }
      }
      result = parseTiff(view, tiffStart)
      if (!result.truncated || attempt === 1 || readBytes >= file.size) break
      readBytes = Math.min(file.size, HEAD_BYTES_RETRY)
    }

    if (!result) return { ...empty, format }
    return {
      gps: result.gps,
      orientation: result.orientation,
      takenAt: exifDateToMs(result.takenAtText),
      takenAtText: result.takenAtText,
      format,
    }
  } catch {
    return empty // ไฟล์อ่านไม่ได้/ฟอร์แมตแปลก — ไม่ให้ทั้งหน้าพัง แค่ถือว่าไม่มี EXIF
  }
}

// ลิงก์เปิด Google Maps จากพิกัด — ใช้ในตารางผลลัพธ์
export const mapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`

// แสดงพิกัดแบบสั้นอ่านง่าย เช่น "13.736717, 100.523186"
export const formatLatLng = (lat, lng) =>
  (Number.isFinite(lat) && Number.isFinite(lng)) ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : ''

// ขอพิกัดจากเบราว์เซอร์ (ใช้ตอนรูปไม่มี EXIF GPS — เช่นรูปที่ผ่านแอปแชทมาแล้วโดนลบ metadata)
export function getCurrentPosition(timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง')); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: Math.round(pos.coords.latitude * 1e7) / 1e7,
        lng: Math.round(pos.coords.longitude * 1e7) / 1e7,
        altitude: Number.isFinite(pos.coords.altitude) ? Math.round(pos.coords.altitude * 100) / 100 : null,
      }),
      (err) => reject(new Error(err.code === 1 ? 'ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง' : 'หาตำแหน่งไม่สำเร็จ')),
      { enableHighAccuracy: true, timeout, maximumAge: 60000 }
    )
  })
}
