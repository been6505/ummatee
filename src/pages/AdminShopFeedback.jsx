import { useMemo, useState } from 'react'
import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import ListSkeleton from '../components/ListSkeleton.jsx'
import { useAllReviews, setReviewStatus, removeReview, useShopIssues, setIssueStatus } from '../data/shopReviews.js'
import {
  REVIEW_STATUS, REVIEW_STATUS_ORDER, normReviewStatus,
  ISSUE_STATUS, ISSUE_STATUS_ORDER, normIssueStatus, ISSUE_TOPIC_LABEL, normIssueTopic,
  cleanPhotos,
} from '../data/shopFeedback.js'
import { optImg } from '../utils/cloudinaryUrl.js'
import { writeAuditLog } from '../lib/auditLog.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faStar, faTrash, faPhone } from '@fortawesome/free-solid-svg-icons'

// ตรวจรีวิว + เรื่องแจ้งปัญหา (/admin/shop/feedback)
//
// รีวิวเข้ามาเป็น 'pending' เสมอ (บังคับที่ firestore.rules) หน้านี้คือที่เดียวที่อนุมัติให้ขึ้นเว็บได้
const REVIEW_COLOR = { pending: '#b45309', approved: '#2e7d32', rejected: '#c62828' }
const ISSUE_COLOR = { open: '#c62828', working: '#b45309', done: '#2e7d32' }

const timeLabel = (ms) => (ms ? new Date(ms).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')

export default function AdminShopFeedback() {
  const [tab, setTab] = useState('reviews')
  const { reviews, loading: rLoading } = useAllReviews(true)
  const { issues, loading: iLoading } = useShopIssues(true)
  const [rFilter, setRFilter] = useState('pending')
  const [iFilter, setIFilter] = useState('open')

  const rRows = useMemo(
    () => reviews.filter((r) => rFilter === 'all' || normReviewStatus(r.status) === rFilter),
    [reviews, rFilter]
  )
  const iRows = useMemo(
    () => issues.filter((i) => iFilter === 'all' || normIssueStatus(i.status) === iFilter),
    [issues, iFilter]
  )
  const pendingCount = reviews.filter((r) => normReviewStatus(r.status) === 'pending').length
  const openCount = issues.filter((i) => normIssueStatus(i.status) === 'open').length

  const setR = async (r, status) => {
    try {
      await setReviewStatus(r.id, status)
      writeAuditLog({ action: 'update', entityType: 'productReview', entityId: r.id, summary: `${REVIEW_STATUS[status]}: ${r.productName || r.productId}` })
    } catch (e) { window.alert('บันทึกไม่สำเร็จ: ' + e.message) }
  }

  return (
    <StaffRoleGuard allowedRoles={['admin', 'staff', 'social']}>
      {() => (
        <main className="admin-dash">
          <AdminNav />
          <div className="admin-wrap">
            <div className="admin-head">
              <div>
                <h1>รีวิว & เรื่องแจ้งจากลูกค้า</h1>
                <p>รีวิวต้องอนุมัติก่อนถึงขึ้นหน้าเว็บ — เรื่องแจ้งปัญหาไม่ขึ้นสาธารณะเลย</p>
              </div>
            </div>

            <div className="admin-cal-viewtabs" style={{ maxWidth: 360 }}>
              <button className={tab === 'reviews' ? 'on' : ''} onClick={() => setTab('reviews')}>
                รีวิว{pendingCount > 0 ? ` (${pendingCount})` : ''}
              </button>
              <button className={tab === 'issues' ? 'on' : ''} onClick={() => setTab('issues')}>
                แจ้งปัญหา{openCount > 0 ? ` (${openCount})` : ''}
              </button>
            </div>

            {tab === 'reviews' ? (
              <>
                <div className="admin-card hk-toolbar">
                  <div className="hk-filters">
                    <button className={rFilter === 'all' ? 'on' : ''} onClick={() => setRFilter('all')}>ทั้งหมด <span>{reviews.length}</span></button>
                    {REVIEW_STATUS_ORDER.map((k) => (
                      <button key={k} className={rFilter === k ? 'on' : ''} onClick={() => setRFilter(k)}>
                        {REVIEW_STATUS[k]} <span>{reviews.filter((r) => normReviewStatus(r.status) === k).length}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {rLoading ? <ListSkeleton rows={3} /> : rRows.length === 0 ? (
                  <div className="admin-card" style={{ textAlign: 'center', padding: 36, color: 'var(--ink-soft)' }}>ไม่มีรีวิวในหมวดนี้</div>
                ) : (
                  <div className="fb-list">
                    {rRows.map((r) => (
                      <div key={r.id} className="admin-card fb-card" style={{ borderLeft: `4px solid ${REVIEW_COLOR[normReviewStatus(r.status)]}` }}>
                        <div className="fb-top">
                          <strong>{r.productName || r.productId}</strong>
                          <span className="fb-time">{timeLabel(r.createdAt)}</span>
                        </div>
                        <div className="fb-stars">
                          {[1, 2, 3, 4, 5].map((n) => <FontAwesomeIcon key={n} icon={faStar} className={n <= (r.rating || 0) ? 'on' : ''} />)}
                        </div>
                        <p className="fb-text">{r.text}</p>
                        <span className="fb-by">— {r.authorName || 'ลูกค้า'}</span>
                        {/* กรอง URL รูปตอนแสดงผลด้วย เหตุผลเดียวกับหน้า public (rules ตรวจทีละสมาชิกในลิสต์ไม่ได้) */}
                        {cleanPhotos(r.photos).length > 0 && (
                          <div className="fb-photos">
                            {cleanPhotos(r.photos).map((u, i) => (
                              <a key={i} href={u} target="_blank" rel="noopener noreferrer"><img src={optImg(u, 300)} alt="" loading="lazy" /></a>
                            ))}
                          </div>
                        )}
                        <div className="fb-actions">
                          {REVIEW_STATUS_ORDER.map((k) => (
                            <button
                              key={k}
                              className="admin-btn"
                              disabled={normReviewStatus(r.status) === k}
                              style={normReviewStatus(r.status) === k ? { background: REVIEW_COLOR[k], borderColor: REVIEW_COLOR[k], color: '#fff' } : {}}
                              onClick={() => setR(r, k)}
                            >{REVIEW_STATUS[k]}</button>
                          ))}
                          <button
                            className="admin-btn-danger"
                            onClick={() => {
                              if (!window.confirm('ลบรีวิวนี้ถาวร?')) return
                              removeReview(r.id).catch((e) => window.alert('ลบไม่สำเร็จ: ' + e.message))
                            }}
                            aria-label="ลบรีวิว"
                          ><FontAwesomeIcon icon={faTrash} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="admin-card hk-toolbar">
                  <div className="hk-filters">
                    <button className={iFilter === 'all' ? 'on' : ''} onClick={() => setIFilter('all')}>ทั้งหมด <span>{issues.length}</span></button>
                    {ISSUE_STATUS_ORDER.map((k) => (
                      <button key={k} className={iFilter === k ? 'on' : ''} onClick={() => setIFilter(k)}>
                        {ISSUE_STATUS[k]} <span>{issues.filter((i) => normIssueStatus(i.status) === k).length}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {iLoading ? <ListSkeleton rows={3} /> : iRows.length === 0 ? (
                  <div className="admin-card" style={{ textAlign: 'center', padding: 36, color: 'var(--ink-soft)' }}>ไม่มีเรื่องในหมวดนี้</div>
                ) : (
                  <div className="fb-list">
                    {iRows.map((i) => (
                      <div key={i.id} className="admin-card fb-card" style={{ borderLeft: `4px solid ${ISSUE_COLOR[normIssueStatus(i.status)]}` }}>
                        <div className="fb-top">
                          <strong>{ISSUE_TOPIC_LABEL[normIssueTopic(i.topic)]}</strong>
                          <span className="fb-time">{timeLabel(i.createdAt)}</span>
                        </div>
                        <div className="fb-meta">
                          {i.orderCode && <span>ออเดอร์: {i.orderCode}</span>}
                          {/* tel: — งานนี้คือโทรกลับหาลูกค้า การก๊อบเบอร์ทีละเรื่องช้าเกินไป */}
                          {i.phone && <a href={`tel:${String(i.phone).replace(/[^0-9+]/g, '')}`}><FontAwesomeIcon icon={faPhone} /> {i.phone}</a>}
                        </div>
                        <p className="fb-text">{i.detail}</p>
                        {cleanPhotos(i.photos).length > 0 && (
                          <div className="fb-photos">
                            {cleanPhotos(i.photos).map((u, k) => (
                              <a key={k} href={u} target="_blank" rel="noopener noreferrer"><img src={optImg(u, 300)} alt="" loading="lazy" /></a>
                            ))}
                          </div>
                        )}
                        <div className="fb-actions">
                          {ISSUE_STATUS_ORDER.map((k) => (
                            <button
                              key={k}
                              className="admin-btn"
                              disabled={normIssueStatus(i.status) === k}
                              style={normIssueStatus(i.status) === k ? { background: ISSUE_COLOR[k], borderColor: ISSUE_COLOR[k], color: '#fff' } : {}}
                              onClick={() => setIssueStatus(i.id, k).catch((e) => window.alert('บันทึกไม่สำเร็จ: ' + e.message))}
                            >{ISSUE_STATUS[k]}</button>
                          ))}
                        </div>
                      </div>
                    ))}
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
