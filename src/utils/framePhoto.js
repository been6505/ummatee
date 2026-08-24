// ประกอบภาพซ้อนเลเยอร์แล้วส่งออกเป็น JPG จัตุรัส 1:1 (ใช้ที่ /admin/photo-frame)
//
//   เลเยอร์ล่าง = รูปถ่าย (ครอปกลางให้เต็มจัตุรัส หรือย่อทั้งรูปแล้วเติมพื้นหลัง)
//   เลเยอร์บน  = กรอบ cover PNG (โปร่งใส) วางทับเต็มผืน
//
// ทำงานฝั่งเบราว์เซอร์ล้วนด้วย canvas — ไม่มีการอัปโหลดไฟล์ต้นฉบับไปที่ไหนระหว่างประกอบภาพ
import { detectFormat, isTiffHeader, isLittleEndianTiff, readIfd } from './exifGps.js'

const HEAD_BYTES = 3 * 1024 * 1024
const SCAN_LIMIT = 96 * 1024 * 1024 // ไฟล์ใหญ่กว่านี้ไม่สแกนทั้งไฟล์หา preview (กินแรมเกินไป)

// ── หา JPEG ที่กล้องฝังมาในไฟล์ RAW ────────────────────────────────────
// ไฟล์ RAW ทุกยี่ห้อฝัง "รูป JPEG พร้อมดู" ไว้ข้างในเสมอ (ที่กล้องเอาไว้โชว์บนจอหลังถ่าย)
// ส่วนใหญ่เป็นความละเอียดเต็ม — เอามาใช้แทนการถอดรหัสข้อมูล RAW จริง (ซึ่งต้องใช้ไลบรารีหนักมาก)

// tag ที่ชี้ตำแหน่ง JPEG ในโครงสร้าง TIFF ของไฟล์ RAW
const TAG_JPEG_OFFSET = 0x0201       // JPEGInterchangeFormat
const TAG_JPEG_LENGTH = 0x0202       // JPEGInterchangeFormatLength
const TAG_COMPRESSION = 0x0103
const TAG_STRIP_OFFSETS = 0x0111
const TAG_STRIP_BYTES = 0x0117
const TAG_SUB_IFDS = 0x014A

// ไล่ IFD ทุกชั้น (IFD chain + SubIFDs) เก็บ JPEG ที่เจอ แล้วเลือกอันใหญ่สุด = ละเอียดสุด
function findEmbeddedJpegInTiff(view) {
  const little = isLittleEndianTiff(view, 0)
  const found = []
  const seen = new Set()

  const visit = (off, depth) => {
    if (!off || off < 8 || seen.has(off) || seen.size > 40 || depth > 3) return
    seen.add(off)
    const { tags, nextIfd } = readIfd(view, 0, off, little)

    const jOff = Array.isArray(tags[TAG_JPEG_OFFSET]) ? tags[TAG_JPEG_OFFSET][0] : null
    const jLen = Array.isArray(tags[TAG_JPEG_LENGTH]) ? tags[TAG_JPEG_LENGTH][0] : null
    if (jOff && jLen) found.push({ offset: jOff, length: jLen })

    // บาง IFD (เช่นของ CR2) เก็บ JPEG เป็น strip เดียวโดยตั้ง Compression = 6/7 (JPEG)
    const comp = Array.isArray(tags[TAG_COMPRESSION]) ? tags[TAG_COMPRESSION][0] : null
    const so = tags[TAG_STRIP_OFFSETS]
    const sc = tags[TAG_STRIP_BYTES]
    if ((comp === 6 || comp === 7) && Array.isArray(so) && Array.isArray(sc) && so.length === 1 && sc.length === 1) {
      found.push({ offset: so[0], length: sc[0] })
    }

    if (Array.isArray(tags[TAG_SUB_IFDS])) tags[TAG_SUB_IFDS].forEach((o) => visit(o, depth + 1))
    visit(nextIfd, depth)
  }

  visit(view.getUint32(4, little), 0)
  return found.filter((f) => f.length > 2048).sort((a, b) => b.length - a.length)[0] || null
}

// อ่านช่วงไบต์ที่ระบุออกมาเป็น Blob JPEG — ตรวจหัว FFD8 ก่อนเสมอ กันตำแหน่งที่คำนวณผิด
async function jpegSlice(file, offset, length) {
  if (!offset || !length || offset + length > file.size) return null
  const blob = file.slice(offset, offset + length)
  const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer())
  return head[0] === 0xFF && head[1] === 0xD8 ? new Blob([blob], { type: 'image/jpeg' }) : null
}

// ทางเลือกสุดท้าย: กวาดทั้งไฟล์หา JPEG ที่ฝังอยู่ (ใช้กับ CR3 และไฟล์ที่ tag ไม่ตรงสเปก)
async function scanForEmbeddedJpeg(file) {
  if (file.size > SCAN_LIMIT) return null
  const buf = new Uint8Array(await file.arrayBuffer())
  let best = null
  for (let i = 0; i + 3 < buf.length; i++) {
    if (buf[i] !== 0xFF || buf[i + 1] !== 0xD8 || buf[i + 2] !== 0xFF) continue
    for (let j = i + 3; j + 1 < buf.length; j++) {
      if (buf[j] === 0xFF && buf[j + 1] === 0xD9) {
        const length = j + 2 - i
        if (!best || length > best.length) best = { offset: i, length }
        i = j + 1
        break
      }
    }
  }
  return best && best.length > 2048 ? new Blob([buf.slice(best.offset, best.offset + best.length)], { type: 'image/jpeg' }) : null
}

// ── ถอดรหัส HEIC ด้วย libheif (เฉพาะเบราว์เซอร์ที่เปิด HEIC เองไม่ได้) ──
// โหลดแบบ dynamic import — ไฟล์ ~1.4MB จะถูกดาวน์โหลดต่อเมื่อมีคนอัปโหลด HEIC จริงเท่านั้น
// (Safari บน Mac/iPhone เปิด HEIC ได้เองอยู่แล้ว จึงไม่โหลดก้อนนี้เลย)
let heifPromise = null
// ตัว .mjs ของ libheif export "โรงงาน" มาให้ ต้องเรียกก่อนถึงได้ตัวโมดูลจริง (บาง build คืน promise)
const loadHeif = () => (heifPromise ||= import('libheif-js/libheif-wasm/libheif-bundle.mjs')
  .then((m) => (typeof m.default === 'function' ? m.default() : m.default)))

async function decodeHeicWithLibheif(blob) {
  const libheif = await loadHeif()
  const images = new libheif.HeifDecoder().decode(new Uint8Array(await blob.arrayBuffer()))
  if (!images || !images.length) throw new Error('ไฟล์ HEIC นี้ไม่มีรูปอยู่ข้างใน')
  const image = images[0]
  const width = image.get_width()
  const height = image.get_height()
  if (!width || !height) throw new Error('อ่านขนาดรูปจากไฟล์ HEIC ไม่ได้')

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const imageData = ctx.createImageData(width, height)
  await new Promise((resolve, reject) => {
    image.display(imageData, (out) => (out ? resolve() : reject(new Error('ถอดรหัสรูป HEIC ไม่สำเร็จ'))))
  })
  ctx.putImageData(imageData, 0, 0)
  return canvas // canvas ใช้กับ drawImage() ได้เหมือน <img>
}

// ── ถอดรหัสรูป ──────────────────────────────────────────────────────────

// ให้เบราว์เซอร์ถอดเอง — ครอบคลุม JPEG/PNG/WebP ทุกเบราว์เซอร์ และ HEIC บน Safari
// (createImageBitmap + imageOrientation:'from-image' หมุนตาม EXIF ให้เอง ส่วน <img> เบราว์เซอร์ก็หมุนให้อยู่แล้ว
//  จึงไม่ต้องหมุนซ้ำเองใน canvas — ไม่งั้นรูปแนวตั้งจากมือถือจะตะแคง)
async function decodeNative(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' })
    } catch {
      try { return await createImageBitmap(blob) } catch { /* ตกไปใช้ <img> ข้างล่าง */ }
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('เบราว์เซอร์เปิดไฟล์นี้ไม่ได้'))
      img.src = url
    })
    return img
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0) // ปล่อยทีหลังหนึ่งรอบ event loop ให้ <img> ใช้ข้อมูลเสร็จก่อน
  }
}

const FORMAT_LABEL = { jpeg: 'JPEG', isobmff: 'HEIC/HEIF', tiff: 'RAW (TIFF)', png: 'PNG', other: 'ไฟล์รูป' }

/**
 * ถอดรหัสรูป 1 ไฟล์ให้พร้อมวาดลง canvas
 * คืน { img, via, width, height, format } — ไม่ throw เว้นแต่หมดทุกวิธีจริงๆ
 *   via: 'native'      เบราว์เซอร์เปิดเอง
 *        'libheif'     ถอด HEIC ด้วย libheif (เบราว์เซอร์ที่เปิด HEIC ไม่ได้)
 *        'raw-preview' ใช้รูป JPEG ความละเอียดสูงที่กล้องฝังไว้ในไฟล์ RAW
 *        'embedded'    ใช้ JPEG ที่กวาดเจอในไฟล์ (ทางเลือกสุดท้าย เช่น CR3)
 */
export async function decodeImageDetailed(source) {
  const blob = typeof source === 'string' ? await (await fetch(source)).blob() : source

  let format = 'other'
  try {
    const view = new DataView(await blob.slice(0, Math.min(blob.size, HEAD_BYTES)).arrayBuffer())
    format = detectFormat(view)

    // RAW: ข้ามการให้เบราว์เซอร์ลองเอง (เปิดไม่ได้อยู่แล้ว) ไปหยิบ JPEG ที่ฝังไว้เลย
    if (format === 'tiff' && isTiffHeader(view, 0)) {
      const spot = findEmbeddedJpegInTiff(view)
      const preview = spot ? await jpegSlice(blob, spot.offset, spot.length) : null
      if (preview) {
        const img = await decodeNative(preview)
        return { img, via: 'raw-preview', width: img.width, height: img.height, format }
      }
    }
  } catch { /* อ่านหัวไฟล์ไม่ได้ — ปล่อยให้ลองวิธีปกติต่อ */ }

  // ทางปกติ: ให้เบราว์เซอร์ถอดเอง
  try {
    const img = await decodeNative(blob)
    if (img.width && img.height) return { img, via: 'native', width: img.width, height: img.height, format }
  } catch { /* ไปลองวิธีถัดไป */ }

  // HEIC/HEIF บนเบราว์เซอร์ที่เปิดเองไม่ได้ (Chrome/Firefox/Edge)
  let heifError = ''
  if (format === 'isobmff') {
    try {
      const img = await decodeHeicWithLibheif(blob)
      return { img, via: 'libheif', width: img.width, height: img.height, format }
    } catch (e) {
      // CR3 และ HEIC บางแบบ libheif ก็เปิดไม่ได้ — ไปหา JPEG ที่ฝังไว้ แต่จำสาเหตุไว้บอกผู้ใช้ด้วย
      heifError = e?.message || String(e)
    }
  }

  // ทางเลือกสุดท้าย — กวาดหา JPEG ที่ฝังในไฟล์
  const embedded = await scanForEmbeddedJpeg(blob)
  if (embedded) {
    const img = await decodeNative(embedded)
    return { img, via: 'embedded', width: img.width, height: img.height, format }
  }

  throw new Error(`เปิดไฟล์ ${FORMAT_LABEL[format] || ''} นี้ไม่ได้ — ลองแปลงเป็น JPEG ก่อนอัปโหลด${heifError ? ` (${heifError})` : ''}`)
}

// เวอร์ชันสั้น ใช้กับไฟล์กรอบ (PNG) ที่ไม่ต้องรู้ว่าถอดรหัสมาทางไหน
export async function decodeImage(source) {
  return (await decodeImageDetailed(source)).img
}

const dims = (img) => ({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height })

// วาดรูปลงกรอบจัตุรัสแบบ cover (ครอปกลาง เต็มกรอบ) หรือ contain (เห็นทั้งรูป มีขอบ)
function drawFitted(ctx, img, size, fit) {
  const { w, h } = dims(img)
  if (!w || !h) return
  const scale = fit === 'contain' ? Math.min(size / w, size / h) : Math.max(size / w, size / h)
  const dw = w * scale
  const dh = h * scale
  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh)
}

/**
 * ประกอบ 1 รูป → Blob ของ JPG ขนาด size × size
 * @param photo      รูปถ่าย (File/Blob/URL หรือรูปที่ถอดรหัสไว้แล้ว)
 * @param cover      กรอบ PNG เลเยอร์บน (ไม่ใส่ = ได้รูปจัตุรัสเปล่าๆ)
 * @param size       ความกว้าง=ความสูง ของไฟล์ผลลัพธ์ (px)
 * @param quality    คุณภาพ JPEG 0–1
 * @param fit        'cover' (ครอปกลาง) | 'contain' (ย่อทั้งรูป)
 * @param background สีพื้นหลัง — เห็นเฉพาะโหมด contain และตรงส่วนโปร่งใสของกรอบ
 */
export async function composeSquareJpeg({ photo, cover, size = 1080, quality = 0.92, fit = 'cover', background = '#ffffff' }) {
  const photoImg = photo && typeof photo.width === 'number' && !(photo instanceof Blob) ? photo : await decodeImage(photo)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // JPG ไม่มีช่องโปร่งใส — ต้องรองพื้นก่อน ไม่งั้นส่วนโปร่งใสจะกลายเป็นสีดำ
  ctx.fillStyle = background
  ctx.fillRect(0, 0, size, size)

  drawFitted(ctx, photoImg, size, fit)                            // เลเยอร์ล่าง
  if (cover) ctx.drawImage(cover, 0, 0, size, size)               // เลเยอร์บน — ยืดเต็มผืน

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('แปลงไฟล์ JPG ไม่สำเร็จ')
  return blob
}

/**
 * แปลงรูป 1 ไฟล์ → Blob JPG โดยคงอัตราส่วน/ขนาดต้นฉบับไว้ (ไม่ครอป ไม่ใส่กรอบ)
 * ใช้ตัวถอดรหัสเดียวกับ composeSquareJpeg จึงรองรับ HEIC/RAW เหมือนกัน
 * @param photo      รูปถ่าย (File/Blob/URL หรือรูปที่ถอดรหัสไว้แล้ว)
 * @param quality    คุณภาพ JPEG 0–1
 * @param background สีพื้นหลัง — เห็นเฉพาะส่วนโปร่งใสของ PNG/HEIC ต้นฉบับ (JPG ไม่มีช่องโปร่งใส)
 */
export async function convertToJpeg(photo, quality = 0.92, background = '#ffffff') {
  const img = photo && typeof photo.width === 'number' && !(photo instanceof Blob) ? photo : await decodeImage(photo)
  const { w, h } = dims(img)
  if (!w || !h) throw new Error('อ่านขนาดรูปไม่ได้')
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('แปลงไฟล์ JPG ไม่สำเร็จ')
  return blob
}

// ตั้งชื่อไฟล์ผลลัพธ์จากชื่อไฟล์ต้นฉบับ — ตัดนามสกุลเดิม (.heic/.dng/...) ออกแล้วเติม -framed.jpg / -converted.jpg
export function framedFileName(originalName = 'photo', suffix = 'framed') {
  const base = originalName.replace(/\.[^.]+$/, '').replace(/[^\w\-ก-๙]+/g, '-').replace(/^-+|-+$/g, '') || 'photo'
  return `${base}-${suffix}.jpg`
}

// สั่งเบราว์เซอร์ดาวน์โหลด Blob เป็นไฟล์
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const formatBytes = (n) =>
  !Number.isFinite(n) ? '—' : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
