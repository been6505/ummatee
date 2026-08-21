import { useEffect, useState } from 'react'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import VolunteerGuard from '../components/VolunteerGuard.jsx'
import { useAllowlistedAdmin } from '../useAdminRole.js'
import { db } from '../firebase.js'
import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPhone, faBoxOpen, faLaptop, faUtensils, faSchool, faUser, faQrcode, faArrowLeft, faTrash, faTriangleExclamation, faEnvelope, faLocationDot, faClipboardList, faQuoteLeft, faCheckCircle, faHandshake } from '@fortawesome/free-solid-svg-icons'
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
            ลบข้อมูลของ <strong>{item.fname} {item.lname}</strong>
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

function InfoRow({ label, value, icon, accent }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '5px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ minWidth: 110, fontSize: '.78rem', color: '#9ca3af', fontWeight: 600, paddingTop: 1, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '.85rem', color: '#1f2937', flex: 1, lineHeight: 1.5 }}>
        {icon && <FontAwesomeIcon icon={icon} style={{ color: accent, marginRight: 5, fontSize: '.75rem' }} />}
        {value}
      </span>
    </div>
  )
}

function ReceiverCard({ item, onDelete }) {
  const isComp = item.type === 'computer'
  const [showQr, setShowQr] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [received, setReceived] = useState(!!item.received)
  const [toggling, setToggling] = useState(false)
  const accentColor = isComp ? '#7c3aed' : '#d97706'

  const toggleReceived = async () => {
    if (toggling) return
    setToggling(true)
    const next = !received
    try {
      await updateDoc(doc(db, 'giveReceiveRegs', item.id), {
        received: next,
        receivedAt: next ? new Date().toLocaleString('th-TH') : null,
      })
      setReceived(next)
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
        {/* Header row */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <span className="give-type-chip" style={{ background: accentColor, color: '#fff', marginBottom: 8, display: 'inline-block' }}>
              <FontAwesomeIcon icon={isComp ? faLaptop : faUtensils} />
              {' '}{isComp ? 'รับคอมมือสอง' : 'รับอุปกรณ์ประกอบอาชีพ'}
            </span>
            <div className="give-admin-name">{item.fname} {item.lname}</div>
            <div className="give-admin-date" style={{ marginTop: 2 }}>{item.date || ''}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button onClick={() => setShowQr(v => !v)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: accentColor, fontSize: '1.2rem' }}>
              <FontAwesomeIcon icon={faQrcode} />
            </button>
            {showQr && <div><QRCodeSVG value={`RCV-${item.id}`} size={80} level="M" /></div>}
            <button onClick={() => setConfirmDelete(true)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '1rem', marginTop: 4 }} title="ลบข้อมูล">
              <FontAwesomeIcon icon={faTrash} />
            </button>
          </div>
        </div>

        {/* Received toggle */}
        <div style={{ marginBottom: 10 }}>
          <button
            onClick={toggleReceived}
            disabled={toggling}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 99, border: 'none', cursor: toggling ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: '.78rem',
              background: received ? '#dcfce7' : '#f3f4f6',
              color: received ? '#15803d' : '#6b7280',
              transition: 'all .2s',
            }}
          >
            <FontAwesomeIcon icon={received ? faCheckCircle : faHandshake} />
            {toggling ? '...' : received ? 'รับมอบแล้ว' : 'ยังไม่รับมอบ'}
          </button>
        </div>

        {/* Info grid */}
        <div style={{ background: '#fafafa', borderRadius: 10, padding: '2px 12px', marginBottom: 8 }}>
          <InfoRow label="เบอร์โทร" value={item.phone} icon={faPhone} accent={accentColor} />
          <InfoRow label="อีเมล" value={item.email} icon={faEnvelope} accent={accentColor} />
          <InfoRow label="อายุ" value={item.age ? `${item.age} ปี` : null} accent={accentColor} />
          {isComp ? (
            <>
              <InfoRow label="โรงเรียน" value={item.school} icon={faSchool} accent={accentColor} />
              <InfoRow label="อาจารย์ที่ปรึกษา" value={item.teacherName} icon={faUser} accent={accentColor} />
              <InfoRow label="เบอร์อาจารย์" value={item.teacherPhone} icon={faPhone} accent={accentColor} />
            </>
          ) : (
            <>
              <InfoRow label="อาชีพ" value={item.job} accent={accentColor} />
              <InfoRow label="รายละเอียดสิ่งที่ทำ" value={item.detail} accent={accentColor} />
              <InfoRow label="สิ่งของที่ต้องการ" value={item.wantedItems} icon={faClipboardList} accent={accentColor} />
            </>
          )}
          <InfoRow label="ที่อยู่จัดส่ง" value={item.address} icon={faLocationDot} accent={accentColor} />
        </div>

        {/* Reason block */}
        {item.reason && (
          <div style={{ fontSize: '.84rem', color: '#374151', padding: '8px 12px', background: '#f9fafb', borderRadius: 8, borderLeft: `3px solid ${accentColor}`, lineHeight: 1.6 }}>
            <span style={{ fontSize: '.72rem', fontWeight: 700, color: accentColor, display: 'block', marginBottom: 3 }}>
              <FontAwesomeIcon icon={faQuoteLeft} /> เหตุผลที่ต้องการรับมอบ
            </span>
            {item.reason}
          </div>
        )}
      </div>
    </>
  )
}

export default function AdminGiveReceiver() {
  const { user, loading } = useAllowlistedAdmin()
  const [receivers, setReceivers] = useState([])
  const [tab, setTab] = useState('all')
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!user) return
    getDocs(collection(db, 'giveReceiveRegs'))
      .then((snap) => setReceivers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [user])

  const handleDelete = async (item) => {
    await deleteDoc(doc(db, 'giveReceiveRegs', item.id))
    setReceivers(prev => prev.filter(r => r.id !== item.id))
  }

  if (loading) return null
  if (!user) return <AdminLogin />

  const rcComp = receivers.filter((r) => r.type === 'computer')
  const rcEquip = receivers.filter((r) => r.type === 'equipment')
  const displayed = tab === 'computer' ? rcComp : tab === 'equipment' ? rcEquip : receivers

  return (<VolunteerGuard>
    <main className="admin-dash">
      <AdminNav />
      <div className="admin-wrap">
        <div style={{ marginBottom: 24 }}>
          <a href="/admin/give" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink-soft)', fontSize: '.88rem', textDecoration: 'none', marginBottom: 8 }}>
            <FontAwesomeIcon icon={faArrowLeft} /> กลับหน้าส่งต่อของ
          </a>
          <h2 style={{ marginBottom: 4 }}><FontAwesomeIcon icon={faBoxOpen} /> ข้อมูลผู้รับ — งานให้ ครั้งที่ 6</h2>
          <p style={{ color: 'var(--ink-soft)', margin: 0 }}>รายชื่อผู้ลงทะเบียนรับคอมมือสองและอุปกรณ์ประกอบอาชีพ</p>
        </div>

        <div className="admin-stats" style={{ marginBottom: 24 }}>
          <div className="admin-stat"><div className="v">{receivers.length}</div><div className="l">ทั้งหมด</div></div>
          <div className="admin-stat"><div className="v">{rcComp.length}</div><div className="l"><FontAwesomeIcon icon={faLaptop} /> รับคอมมือสอง</div></div>
          <div className="admin-stat"><div className="v">{rcEquip.length}</div><div className="l"><FontAwesomeIcon icon={faUtensils} /> รับเครื่องมือ</div></div>
          <div className="admin-stat"><div className="v" style={{ color: '#15803d' }}>{receivers.filter(r => r.received).length}</div><div className="l"><FontAwesomeIcon icon={faCheckCircle} style={{ color: '#15803d' }} /> รับมอบแล้ว</div></div>
        </div>

        <div className="give-admin-tabs" style={{ marginBottom: 20 }}>
          <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>ทั้งหมด ({receivers.length})</button>
          <button className={tab === 'computer' ? 'active' : ''} onClick={() => setTab('computer')}>
            <FontAwesomeIcon icon={faLaptop} /> คอมมือสอง ({rcComp.length})
          </button>
          <button className={tab === 'equipment' ? 'active' : ''} onClick={() => setTab('equipment')}>
            <FontAwesomeIcon icon={faUtensils} /> เครื่องมือ ({rcEquip.length})
          </button>
        </div>

        {fetching ? (
          <ListSkeleton />
        ) : displayed.length === 0 ? (
          <p style={{ color: 'var(--ink-soft)', textAlign: 'center', padding: '40px 0' }}>ยังไม่มีข้อมูล</p>
        ) : (
          <div className="give-admin-grid">
            {displayed.map((item) => <ReceiverCard key={item.id} item={item} onDelete={handleDelete} />)}
          </div>
        )}
      </div>
    </main>
  </VolunteerGuard>)
}
