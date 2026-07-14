// ย่อ/บีบอัดรูป Cloudinary ตอนแสดงผล — ใส่ transformation ใน URL (ไฟล์ต้นฉบับไม่ถูกแก้)
// w_X = ความกว้างสูงสุด, q_auto = บีบอัดอัตโนมัติ, f_auto = เลือกฟอร์แมตที่เบราว์เซอร์รองรับ (webp/avif)
// URL ที่ไม่ใช่ Cloudinary หรือใส่ transformation แล้ว คืนค่าเดิม
export function optImg(url, width = 400) {
  if (typeof url !== 'string' || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url
  if (/\/upload\/[^/]*(w_|q_auto)/.test(url)) return url
  return url.replace('/upload/', `/upload/w_${width},q_auto,f_auto/`)
}
