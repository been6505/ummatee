import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useStaffDirectory, memberLabel } from '../data/staffDirectory.js'
import { buildWorkload, BUCKETS } from '../data/teamWorkload.js'
import { readableSources, hiddenSources } from '../data/workSources.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUserGroup, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'

// "ภาระงานของทีม" — ใครถืองานอะไรอยู่ ใครล้นมือ และงานไหนยังไม่มีคนรับ
//
// /admin/my-work ตอบว่า "ฉันมีงานอะไร" ส่วนนี้ตอบว่า "ทีมมีงานอะไร" ซึ่งเป็นคนละคำถาม
// และเป็นคำถามที่ต้องใช้ตอนวางแผน ไม่ใช่ตอนลงมือทำ

const todayKey = () => {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

export default function TeamWorkload({ role }) {
  const { members } = useStaffDirectory()
  const [posts, setPosts] = useState([])
  const [cards, setCards] = useState([])

  // เปิด listener เฉพาะแหล่งที่ role นี้อ่านได้จริง — ตารางสิทธิ์เดียวกับหน้า "งานของฉัน"
  // (workSources.js มีเทสต์ที่เทียบกับ firestore.rules ให้แล้ว)
  const sourceKeys = readableSources(role).map((s) => s.key).join(',')

  useEffect(() => {
    const keys = sourceKeys ? sourceKeys.split(',') : []
    if (keys.length === 0) return
    const setter = { contentPosts: setPosts, boardCards: setCards }
    const unsubs = keys.map((key) =>
      onSnapshot(
        query(collection(db, key)),
        (snap) => setter[key](snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.error(key + ' workload listener failed', err)
      )
    )
    return () => unsubs.forEach((u) => u())
  }, [sourceKeys])

  const data = useMemo(
    () => buildWorkload({
      posts, cards,
      members: members.map((m) => ({ id: m.uid, name: memberLabel(m) })),
      todayKey: todayKey(),
    }),
    [posts, cards, members]
  )

  const hidden = hiddenSources(role)
  const max = Math.max(1, ...data.rows.map((r) => r.total), data.unassigned.total)

  const Bar = ({ row }) => (
    <div className="tw-bar" aria-hidden="true">
      {BUCKETS.map((b) => (row[b.key] > 0 ? (
        <span key={b.key} style={{ background: b.color, flex: row[b.key] }} title={`${b.label} ${row[b.key]}`} />
      ) : null))}
      {/* เว้นที่ว่างให้แถวสั้นกว่า เพื่อให้เทียบปริมาณงานระหว่างคนได้ด้วยสายตา */}
      <span className="tw-bar-rest" style={{ flex: Math.max(0, max - row.total) }} />
    </div>
  )

  const Row = ({ row, muted }) => (
    <li className={muted ? 'tw-row tw-row-muted' : 'tw-row'}>
      <span className="tw-name">
        {row.name}
        {row.missing && (
          <span className="tw-warn" title="มีงานค้างอยู่ แต่ไม่พบชื่อนี้ในสมุดรายชื่อทีม">
            <FontAwesomeIcon icon={faTriangleExclamation} />
          </span>
        )}
      </span>
      <Bar row={row} />
      <span className="tw-counts">
        {row.overdue > 0 && <b style={{ color: '#c62828' }}>{row.overdue} เลยกำหนด</b>}
        <span className="tw-total">{row.total}</span>
      </span>
    </li>
  )

  return (
    <div className="admin-card tw-card">
      <div className="admin-card-head">
        <h3><FontAwesomeIcon icon={faUserGroup} /> ภาระงานของทีม</h3>
        <span className="tw-legend">
          {BUCKETS.map((b) => (
            <span key={b.key}><i style={{ background: b.color }} />{b.label} {data.totals[b.key]}</span>
          ))}
        </span>
      </div>

      {hidden.length > 0 && (
        <p className="tw-note">
          สิทธิ์ของคุณยังไม่เห็นงานจาก{hidden.map((s) => s.label).join(' และ ')} — ตัวเลขด้านล่างจึงยังไม่ครบ
        </p>
      )}

      {data.taskCount === 0 && data.rows.length === 0 ? (
        <p className="tw-empty">ยังไม่มีข้อมูลทีม — กด "อัปเดตสมุดรายชื่อทีม" ที่หน้าจัดการพนักงานก่อน</p>
      ) : (
        <ul className="tw-list">
          {/* งานที่ยังไม่มีคนรับขึ้นบนสุดเสมอ — เป็นช่องโหว่ของแผน ไม่ใช่ภาระของใครคนใดคนหนึ่ง */}
          {data.unassigned.total > 0 && <Row row={data.unassigned} muted />}
          {data.rows.map((r) => <Row key={r.id || 'none'} row={r} />)}
        </ul>
      )}
    </div>
  )
}
