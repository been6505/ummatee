// จุดเริ่มต้นของแอป — เรนเดอร์ <App /> ลงใน <div id="root"> ของ index.html
import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initWriteErrorNotice } from './lib/writeErrorNotice.js'
import { initSwAutoReload } from './lib/swAutoReload.js'

// ดัก Firestore write ที่ล้มเหลวแบบไม่มีใคร catch — กัน 'กดปุ่มแล้วเงียบ' (ดูเหตุผลในไฟล์นั้น)
initWriteErrorNotice()
// PWA อัปเดต service worker เองอยู่แล้ว แต่หน้าที่เปิดค้างยังรันโค้ดเก่าจนกว่าจะรีเฟรช (ดูไฟล์นั้น)
initSwAutoReload()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
