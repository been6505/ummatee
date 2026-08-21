import { useState } from 'react'
import { uploadToCloudinary } from '../utils/cloudinary.js'
import { toPhotoUrl } from '../utils/photoUrl.js'
import { optImg } from '../utils/cloudinaryUrl.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCamera, faXmark } from '@fortawesome/free-solid-svg-icons'

// ตัวเลือก/อัปโหลดรูปที่ใช้ร่วมกัน — คืนค่าเป็น "อาร์เรย์ของสตริง URL" เสมอ
//
// จุดที่พลาดง่ายและเคยพลาดมาแล้ว: uploadToCloudinary คืน { url, type, publicId }
// ถ้าเก็บทั้ง object ลง state รูปจะพังสองต่อโดยไม่มี error ให้เห็น —
// พรีวิวกลายเป็น <img src="[object Object]"> และตอนบันทึกก็ถูกตัวกรอง URL ทิ้งทั้งหมด
// ฟอร์มยังดูเหมือนทำงานปกติทุกอย่าง แต่รูปไม่เคยไปถึงฐานข้อมูลเลย
// onBusyChange: ให้หน้าที่ใช้ปิดปุ่ม "ส่ง" ระหว่างอัปโหลดได้ — ไม่งั้นกดส่งตอนรูปยังขึ้นไม่เสร็จ
// จะบันทึกโดยไม่มีรูปนั้น ทั้งที่ผู้ใช้เห็นว่าเลือกไปแล้ว
export default function PhotoUploader({ photos = [], max = 4, onChange, onBusyChange, label = 'เพิ่มรูป' }) {
  const [busy, setBusyState] = useState(false)
  const setBusy = (v) => { setBusyState(v); onBusyChange?.(v) }

  const pick = async (e) => {
    const files = [...(e.target.files || [])].slice(0, max - photos.length)
    e.target.value = '' // ให้เลือกไฟล์เดิมซ้ำได้ถ้ารอบก่อนล้ม
    if (files.length === 0) return
    setBusy(true)
    try {
      const results = await Promise.all(files.map((f) => uploadToCloudinary(f)))
      const urls = results.map(toPhotoUrl).filter(Boolean)
      onChange([...photos, ...urls].slice(0, max))
    } catch (err) {
      window.alert('อัปโหลดรูปไม่สำเร็จ: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sup-photos">
      {photos.map((url, i) => (
        <div key={i} className="sup-photo">
          <img src={optImg(url, 200)} alt="" />
          <button type="button" onClick={() => onChange(photos.filter((_, j) => j !== i))} aria-label="ลบรูป">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
      ))}
      {photos.length < max && (
        <label className="sup-photo-add">
          <FontAwesomeIcon icon={faCamera} />
          <span>{busy ? 'กำลังอัปโหลด…' : label}</span>
          <input type="file" accept="image/*" multiple hidden onChange={pick} disabled={busy} />
        </label>
      )}
    </div>
  )
}
