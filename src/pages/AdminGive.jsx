import { useEffect, useState } from 'react'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { db } from '../firebase.js'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPhone, faGift, faLaptop, faUtensils } from '@fortawesome/free-solid-svg-icons'

const TYPE_LABELS = {
  computer: 'คอมมือสองเพื่อน้อง',
  tools: 'เครื่องมือทำอาชีพ',
}

function ItemCard({ item }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="give-admin-card">
      <div className="give-admin-card-head">
        <div>
          <div className="give-admin-ref">{item.refCode}</div>
          <div className="give-admin-name">{item.fname} {item.lname}</div>
          <div className="give-admin-phone"><FontAwesomeIcon icon={faPhone} /> {item.phone}</div>
          <div className="give-admin-types">
            {(item.types || []).map((k) => (
              <span key={k} className={`give-type-chip ${k}`}>{TYPE_LABELS[k] || k}</span>
            ))}
          </div>
          {item.detail && <p className="give-admin-detail">{item.detail}</p>}
          <div className="give-admin-date">{item.submittedAt ? new Date(item.submittedAt).toLocaleString('th-TH') : ''}</div>
        </div>
      </div>
      {item.imageUrls?.length > 0 && (
        <div>
          <button className="give-admin-toggle" onClick={() => setExpanded((v) => !v)}>
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
  )
}

export default function AdminGive() {
  const { user, loading } = useAdminAuth()
  const [items, setItems] = useState([])
  const [tab, setTab] = useState('all')
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'give2Regs'), orderBy('submittedAt', 'desc'))
    getDocs(q)
      .then((snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [user])

  if (loading) return null
  if (!user) return <AdminLogin />

  const computers = items.filter((i) => i.types?.includes('computer'))
  const tools = items.filter((i) => i.types?.includes('tools'))
  const displayed = tab === 'computer' ? computers : tab === 'tools' ? tools : items

  return (
    <main className="admin-dash">
      <AdminNav />
      <div className="admin-wrap">
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ marginBottom: 4 }}><FontAwesomeIcon icon={faGift} /> ส่งต่อของ — งานให้ ครั้งที่ 6</h2>
          <p style={{ color: 'var(--ink-soft)' }}>รายการสิ่งของที่ผู้บริจาคลงทะเบียนส่งมอบ</p>
        </div>

        {/* Summary */}
        <div className="admin-stats" style={{ marginBottom: 24 }}>
          <div className="admin-stat">
            <div className="v">{items.length}</div>
            <div className="l">ทั้งหมด</div>
          </div>
          <div className="admin-stat">
            <div className="v">{computers.length}</div>
            <div className="l"><FontAwesomeIcon icon={faLaptop} /> คอมมือสอง</div>
          </div>
          <div className="admin-stat">
            <div className="v">{tools.length}</div>
            <div className="l"><FontAwesomeIcon icon={faUtensils} /> เครื่องมือทำอาชีพ</div>
          </div>
        </div>

        {/* Tab filter */}
        <div className="give-admin-tabs">
          <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>ทั้งหมด ({items.length})</button>
          <button className={tab === 'computer' ? 'active' : ''} onClick={() => setTab('computer')}><FontAwesomeIcon icon={faLaptop} /> คอมมือสอง ({computers.length})</button>
          <button className={tab === 'tools' ? 'active' : ''} onClick={() => setTab('tools')}><FontAwesomeIcon icon={faUtensils} /> เครื่องมือทำอาชีพ ({tools.length})</button>
        </div>

        {fetching && <p style={{ color: 'var(--ink-soft)', textAlign: 'center', padding: '40px 0' }}>กำลังโหลด...</p>}
        {!fetching && displayed.length === 0 && (
          <p style={{ color: 'var(--ink-soft)', textAlign: 'center', padding: '40px 0' }}>ยังไม่มีข้อมูล</p>
        )}

        <div className="give-admin-grid">
          {displayed.map((item) => <ItemCard key={item.id} item={item} />)}
        </div>
      </div>
    </main>
  )
}
