import { useConfigDoc, saveConfigDoc } from './configDoc.js'

// ชุดการ์ดที่แอดมินจัดการเองใน config/{docId} — ใช้ร่วมกันระหว่าง homeCards (Hero Feed) กับ focusCards (การ์ดทางลัด)
//
// cards = null หมายถึง "ยังไม่เคยตั้งค่า" ⇒ ผู้เรียกไป fallback เป็นชุดมาตรฐานที่ hardcode ไว้
// ต่างจาก [] ที่แปลว่าตั้งค่าแล้วแต่เลือกจะไม่มีการ์ดเลย — สองอย่างนี้ต้องแยกกันให้ได้
export function useConfigCards(docId, live = false) {
  const { data, loading } = useConfigDoc(docId, { live })
  return { cards: data ? (data.cards || []) : null, loading }
}

// merge:false — ต้องเขียนทับทั้งเอกสาร ไม่งั้นการ์ดที่แอดมินลบออกจะไม่หายไปจริง
export const saveConfigCards = (docId, cards) =>
  saveConfigDoc(docId, { cards, updatedAt: Date.now() }, { merge: false })
