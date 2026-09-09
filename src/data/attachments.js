import { useEffect, useState } from 'react'
import { db } from '../firebase.js'
import {
  collection, doc, addDoc, deleteDoc, onSnapshot, query, where,
} from 'firebase/firestore'
import { isSafeHttpUrl } from '../utils/safeUrl.js'

// ไฟล์แนบ (ลิงก์ Google Sheet/Doc/Slides/Drive หรือลิงก์อื่นๆ) ผูกกับงานอะไรก็ได้ในระบบ
//
// เก็บเป็น collection แยก ไม่ใช่ field ในเอกสารแม่ — เพื่อให้เพิ่มไฟล์แนบให้ entity ใหม่ได้ทันที
// โดยไม่ต้องแก้ firestore.rules ของ collection นั้นๆ ทุกครั้ง (rules ของ attachments คุมที่เดียวจบ)
// และไม่ทำให้เอกสารแม่บวมขึ้นเรื่อยๆ ตามจำนวนไฟล์
//
// entityType/entityId = ชี้ว่าไฟล์นี้แนบกับอะไร เช่น ('meeting', <meetingId>) / ('campaign', <campaignId>)

const COL = 'attachments'

// ชนิดไฟล์เดาจาก URL — ใช้เลือกไอคอน/ป้ายสีให้ผู้ใช้กวาดตาหาไฟล์ที่ต้องการได้เร็ว
// ไม่ได้ใช้ตัดสินใจเรื่องความปลอดภัยใดๆ (ตัวนั้นคือ isSafeHttpUrl)
export function detectKind(url) {
  const u = String(url || '')
  if (/docs\.google\.com\/spreadsheets/i.test(u)) return 'sheet'
  if (/docs\.google\.com\/document/i.test(u)) return 'doc'
  if (/docs\.google\.com\/presentation/i.test(u)) return 'slides'
  if (/docs\.google\.com\/forms|forms\.gle/i.test(u)) return 'form'
  if (/drive\.google\.com/i.test(u)) return 'drive'
  return 'link'
}

export const KIND_LABEL = {
  sheet: 'Sheet', doc: 'Doc', slides: 'Slides', form: 'Form', drive: 'Drive', link: 'ลิงก์',
}
export const KIND_COLOR = {
  sheet: '#0f9d58', doc: '#4285f4', slides: '#f4b400', form: '#7248b9', drive: '#00ac47', link: '#6b7280',
}

// ดึงชื่อไฟล์มาตั้งเป็นชื่อเริ่มต้นไม่ได้ (ต้องมี Drive API + สิทธิ์) จึงให้ผู้ใช้พิมพ์ชื่อเอง
// ถ้าไม่พิมพ์ใช้ชนิดไฟล์เป็นชื่อแทน ดีกว่าโชว์ URL ยาวๆ ที่อ่านไม่รู้เรื่อง
export async function addAttachment({ entityType, entityId, url, title, addedBy = '' }) {
  if (!isSafeHttpUrl(url)) throw new Error('ลิงก์ต้องเริ่มด้วย http:// หรือ https://')
  const kind = detectKind(url)
  return addDoc(collection(db, COL), {
    entityType: String(entityType).slice(0, 40),
    entityId: String(entityId).slice(0, 100),
    url: String(url).slice(0, 1000),
    title: String(title || '').trim().slice(0, 200) || KIND_LABEL[kind],
    kind,
    addedBy: String(addedBy || '').slice(0, 200),
    addedAt: Date.now(),
  })
}

export const removeAttachment = (id) => deleteDoc(doc(db, COL, id))

// ไฟล์แนบของงานหนึ่ง — เรียลไทม์
// ไม่ใช้ orderBy ใน query เพราะ where + orderBy คนละ field ต้องสร้าง composite index ใน Firestore
// (ถ้าไม่มี index onSnapshot จะ error เงียบๆ แล้วรายการว่างเปล่าโดยไม่มีอะไรบอก) — เรียงฝั่ง client แทน
export function useAttachments(entityType, entityId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!entityId) { setItems([]); setLoading(false); return }
    const qy = query(collection(db, COL), where('entityType', '==', entityType), where('entityId', '==', entityId))
    return onSnapshot(qy, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0)))
      setLoading(false)
    }, () => setLoading(false))
  }, [entityType, entityId])
  return { items, loading }
}
