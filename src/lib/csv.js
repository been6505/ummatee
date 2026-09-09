import { SHEETS_EXPORT_ENDPOINT, SHEETS_EXPORT_TOKEN, fetchWithTimeout } from '../utils/endpoints.js'

// สร้างไฟล์ CSV จาก array ของ object ฝั่ง client แล้วสั่งดาวน์โหลดทันที — พอร์ตมาจาก
// UmmateeThailand (Next.js) src/lib/csv-client.ts ที่เคยแก้ช่องโหว่ CSV/formula injection แล้ว
// ไม่ต้องใช้ dependency เพิ่ม (native Blob + <a download> พอสำหรับขนาดข้อมูลของแอปนี้)
// กัน CSV/formula injection (CWE-1236) — ฟิลด์ freeform ที่พนักงานพิมพ์เอง (ชื่อองค์กร/หมายเหตุ ฯลฯ)
// ถ้าขึ้นต้นด้วย =,+,-,@ โปรแกรม spreadsheet (Excel/Sheets) จะตีความเป็นสูตรแล้วรันทันทีตอนเปิดไฟล์
// เติม ' นำหน้าบังคับให้อ่านเป็นข้อความเฉยๆ เหมือนวิธีมาตรฐานที่ OWASP แนะนำ
// ใช้ร่วมกันทั้ง downloadCsv และ exportToSheets ด้านล่าง — ทั้งคู่เสี่ยงแบบเดียวกัน (ดูเหตุผลที่ exportToSheets)
function guardFormulaPrefix(str) {
  return /^[=+\-@]/.test(str) ? `'${str}` : str
}

function escapeCsvCell(value) {
  let str = guardFormulaPrefix(value === null || value === undefined ? '' : String(value))
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function downloadCsv(filename, headers, rows) {
  const lines = [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))]
  // BOM กันปัญหาภาษาไทยเพี้ยนตอนเปิดด้วย Excel
  const csv = '﻿' + lines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── ส่งข้อมูลชุดเดียวกับที่ดาวน์โหลด CSV เข้า Google Sheets แทน ──
// ใช้ headers/rows หน้าตาเดียวกับ downloadCsv เลย จึงเพิ่มปุ่มในหน้าไหนก็ใช้ตัวแปรเดิมได้ทันที
//
// ⚠️ ต้อง guard formula prefix เหมือน downloadCsv — Code.gs ฝั่งปลายทางเขียนด้วย Range.setValues()
// ซึ่งตีความ string ที่ขึ้นต้นด้วย =,+,-,@ เป็นสูตรเหมือนพิมพ์ในช่องเซลล์เอง (พฤติกรรมเดียวกับเปิดไฟล์ CSV
// ใน Excel/Sheets) จึงเสี่ยง formula injection แบบเดียวกันถ้าข้อมูลมีฟิลด์ freeform ที่คนอื่นพิมพ์ได้
export const isSheetsExportEnabled = () => !!SHEETS_EXPORT_ENDPOINT && !!SHEETS_EXPORT_TOKEN

export async function exportToSheets(sheetName, headers, rows) {
  if (!isSheetsExportEnabled()) {
    throw new Error('ยังไม่ได้ตั้งค่าการส่งเข้า Google Sheets — ดูขั้นตอนใน docs/sheets-export-apps-script/Code.gs')
  }
  const safeHeaders = headers.map((h) => guardFormulaPrefix(String(h ?? '')))
  const safeRows = rows.map((r) => r.map((v) => guardFormulaPrefix(v === null || v === undefined ? '' : String(v))))
  // Apps Script ไม่ตอบ CORS preflight — ต้องใช้ text/plain ให้เป็น simple request (แบบเดียวกับฟอร์มอื่นในเว็บนี้)
  const res = await fetchWithTimeout(SHEETS_EXPORT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: SHEETS_EXPORT_TOKEN, sheetName, headers: safeHeaders, rows: safeRows }),
  }, 30000) // ให้เวลามากกว่าปกติ ข้อมูลหลายพันแถว Apps Script เขียนช้ากว่าฟอร์มทีละรายการ
  const data = await res.json().catch(() => null)
  if (!data?.ok) throw new Error(data?.error || 'ส่งเข้า Google Sheets ไม่สำเร็จ')
  return data
}
