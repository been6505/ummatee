import { useState } from 'react'
import { downloadCsv, exportToSheets, isSheetsExportEnabled } from '../lib/csv.js'

// ปุ่มส่งออกข้อมูล — CSV (ดาวน์โหลด) และ Google Sheets (เขียนเข้าชีตตรงๆ) ใช้ชุดข้อมูลเดียวกัน
//
// build() ต้องคืน { filename, sheetName, headers, rows } — เขียนตัวสร้างข้อมูลครั้งเดียวใช้ได้ทั้ง 2 ปุ่ม
// ไม่ต้องมีสองก๊อบปี้ที่หลุดไม่ตรงกันเวลาเพิ่มคอลัมน์ใหม่
//
// ปุ่ม Sheets ซ่อนอัตโนมัติถ้ายังไม่ได้ตั้ง SHEETS_EXPORT_ENDPOINT/TOKEN ใน utils/endpoints.js
// (ดูขั้นตอนติดตั้งใน docs/sheets-export-apps-script/Code.gs) — ปุ่ม CSV ใช้ได้ตลอดไม่ต้องตั้งอะไร
export default function ExportButtons({ build }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')

  const csv = () => {
    const { filename, headers, rows } = build()
    downloadCsv(filename, headers, rows)
  }

  // ⚠️ Apps Script ฝั่งปลายทาง clear() ทั้งชีตก่อนเขียนทุกครั้ง (snapshot ล่าสุด ไม่ต่อท้ายให้ซ้ำ)
  // แปลว่าถ้าหน้านี้กำลังกรอง/ค้นหาอยู่ แล้วกดส่ง ข้อมูลเต็มในชีตจะถูกแทนที่ด้วยผลการกรองทันที
  // จึงต้องยืนยันจำนวนแถวก่อนเสมอ ให้ผู้ใช้เห็นว่ากำลังจะเขียนทับด้วยกี่แถว
  const sheets = async () => {
    if (busy) return
    const { sheetName, headers, rows } = build()
    if (!window.confirm(
      `ส่ง ${rows.length} แถว เข้าชีต "${sheetName}"?\n\n`
      + 'ข้อมูลเดิมในชีตนี้จะถูกลบแล้วเขียนทับด้วยรายการที่เห็นบนหน้าจอตอนนี้\n'
      + 'ถ้ากำลังค้นหา/กรองอยู่ ให้ล้างตัวกรองก่อน ไม่งั้นชีตจะเหลือเฉพาะผลการกรอง'
    )) return
    setBusy(true)
    setDone('')
    try {
      const r = await exportToSheets(sheetName, headers, rows)
      setDone(`ส่งแล้ว ${r.rows} แถว`)
      setTimeout(() => setDone(''), 4000)
    } catch (e) {
      window.alert('ส่งเข้า Google Sheets ไม่สำเร็จ: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <button type="button" className="admin-btn" onClick={csv}>ส่งออก CSV</button>
      {isSheetsExportEnabled() && (
        <button type="button" className="admin-btn" onClick={sheets} disabled={busy}>
          {busy ? 'กำลังส่ง...' : (done || 'ส่งเข้า Google Sheets')}
        </button>
      )}
    </div>
  )
}
