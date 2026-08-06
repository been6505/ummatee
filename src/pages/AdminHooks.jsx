import { useMemo, useState } from 'react'
import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import ListSkeleton from '../components/ListSkeleton.jsx'
import { useContentHooks, addHook, removeHook, markHookUsed } from '../data/contentHooks.js'
import { HOOK_CATEGORIES, HOOK_CATEGORY_LABEL, normHookCategory, matchesHook, MAX_HOOK_LEN } from '../data/hooks.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBolt, faCopy, faCheck, faTrash, faPlus } from '@fortawesome/free-solid-svg-icons'

// คลัง HOOK (/admin/hooks) — ประโยคเปิดที่ใช้ได้ผล เก็บไว้หยิบใช้ซ้ำแทนที่จะคิดใหม่ทุกครั้ง
//
// ตรรกะจัดหมวด/ค้นหา/เรียง อยู่ใน data/hooks.js (เทสต์ได้ ไม่แตะ firebase)
// หน้านี้ทำหน้าที่แสดงผลกับสั่งงานเท่านั้น
export default function AdminHooks() {
  const { hooks, loading } = useContentHooks()
  const [text, setText] = useState('')
  const [category, setCategory] = useState('question')
  const [note, setNote] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [copiedId, setCopiedId] = useState('')
  const [busy, setBusy] = useState(false)

  const rows = useMemo(
    () => hooks.filter((h) => filter === 'all' || normHookCategory(h.category) === filter).filter((h) => matchesHook(h, search)),
    [hooks, filter, search]
  )

  const counts = useMemo(() => {
    const c = { all: hooks.length }
    for (const k of HOOK_CATEGORIES) c[k.key] = 0
    for (const h of hooks) c[normHookCategory(h.category)] += 1
    return c
  }, [hooks])

  const save = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      await addHook({ text, category, note })
      setText(''); setNote('')
    } catch (e) {
      window.alert('บันทึกไม่สำเร็จ: ' + e.message)
    } finally { setBusy(false) }
  }

  // คัดลอกแล้วนับว่าใช้ — ตัวเลขนี้คือสิ่งเดียวที่บอกได้ว่า hook ไหนได้ผลจริง
  // นับตอนคัดลอกเพราะนั่นคือจังหวะที่มันถูกเอาไปใช้ ไม่ใช่ตอนเปิดหน้าดู
  const use = async (h) => {
    try {
      await navigator.clipboard.writeText(h.text)
      setCopiedId(h.id)
      setTimeout(() => setCopiedId(''), 1800)
    } catch {
      window.prompt('คัดลอก hook นี้', h.text)
    }
    markHookUsed(h.id).catch(() => {}) // นับพลาดไม่ควรทำให้การคัดลอกดูเหมือนล้มเหลว
  }

  return (
    <StaffRoleGuard allowedRoles={['admin', 'staff', 'social']}>
      {() => (
        <main className="admin-dash">
          <AdminNav />
          <div className="admin-wrap">
            <div className="admin-head">
              <div>
                <h1><FontAwesomeIcon icon={faBolt} /> คลัง HOOK</h1>
                <p>ประโยคเปิดที่ใช้ได้ผล เก็บไว้หยิบมาใช้ซ้ำ — เรียงตัวที่ใช้บ่อยไว้บนสุด</p>
              </div>
              <span className="hk-total">{hooks.length} hook</span>
            </div>

            <div className="admin-card hk-add">
              <label>เพิ่ม hook ใหม่
                <textarea
                  rows={2}
                  value={text}
                  maxLength={MAX_HOOK_LEN}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() } }}
                  placeholder="เช่น รู้ไหมว่าคนไทย 70% ยังไม่เคยบริจาคออนไลน์"
                />
              </label>
              <div className="hk-add-row">
                <label>หมวด
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    {HOOK_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </label>
                <label>โน้ต (ไม่บังคับ)
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ใช้กับแคมเปญปลายปี" />
                </label>
                <button className="admin-btn-primary" onClick={save} disabled={!text.trim() || busy}>
                  <FontAwesomeIcon icon={faPlus} /> {busy ? 'กำลังบันทึก…' : 'เพิ่ม'}
                </button>
              </div>
              <p className="hk-hint">{HOOK_CATEGORIES.find((c) => c.key === category)?.hint}</p>
            </div>

            <div className="admin-card hk-toolbar">
              <input type="search" placeholder="ค้นหาใน hook / หมวด / โน้ต" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="hk-filters">
                <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>ทั้งหมด <span>{counts.all}</span></button>
                {HOOK_CATEGORIES.map((c) => (
                  <button key={c.key} className={filter === c.key ? 'on' : ''} onClick={() => setFilter(c.key)}>
                    {c.label} <span>{counts[c.key]}</span>
                  </button>
                ))}
              </div>
            </div>

            {loading ? <ListSkeleton rows={4} /> : rows.length === 0 ? (
              <div className="admin-card" style={{ textAlign: 'center', padding: 36, color: 'var(--ink-soft)' }}>
                {hooks.length === 0 ? 'ยังไม่มี hook ในคลัง — เพิ่มอันแรกด้านบนได้เลย' : 'ไม่พบ hook ที่ตรงกับที่ค้นหา'}
              </div>
            ) : (
              <div className="hk-list">
                {rows.map((h) => (
                  <div key={h.id} className="admin-card hk-card">
                    <div className="hk-card-top">
                      <span className="hk-cat">{HOOK_CATEGORY_LABEL[normHookCategory(h.category)]}</span>
                      {h.useCount > 0 && <span className="hk-used">ใช้แล้ว {h.useCount} ครั้ง</span>}
                    </div>
                    <p className="hk-text">{h.text}</p>
                    {h.note && <p className="hk-note">{h.note}</p>}
                    <div className="hk-actions">
                      <button className="admin-btn" onClick={() => use(h)}>
                        <FontAwesomeIcon icon={copiedId === h.id ? faCheck : faCopy} /> {copiedId === h.id ? 'คัดลอกแล้ว' : 'ใช้ hook นี้'}
                      </button>
                      <button
                        className="admin-btn-danger"
                        onClick={() => {
                          if (!window.confirm('ลบ hook นี้?')) return
                          removeHook(h.id).catch((e) => window.alert('ลบไม่สำเร็จ: ' + e.message))
                        }}
                        aria-label="ลบ hook"
                      ><FontAwesomeIcon icon={faTrash} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}
    </StaffRoleGuard>
  )
}
