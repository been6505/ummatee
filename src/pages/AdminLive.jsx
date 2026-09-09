import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import ListSkeleton from '../components/ListSkeleton.jsx'
import { AssigneeTag } from '../components/AssigneePicker.jsx'
import { splitLives, localNowIso, liveTimeLabel } from '../data/liveSchedule.js'
import { STATUS, STATUS_COLOR, normStatus } from '../data/contentStatus.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faVideo, faUser, faTowerBroadcast } from '@fortawesome/free-solid-svg-icons'

// ตารางไลฟ์สด (/admin/live)
//
// ปฏิทินคอนเทนต์รองรับ contentType 'live' พร้อม liveScheduledAt/livePlatforms/liveHost อยู่แล้ว
// แต่ไลฟ์กระจายอยู่ตามช่องวันในปฏิทิน — จะรู้ว่า "ไลฟ์ถัดไปคือเมื่อไหร่ ใครจัด พร้อมหรือยัง"
// ต้องไล่เปิดทีละวัน หน้านี้ดึงเฉพาะไลฟ์มาเรียงตามเวลาให้

export default function AdminLive() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  // ตรึงเวลา "ตอนนี้" ไว้ตอน mount — ถ้าอ่านนาฬิกาสดทุกครั้งที่เรนเดอร์ รายการจะกระโดดข้ามกลุ่ม
  // กลางคันขณะผู้ใช้กำลังอ่านอยู่
  const [nowIso] = useState(() => localNowIso())

  useEffect(() => {
    // where ฟิลด์เดียว ไม่มี orderBy — where + orderBy คนละฟิลด์ต้องมี composite index
    // ที่ Firestore ไม่สร้างให้ แล้ว query พังเงียบๆ (บอร์ดเคยโดนมาแล้ว) เรียงใน splitLives แทน
    const unsub = onSnapshot(
      query(collection(db, 'contentPosts'), where('contentType', '==', 'live')),
      (snap) => { setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false) },
      () => setLoading(false)
    )
    return unsub
  }, [])

  const { upcoming, past, unscheduled, total } = useMemo(() => splitLives(posts, nowIso), [posts, nowIso])
  const next = upcoming[0]

  const Row = ({ p, dim }) => (
    <li className={dim ? 'live-row live-row-dim' : 'live-row'}>
      <span className="live-time">{liveTimeLabel(p.liveAt) || 'ยังไม่ตั้งเวลา'}</span>
      <span className="live-title">{p.title || '(ไม่มีชื่อ)'}</span>
      {p.liveHost && <span className="live-host"><FontAwesomeIcon icon={faUser} /> {p.liveHost}</span>}
      {p.assignedToStaffId && <AssigneeTag uid={p.assignedToStaffId} />}
      <span className="live-platforms">{(p.livePlatforms || []).join(' · ') || '—'}</span>
      <span className="live-status" style={{ background: STATUS_COLOR[normStatus(p.status)] }}>
        {STATUS[normStatus(p.status)]}
      </span>
      {/* เปิดปฏิทินที่วันของไลฟ์นั้น เพื่อไปแก้รายละเอียดต่อ — หน้านี้ตั้งใจให้อ่านอย่างเดียว
          แก้ที่เดียวคือปฏิทิน จะได้ไม่มีฟอร์มสองชุดที่หลุดไม่ตรงกัน */}
      <a className="live-open" href={`/admin/calendar?date=${p.date || (p.liveAt || '').slice(0, 10)}`}>เปิดในปฏิทิน →</a>
    </li>
  )

  return (
    <StaffRoleGuard allowedRoles={['admin', 'staff', 'social']}>
      {() => (
        <main className="admin-dash">
          <AdminNav />
          <div className="admin-wrap">
            <div className="admin-head">
              <div>
                <h1><FontAwesomeIcon icon={faVideo} /> ตารางไลฟ์สด</h1>
                <p>ไลฟ์ทั้งหมดจากปฏิทินคอนเทนต์ เรียงตามเวลา — แก้รายละเอียดที่ปฏิทิน</p>
              </div>
              <span className="live-total">{total} ไลฟ์</span>
            </div>

            {loading ? <ListSkeleton rows={4} /> : total === 0 ? (
              <div className="admin-card" style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>
                <FontAwesomeIcon icon={faTowerBroadcast} style={{ fontSize: '2rem', opacity: .4 }} />
                <p style={{ marginTop: 12 }}>ยังไม่มีไลฟ์ในระบบ</p>
                <p style={{ fontSize: '.85rem', opacity: .8 }}>
                  สร้างได้ที่ปฏิทินคอนเทนต์ โดยเลือกชนิดคอนเทนต์เป็น "ไลฟ์สด"
                </p>
              </div>
            ) : (
              <>
                {next && (
                  <div className="admin-card live-next">
                    <div className="live-next-label">ไลฟ์ถัดไป</div>
                    <div className="live-next-title">{next.title || '(ไม่มีชื่อ)'}</div>
                    <div className="live-next-meta">
                      <span>{liveTimeLabel(next.liveAt)}</span>
                      {next.liveHost && <span>ผู้ดำเนินรายการ: {next.liveHost}</span>}
                      {(next.livePlatforms || []).length > 0 && <span>{next.livePlatforms.join(' · ')}</span>}
                    </div>
                  </div>
                )}

                {unscheduled.length > 0 && (
                  <div className="admin-card live-section">
                    <h4 className="live-section-head live-section-warn">
                      ยังไม่ได้ตั้งเวลา <span>{unscheduled.length}</span>
                    </h4>
                    <ul className="live-list">{unscheduled.map((p) => <Row key={p.id} p={p} />)}</ul>
                  </div>
                )}

                <div className="admin-card live-section">
                  <h4 className="live-section-head">กำลังจะถึง <span>{upcoming.length}</span></h4>
                  {upcoming.length === 0
                    ? <p className="live-empty">ไม่มีไลฟ์ที่ตั้งเวลาไว้ข้างหน้า</p>
                    : <ul className="live-list">{upcoming.map((p) => <Row key={p.id} p={p} />)}</ul>}
                </div>

                <div className="admin-card live-section">
                  <h4 className="live-section-head">ผ่านไปแล้ว <span>{past.length}</span></h4>
                  {past.length === 0
                    ? <p className="live-empty">ยังไม่มีไลฟ์ที่ผ่านไปแล้ว</p>
                    : <ul className="live-list">{past.map((p) => <Row key={p.id} p={p} dim />)}</ul>}
                </div>
              </>
            )}
          </div>
        </main>
      )}
    </StaffRoleGuard>
  )
}
