import { useEffect, useState } from 'react'
import { doc, onSnapshot, collection } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import ListSkeleton from '../components/ListSkeleton.jsx'
import CommentThread from '../components/CommentThread.jsx'
import { AssigneeTag } from '../components/AssigneePicker.jsx'
import { useCampaignLinks } from '../data/campaignLinks.js'
import { campaignProgress } from '../data/campaignProgress.js'
import { STATUS as CONTENT_STATUS, STATUS_COLOR as CONTENT_STATUS_COLOR, normStatus } from '../data/contentStatus.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft, faBullseye, faFlag, faCalendar, faTableColumns, faUsers, faMapLocationDot,
} from '@fortawesome/free-solid-svg-icons'

// หน้ารวมของแคมเปญเดียว (/admin/campaigns/:id)
//
// ความเชื่อมโยงมีอยู่ในข้อมูลอยู่แล้ว แต่กระจายคนละหน้า — อีเวนต์อยู่ /admin/events, คอนเทนต์อยู่
// /admin/calendar, งานอยู่ /admin/board, พันธมิตรอยู่ในหน้าแคมเปญรวม, จุดลงพื้นที่อยู่ /admin/aid-map
// จะตอบคำถามง่ายๆ อย่าง "แคมเปญนี้ไปถึงไหนแล้ว" ต้องเปิด 5 หน้าแล้วประกอบเอง หน้านี้ประกอบให้

const THB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH')

const LINK_STATUS_LABEL = { invited: 'เชิญแล้ว', confirmed: 'ยืนยันแล้ว', declined: 'ปฏิเสธ' }
const EVENT_STATUS_LABEL = { planning: 'วางแผน', confirmed: 'ยืนยันแล้ว', done: 'จบแล้ว', cancelled: 'ยกเลิก' }

function Section({ icon, title, count, href, hrefLabel, children }) {
  return (
    <div className="admin-card cd-section">
      <div className="cd-section-head">
        <h4><FontAwesomeIcon icon={icon} /> {title} <span className="cd-count">{count}</span></h4>
        {href && <a className="cd-more" href={href}>{hrefLabel} →</a>}
      </div>
      {count === 0 ? <p className="cd-empty">ยังไม่มีข้อมูลผูกกับแคมเปญนี้</p> : children}
    </div>
  )
}

export default function AdminCampaignDetail({ campaignId }) {
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [partners, setPartners] = useState([])
  const { events, posts, cards, partnerLinks, aidLocations, loading: linksLoading } = useCampaignLinks(campaignId)

  useEffect(() => {
    if (!campaignId) return
    const unsub = onSnapshot(
      doc(db, 'campaigns', campaignId),
      (snap) => { setCampaign(snap.exists() ? { id: snap.id, ...snap.data() } : null); setLoading(false) },
      () => setLoading(false)
    )
    return unsub
  }, [campaignId])

  // ต้องดึงชื่อองค์กรมาเอง — campaignPartners เก็บแค่ partnerId ไม่ได้เก็บชื่อซ้ำไว้
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'partnerOrganizations'),
      (snap) => setPartners(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setPartners([]))
    return unsub
  }, [])

  const prog = campaignProgress(campaign)

  return (
    <StaffRoleGuard allowedRoles={['admin', 'staff', 'field']}>
      {() => (
        <main className="admin-dash">
          <AdminNav />
          <div className="admin-wrap">
            <a className="cd-back" href="/admin/campaigns"><FontAwesomeIcon icon={faArrowLeft} /> กลับไปรายการแคมเปญ</a>

            {loading ? <ListSkeleton rows={3} /> : !campaign ? (
              <div className="admin-card" style={{ textAlign: 'center', padding: 40 }}>
                <h3>ไม่พบแคมเปญนี้</h3>
                <p style={{ color: 'var(--ink-soft)' }}>อาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง</p>
              </div>
            ) : (
              <>
                <div className="admin-card cd-hero">
                  <h1><FontAwesomeIcon icon={faBullseye} /> {campaign.name}</h1>
                  {campaign.description && <p className="cd-desc">{campaign.description}</p>}
                  <div className="cd-facts">
                    <span>ช่วงเวลา: {campaign.startDate || '—'} → {campaign.endDate || '—'}</span>
                    <span>ผู้รับผิดชอบ: {campaign.ownerName || '—'}</span>
                    <span>สถานะ: {campaign.status || '—'}</span>
                  </div>

                  {prog.hasGoal ? (
                    <div className="cd-progress">
                      <div className="cd-progress-bar"><span style={{ width: `${prog.pct}%` }} /></div>
                      <div className="cd-progress-text">
                        {THB(prog.current)} / {THB(prog.goal)}
                        {/* โชว์ rawPct ไม่ใช่ pct ที่ตันไว้ที่ 100 — ได้เกินเป้าคือข่าวดีที่ควรเห็น */}
                        <strong>{prog.rawPct}%</strong>
                      </div>
                    </div>
                  ) : (
                    <p className="cd-empty">ยังไม่ได้ตั้งเป้าหมายยอดบริจาค</p>
                  )}
                </div>

                {linksLoading ? <ListSkeleton rows={3} /> : (
                  <div className="cd-grid">
                    <Section icon={faUsers} title="องค์กรพันธมิตร" count={partnerLinks.length} href="/admin/campaigns" hrefLabel="จัดการ">
                      <ul className="cd-list">
                        {partnerLinks.map((l) => {
                          const p = partners.find((x) => x.id === l.partnerId)
                          return (
                            <li key={l.id}>
                              <span className="cd-item-name">{p?.name || l.partnerId}</span>
                              <span className="cd-tag">{LINK_STATUS_LABEL[l.status] || l.status}</span>
                            </li>
                          )
                        })}
                      </ul>
                    </Section>

                    <Section icon={faFlag} title="งาน/อีเวนต์" count={events.length} href="/admin/events" hrefLabel="จัดการ">
                      <ul className="cd-list">
                        {[...events].sort((a, b) => String(a.startAt || '').localeCompare(String(b.startAt || ''))).map((e) => (
                          <li key={e.id}>
                            <span className="cd-item-name">{e.name}</span>
                            <span className="cd-date">{(e.startAt || '').slice(0, 10) || '—'}</span>
                            <span className="cd-tag">{EVENT_STATUS_LABEL[e.status] || e.status}</span>
                          </li>
                        ))}
                      </ul>
                    </Section>

                    <Section icon={faCalendar} title="คอนเทนต์" count={posts.length} href="/admin/calendar" hrefLabel="เปิดปฏิทิน">
                      <ul className="cd-list">
                        {[...posts].sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).map((p) => (
                          <li key={p.id}>
                            <span className="cd-item-name">{p.title || '(ไม่มีชื่อ)'}</span>
                            {p.assignedToStaffId && <AssigneeTag uid={p.assignedToStaffId} />}
                            <span className="cd-date">{p.date || '—'}</span>
                            <span className="cd-tag" style={{ background: CONTENT_STATUS_COLOR[normStatus(p.status)], color: '#fff' }}>
                              {CONTENT_STATUS[normStatus(p.status)]}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </Section>

                    <Section icon={faTableColumns} title="งานในบอร์ด" count={cards.length} href="/admin/board" hrefLabel="เปิดบอร์ด">
                      <ul className="cd-list">
                        {[...cards].sort((a, b) => String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'))).map((c) => (
                          <li key={c.id}>
                            <span className="cd-item-name">{c.title}</span>
                            {c.assignedToStaffId && <AssigneeTag uid={c.assignedToStaffId} />}
                            <span className="cd-date">{c.dueDate || '—'}</span>
                          </li>
                        ))}
                      </ul>
                    </Section>

                    <Section icon={faMapLocationDot} title="จุดลงพื้นที่" count={aidLocations.length} href="/admin/aid-map" hrefLabel="เปิดแผนที่">
                      <ul className="cd-list">
                        {aidLocations.map((l) => (
                          <li key={l.id}>
                            <span className="cd-item-name">{l.villageName || l.city || '(ไม่มีชื่อ)'}</span>
                            <span className="cd-date">{l.visitDate || '—'}</span>
                            {l.peopleHelped ? <span className="cd-tag">ช่วย {l.peopleHelped} คน</span> : null}
                          </li>
                        ))}
                      </ul>
                    </Section>

                    <div className="admin-card cd-section">
                      <CommentThread entityType="campaign" entityId={campaignId} title="คุยเรื่องแคมเปญนี้" />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      )}
    </StaffRoleGuard>
  )
}
