import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import ListSkeleton from '../components/ListSkeleton.jsx'
import { AssigneeTag } from '../components/AssigneePicker.jsx'
import {
  toKey, fromKey, weekStart, weekDays, shiftWeek, dayLabel, weekRangeLabel, groupByDay, WEEK_COLUMNS,
} from '../data/weekView.js'
import { hijriLabel, getHijri } from '../data/hijri.js'
import { STATUS, STATUS_COLOR, STATUS_ORDER, normStatus } from '../data/contentStatus.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faChevronRight, faCalendarWeek } from '@fortawesome/free-solid-svg-icons'

// ปฏิทินรายสัปดาห์ (/admin/week) — 7 คอลัมน์ อาทิตย์→เสาร์ โพสต์ของแต่ละวันเรียงลงมาในคอลัมน์
//
// ต่างจากตารางเดือนเดิมตรงที่เห็น "เนื้อหาของโพสต์" ไม่ใช่แค่จุดสีบอกว่ามีของ — ตารางเดือนตอบได้แค่
// วันไหนมีงาน ส่วนการวางแผนสัปดาห์ต้องเห็นว่างานคืออะไร ใครทำ สถานะไหน พร้อมกันทั้งเจ็ดวัน
//
// อ่านอย่างเดียว กดแล้วเด้งไปแก้ที่ปฏิทินเดือน — ไม่ทำฟอร์มชุดที่สองที่จะหลุดไม่ตรงกับของเดิม
// (หลักเดียวกับหน้าตารางไลฟ์สด)
const CONTENT_TYPE_LABEL = { post: 'โพสต์', video: 'VDO', picture: 'Picture', live: 'ไลฟ์' }

export default function AdminWeek() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  // เปิดหน้ามาที่สัปดาห์ของวันนี้เสมอ และรับ ?date= เพื่อให้ลิงก์จากที่อื่นเจาะมาสัปดาห์ที่ต้องการได้
  const [startKey, setStartKey] = useState(() => {
    const param = new URLSearchParams(window.location.search).get('date')
    return weekStart(param && fromKey(param) ? param : toKey(new Date()))
  })
  const todayKey = useMemo(() => toKey(new Date()), [])
  // วันที่ถูกเลือกจากแถวปฏิทินด้านบน — ใช้ไฮไลต์คอลัมน์ให้ตรงกัน
  const [selKey, setSelKey] = useState(todayKey)

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'contentPosts'),
      (snap) => { setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false) },
      () => setLoading(false)
    )
    return unsub
  }, [])

  const days = useMemo(() => weekDays(startKey), [startKey])
  const byDay = useMemo(() => groupByDay(posts, days), [posts, days])
  const weekCount = days.reduce((s, k) => s + (byDay[k]?.length || 0), 0)

  return (
    <StaffRoleGuard allowedRoles={['admin', 'staff', 'social']}>
      {() => (
        <main className="admin-dash">
          <AdminNav />
          <div className="admin-wrap">
            <div className="admin-head">
              <div>
                <h1><FontAwesomeIcon icon={faCalendarWeek} /> ปฏิทินรายสัปดาห์</h1>
                <p>อาทิตย์ถึงเสาร์ — โพสต์ของแต่ละวันเรียงลงมาในคอลัมน์ของวันนั้น</p>
              </div>
              <span className="wk-total">{weekCount} โพสต์ในสัปดาห์นี้</span>
            </div>

            <div className="admin-card wk-bar">
              <button className="admin-btn" onClick={() => setStartKey((k) => shiftWeek(k, -1))} aria-label="สัปดาห์ก่อนหน้า">
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              <div className="wk-range">
                <strong>{weekRangeLabel(startKey)}</strong>
                <span>{hijriLabel(fromKey(startKey))}</span>
              </div>
              <button className="admin-btn" onClick={() => setStartKey((k) => shiftWeek(k, 1))} aria-label="สัปดาห์ถัดไป">
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
              <button className="admin-btn wk-today" onClick={() => setStartKey(weekStart(toKey(new Date())))}>
                สัปดาห์นี้
              </button>
            </div>

            {/* แถวปฏิทินแบบเดียวกับตารางเดือน — ใช้คลาสชุดเดิม (.admin-cal-grid/.admin-cal-day) ทั้งหมด
                เพื่อให้หน้าตาตรงกับหน้าปฏิทินคอนเทนต์เป๊ะ ไม่ใช่ของที่ดูคล้ายแต่ไม่เหมือน
                หน้าที่ของมันคือให้กวาดตาเห็นทั้งสัปดาห์ก่อน แล้วค่อยกดลงไปดูรายละเอียดในคอลัมน์ข้างล่าง */}
            <div className="admin-card wk-strip">
              <div className="admin-cal-grid">
                {WEEK_COLUMNS.map((c) => <div className="admin-cal-dow" key={c.dow}>{c.short}</div>)}
                {days.map((key) => {
                  const has = byDay[key] || []
                  const d = fromKey(key)
                  const h = getHijri(d)
                  // สีประจำวัน: สถานะที่ "ค้างที่สุด" ของวันนั้น (ร่าง > กำลังทำ > ส่งงาน > โพสต์แล้ว)
                  // ตรรกะเดียวกับตารางเดือน — กวาดตาแล้วต้องเห็นวันที่ยังมีงานค้างก่อน
                  const dominant = has.length === 0 ? null
                    : STATUS_ORDER.find((st) => has.some((p) => normStatus(p.status) === st))
                  return (
                    <button
                      key={key}
                      className={`admin-cal-day ${has.length > 0 ? 'has-posts' : ''} ${key === selKey ? 'sel' : ''} ${key === todayKey ? 'today' : ''}`}
                      style={dominant ? { '--day-color': STATUS_COLOR[dominant] } : undefined}
                      title={has.length > 0 ? `${has.length} โพสต์` : undefined}
                      onClick={() => {
                        setSelKey(key)
                        // เลื่อนไปที่คอลัมน์ของวันนั้น — บนมือถือคอลัมน์เรียงลงมา การกดแล้วไม่ขยับ
                        // จะดูเหมือนกดไม่ติด
                        document.getElementById(`wk-col-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                    >
                      <span>{d ? d.getDate() : ''}</span>
                      {h && <span className="admin-cal-hijri">{h.d}</span>}
                      {has.length > 0 && (
                        <span className="admin-cal-dots">
                          {has.slice(0, 3).map((p, j) => <i key={j} style={{ background: STATUS_COLOR[normStatus(p.status)] }} />)}
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

            {loading ? <ListSkeleton rows={4} /> : (
              <div className="wk-grid">
                {days.map((key, i) => {
                  const items = byDay[key] || []
                  const h = getHijri(fromKey(key))
                  const isToday = key === todayKey
                  return (
                    <div
                      key={key}
                      id={`wk-col-${key}`}
                      className={`wk-col${isToday ? ' wk-col-today' : ''}${key === selKey ? ' wk-col-sel' : ''}`}
                    >
                      <div className="wk-col-head">
                        <span className="wk-dow">{WEEK_COLUMNS[i].label}</span>
                        <span className="wk-date">{dayLabel(key)}</span>
                        {h && <span className="wk-hijri">{h.d}</span>}
                      </div>

                      <div className="wk-col-body">
                        {items.length === 0 ? (
                          <p className="wk-none">—</p>
                        ) : items.map((p) => (
                          /* ?post=<id> เปิดโพสต์ใบนั้นตรงๆ (ปฏิทินรองรับพารามิเตอร์นี้อยู่แล้ว)
                             ไม่ใช่แค่เด้งไปที่วันแล้วให้ไปไล่หาเองว่าใบไหน */
                          <a
                            key={p.id}
                            className="wk-item"
                            href={`/admin/calendar?date=${key}&post=${p.id}`}
                            style={{ borderLeftColor: STATUS_COLOR[normStatus(p.status)] }}
                          >
                            <span className="wk-item-top">
                              {p.time && <span className="wk-time">{p.time}</span>}
                              <span className="wk-type">{CONTENT_TYPE_LABEL[p.contentType] || 'โพสต์'}</span>
                            </span>
                            <span className="wk-item-title">{p.title || '(ไม่มีชื่อ)'}</span>
                            <span className="wk-item-foot">
                              <span className="wk-status" style={{ background: STATUS_COLOR[normStatus(p.status)] }}>
                                {STATUS[normStatus(p.status)]}
                              </span>
                              {p.assignedToStaffId && <AssigneeTag uid={p.assignedToStaffId} />}
                            </span>
                          </a>
                        ))}
                      </div>

                      {/* เพิ่มโพสต์ของวันนั้นได้เลย — ปฏิทินเดือนรับ ?date= อยู่แล้ว จึงไม่ต้องมีฟอร์มซ้ำที่นี่ */}
                      <a className="wk-add" href={`/admin/calendar?date=${key}`}>+ เพิ่ม</a>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      )}
    </StaffRoleGuard>
  )
}
