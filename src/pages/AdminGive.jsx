import { useEffect, useState } from 'react'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import { useAllowlistedAdmin, isVolunteerEmail } from '../useAdminRole.js'
import { db } from '../firebase.js'
import { collection, getDocs, orderBy, query, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPhone, faGift, faLaptop, faUtensils, faBoxOpen, faQrcode, faArrowRight, faTrash, faTriangleExclamation, faEnvelope, faCheckCircle, faTruck, faHandshake } from '@fortawesome/free-solid-svg-icons'
import { QRCodeSVG } from 'qrcode.react'
import ListSkeleton from '../components/ListSkeleton.jsx'

function ConfirmDelete({ item, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '1.5rem', color: '#dc2626' }}>
            <FontAwesomeIcon icon={faTriangleExclamation} />
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 800 }}>ยืนยันการลบข้อมูล</h3>
          <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: '.9rem' }}>
            ลบข้อมูลของ <strong>{item.fname} {item.lname}</strong><br />
            {item.refCode && <span style={{ fontSize: '.82rem', color: '#9ca3af' }}>{item.refCode}</span>}
          </p>
          <p style={{ margin: '12px 0 0', color: '#dc2626', fontSize: '.85rem', fontWeight: 600 }}>ข้อมูลจะถูกลบถาวร ไม่สามารถกู้คืนได้</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '12px', border: '1.5px solid #e5e7eb', borderRadius: 10, background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.95rem' }}>
            ยกเลิก
          </button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '12px', border: 'none', borderRadius: 10, background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '.95rem' }}>
            ลบข้อมูล
          </button>
        </div>
      </div>
    </div>
  )
}

function DonorCard({ item, onDelete }) {
  const isCook = item._source === 'cook'
  const [expanded, setExpanded] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [delivered, setDelivered] = useState(!!item.delivered)
  const [toggling, setToggling] = useState(false)
  const accentColor = isCook ? '#d97706' : '#7c3aed'

  const toggleDelivered = async () => {
    if (toggling) return
    setToggling(true)
    const next = !delivered
    const colName = isCook ? 'give2CookRegs' : 'give2Regs'
    try {
      await updateDoc(doc(db, colName, item.id), {
        delivered: next,
        deliveredAt: next ? new Date().toLocaleString('th-TH') : null,
      })
      setDelivered(next)
    } catch (_) {}
    setToggling(false)
  }

  return (
    <>
      {confirmDelete && (
        <ConfirmDelete
          item={item}
          onConfirm={() => { setConfirmDelete(false); onDelete(item) }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      <div className="give-admin-card" style={{ borderLeft: `4px solid ${accentColor}` }}>
        <div className="give-admin-card-head" style={{ display: 'flex', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div className="give-admin-ref">{item.refCode}</div>
            <div className="give-admin-name">{item.fname} {item.lname}</div>
            <div className="give-admin-phone"><FontAwesomeIcon icon={faPhone} /> {item.phone}</div>
            {item.email && <div style={{ fontSize: '.82rem', color: 'var(--ink-soft)', marginTop: 2 }}><FontAwesomeIcon icon={faEnvelope} /> {item.email}</div>}
            {item.canAttend != null && (
              <div style={{ marginTop: 6 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '.78rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: item.canAttend ? '#dcfce7' : '#fef9c3', color: item.canAttend ? '#15803d' : '#92400e' }}>
                  <FontAwesomeIcon icon={item.canAttend ? faCheckCircle : faTruck} />
                  {item.canAttend ? 'สะดวกมามอบในงาน' : 'ไม่สะดวก — นัดรับที่ออฟฟิศ'}
                </span>
              </div>
            )}
            <div style={{ marginTop: 6 }}>
              {isCook ? (
                item.typeLabels && (
                  <span className="give-type-chip" style={{ background: '#d97706', color: '#fff' }}>
                    <FontAwesomeIcon icon={faUtensils} /> {item.typeLabels}
                  </span>
                )
              ) : (
                <span className="give-type-chip computer">
                  <FontAwesomeIcon icon={faLaptop} /> คอมมือสอง
                  {item.notebookQty > 0 && ` · Notebook ${item.notebookQty}`}
                  {item.tabletQty > 0 && ` · Tablet ${item.tabletQty}`}
                </span>
              )}
            </div>
            {item.detail && <p className="give-admin-detail">{item.detail}</p>}
            <div className="give-admin-date">{item.submittedAt ? new Date(item.submittedAt).toLocaleString('th-TH') : ''}</div>
            <div style={{ marginTop: 8 }}>
              <button
                onClick={toggleDelivered}
                disabled={toggling}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 99, border: 'none', cursor: toggling ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: '.78rem',
                  background: delivered ? '#dcfce7' : '#f3f4f6',
                  color: delivered ? '#15803d' : '#6b7280',
                  transition: 'all .2s',
                }}
              >
                <FontAwesomeIcon icon={delivered ? faCheckCircle : faHandshake} />
                {toggling ? '...' : delivered ? 'ส่งมอบแล้ว' : 'ยังไม่ส่งมอบ'}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button onClick={() => setShowQr(v => !v)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: accentColor, fontSize: '1.2rem' }}>
              <FontAwesomeIcon icon={faQrcode} />
            </button>
            {showQr && <div><QRCodeSVG value={item.refCode || item.id} size={80} level="M" /></div>}
            {/* onDelete = null เมื่อบัญชีไม่มีสิทธิ์ลบ (บัญชี volunteer) — ไม่โชว์ปุ่มที่กดแล้วต้องเจอ permission error */}
            {onDelete && (
              <button onClick={() => setConfirmDelete(true)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '1rem', marginTop: 4 }} title="ลบข้อมูล">
                <FontAwesomeIcon icon={faTrash} />
              </button>
            )}
          </div>
        </div>
        {item.imageUrls?.length > 0 && (
          <div>
            <button className="give-admin-toggle" onClick={() => setExpanded(v => !v)}>
              {expanded ? '▲ ซ่อนรูป' : `▼ ดูรูป (${item.imageUrls.length} รูป)`}
            </button>
            {expanded && (
              <div className="give-admin-images">
                {item.imageUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt={`img-${i}`} className="give-admin-thumb" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export default function AdminGive() {
  const { user, loading } = useAllowlistedAdmin()
  // ปุ่มลบโชว์เฉพาะแอดมินตัวจริง (ดู handleDelete + firestore.rules give2Regs/give2CookRegs)
  const canDelete = !isVolunteerEmail(user?.email || '')
  const [comItems, setComItems] = useState([])
  const [cookItems, setCookItems] = useState([])
  const [tab, setTab] = useState('all')
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!user) return
    let done = 0
    const finish = () => { done++; if (done >= 2) setFetching(false) }

    getDocs(query(collection(db, 'give2Regs'), orderBy('submittedAt', 'desc')))
      .then((snap) => setComItems(snap.docs.map((d) => ({ id: d.id, _source: 'com', ...d.data() }))))
      .catch(() => {}).finally(finish)

    getDocs(query(collection(db, 'give2CookRegs'), orderBy('submittedAt', 'desc')))
      .then((snap) => setCookItems(snap.docs.map((d) => ({ id: d.id, _source: 'cook', ...d.data() }))))
      .catch(() => {}).finally(finish)
  }, [user])

  // ลบเอกสารผู้บริจาคเป็นการทำลายข้อมูลถาวร firestore.rules จำกัดไว้ที่ isFullAdmin() เท่านั้น
  // (บัญชี volunteer แชร์กันหลายคน อยู่นอกขอบเขตหน้าที่) — ต้อง catch ด้วย ไม่งั้น permission error
  // จะเงียบหายเป็น unhandled rejection ผู้ใช้กดแล้วไม่มีอะไรเกิดขึ้นโดยไม่รู้สาเหตุ
  const handleDelete = async (item) => {
    const colName = item._source === 'cook' ? 'give2CookRegs' : 'give2Regs'
    try {
      await deleteDoc(doc(db, colName, item.id))
    } catch (e) {
      window.alert('ลบไม่สำเร็จ: บัญชีนี้ไม่มีสิทธิ์ลบข้อมูลผู้บริจาค กรุณาแจ้งแอดมินตัวจริง')
      return
    }
    if (item._source === 'cook') setCookItems(prev => prev.filter(i => i.id !== item.id))
    else setComItems(prev => prev.filter(i => i.id !== item.id))
  }

  if (loading) return null
  if (!user) return <AdminLogin />

  const all = [...comItems, ...cookItems].sort((a, b) =>
    (b.submittedAt || '').localeCompare(a.submittedAt || '')
  )
  const displayed = tab === 'com' ? comItems : tab === 'cook' ? cookItems : all

  return (
    <main className="admin-dash">
      <AdminNav />
      <div className="admin-wrap">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div>
            <h2 style={{ marginBottom: 4 }}><FontAwesomeIcon icon={faGift} /> ส่งต่อของ — งานให้ ครั้งที่ 6</h2>
            <p style={{ color: 'var(--ink-soft)', margin: 0 }}>รายการสิ่งของที่ผู้บริจาคลงทะเบียนส่งมอบทั้งหมด</p>
          </div>
          <a href="/admin/give/receiver" className="admin-btn admin-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <FontAwesomeIcon icon={faBoxOpen} /> ข้อมูลผู้รับ <FontAwesomeIcon icon={faArrowRight} />
          </a>
        </div>

        <div className="admin-stats" style={{ marginBottom: 24 }}>
          <div className="admin-stat"><div className="v">{all.length}</div><div className="l">ทั้งหมด</div></div>
          <div className="admin-stat"><div className="v">{comItems.length}</div><div className="l"><FontAwesomeIcon icon={faLaptop} /> คอมมือสอง</div></div>
          <div className="admin-stat"><div className="v">{cookItems.length}</div><div className="l"><FontAwesomeIcon icon={faUtensils} /> เครื่องมือ</div></div>
          <div className="admin-stat"><div className="v" style={{ color: '#15803d' }}>{all.filter(i => i.delivered).length}</div><div className="l"><FontAwesomeIcon icon={faCheckCircle} style={{ color: '#15803d' }} /> ส่งมอบแล้ว</div></div>
        </div>

        <div className="give-admin-tabs" style={{ marginBottom: 20 }}>
          <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>ทั้งหมด ({all.length})</button>
          <button className={tab === 'com' ? 'active' : ''} onClick={() => setTab('com')}>
            <FontAwesomeIcon icon={faLaptop} /> คอมมือสอง ({comItems.length})
          </button>
          <button className={tab === 'cook' ? 'active' : ''} onClick={() => setTab('cook')}>
            <FontAwesomeIcon icon={faUtensils} /> เครื่องมือ ({cookItems.length})
          </button>
        </div>

        {fetching ? (
          <ListSkeleton />
        ) : displayed.length === 0 ? (
          <p style={{ color: 'var(--ink-soft)', textAlign: 'center', padding: '40px 0' }}>ยังไม่มีข้อมูล</p>
        ) : (
          <div className="give-admin-grid">
            {displayed.map((item) => <DonorCard key={item.id} item={item} onDelete={canDelete ? handleDelete : null} />)}
          </div>
        )}
      </div>
    </main>
  )
}
