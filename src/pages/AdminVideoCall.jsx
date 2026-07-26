import { useState } from 'react'
import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'

// วิดีโอคอล (/admin/video-call) — ข้อ 9 ครึ่งแรกของแผน admin-intranet-plan.md
// ฝัง Jitsi Meet (meet.jit.si) เป็น iframe ตรงๆ — ฟรี ไม่ต้องมีเซิร์ฟเวอร์/สมัครบัญชี ไม่มี dependency เพิ่ม
// จำกัด: ชื่อห้องไม่ได้บันทึกไว้ที่ไหนเลย (ไม่มี Firestore) ต้องบอกเพื่อนร่วมทีมเองผ่านแชท/LINE ว่าจะเข้าห้องชื่ออะไร
const randomRoom = () => `ummatee-${Math.random().toString(36).slice(2, 8)}`

export default function AdminVideoCall() {
  const [roomInput, setRoomInput] = useState(randomRoom())
  const [activeRoom, setActiveRoom] = useState(null)

  const join = () => {
    const name = roomInput.trim().replace(/[^a-zA-Z0-9-_]/g, '')
    if (!name) { window.alert('กรอกชื่อห้องประชุม'); return }
    setActiveRoom(name)
  }
  const leave = () => setActiveRoom(null)

  return (
    <StaffRoleGuard allowedRoles={['admin', 'staff', 'field', 'social']}>
      {() => (
        <main className="admin-dash">
          <AdminNav />
          <div className="admin-wrap">
            <div className="admin-head">
              <div><h1>ประชุมวิดีโอ</h1><p>ใช้ Jitsi Meet ฟรี — ไม่ต้องสมัครบัญชี ตั้งชื่อห้องแล้วแชร์ให้เพื่อนร่วมทีมเข้าห้องเดียวกัน</p></div>
            </div>

            {!activeRoom ? (
              <div className="admin-card">
                <div className="admin-form-grid" style={{ marginBottom: 14 }}>
                  <label>ชื่อห้องประชุม
                    <input value={roomInput} onChange={(e) => setRoomInput(e.target.value)} placeholder="เช่น ummatee-abc123" />
                  </label>
                </div>
                <p style={{ color: 'var(--ink-soft)', fontSize: '.82rem', marginBottom: 14 }}>
                  ชื่อห้องไม่ได้บันทึกไว้ในระบบเลย — ต้องบอกเพื่อนร่วมทีมชื่อห้องตรงๆ (เช่น ผ่านแชทหรือ LINE)
                  ให้เขาพิมพ์ชื่อห้องเดียวกันแล้วกด "เข้าห้องประชุม" จึงจะเจอกันในห้องเดียวกัน
                </p>
                <button className="admin-btn-primary" onClick={join}>เข้าห้องประชุม</button>
              </div>
            ) : (
              <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
                  <strong>ห้อง: {activeRoom}</strong>
                  <button className="admin-btn-danger" onClick={leave}>ออกจากห้อง</button>
                </div>
                <iframe
                  title="Jitsi Meet"
                  src={`https://meet.jit.si/${encodeURIComponent(activeRoom)}`}
                  allow="camera; microphone; fullscreen; display-capture"
                  style={{ width: '100%', height: '80vh', border: 'none', display: 'block' }}
                />
              </div>
            )}
          </div>
        </main>
      )}
    </StaffRoleGuard>
  )
}
