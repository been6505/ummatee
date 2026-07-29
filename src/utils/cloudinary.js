// อัพโหลดไฟล์ขึ้น Cloudinary (unsigned preset) — ใช้ร่วมกันทุกหน้า
// resourceType: 'image' (รูปเท่านั้น) หรือ 'auto' (รูป/วิดีโอ)
// คืน { url, type, publicId } — type คือ resource_type จาก Cloudinary เช่น 'image' | 'video'
// publicId ใช้ตอนลบไฟล์ทีหลัง (เช่น cleanupPublishedMedia ใน functions/index.js) — ไม่ได้ใช้ทุกที่ที่เรียกฟังก์ชันนี้
//
// ⚠️ preset นี้เป็นแบบ unsigned = ใครอ่าน JS bundle ก็ยิง POST เข้าบัญชี Cloudinary ของมูลนิธิได้ตรงๆ
// ด่านจริงต้องตั้งที่ Cloudinary Console → Settings → Upload → preset "Ummatee":
//   - จำกัดขนาดไฟล์สูงสุด (Max file size)
//   - จำกัดฟอร์แมตที่รับ (Allowed formats)
//   - เปิด moderation ถ้าต้องการคัดกรองเนื้อหา
// เพราะเว็บนี้ไม่มี server มา sign upload ให้ (Spark plan ไม่มี Cloud Functions)
// การตรวจด้านล่างเป็นแค่การกันพลาดฝั่ง UI (ผู้ใช้เลือกไฟล์ผิด/ใหญ่เกิน) กันคนตั้งใจโจมตีไม่ได้

// export ไว้ให้หน้าที่ใช้ Cloudinary upload widget (Give2/Give2Cook) ดึงไปใช้ ไม่ต้อง copy ค่าไปเขียนซ้ำ
// — ถ้าย้ายบัญชี/เปลี่ยน preset จะได้แก้ที่เดียว ไม่ตกหล่นบางหน้า
export const CLOUDINARY_CLOUD = 'dei5jktuw'
export const CLOUDINARY_PRESET = 'Ummatee'

const MAX_IMAGE_BYTES = 25 * 1024 * 1024 // 25MB — เผื่อไฟล์ RAW จากกล้อง (CR2/CR3/NEF มักใหญ่หลายสิบ MB)
const MAX_VIDEO_BYTES = 100 * 1024 * 1024 // 100MB

// นามสกุลไฟล์กล้อง/มือถือที่เบราว์เซอร์มักไม่ให้ MIME type มา (file.type เป็นค่าว่างหรือชื่อแปลกๆ)
// จึงต้องเช็คนามสกุลควบคู่กับ MIME ไม่ใช่เช็ค MIME อย่างเดียว ไม่งั้นบล็อกไฟล์ HEIC/RAW ที่รองรับอยู่
const EXTRA_IMAGE_EXT = /\.(heic|heif|cr2|cr3|nef|arw|raf|rw2|dng|orf|sr2|raw)$/i

export async function uploadToCloudinary(file, resourceType = 'image') {
  const mime = file?.type || ''
  const isVideo = /^video\//i.test(mime)
  const isImage = /^image\//i.test(mime) || EXTRA_IMAGE_EXT.test(file?.name || '')
  // รับเฉพาะรูป/วิดีโอ — กันเผลอเลือกไฟล์ผิด (zip/pdf/exe) แล้วไปกินพื้นที่บัญชี Cloudinary ของมูลนิธิ
  // MIME ว่างเปล่ายอมให้ผ่านเฉพาะเมื่อนามสกุลเป็นไฟล์รูปกล้อง (ดู EXTRA_IMAGE_EXT)
  if (!isImage && !(isVideo && resourceType !== 'image')) {
    throw new Error('รับเฉพาะไฟล์รูปภาพ' + (resourceType === 'image' ? '' : 'หรือวิดีโอ') + ' เท่านั้น')
  }
  const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (file?.size > max) {
    throw new Error(`ไฟล์ใหญ่เกิน ${Math.round(max / 1024 / 1024)}MB (ไฟล์นี้ ${Math.round(file.size / 1024 / 1024)}MB) กรุณาย่อขนาดก่อนอัปโหลด`)
  }
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', CLOUDINARY_PRESET)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error('upload failed')
  const j = await res.json()
  // ไฟล์กล้อง/มือถือบางชนิด (HEIC/HEIF, RAW เช่น CR2/CR3/NEF/ARW) เบราว์เซอร์ทั่วไปแสดงเป็น <img> ตรงๆ ไม่ได้
  // ใส่ f_auto,q_auto ให้ Cloudinary แปลงเป็นฟอร์แมตที่เบราว์เซอร์ผู้ขอรองรับ (jpg/webp) ตอนดึงไฟล์แทน
  const url = j.resource_type === 'image' ? j.secure_url.replace('/upload/', '/upload/f_auto,q_auto/') : j.secure_url
  return { url, type: j.resource_type, publicId: j.public_id }
}
