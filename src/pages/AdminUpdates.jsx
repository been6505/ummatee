import { useState } from 'react'
import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import ListSkeleton from '../components/ListSkeleton.jsx'
import PhotoUploader from '../components/PhotoUploader.jsx'
import { useAllUpdates, saveUpdate, removeUpdate } from '../data/updates.js'
import {
  UPDATE_CATEGORIES, CATEGORY_LABEL, CATEGORY_COLOR, normCategory,
  UPDATE_STATUS, normUpdateStatus, cleanPhotos, MAX_PHOTOS,
} from '../data/publicUpdates.js'
import { optImg } from '../utils/cloudinaryUrl.js'
import { writeAuditLog } from '../lib/auditLog.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faPen, faPlus, faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'

// เขียน/เผยแพร่ข่าวความคืบหน้า (/admin/updates) — หน้าสาธารณะคือ /updates
//
// ข่าวเริ่มที่ "ฉบับร่าง" เสมอ ต้องกดเผยแพร่อีกทีถึงขึ้นเว็บ (บังคับซ้ำที่ firestore.rules)
export const UPDATES_ROLES = ['admin', 'staff', 'social', 'field']

const EMPTY = { title: '', summary: '', body: '', category: 'relief', place: '', date: '', photos: [], authorName: '' }

export default function AdminUpdates() {
  return (
    <StaffRoleGuard allowedRoles={UPDATES_ROLES}>
      {(staff) => <Body staffName={staff?.name || staff?.email || ''} />}
    </StaffRoleGuard>
  )
}

function Body({ staffName }) {
  const { items, loading, error } = useAllUpdates(true)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const startNew = () => { setForm({ ...EMPTY, authorName: staffName }); setEditId(null); setOpen(true); setStatus('') }
  const startEdit = (u) => {
    setForm({ ...EMPTY, ...u, photos: cleanPhotos(u.photos) })
    setEditId(u.id); setOpen(true); setStatus('')
  }

  const submit = async (publish) => {
    setBusy(true)
    setStatus('')
    try {
      const r = await saveUpdate(editId, { ...form, status: publish ? 'published' : 'draft' })
      if (!r.ok) { setStatus(r.error); return }
      writeAuditLog({
        action: editId ? 'update' : 'create',
        entityType: 'publicUpdate',
        entityId: r.id,
        summary: `${publish ? 'เผยแพร่' : 'บันทึกร่าง'}: ${form.title}`,
      })
      setStatus(publish ? 'เผยแพร่แล้ว ✓' : 'บันทึกฉบับร่างแล้ว ✓')
      setEditId(r.id) // แก้ต่อได้เลย ไม่ต้องหาใหม่ในรายการ
    } catch (e) {
      setStatus('บันทึกไม่สำเร็จ: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  const drafts = items.filter((u) => normUpdateStatus(u.status) === 'draft').length

  return (
    <main className="admin-dash">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1>ข่าวความคืบหน้า</h1>
            <p>เขียนรายงานการช่วยเหลือให้คนภายนอกอ่าน — ขึ้นที่หน้า /updates เมื่อกดเผยแพร่</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a className="admin-btn" href="/updates" target="_blank" rel="noopener noreferrer">
              <FontAwesomeIcon icon={faUpRightFromSquare} /> ดูหน้าจริง
            </a>
            <button className="admin-btn-primary" onClick={startNew}>
              <FontAwesomeIcon icon={faPlus} /> เขียนข่าวใหม่
            </button>
          </div>
        </div>

        {open && (
          <div className="admin-card upd-form">
            <div className="admin-card-head">
              <h3>{editId ? 'แก้ไขข่าว' : 'เขียนข่าวใหม่'}</h3>
              <button className="admin-btn" onClick={() => setOpen(false)}>ปิด</button>
            </div>

            <label>หัวข้อ *
              <input value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={120} placeholder="เช่น ส่งมอบอาหาร 500 ชุดที่กาซ่า" />
            </label>

            <div className="upd-form-row">
              <label>หมวด
                <select value={form.category} onChange={(e) => set('category', e.target.value)}>
                  {UPDATE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </label>
              <label>วันที่
                <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
              </label>
              <label>สถานที่
                <input value={form.place} onChange={(e) => set('place', e.target.value)} maxLength={80} placeholder="เช่น ฉนวนกาซ่า" />
              </label>
            </div>

            <label>คำโปรย (ไม่ใส่ก็ได้ ระบบตัดจากเนื้อหาให้)
              <input value={form.summary} onChange={(e) => set('summary', e.target.value)} maxLength={300} />
            </label>

            <label>เนื้อหา *
              <textarea rows={8} value={form.body} onChange={(e) => set('body', e.target.value)} maxLength={4000} placeholder="เล่าว่าทำอะไร ที่ไหน ช่วยใครได้บ้าง" />
            </label>

            <PhotoUploader
              photos={form.photos}
              max={MAX_PHOTOS}
              onChange={(next) => set('photos', next)}
            />

            <label>ผู้รายงาน
              <input value={form.authorName} onChange={(e) => set('authorName', e.target.value)} maxLength={60} />
            </label>

            {status && <p className="upd-form-status">{status}</p>}

            <div className="upd-form-actions">
              <button className="admin-btn" disabled={busy} onClick={() => submit(false)}>บันทึกฉบับร่าง</button>
              <button className="admin-btn-primary" disabled={busy} onClick={() => submit(true)}>เผยแพร่ขึ้นเว็บ</button>
            </div>
          </div>
        )}

        <div className="admin-card hk-toolbar">
          <span>ทั้งหมด {items.length} ข่าว · ฉบับร่าง {drafts}</span>
        </div>

        {loading ? <ListSkeleton rows={3} /> : error ? (
          <div className="admin-card mywork-note mywork-note-error">โหลดรายการข่าวไม่สำเร็จ — ลองรีเฟรชหน้าอีกครั้ง</div>
        ) : items.length === 0 ? (
          <div className="admin-card" style={{ textAlign: 'center', padding: 36, color: 'var(--ink-soft)' }}>
            ยังไม่มีข่าว — กด "เขียนข่าวใหม่" เพื่อเริ่ม
          </div>
        ) : (
          <div className="fb-list">
            {items.map((u) => {
              const k = normCategory(u.category)
              const st = normUpdateStatus(u.status)
              return (
                <div key={u.id} className="admin-card fb-card" style={{ borderLeft: `4px solid ${st === 'published' ? '#2e7d32' : '#b45309'}` }}>
                  <div className="fb-top">
                    <strong>{u.title}</strong>
                    <span className="fb-time">{UPDATE_STATUS[st]}</span>
                  </div>
                  <div className="fb-meta">
                    <span style={{ color: CATEGORY_COLOR[k] }}>{CATEGORY_LABEL[k]}</span>
                    {u.date && <span>{u.date}</span>}
                    {u.place && <span>{u.place}</span>}
                  </div>
                  <p className="fb-text">{u.summary}</p>
                  {cleanPhotos(u.photos).length > 0 && (
                    <div className="fb-photos">
                      {cleanPhotos(u.photos).map((p, i) => <img key={i} src={optImg(p, 300)} alt="" loading="lazy" />)}
                    </div>
                  )}
                  <div className="fb-actions">
                    <button className="admin-btn" onClick={() => startEdit(u)}><FontAwesomeIcon icon={faPen} /> แก้ไข</button>
                    <button
                      className="admin-btn-danger"
                      onClick={() => {
                        if (!window.confirm(`ลบข่าว "${u.title}" ถาวร?`)) return
                        removeUpdate(u.id).catch((e) => window.alert('ลบไม่สำเร็จ: ' + e.message))
                      }}
                      aria-label="ลบข่าว"
                    ><FontAwesomeIcon icon={faTrash} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
