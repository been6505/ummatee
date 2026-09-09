import { useEffect, useMemo, useState } from 'react'
import VolunteerGuard from '../components/VolunteerGuard.jsx'
import { db } from '../firebase.js'
import { collection, getDocs } from 'firebase/firestore'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import { useAllowlistedAdmin } from '../useAdminRole.js'

import { IFTAR_SHEET_ENDPOINT as SEND_SCRIPT, fetchWithTimeout } from '../utils/endpoints.js'
import ListSkeleton from '../components/ListSkeleton.jsx'

// ── กลุ่มผู้รับที่รองรับ ────────────────────────────────────────────────────
const SOURCES = [
  {
    key: 'iftarRegs',
    label: 'Iftar For Gaza',
    defaultSubject: 'เตรียมตัวให้พร้อม! งาน Iftar For Gaza พรุ่งนี้แล้ว 🇵🇸',
    defaultHeader: 'แจ้งเตือนงาน Iftar For Gaza',
    refField: 'ref',
    filters: [
      { value: 'all', label: 'ทั้งหมด', fn: () => true },
      { value: 'notCheckedIn', label: 'ยังไม่เช็คอิน', fn: (r) => !r.checkedIn },
      { value: 'checkedIn', label: 'เช็คอินแล้ว', fn: (r) => !!r.checkedIn },
    ],
  },
  {
    key: 'give2Regs',
    label: 'ส่งต่อของ — คอมมือสอง (ผู้บริจาค)',
    defaultSubject: 'ขอบคุณที่ลงทะเบียนส่งมอบคอมมือสอง 💻',
    defaultHeader: 'ส่งต่อของ — งานให้ ครั้งที่ 6',
    refField: 'refCode',
    filters: [
      { value: 'all', label: 'ทั้งหมด', fn: () => true },
      { value: 'notDelivered', label: 'ยังไม่ส่งมอบ', fn: (r) => !r.delivered },
      { value: 'delivered', label: 'ส่งมอบแล้ว', fn: (r) => !!r.delivered },
    ],
  },
  {
    key: 'give2CookRegs',
    label: 'ส่งต่อของ — เครื่องมือประกอบอาชีพ (ผู้บริจาค)',
    defaultSubject: 'ขอบคุณที่ลงทะเบียนส่งมอบอุปกรณ์ 🍳',
    defaultHeader: 'ส่งต่อของ — งานให้ ครั้งที่ 6',
    refField: 'refCode',
    filters: [
      { value: 'all', label: 'ทั้งหมด', fn: () => true },
      { value: 'notDelivered', label: 'ยังไม่ส่งมอบ', fn: (r) => !r.delivered },
      { value: 'delivered', label: 'ส่งมอบแล้ว', fn: (r) => !!r.delivered },
    ],
  },
  {
    key: 'giveReceiveRegs',
    label: 'ผู้รับของ — งานให้ ครั้งที่ 6',
    defaultSubject: 'นัดหมายรับของ — งานให้ ครั้งที่ 6 🎁',
    defaultHeader: 'ผู้รับของ — งานให้ ครั้งที่ 6',
    refField: null,
    filters: [
      { value: 'all', label: 'ทั้งหมด', fn: () => true },
      { value: 'notReceived', label: 'ยังไม่รับมอบ', fn: (r) => !r.received },
      { value: 'received', label: 'รับมอบแล้ว', fn: (r) => !!r.received },
    ],
  },
  {
    key: 'volunteerRegs',
    label: 'อาสาสมัคร',
    defaultSubject: 'ขอบคุณที่สมัครเป็นอาสาสมัครอุมมะตี 🤝',
    defaultHeader: 'อาสาสมัครอุมมะตี',
    refField: 'ref',
    filters: [
      { value: 'all', label: 'ทั้งหมด', fn: () => true },
    ],
  },
]

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const safeHttpsUrl = (s) => { try { return new URL(s).protocol === 'https:' ? s : '' } catch { return '' } }

function buildEmailHtml(headerTitle, message, posterUrl, reg) {
  const name = esc(((reg.fname || '') + ' ' + (reg.lname || '')).trim())
  const ref = esc(reg.ref || reg.refCode || '')
  const safePoster = safeHttpsUrl(posterUrl)
  const qrVal = reg.ref || reg.refCode || ''
  const qrUrl = qrVal ? 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(qrVal) : ''

  return '<div style="font-family:Tahoma,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden">' +
    '<div style="background:#1b5e36;color:#fff;padding:24px;text-align:center">' +
    '<h1 style="margin:0;font-size:20px">📢 ' + esc(headerTitle) + '</h1>' +
    '<p style="margin:6px 0 0;opacity:.9">มูลนิธิอุมมะตี · Ummatee Foundation</p>' +
    '</div>' +
    (safePoster ? '<div style="text-align:center;padding:16px 16px 0"><img src="' + esc(safePoster) + '" alt="Poster" style="width:100%;max-width:500px;border-radius:10px"></div>' : '') +
    '<div style="padding:24px;color:#333;line-height:1.8">' +
    (name ? '<p>เรียน คุณ' + name + '</p>' : '') +
    '<pre style="white-space:pre-wrap;font-family:Tahoma,Arial,sans-serif;margin:0">' + message.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>' +
    '</div>' +
    (qrUrl ? '<div style="text-align:center;padding:0 24px 16px">' +
      '<div style="display:inline-block;background:#fff;border:2px solid #e5e7eb;border-radius:14px;padding:14px">' +
      '<img src="' + qrUrl + '" alt="QR Code" width="160" height="160" style="display:block;border-radius:8px">' +
      '</div>' +
      '<div style="margin-top:8px;font-size:22px;font-weight:800;color:#1b5e36;letter-spacing:1px">' + ref + '</div>' +
      '</div>' : '') +
    '<div style="padding:0 24px 22px;text-align:center;border-top:1px solid #f0f0f0">' +
    '<p style="color:#777;font-size:13px;margin:18px 0 12px">ติดตามอุมมะตี · Follow Ummatee</p>' +
    '<a href="https://www.facebook.com/UmmateeinThailand" style="display:inline-block;margin:3px;padding:8px 13px;background:#1877f2;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">Facebook</a>' +
    '<a href="https://www.instagram.com/ummatee.thailand" style="display:inline-block;margin:3px;padding:8px 13px;background:#e1306c;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">Instagram</a>' +
    '<a href="https://www.tiktok.com/@ummatee.thailand" style="display:inline-block;margin:3px;padding:8px 13px;background:#010101;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">TikTok</a>' +
    '<a href="https://www.youtube.com/@ummateethailand" style="display:inline-block;margin:3px;padding:8px 13px;background:#ff0000;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">YouTube</a>' +
    '<a href="https://line.me/R/ti/p/@745bvvgx" style="display:inline-block;margin:3px;padding:8px 13px;background:#06c755;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">LINE</a>' +
    '</div>' +
    '<div style="background:#faf3e0;color:#8a6d1a;padding:14px 24px;font-size:13px;text-align:center">' +
    '⚠️ อีเมลฉบับนี้เป็นข้อความอัตโนมัติ <b>ห้ามตอบกลับ</b>' +
    '</div>' +
    '</div>'
}

export default function AdminBroadcast() {
  const { user, loading: authLoading } = useAllowlistedAdmin()

  const [sourceKey, setSourceKey] = useState('iftarRegs')
  const [regs, setRegs] = useState([])
  const [loading, setLoading] = useState(true)

  const [headerTitle, setHeaderTitle] = useState(SOURCES[0].defaultHeader)
  const [subject, setSubject] = useState(SOURCES[0].defaultSubject)
  const [message, setMessage] = useState('')
  const [posterUrl, setPosterUrl] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 })
  const [log, setLog] = useState([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [testEmail, setTestEmail] = useState('')

  const sourceDef = SOURCES.find((s) => s.key === sourceKey) || SOURCES[0]

  // เมื่อเปลี่ยน source — โหลดข้อมูลใหม่ + reset filter + ตั้ง default subject/header
  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    setRegs([])
    setFilterStatus('all')
    setLog([])
    setProgress({ sent: 0, failed: 0, total: 0 })
    setHeaderTitle(sourceDef.defaultHeader)
    setSubject(sourceDef.defaultSubject)
    getDocs(collection(db, sourceKey))
      .then((snap) => { if (!cancelled) setRegs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))) })
      .catch(() => { if (!cancelled) setRegs([]) })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [user, sourceKey])

  const withEmail = regs.filter((r) => r.email && r.email.trim())

  const recipients = useMemo(() => {
    const filterDef = sourceDef.filters.find((f) => f.value === filterStatus) || sourceDef.filters[0]
    return withEmail.filter(filterDef.fn)
  }, [regs, sourceKey, filterStatus])

  const sendOne = async (reg, subj, msg, poster, header) => {
    const html = buildEmailHtml(header, msg, poster, reg)
    const idToken = await user.getIdToken()
    const res = await fetchWithTimeout(SEND_SCRIPT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'broadcast', idToken, email: reg.email, subject: subj, htmlBody: html }),
    })
    if (!res.ok) throw new Error(`server ${res.status}`)
    const out = await res.json()
    if (out.error) throw new Error(out.error)
    return out
  }

  const sendTest = async () => {
    if (!testEmail.trim()) return
    setSending(true)
    try {
      await sendOne({ fname: 'ทดสอบ', lname: 'ระบบ', ref: 'TEST-0000', email: testEmail.trim() }, '[ทดสอบ] ' + subject, message, posterUrl, headerTitle)
      setLog((l) => ['✅ ส่งทดสอบไปที่ ' + testEmail + ' สำเร็จ', ...l])
    } catch (e) {
      setLog((l) => ['❌ ส่งทดสอบล้มเหลว: ' + e.message, ...l])
    }
    setSending(false)
  }

  const sendAll = async () => {
    if (!recipients.length) return
    if (!window.confirm(`ยืนยันส่งอีเมลถึง ${recipients.length} คน?`)) return
    setSending(true)
    setProgress({ sent: 0, failed: 0, total: recipients.length })
    setLog([])
    let sent = 0, failed = 0
    for (const reg of recipients) {
      const refLabel = reg.ref || reg.refCode || reg.id
      try {
        await sendOne(reg, subject, message, posterUrl, headerTitle)
        sent++
        setLog((l) => ['✅ ' + reg.email + (refLabel ? ' (' + refLabel + ')' : ''), ...l])
      } catch (e) {
        failed++
        setLog((l) => ['❌ ' + reg.email + ': ' + e.message, ...l])
      }
      setProgress({ sent, failed, total: recipients.length })
      await new Promise((r) => setTimeout(r, 500))
    }
    setSending(false)
  }

  if (authLoading) return null
  if (!user) return <AdminLogin />

  return (
    <VolunteerGuard>
      <main className="admin-dash">
        <AdminNav />
        <div className="admin-wrap">
          <div className="admin-head">
            <div>
              <h1>📢 Broadcast — ส่งอีเมลแจ้งเตือน</h1>
              <p>ส่งอีเมลถึงกลุ่มผู้ลงทะเบียนจาก Firestore</p>
            </div>
          </div>

          {/* ── เลือกกลุ่มผู้รับ ── */}
          <div className="admin-card" style={{ marginBottom: 24 }}>
            <h4 style={{ marginBottom: 12 }}>กลุ่มผู้รับ (Collection)</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SOURCES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSourceKey(s.key)}
                  style={{
                    padding: '7px 16px', borderRadius: 99, border: 'none', cursor: 'pointer',
                    fontWeight: 700, fontSize: '.83rem',
                    background: sourceKey === s.key ? '#1b5e36' : '#f3f4f6',
                    color: sourceKey === s.key ? '#fff' : '#374151',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-stats" style={{ marginBottom: 24 }}>
            <div className="admin-stat"><div className="v">{loading ? '…' : regs.length}</div><div className="l">ทั้งหมด</div></div>
            <div className="admin-stat"><div className="v">{loading ? '…' : withEmail.length}</div><div className="l">มีอีเมล</div></div>
            <div className="admin-stat"><div className="v">{loading ? '…' : recipients.length}</div><div className="l">จะส่งถึง</div></div>
            <div className="admin-stat"><div className="v" style={{ color: '#2E7D52' }}>{progress.sent}</div><div className="l">ส่งสำเร็จ</div></div>
            <div className="admin-stat"><div className="v" style={{ color: '#c0392b' }}>{progress.failed}</div><div className="l">ล้มเหลว</div></div>
          </div>

          {loading ? (
            <ListSkeleton />
          ) : (
            <>
              {/* ── ตั้งค่าอีเมล ── */}
              <div className="admin-card" style={{ marginBottom: 24 }}>
                <h4>ตั้งค่าอีเมล</h4>
                <div className="admin-form-grid" style={{ marginBottom: 12 }}>

                  <label>กรองผู้รับ
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                      {sourceDef.filters.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label} ({withEmail.filter(f.fn).length} คน)
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>หัวข้ออีเมล (Email Header)
                    <input type="text" value={headerTitle} onChange={(e) => setHeaderTitle(e.target.value)} />
                  </label>

                  <label>Subject
                    <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
                  </label>

                  <label>URL โปสเตอร์ (เว้นว่างถ้าไม่ต้องการ)
                    <input type="text" value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} placeholder="https://..." />
                  </label>
                </div>

                <label style={{ display: 'block' }}>ข้อความ
                  <textarea
                    rows={10}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', marginTop: 4 }}
                  />
                </label>
              </div>

              {/* ── Preview ── */}
              <div className="admin-card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <h4>ตัวอย่างอีเมล</h4>
                  <button className="admin-btn" onClick={() => setPreviewOpen((v) => !v)}>
                    {previewOpen ? '🔽 ซ่อน' : '🔼 ดูตัวอย่าง'}
                  </button>
                </div>
                {previewOpen && (
                  <div
                    style={{ marginTop: 12, border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden', background: '#fff' }}
                    dangerouslySetInnerHTML={{ __html: buildEmailHtml(headerTitle, message, posterUrl, { fname: 'ทดสอบ', lname: 'ระบบ', ref: 'TEST-0000' }) }}
                  />
                )}
              </div>

              {/* ── ส่งทดสอบ ── */}
              <div className="admin-card" style={{ marginBottom: 24 }}>
                <h4>ส่งทดสอบ</h4>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="email"
                    placeholder="อีเมลทดสอบ"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, minWidth: 250 }}
                  />
                  <button className="admin-btn" onClick={sendTest} disabled={sending || !testEmail.trim()}>
                    {sending ? '⏳ กำลังส่ง...' : '📧 ส่งทดสอบ'}
                  </button>
                </div>
              </div>

              {/* ── ส่งจริง ── */}
              <div className="admin-card" style={{ marginBottom: 24 }}>
                <h4>ส่งจริง</h4>
                <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>
                  จะส่งอีเมลไปยัง <b>{recipients.length}</b> คน · ใช้เวลาประมาณ {Math.ceil(recipients.length * 0.5 / 60)} นาที
                </p>
                <button
                  className="admin-btn-primary"
                  onClick={sendAll}
                  disabled={sending || !recipients.length || !subject.trim() || !message.trim()}
                  style={{ fontSize: 16, padding: '12px 32px' }}
                >
                  {sending
                    ? `⏳ กำลังส่ง... (${progress.sent + progress.failed}/${progress.total})`
                    : `📢 ส่งอีเมลทั้งหมด (${recipients.length} คน)`}
                </button>

                {sending && progress.total > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ background: '#eee', borderRadius: 8, height: 24, overflow: 'hidden' }}>
                      <div style={{
                        width: `${((progress.sent + progress.failed) / progress.total) * 100}%`,
                        height: '100%',
                        background: progress.failed > 0 ? 'linear-gradient(90deg,#2E7D52,#c0392b)' : '#2E7D52',
                        transition: 'width 0.3s',
                        borderRadius: 8,
                      }} />
                    </div>
                    <div style={{ fontSize: 13, marginTop: 4, opacity: 0.7 }}>
                      {progress.sent + progress.failed}/{progress.total} — สำเร็จ {progress.sent} ล้มเหลว {progress.failed}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Log ── */}
              {log.length > 0 && (
                <div className="admin-card">
                  <h4>ประวัติการส่ง ({log.length})</h4>
                  <div style={{ maxHeight: 400, overflow: 'auto', fontSize: 13 }}>
                    {log.map((l, i) => (
                      <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid #eee' }}>{l}</div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </VolunteerGuard>
  )
}
