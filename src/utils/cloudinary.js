// อัพโหลดไฟล์ขึ้น Cloudinary (unsigned preset) — ใช้ร่วมกันทุกหน้า
// resourceType: 'image' (รูปเท่านั้น) หรือ 'auto' (รูป/วิดีโอ)
// คืน { url, type } — type คือ resource_type จาก Cloudinary เช่น 'image' | 'video'
const CLOUDINARY_CLOUD = 'dei5jktuw'
const CLOUDINARY_PRESET = 'Ummatee'

export async function uploadToCloudinary(file, resourceType = 'image') {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', CLOUDINARY_PRESET)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error('upload failed')
  const j = await res.json()
  return { url: j.secure_url, type: j.resource_type }
}
