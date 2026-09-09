import { useEffect, useState } from 'react'
import { useMeeting, isMeetingOpen } from '../data/meetings.js'

// หน้าเข้าร่วมประชุมสำหรับคนนอก (/meet/<meeting id>) — ไม่ต้องล็อกอิน แค่มีลิงก์เชิญ
//
// "ไม่ public" ในความหมายที่ใช้ที่นี่: ไม่มีลิงก์มาหน้านี้จากที่ไหนในเว็บเลย (ไม่อยู่ในเมนู/sitemap)
// ตัวป้องกันคือ meeting id ที่เป็น UUID สุ่มเดาไม่ได้ + firestore.rules ห้าม list ทั้งคอลเลกชัน
// (คนนอกอ่านได้เฉพาะ doc ที่รู้ id เท่านั้น ไล่ดูห้องทั้งหมดไม่ได้) — ดูคอมเมนต์ใน data/meetings.js
//
// เป็นหน้า standalone (ไม่มี Nav/Footer/ปุ่มลอย/แชท) เพราะคนนอกไม่ควรถูกพาไปหน้าอื่นของมูลนิธิ
// และตั้ง noindex กัน search engine เก็บ URL ห้องประชุมเข้า index
export default function MeetGuest({ meetId }) {
  const { meeting, loading, notFound } = useMeeting(meetId)
  const [name, setName] = useState('')
  const [joined, setJoined] = useState(false)

  useEffect(() => {
    const tag = document.createElement('meta')
    tag.name = 'robots'
    tag.content = 'noindex, nofollow'
    document.head.appendChild(tag)
    const prevTitle = document.title
    document.title = 'เข้าร่วมประชุม — Ummatee'
    return () => { tag.remove(); document.title = prevTitle }
  }, [])

  const box = (children) => (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fdf4', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 32, maxWidth: 420, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,.1)', textAlign: 'center' }}>
        <img src="/logo.png" alt="Ummatee" style={{ height: 56, marginBottom: 20 }} />
        {children}
      </div>
    </main>
  )

  if (loading) return box(<p style={{ color: '#6b7280' }}>กำลังตรวจสอบลิงก์...</p>)

  if (notFound || !meeting) {
    return box(<>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d', marginBottom: 10 }}>ไม่พบห้องประชุมนี้</h1>
      <p style={{ color: '#6b7280', fontSize: '.92rem' }}>ลิงก์อาจไม่ถูกต้องหรือถูกยกเลิกแล้ว กรุณาขอลิงก์ใหม่จากผู้จัดประชุม</p>
    </>)
  }

  if (!isMeetingOpen(meeting)) {
    return box(<>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d', marginBottom: 10 }}>ห้องประชุมนี้ปิดแล้ว</h1>
      <p style={{ color: '#6b7280', fontSize: '.92rem' }}>
        {meeting.title ? `"${meeting.title}" ` : ''}ไม่เปิดให้เข้าร่วมแล้ว (ลิงก์หมดอายุหรือผู้จัดปิดห้อง)<br />
        กรุณาขอลิงก์ใหม่จากผู้จัดประชุม
      </p>
    </>)
  }

  if (!joined) {
    return box(<>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d', marginBottom: 6 }}>{meeting.title || 'ประชุมวิดีโอ'}</h1>
      <p style={{ color: '#6b7280', fontSize: '.9rem', marginBottom: 20 }}>มูลนิธิอุมมะตี เชิญคุณเข้าร่วมประชุม</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) setJoined(true) }}
        placeholder="ชื่อที่ให้แสดงในห้องประชุม"
        style={{ width: '100%', padding: '12px 14px', border: '1px solid #ddd', borderRadius: 10, fontSize: '.95rem', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14 }}
      />
      <button
        type="button"
        onClick={() => setJoined(true)}
        disabled={!name.trim()}
        style={{ width: '100%', padding: '13px 20px', border: 'none', borderRadius: 99, background: name.trim() ? '#15803d' : '#d1d5db', color: '#fff', fontWeight: 800, fontSize: '.95rem', fontFamily: 'inherit', cursor: name.trim() ? 'pointer' : 'default' }}
      >
        เข้าร่วมประชุม
      </button>
      <p style={{ color: '#9ca3af', fontSize: '.78rem', marginTop: 14 }}>ระบบจะขออนุญาตใช้กล้องและไมโครโฟนของคุณ</p>
    </>)
  }

  // ส่งชื่อผู้ใช้เข้า Jitsi ผ่าน hash config (userInfo.displayName) — ไม่ต้องพิมพ์ชื่อซ้ำในหน้า Jitsi
  const jitsiSrc = `https://meet.jit.si/${encodeURIComponent(meeting.room)}#userInfo.displayName=${encodeURIComponent(`"${name.trim()}"`)}&config.prejoinPageEnabled=false`

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#111' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', color: '#fff', fontSize: '.9rem' }}>
        <img src="/logo.png" alt="" style={{ height: 26 }} />
        <strong style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {meeting.title || 'ประชุมวิดีโอ'}
        </strong>
      </div>
      <iframe
        title="ประชุมวิดีโอ"
        src={jitsiSrc}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        style={{ flex: 1, width: '100%', border: 'none', display: 'block', minHeight: '80vh' }}
      />
    </main>
  )
}
