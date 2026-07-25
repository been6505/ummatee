// สร้างไฟล์ CSV จาก array ของ object ฝั่ง client แล้วสั่งดาวน์โหลดทันที — พอร์ตมาจาก
// UmmateeThailand (Next.js) src/lib/csv-client.ts ที่เคยแก้ช่องโหว่ CSV/formula injection แล้ว
// ไม่ต้องใช้ dependency เพิ่ม (native Blob + <a download> พอสำหรับขนาดข้อมูลของแอปนี้)
function escapeCsvCell(value) {
  let str = value === null || value === undefined ? '' : String(value)
  // กัน CSV/formula injection (CWE-1236) — ฟิลด์ freeform ที่พนักงานพิมพ์เอง (ชื่อองค์กร/หมายเหตุ ฯลฯ)
  // ถ้าขึ้นต้นด้วย =,+,-,@ โปรแกรม spreadsheet (Excel/Sheets) จะตีความเป็นสูตรแล้วรันทันทีตอนเปิดไฟล์
  // เติม ' นำหน้าบังคับให้อ่านเป็นข้อความเฉยๆ เหมือนวิธีมาตรฐานที่ OWASP แนะนำ
  if (/^[=+\-@]/.test(str)) str = `'${str}`
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
