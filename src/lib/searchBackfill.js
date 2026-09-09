import { collection, getDocs, writeBatch, doc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { SEARCH_COLLECTIONS, SEARCH_FIELD, buildSearchTokens } from './searchIndex.js'

// เติมดัชนีคำค้นให้เอกสารที่มีอยู่แล้ว
//
// จำเป็นเพราะ searchTokens ถูกใส่ตอน "บันทึก" เท่านั้น ⇒ ข้อมูลที่สร้างไว้ก่อนมีฟีเจอร์นี้
// จะไม่มี token เลย และค้นไม่เจอจนกว่าจะเปิดไปกดบันทึกใหม่ทีละรายการ
//
// ปกติงานแบบนี้ควรทำด้วย Cloud Functions หรือสคริปต์ Admin SDK แต่โปรเจกต์นี้อยู่บน Spark plan
// (ไม่มี Cloud Functions) จึงทำจากฝั่งแอดมินที่ล็อกอินแล้วแทน — สิทธิ์บังคับด้วย firestore.rules
// ตามปกติ ทำได้เฉพาะคนที่มีสิทธิ์เขียน collection นั้นอยู่แล้ว
//
// เขียนเป็น batch ละ 400 (ลิมิตจริงคือ 500 ต่อ batch) และข้ามเอกสารที่ token ตรงอยู่แล้ว
// เพื่อให้กดซ้ำได้โดยไม่เปลืองโควตาเขียน

const BATCH_SIZE = 400

/** เทียบว่า token ที่มีอยู่ตรงกับที่ควรจะเป็นหรือยัง (ไม่สนลำดับ) */
function sameTokens(a, b) {
  if (!Array.isArray(a) || a.length !== b.length) return false
  const set = new Set(a)
  return b.every((x) => set.has(x))
}

/**
 * @param onProgress เรียกทุกครั้งที่จบ 1 คอลเลกชัน — ใช้อัปเดต UI ระหว่างทำ
 * @returns สรุปผลรายคอลเลกชัน { col, total, updated, skipped, error }
 */
export async function backfillSearchIndex(onProgress) {
  const summary = []
  for (const s of SEARCH_COLLECTIONS) {
    const row = { col: s.col, label: s.label, total: 0, updated: 0, skipped: 0, error: null }
    try {
      const snap = await getDocs(collection(db, s.col))
      row.total = snap.size
      let batch = writeBatch(db)
      let pending = 0
      for (const d of snap.docs) {
        const data = d.data()
        const tokens = buildSearchTokens(...s.fields.map((f) => data[f]))
        if (sameTokens(data[SEARCH_FIELD], tokens)) { row.skipped++; continue }
        batch.update(doc(db, s.col, d.id), { [SEARCH_FIELD]: tokens })
        row.updated++
        if (++pending >= BATCH_SIZE) { await batch.commit(); batch = writeBatch(db); pending = 0 }
      }
      if (pending > 0) await batch.commit()
    } catch (e) {
      // คอลเลกชันที่บัญชีนี้ไม่มีสิทธิ์เขียน ให้ข้ามไปทำตัวอื่นต่อ ไม่ล้มทั้งงาน
      row.error = e?.code === 'permission-denied' ? 'ไม่มีสิทธิ์' : (e?.message || 'ผิดพลาด')
    }
    summary.push(row)
    onProgress?.([...summary])
  }
  return summary
}
