// คลังรูปที่ใส่กรอบแล้ว (/admin/photo-frame) — Firestore collection: framedPhotos
// 1 เอกสาร = รูป 1 ใบ เก็บ URL ผลลัพธ์บน Cloudinary + พิกัด GPS ที่อ่านได้จาก EXIF ตอนอัปโหลด
// อ่าน/เขียนได้เฉพาะแอดมินตัวจริง (ดู firestore.rules)
import { useEffect, useState } from 'react'
import { db } from '../firebase.js'
import { collection, addDoc, deleteDoc, doc, onSnapshot, orderBy, query, limit } from 'firebase/firestore'

const COL = 'framedPhotos'

export function useFramedPhotos(enabled = true, max = 300) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled) return
    const unsub = onSnapshot(
      query(collection(db, COL), orderBy('createdAt', 'desc'), limit(max)),
      (snap) => { setPhotos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false) },
      (e) => { setError(e.code || e.message); setLoading(false) }
    )
    return unsub
  }, [enabled, max])

  return { photos, loading, error }
}

// บันทึก 1 รูป — ตัด field ที่เป็น undefined ออก (Firestore ไม่รับ undefined จะ throw ทั้งชุด)
export async function saveFramedPhoto(data) {
  const clean = Object.fromEntries(Object.entries({ ...data, createdAt: Date.now() }).filter(([, v]) => v !== undefined))
  const ref = await addDoc(collection(db, COL), clean)
  return ref.id
}

export const deleteFramedPhoto = (id) => deleteDoc(doc(db, COL, id))

// แปลงรายการเป็น CSV (พิกัดเปิดต่อใน Google My Maps / Excel ได้)
export function framedPhotosToCsv(rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['วันที่บันทึก', 'ชื่อไฟล์', 'ละติจูด', 'ลองจิจูด', 'ที่มาพิกัด', 'ความสูง(ม.)', 'วันเวลาที่ถ่าย', 'ลิงก์รูป', 'หมายเหตุ']
  const body = rows.map((r) => [
    new Date(r.createdAt).toLocaleString('th-TH'),
    r.fileName, r.lat ?? '', r.lng ?? '', r.gpsSource ?? '', r.altitude ?? '',
    r.takenAtText || (r.takenAt ? new Date(r.takenAt).toLocaleString('th-TH') : ''),
    r.url, r.note ?? '',
  ].map(esc).join(','))
  return '﻿' + [head.map(esc).join(','), ...body].join('\n') // BOM ให้ Excel อ่านภาษาไทยถูก
}
