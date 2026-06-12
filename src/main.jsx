// จุดเริ่มต้นของแอป — เรนเดอร์ <App /> ลงใน <div id="root"> ของ index.html
import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
