import { useState } from 'react'
import { auth } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import ListSkeleton from '../components/ListSkeleton.jsx'
import FileAttachments from '../components/FileAttachments.jsx'
import { createGoogleDoc, isGoogleConfigured } from '../utils/googleDrive.js'
import { addAttachment } from '../data/attachments.js'
import { writeAuditLog } from '../lib/auditLog.js'
import {
  useMeetings, createMeeting, closeMeeting, reopenMeeting, deleteMeeting, meetingUrl, isMeetingOpen,
} from '../data/meetings.js'
import { LIVE_STUDIO_URL } from '../utils/endpoints.js'

// ประชุมวิดีโอ (/admin/video-call) — ฝัง Jitsi Meet (meet.jit.si) ฟรี ไม่ต้องมีเซิร์ฟเวอร์/สมัครบัญชี
//
// เชิญคนนอกได้ด้วยลิงก์ /meet/<id> ที่ id เป็น UUID สุ่ม (เดาไม่ได้) คนนอกไม่ต้องล็อกอิน
// แต่ไม่ถือว่า public เพราะไม่มีลิงก์มาหน้านี้จากที่ไหนในเว็บ และ list ห้องทั้งหมดได้เฉพาะ staff
// รายละเอียดข้อจำกัดด้านความปลอดภัยอยู่ในคอมเมนต์หัวไฟล์ data/meetings.js
const HOUR_OPTIONS = [
  { v: 3, label: '3 ชั่วโมง' },
  { v: 24, label: '1 วัน' },
  { v: 24 * 7, label: '7 วัน' },
]

const timeLabel = (ms) => (ms ? new Date(ms).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')

export default function AdminVideoCall() {
  const { meetings, loading } = useMeetings()
  const [title, setTitle] = useState('')
  const [hours, setHours] = useState(24)
  const [busy, setBusy] = useState(false)
  const [activeRoom, setActiveRoom] = useState(null) // ห้องที่ staff กำลังเปิดดูอยู่ในหน้านี้
  const [copied, setCopied] = useState('')
  // สตูดิโอไลฟ์เป็นห้องภายนอกห้องเดียวที่ตั้งไว้ตายตัว (ดู LIVE_STUDIO_URL) ไม่ใช่ห้องที่สร้างในระบบนี้
  // ไม่โหลด iframe ไว้ตั้งแต่แรก — มันเปิดกล้อง/ไมค์และเป็นเซิร์ฟเวอร์ที่ต้องปลุกก่อนใช้ (onrender)
  // การโหลดค้างไว้ทุกครั้งที่เปิดหน้านี้จึงเปลืองโดยเปล่าประโยชน์เมื่อแค่มาสร้างห้องประชุมธรรมดา
  const [studioOpen, setStudioOpen] = useState(false)

  const copy = async (id) => {
    try {
      await navigator.clipboard.writeText(meetingUrl(id))
      setCopied(id)
      setTimeout(() => setCopied(''), 2000)
    } catch { window.prompt('คัดลอกลิงก์นี้เพื่อส่งให้ผู้เข้าร่วม', meetingUrl(id)) }
  }

  const create = async () => {
    if (busy) return
    setBusy(true)
    try {
      const m = await createMeeting({ title, hours, createdBy: auth.currentUser?.email || '' })
      writeAuditLog({ action: 'create', entityType: 'meeting', entityId: m.id, summary: `สร้างห้องประชุม ${m.title || m.room}` })
      setTitle('')
      // คัดลอกลิงก์ให้ทันทีหลังสร้าง — ขั้นตอนถัดไปที่ผู้ใช้ต้องทำแน่ๆ คือส่งลิงก์ให้คนอื่น
      await copy(m.id)
    } catch (e) {
      window.alert('สร้างห้องไม่สำเร็จ: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  // สร้าง Google Doc จดบันทึกการประชุม แล้วแนบเข้าห้องให้เลย — ทีมกดลิงก์เดียวเจอบันทึกได้ทันที
  // เอกสารสร้างในไดรฟ์ของ "คนที่กดปุ่ม" (ไม่มีบัญชีกลาง) จึงต้องเตือนให้ตั้งแชร์ให้ทีมเองด้วย
  const [docBusy, setDocBusy] = useState(false)
  const makeNotesDoc = async (m) => {
    if (docBusy) return
    setDocBusy(true)
    try {
      const dateLabel = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
      const doc = await createGoogleDoc(`บันทึกการประชุม — ${m.title || 'ประชุมวิดีโอ'} (${dateLabel})`)
      await addAttachment({
        entityType: 'meeting', entityId: m.id, url: doc.url, title: doc.name,
        addedBy: auth.currentUser?.email || '',
      })
      window.alert('สร้างเอกสารจดบันทึกและแนบเข้าห้องแล้ว\n\nเอกสารอยู่ใน Google Drive ของบัญชีที่คุณกดอนุญาต — อย่าลืมกด "แชร์" ให้ทีมด้วย ไม่งั้นคนอื่นเปิดไม่ได้')
    } catch (e) {
      window.alert('สร้างเอกสารไม่สำเร็จ: ' + e.message)
    } finally {
      setDocBusy(false)
    }
  }

  const close = async (m) => {
    if (!window.confirm(`ปิดห้อง "${m.title || m.room}"?\n\nลิงก์เชิญที่ส่งไปแล้วจะใช้เข้าห้องไม่ได้อีก`)) return
    await closeMeeting(m.id).catch((e) => window.alert('ปิดห้องไม่สำเร็จ: ' + e.message))
    writeAuditLog({ action: 'update', entityType: 'meeting', entityId: m.id, summary: `ปิดห้องประชุม ${m.title || m.room}` })
  }

  const remove = async (m) => {
    if (!window.confirm(`ลบห้อง "${m.title || m.room}" ถาวร?`)) return
    await deleteMeeting(m.id).catch((e) => window.alert('ลบไม่สำเร็จ: ' + e.message))
    writeAuditLog({ action: 'delete', entityType: 'meeting', entityId: m.id, summary: `ลบห้องประชุม ${m.title || m.room}` })
  }

  return (
    <StaffRoleGuard allowedRoles={['admin', 'staff', 'field', 'social']}>
      {() => (
        <main className="admin-dash">
          <AdminNav />
          <div className="admin-wrap">
            <div className="admin-head">
              <div>
                <h1>ประชุมวิดีโอ</h1>
                <p>สร้างห้องแล้วส่งลิงก์เชิญให้คนนอกเข้าร่วมได้ โดยไม่ต้องให้เขาล็อกอินหรือสมัครบัญชี</p>
              </div>
            </div>

            {/* สตูดิโอไลฟ์ (บริการภายนอก) — ห้องประจำที่ทีมใช้ถ่ายทอดสด แยกจากห้องประชุมที่สร้างเองด้านล่าง */}
            <div className="admin-card" style={{ marginBottom: 20, padding: studioOpen ? 0 : undefined, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: studioOpen ? '12px 16px' : 0 }}>
                <div style={{ minWidth: 0 }}>
                  <h4 style={{ margin: 0 }}>🎥 สตูดิโอไลฟ์</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '.85rem', color: 'var(--ink-soft)' }}>
                    ห้องสตูดิโอประจำสำหรับถ่ายทอดสด — เปิดในหน้านี้ได้เลย หรือเปิดแท็บใหม่ถ้าต้องแชร์หน้าจอ
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className={studioOpen ? 'admin-btn-danger' : 'admin-btn-primary'} onClick={() => setStudioOpen((v) => !v)}>
                    {studioOpen ? 'ปิดสตูดิโอ' : 'เปิดสตูดิโอ'}
                  </button>
                  {/* noopener/noreferrer — แท็บที่เปิดออกไปต้องแตะ window.opener ของหน้าแอดมินไม่ได้ */}
                  <a className="admin-btn" href={LIVE_STUDIO_URL} target="_blank" rel="noopener noreferrer">เปิดแท็บใหม่ ↗</a>
                </div>
              </div>
              {studioOpen && (
                <iframe
                  title="สตูดิโอไลฟ์"
                  src={LIVE_STUDIO_URL}
                  allow="camera; microphone; fullscreen; display-capture; autoplay"
                  style={{ width: '100%', height: '78vh', border: 'none', display: 'block' }}
                />
              )}
            </div>

            {/* ห้องที่กำลังเปิดดูอยู่ — ฝัง Jitsi ในหน้าแอดมินเลย ไม่ต้องเปิดแท็บใหม่ */}
            {activeRoom && (
              <div className="admin-card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
                  <strong style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeRoom.title || 'ประชุมวิดีโอ'}
                  </strong>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {isGoogleConfigured() && (
                      <button className="admin-btn" onClick={() => makeNotesDoc(activeRoom)} disabled={docBusy}>
                        {docBusy ? 'กำลังสร้าง...' : '+ Doc จดบันทึก'}
                      </button>
                    )}
                    <button className="admin-btn-danger" onClick={() => setActiveRoom(null)}>ออกจากห้อง</button>
                  </div>
                </div>
                <iframe
                  title="Jitsi Meet"
                  src={`https://meet.jit.si/${encodeURIComponent(activeRoom.room)}`}
                  allow="camera; microphone; fullscreen; display-capture; autoplay"
                  style={{ width: '100%', height: '78vh', border: 'none', display: 'block' }}
                />
                {/* เอกสารประกอบการประชุม (วาระ/สไลด์/ชีตจดบันทึก) — แนบไว้ที่ห้องให้ทีมเปิดพร้อมกันได้ */}
                <div style={{ padding: '4px 16px 18px' }}>
                  <FileAttachments entityType="meeting" entityId={activeRoom.id} />
                </div>
              </div>
            )}

            <div className="admin-card" style={{ marginBottom: 20 }}>
              <h4>สร้างห้องประชุมใหม่</h4>
              <div className="admin-form-grid">
                <label>หัวข้อประชุม
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create() } }}
                    placeholder="เช่น ประชุมทีมอาสา งานให้ครั้งที่ 6"
                  />
                </label>
                <label>ลิงก์เชิญใช้ได้นาน
                  <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                    {HOUR_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                  </select>
                </label>
              </div>
              <button className="admin-btn-primary" style={{ marginTop: 14 }} onClick={create} disabled={busy}>
                {busy ? 'กำลังสร้าง...' : 'สร้างห้อง + คัดลอกลิงก์เชิญ'}
              </button>
              <p style={{ color: 'var(--ink-soft)', fontSize: '.8rem', marginTop: 12, lineHeight: 1.7 }}>
                ลิงก์เชิญเป็นรหัสสุ่มที่เดาไม่ได้ และไม่มีลิงก์มาหน้านี้จากที่ไหนในเว็บ — ใครมีลิงก์เท่านั้นที่เข้าได้<br />
                หากเป็นการประชุมที่มีข้อมูลอ่อนไหว แนะนำให้กด <strong>Security</strong> ในห้อง Jitsi แล้วตั้งรหัสห้องเพิ่มอีกชั้น
                เพราะห้องของ meet.jit.si เป็นบริการภายนอกที่เราคุมสิทธิ์ไม่ได้
              </p>
            </div>

            <div className="admin-card">
              <h4>ห้องประชุม ({meetings.length})</h4>
              {loading ? <ListSkeleton /> : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr><th>หัวข้อ</th><th>สร้างโดย</th><th>สร้างเมื่อ</th><th>ใช้ได้ถึง</th><th>สถานะ</th><th></th></tr>
                    </thead>
                    <tbody>
                      {meetings.map((m) => {
                        const open = isMeetingOpen(m)
                        return (
                          <tr key={m.id}>
                            <td>{m.title || <span style={{ color: '#999' }}>(ไม่มีหัวข้อ)</span>}</td>
                            <td style={{ color: 'var(--ink-soft)', fontSize: '.85rem' }}>{m.createdBy || '—'}</td>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '.85rem' }}>{timeLabel(m.createdAt)}</td>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '.85rem' }}>{timeLabel(m.expiresAt)}</td>
                            <td>
                              <span style={{ color: open ? '#15803d' : '#dc2626', fontWeight: 700, fontSize: '.85rem' }}>
                                {open ? 'เปิด' : (m.active === false ? 'ปิดแล้ว' : 'หมดอายุ')}
                              </span>
                            </td>
                            <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {open && <button className="admin-btn" onClick={() => setActiveRoom(m)}>เข้าห้อง</button>}
                              {open && (
                                <button className="admin-btn" onClick={() => copy(m.id)}>
                                  {copied === m.id ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์เชิญ'}
                                </button>
                              )}
                              {open
                                ? <button className="admin-btn-danger" onClick={() => close(m)}>ปิดห้อง</button>
                                : <button className="admin-btn" onClick={() => reopenMeeting(m.id).catch((e) => window.alert('เปิดห้องใหม่ไม่สำเร็จ: ' + e.message))}>เปิดใหม่</button>}
                              <button className="admin-btn-danger" onClick={() => remove(m)}>ลบ</button>
                            </td>
                          </tr>
                        )
                      })}
                      {meetings.length === 0 && (
                        <tr><td colSpan="6" style={{ textAlign: 'center', color: '#999' }}>ยังไม่มีห้องประชุม</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      )}
    </StaffRoleGuard>
  )
}
