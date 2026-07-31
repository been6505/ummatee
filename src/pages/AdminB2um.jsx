import { useEffect, useMemo, useState } from 'react'
import { collection, updateDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { isFullAdminEmail } from '../useAdminRole.js'
import { writeAuditLog } from '../lib/auditLog.js'
import ExportButtons from '../components/ExportButtons.jsx'
import ListSkeleton from '../components/ListSkeleton.jsx'
import { B2UM_STATUS, B2UM_STATUS_COLOR, B2UM_STATUS_ORDER, normB2umStatus } from '../data/b2umStatus.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faStore, faPhone } from '@fortawesome/free-solid-svg-icons'

// ร้านค้าที่เข้าร่วมโครงการ B2UM (/admin/b2um)
//
// b2umRegs เป็น collection เดียวที่มีข้อมูลไหลเข้ามาจริงจากหน้า public แต่ไม่เคยมีหน้าให้ดูเลย —
// ใบสมัครลง Firestore แล้วอยู่ตรงนั้น ไม่มีใครเห็น (ช่องค้นหารวมมีผลลัพธ์ B2UM แต่ลิงก์ไป /admin/give
// ซึ่งไม่ได้แสดง b2umRegs กดแล้วไปเจอหน้าที่ไม่มีสิ่งที่ค้นหา)
//
// สิทธิ์: firestore.rules ให้ read/update ของ b2umRegs เฉพาะ isFullAdmin() — ไม่ใช่ staff role
// จึงเช็คด้วย isFullAdminEmail ที่เป็นรายชื่อชุดเดียวกับในกฎเป๊ะๆ
// (ไม่ใช้ useAllowlistedAdmin เพราะรายชื่อชุดนั้นกว้างกว่า มีบัญชี volunteer ที่กฎไม่ให้ผ่าน
//  คนกลุ่มนั้นจะเปิดหน้าได้แต่เจอข้อมูลว่างเปล่า ซึ่งดูเหมือนระบบพังมากกว่าจะรู้ว่าเป็นเรื่องสิทธิ์)
const EMPTY_NOTE = ''

export default function AdminB2um() {
  const { user, loading: authLoading } = useAdminAuth()
  const isAdmin = !!user && isFullAdminEmail(user.email || '')

  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [noteDraft, setNoteDraft] = useState({})
  const [savingId, setSavingId] = useState('')

  useEffect(() => {
    if (!user) return
    // ไม่ใส่ orderBy — ใบสมัครเก่าเก็บ date เป็นข้อความ th-TH ("31/7/2569 15:04") เรียงตามตัวอักษรแล้วมั่ว
    // ใช้ createdAt ก็ไม่ได้เพราะฟอร์มไม่เคยเขียนฟิลด์นั้น เรียงฝั่ง client ตาม ref ที่รันเลขต่อกันแทน
    const unsub = onSnapshot(
      collection(db, 'b2umRegs'),
      (snap) => { setList(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false) },
      () => setLoading(false)
    )
    return unsub
  }, [user])

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase()
    return list
      .map((r) => ({ ...r, status: normB2umStatus(r.status) }))
      .filter((r) => statusFilter === 'all' || r.status === statusFilter)
      .filter((r) => !s || [r.shopName, r.fname, r.lname, r.phone, r.ref].some((x) => String(x || '').toLowerCase().includes(s)))
      .sort((a, b) => String(b.ref || '').localeCompare(String(a.ref || ''), undefined, { numeric: true }))
  }, [list, search, statusFilter])

  const counts = useMemo(() => {
    const c = { all: list.length }
    for (const k of B2UM_STATUS_ORDER) c[k] = 0
    for (const r of list) c[normB2umStatus(r.status)] += 1
    return c
  }, [list])

  const setStatus = async (r, status) => {
    setSavingId(r.id)
    try {
      await updateDoc(doc(db, 'b2umRegs', r.id), { status, statusUpdatedAt: serverTimestamp() })
      writeAuditLog({ action: 'update', entityType: 'b2umReg', entityId: r.id, summary: `${r.shopName}: ${B2UM_STATUS[status]}` })
    } catch (e) {
      window.alert('บันทึกไม่สำเร็จ: ' + e.message)
    } finally { setSavingId('') }
  }

  const saveNote = async (r) => {
    const note = (noteDraft[r.id] ?? r.note ?? EMPTY_NOTE).trim()
    setSavingId(r.id)
    try {
      await updateDoc(doc(db, 'b2umRegs', r.id), { note, statusUpdatedAt: serverTimestamp() })
      setNoteDraft((d) => { const next = { ...d }; delete next[r.id]; return next })
    } catch (e) {
      window.alert('บันทึกไม่สำเร็จ: ' + e.message)
    } finally { setSavingId('') }
  }

  if (authLoading) return null
  if (!user) return <AdminLogin />
  if (!isAdmin) {
    return (
      <main className="admin-dash">
        <AdminNav />
        <div className="admin-wrap">
          <div className="admin-card" style={{ marginTop: 40, textAlign: 'center' }}>
            <h3>ไม่มีสิทธิ์เข้าหน้านี้</h3>
            <p>ข้อมูลร้านค้า B2UM เปิดให้เฉพาะผู้ดูแลระบบเท่านั้น</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="admin-dash">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1><FontAwesomeIcon icon={faStore} /> ร้านค้า B2UM</h1>
            <p>ร้านค้า/ธุรกิจที่สมัครเข้าร่วมโครงการ — ไล่สถานะติดต่อและจดบันทึกได้</p>
          </div>
          <ExportButtons build={() => ({
            filename: 'b2um-shops.csv',
            sheetName: 'B2UM',
            headers: ['เลขที่', 'วันที่สมัคร', 'ชื่อร้าน', 'ผู้ติดต่อ', 'เบอร์โทร', 'สถานะ', 'บันทึก'],
            rows: rows.map((r) => [
              r.ref || '', r.date || '', r.shopName || '',
              `${r.fname || ''} ${r.lname || ''}`.trim(), r.phone || '',
              B2UM_STATUS[r.status], r.note || '',
            ]),
          })} />
        </div>

        <div className="admin-card" style={{ marginBottom: 16 }}>
          <div className="b2um-toolbar">
            <input
              type="search"
              placeholder="ค้นหาชื่อร้าน / ผู้ติดต่อ / เบอร์โทร"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {/* แถบตัวกรองพร้อมจำนวน — ตอบคำถามแรกที่คนเปิดหน้านี้อยากรู้: เหลือใบใหม่ที่ยังไม่ได้ติดต่อกี่ร้าน */}
            <div className="b2um-filters">
              <button className={statusFilter === 'all' ? 'on' : ''} onClick={() => setStatusFilter('all')}>
                ทั้งหมด <span>{counts.all}</span>
              </button>
              {B2UM_STATUS_ORDER.map((k) => (
                <button
                  key={k}
                  className={statusFilter === k ? 'on' : ''}
                  style={statusFilter === k ? { background: B2UM_STATUS_COLOR[k], borderColor: B2UM_STATUS_COLOR[k], color: '#fff' } : {}}
                  onClick={() => setStatusFilter(k)}
                >
                  {B2UM_STATUS[k]} <span>{counts[k]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? <ListSkeleton rows={4} /> : rows.length === 0 ? (
          <div className="admin-card" style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>
            {list.length === 0 ? 'ยังไม่มีร้านค้าสมัครเข้ามา' : 'ไม่พบร้านค้าที่ตรงกับตัวกรอง'}
          </div>
        ) : (
          <div className="b2um-grid">
            {rows.map((r) => (
              <div key={r.id} className="admin-card b2um-card" style={{ borderLeft: `4px solid ${B2UM_STATUS_COLOR[r.status]}` }}>
                <div className="b2um-card-head">
                  <div>
                    <div className="b2um-shop">{r.shopName || '(ไม่มีชื่อร้าน)'}</div>
                    <div className="b2um-meta">{r.ref || '—'} · {r.date || '—'}</div>
                  </div>
                  <span className="b2um-chip" style={{ background: B2UM_STATUS_COLOR[r.status] }}>{B2UM_STATUS[r.status]}</span>
                </div>

                <div className="b2um-contact">
                  <span>{`${r.fname || ''} ${r.lname || ''}`.trim() || '—'}</span>
                  {/* tel: ให้กดโทรจากมือถือได้เลย — งานนี้คือไล่โทรหาร้าน การก๊อบเบอร์ทีละร้านช้าเกินไป */}
                  {r.phone && <a href={`tel:${String(r.phone).replace(/[^0-9+]/g, '')}`}><FontAwesomeIcon icon={faPhone} /> {r.phone}</a>}
                </div>

                {Array.isArray(r.images) && r.images.length > 0 && (
                  <div className="b2um-images">
                    {r.images.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="" loading="lazy" />
                      </a>
                    ))}
                  </div>
                )}

                <div className="b2um-status-row">
                  {B2UM_STATUS_ORDER.map((k) => (
                    <button
                      key={k}
                      disabled={savingId === r.id || r.status === k}
                      className={r.status === k ? 'on' : ''}
                      style={r.status === k ? { background: B2UM_STATUS_COLOR[k], borderColor: B2UM_STATUS_COLOR[k], color: '#fff' } : {}}
                      onClick={() => setStatus(r, k)}
                    >{B2UM_STATUS[k]}</button>
                  ))}
                </div>

                <label className="b2um-note">
                  บันทึกภายใน
                  <textarea
                    rows={2}
                    value={noteDraft[r.id] ?? r.note ?? ''}
                    onChange={(e) => setNoteDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                    placeholder="เช่น โทรแล้ววันที่ 5 สนใจ ขอเอกสารเพิ่ม"
                  />
                </label>
                {(noteDraft[r.id] !== undefined && noteDraft[r.id] !== (r.note ?? '')) && (
                  <button className="admin-btn-primary b2um-note-save" disabled={savingId === r.id} onClick={() => saveNote(r)}>
                    {savingId === r.id ? 'กำลังบันทึก…' : 'บันทึก'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
