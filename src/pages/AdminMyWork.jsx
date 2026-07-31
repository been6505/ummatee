import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import ListSkeleton from '../components/ListSkeleton.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { STATUS, STATUS_COLOR, normStatus } from '../data/contentStatus.js'
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

export default function AdminMyWork() {
  const { user } = useAdminAuth()
  const uid = user?.uid

  const [posts, setPosts] = useState([])
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) return
    let done = 0
    const finish = () => { done += 1; if (done >= 2) setLoading(false) }

    const unsubPosts = onSnapshot(
      query(collection(db, 'contentPosts'), where('assignedToStaffId', '==', uid)),
      (snap) => { setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); finish() },
      finish
    )
    const unsubCards = onSnapshot(
      query(collection(db, 'boardCards'), where('assignedToStaffId', '==', uid)),
      (snap) => { setCards(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); finish() },
      finish
    )
    return () => { unsubPosts(); unsubCards() }
  }, [uid])

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
    <StaffRoleGuard allowedRoles={['admin', 'staff', 'social', 'field']}>
      {() => (
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
      )}
    </StaffRoleGuard>
  )
}
