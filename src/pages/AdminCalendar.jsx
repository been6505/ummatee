import { useEffect, useMemo, useState } from 'react'
import { collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'

// ปฏิทินวางแผนคอนเทนต์ (/admin/calendar) — เพิ่มกิจกรรม/โพสต์ ตั้งเวลา เลือกแพลตฟอร์ม (ข้อความเท่านั้น เพิ่มรูป/วิดีโอได้ทีหลัง)
// เก็บใน Firestore (collection: contentPosts)
// หมายเหตุ: ระบบนี้เก็บ "แผนโพสต์" — การโพสต์จริงลงแต่ละแพลตฟอร์มยังต้องทำผ่านแอปของแพลตฟอร์มนั้น

const PLATFORMS = [
  { id: 'facebook', label: 'Facebook', color: '#1877f2' },
  { id: 'instagram', label: 'Instagram', color: '#e1306c' },
  { id: 'tiktok', label: 'TikTok', color: '#111' },
  { id: 'youtube', label: 'YouTube', color: '#ff0000' },
  { id: 'x', label: 'X', color: '#444' },
  { id: 'line', label: 'LINE', color: '#06c755' },
]

const STATUS = { draft: 'ฉบับร่าง', scheduled: 'ตั้งเวลาแล้ว', posted: 'โพสต์แล้ว' }
const STATUS_COLOR = { draft: '#999', scheduled: '#c9a84c', posted: '#2e7d52' }

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const TH_DAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

const pad = (n) => String(n).padStart(2, '0')
const dateKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`
const todayKey = () => { const t = new Date(); return dateKey(t.getFullYear(), t.getMonth(), t.getDate()) }

const EMPTY_FORM = { title: '', text: '', time: '10:00', platforms: [], status: 'scheduled' }

export default function AdminCalendar() {
  const { user, loading } = useAdminAuth()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-11
  const [selected, setSelected] = useState(todayKey())

  const [posts, setPosts] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'contentPosts'), (snap) => {
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  // โพสต์จัดกลุ่มตามวันที่ ใช้แสดงจุดบนปฏิทิน
  const byDate = useMemo(() => {
    const m = {}
    posts.forEach((p) => { (m[p.date] = m[p.date] || []).push(p) })
    Object.values(m).forEach((arr) => arr.sort((a, b) => (a.time || '').localeCompare(b.time || '')))
    return m
  }, [posts])

  if (loading) return null
  if (!user) return <AdminLogin />

  // ตารางวันของเดือนที่แสดง (เริ่มวันอาทิตย์)
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(year - 1) } else setMonth(month - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(year + 1) } else setMonth(month + 1) }

  const togglePlatform = (id) => {
    setForm((f) => ({
      ...f,
      platforms: f.platforms.includes(id) ? f.platforms.filter((p) => p !== id) : [...f.platforms, id],
    }))
  }

  const startEdit = (p) => {
    setEditId(p.id)
    setForm({ title: p.title, text: p.text || '', time: p.time || '10:00', platforms: p.platforms || [], status: p.status || 'scheduled' })
  }
  const cancelEdit = () => { setEditId(null); setForm(EMPTY_FORM) }

  const save = async () => {
    if (!form.title.trim()) { setStatus('กรุณากรอกชื่อกิจกรรม/โพสต์'); return }
    setStatus('กำลังบันทึก...')
    try {
      const payload = {
        date: selected,
        time: form.time,
        title: form.title.trim(),
        text: form.text.trim(),
        platforms: form.platforms,
        status: form.status,
      }
      if (editId) {
        await updateDoc(doc(db, 'contentPosts', editId), payload)
      } else {
        await addDoc(collection(db, 'contentPosts'), { ...payload, createdAt: Date.now() })
      }
      cancelEdit()
      setStatus('บันทึกสำเร็จ ✓')
      setTimeout(() => setStatus(''), 2000)
    } catch (e) {
      setStatus('เกิดข้อผิดพลาด: ' + e.message)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('ลบโพสต์นี้?')) return
    try { await deleteDoc(doc(db, 'contentPosts', id)) } catch (e) { window.alert('ลบไม่สำเร็จ: ' + e.message) }
  }

  const markPosted = async (p) => {
    try { await updateDoc(doc(db, 'contentPosts', p.id), { status: 'posted' }) } catch (e) { window.alert(e.message) }
  }

  const dayPosts = byDate[selected] || []
  const selDate = new Date(selected)

  return (
    <main className="admin-dash admin-qurban">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1>ปฏิทินคอนเทนต์</h1>
            <p>วางแผนกิจกรรมและโพสต์ลงโซเชียล — เลือกวัน เพิ่มโพสต์ ตั้งเวลา เลือกแพลตฟอร์ม</p>
          </div>
        </div>

        <div className="admin-cal-layout">
          {/* ปฏิทินรายเดือน */}
          <div className="admin-card admin-cal-card">
            <div className="admin-cal-head">
              <button className="admin-btn" onClick={prevMonth}>‹</button>
              <h4>{TH_MONTHS[month]} {year + 543}</h4>
              <button className="admin-btn" onClick={nextMonth}>›</button>
            </div>
            <div className="admin-cal-grid">
              {TH_DAYS.map((d) => <div className="admin-cal-dow" key={d}>{d}</div>)}
              {cells.map((d, i) => {
                if (d === null) return <div key={`e${i}`} />
                const key = dateKey(year, month, d)
                const has = byDate[key] || []
                return (
                  <button
                    key={key}
                    className={`admin-cal-day ${key === selected ? 'sel' : ''} ${key === todayKey() ? 'today' : ''}`}
                    onClick={() => { setSelected(key); cancelEdit() }}
                  >
                    <span>{d}</span>
                    {has.length > 0 && (
                      <span className="admin-cal-dots">
                        {has.slice(0, 3).map((p, j) => <i key={j} style={{ background: STATUS_COLOR[p.status] || '#999' }} />)}
                        {has.length > 3 && <em>+{has.length - 3}</em>}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="admin-cal-legend">
              {Object.entries(STATUS).map(([k, v]) => (
                <span key={k}><i style={{ background: STATUS_COLOR[k] }} /> {v}</span>
              ))}
            </div>
          </div>

          {/* รายการโพสต์ของวันที่เลือก + ฟอร์ม */}
          <div className="admin-cal-side">
            <div className="admin-card">
              <h4>{selDate.getDate()} {TH_MONTHS[selDate.getMonth()]} {selDate.getFullYear() + 543} — {dayPosts.length} โพสต์</h4>
              {dayPosts.length === 0 && <p style={{ color: '#999', fontSize: '.9rem' }}>ยังไม่มีโพสต์ในวันนี้</p>}
              {dayPosts.map((p) => (
                <div className="admin-post" key={p.id}>
                  <div className="admin-post-top">
                    <strong>{p.time} · {p.title}</strong>
                    <span className="admin-post-status" style={{ background: STATUS_COLOR[p.status] }}>{STATUS[p.status]}</span>
                  </div>
                  {p.text && <p className="admin-post-text">{p.text}</p>}
                  <div className="admin-post-platforms">
                    {(p.platforms || []).map((id) => {
                      const pl = PLATFORMS.find((x) => x.id === id)
                      return pl ? <span key={id} style={{ background: pl.color }}>{pl.label}</span> : null
                    })}
                  </div>
                  <div className="admin-post-actions">
                    {p.status !== 'posted' && <button className="admin-btn" onClick={() => markPosted(p)}>✓ โพสต์แล้ว</button>}
                    <button className="admin-btn" onClick={() => startEdit(p)}>แก้ไข</button>
                    <button className="admin-btn-danger" onClick={() => remove(p.id)}>ลบ</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="admin-card">
              <h4>{editId ? 'แก้ไขโพสต์' : 'เพิ่มกิจกรรม / โพสต์ใหม่'}</h4>
              <div className="admin-cal-form">
                <label>ชื่อกิจกรรม/โพสต์
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="เช่น โพสต์อัปเดตภารกิจกุรบาน" />
                </label>
                <label>ข้อความ/แคปชัน
                  <textarea rows="4" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="เนื้อหาที่จะโพสต์..." />
                </label>
                <div className="admin-cal-form-row">
                  <label>เวลาโพสต์
                    <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                  </label>
                  <label>สถานะ
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </label>
                </div>
                <label>แพลตฟอร์ม</label>
                <div className="admin-cal-platforms">
                  {PLATFORMS.map((pl) => (
                    <button
                      key={pl.id}
                      type="button"
                      className={form.platforms.includes(pl.id) ? 'on' : ''}
                      style={form.platforms.includes(pl.id) ? { background: pl.color, borderColor: pl.color, color: '#fff' } : {}}
                      onClick={() => togglePlatform(pl.id)}
                    >
                      {pl.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
                  <button className="admin-btn-primary" onClick={save}>{editId ? 'บันทึกการแก้ไข' : 'เพิ่มโพสต์'}</button>
                  {editId && <button className="admin-btn" onClick={cancelEdit}>ยกเลิก</button>}
                  {status && <span style={{ fontSize: '.85rem' }}>{status}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
