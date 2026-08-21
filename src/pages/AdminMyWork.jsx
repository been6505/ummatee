import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import ListSkeleton from '../components/ListSkeleton.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { STATUS, STATUS_COLOR, normStatus } from '../data/contentStatus.js'
import { WORK_SOURCES, MY_WORK_ROLES, readableSources, hiddenSources } from '../data/workSources.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendar, faTableColumns, faInbox } from '@fortawesome/free-solid-svg-icons'

// "งานของฉัน" — รวมงานที่มอบหมายให้ผู้ใช้คนนี้ จากทุกระบบมาไว้หน้าเดียว
//
// ที่ผ่านมางานกระจายอยู่คนละหน้า (ปฏิทินคอนเทนต์ / บอร์ดวางแผน) และไม่มีใครรู้ว่าอันไหนของตัวเอง
// เพราะไม่เคยมีช่องผู้รับผิดชอบให้กรอกเลย หน้านี้คือเหตุผลที่ต้องมี assignedToStaffId ตั้งแต่แรก
//
// query ด้วย where('assignedToStaffId','==',uid) เฉยๆ ไม่ใส่ orderBy — where + orderBy คนละฟิลด์
// ต้องมี composite index ที่ Firestore ไม่สร้างให้เอง แล้ว query จะพังเงียบๆ (เคยเจอมาแล้วที่บอร์ด)
// จำนวนงานต่อคนน้อย เรียงฝั่ง client พอ

const todayKey = () => {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

// จัดกลุ่มตามความเร่งด่วน — สิ่งที่คนเปิดหน้านี้อยากรู้คือ "อะไรเลยกำหนดแล้ว" ไม่ใช่รายการเรียงตามวัน
const bucketOf = (dateStr) => {
  if (!dateStr) return 'noDate'
  const today = todayKey()
  if (dateStr < today) return 'overdue'
  if (dateStr === today) return 'today'
  return 'upcoming'
}

const BUCKETS = [
  { key: 'overdue', label: 'เลยกำหนดแล้ว', color: '#c62828' },
  { key: 'today', label: 'วันนี้', color: '#b45309' },
  { key: 'upcoming', label: 'กำลังจะถึง', color: '#2e7d32' },
  { key: 'noDate', label: 'ยังไม่กำหนดวัน', color: '#6b7280' },
]

function MyWork({ role }) {
  const { user } = useAdminAuth()
  const uid = user?.uid

  const [posts, setPosts] = useState([])
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState([]) // แหล่งที่ listener ล้ม — ต้องบอกผู้ใช้ ห้ามเงียบ

  // เปิด listener เฉพาะแหล่งที่ role นี้อ่านได้จริง (ดู workSources.js)
  // เดิมเปิดทั้งสองแหล่งเสมอ: คน role 'social' จึงโดน permission-denied ที่ boardCards
  // และ 'field' โดนที่ contentPosts โดยที่ error callback กลืนทิ้ง แล้วหน้าขึ้นว่า "ไม่มีงาน"
  const sources = readableSources(role).map((s) => s.key).join(',')

  useEffect(() => {
    if (!uid) return
    const keys = sources ? sources.split(',') : []
    if (keys.length === 0) { setLoading(false); return }

    const setter = { contentPosts: setPosts, boardCards: setCards }
    let done = 0
    const finish = () => { done += 1; if (done >= keys.length) setLoading(false) }

    const unsubs = keys.map((key) =>
      onSnapshot(
        query(collection(db, key), where('assignedToStaffId', '==', uid)),
        (snap) => { setter[key](snap.docs.map((d) => ({ id: d.id, ...d.data() }))); finish() },
        () => { setFailed((f) => (f.includes(key) ? f : [...f, key])); finish() }
      )
    )
    return () => unsubs.forEach((u) => u())
  }, [uid, sources])

  const hidden = hiddenSources(role)
  const broken = WORK_SOURCES.filter((s) => failed.includes(s.key))

  // โพสต์ที่ขึ้นแล้วถือว่าจบงาน ไม่ต้องรกอยู่ในรายการค้าง
  const items = [
    ...posts
      .filter((p) => normStatus(p.status) !== 'posted')
      .map((p) => ({
        id: 'post-' + p.id,
        kind: 'content',
        title: p.title || '(ไม่มีชื่อ)',
        date: p.date || '',
        statusLabel: STATUS[normStatus(p.status)],
        statusColor: STATUS_COLOR[normStatus(p.status)],
        href: `/admin/calendar?date=${p.date || ''}`,
      })),
    ...cards.map((c) => ({
      id: 'card-' + c.id,
      kind: 'board',
      title: c.title || '(ไม่มีชื่อ)',
      date: c.dueDate || '',
      statusLabel: null,
      href: '/admin/board',
    })),
  ].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))

  const grouped = BUCKETS.map((b) => ({ ...b, items: items.filter((i) => bucketOf(i.date) === b.key) }))

  return (
        <main className="admin-dash">
          <AdminNav />
          <div className="admin-wrap">
            <div className="admin-head">
              <div>
                <h1>งานของฉัน</h1>
                <p>งานที่มอบหมายให้คุณ จากปฏิทินคอนเทนต์และบอร์ดวางแผน</p>
              </div>
              <span className="mywork-count">{items.length} งานค้าง</span>
            </div>

            {/* บอกให้ชัดว่าหน้านี้ยังไม่ครบ ดีกว่าปล่อยให้เข้าใจผิดว่า "ไม่มีงาน" */}
            {hidden.length > 0 && (
              <div className="admin-card mywork-note">
                สิทธิ์ของคุณ (role: {role}) ยังไม่เห็นงานจาก{hidden.map((s) => s.label).join(' และ ')} —
                หากควรเห็นด้วย แจ้งแอดมินที่หน้า "จัดการพนักงาน"
              </div>
            )}
            {broken.length > 0 && (
              <div className="admin-card mywork-note mywork-note-error">
                โหลดงานจาก{broken.map((s) => s.label).join(' และ ')}ไม่สำเร็จ —
                รายการด้านล่างยังไม่ครบ ลองรีเฟรชหน้าอีกครั้ง
              </div>
            )}

            {loading ? <ListSkeleton rows={4} /> : items.length === 0 ? (
              <div className="admin-card mywork-empty">
                <FontAwesomeIcon icon={faInbox} />
                <p>ยังไม่มีงานที่มอบหมายให้คุณ</p>
                <p className="mywork-empty-hint">
                  งานจะขึ้นที่นี่เมื่อมีคนเลือกชื่อคุณในช่อง "ผู้รับผิดชอบ" ที่ปฏิทินคอนเทนต์หรือบอร์ดวางแผน
                </p>
              </div>
            ) : (
              <div className="mywork-cols">
                {grouped.filter((g) => g.items.length > 0).map((g) => (
                  <div key={g.key} className="admin-card mywork-group">
                    <div className="mywork-group-head" style={{ color: g.color }}>
                      {g.label} <span className="mywork-group-count">{g.items.length}</span>
                    </div>
                    <ul className="mywork-list">
                      {g.items.map((it) => (
                        <li key={it.id}>
                          <a href={it.href}>
                            <span className="mywork-kind" title={it.kind === 'content' ? 'ปฏิทินคอนเทนต์' : 'บอร์ดวางแผน'}>
                              <FontAwesomeIcon icon={it.kind === 'content' ? faCalendar : faTableColumns} />
                            </span>
                            <span className="mywork-title">{it.title}</span>
                            {it.statusLabel && (
                              <span className="mywork-status" style={{ background: it.statusColor }}>{it.statusLabel}</span>
                            )}
                            <span className="mywork-date">{it.date || '—'}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
  )
}

export default function AdminMyWork() {
  // role มาจาก guard — ต้องรู้ role ก่อนถึงจะเปิด listener ได้ถูกแหล่ง จึงแยก MyWork เป็นคอมโพเนนต์ลูก
  return (
    <StaffRoleGuard allowedRoles={MY_WORK_ROLES}>
      {(staff) => <MyWork role={staff?.role} />}
    </StaffRoleGuard>
  )
}
