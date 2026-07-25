import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { collection, query, where, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch } from '@fortawesome/free-solid-svg-icons'

// ค้นหาแบบรวม (/admin) — ⚠️ ข้อจำกัด: Firestore ไม่รองรับ full-text "contains" ในตัว จึงใช้เทคนิค prefix-match
// มาตรฐาน (where(field,'>=',term) + where(field,'<=',term+'')) ซึ่งค้นได้แค่คำที่ "ขึ้นต้นตรงกัน"
// เท่านั้น ไม่ใช่ substring search แบบ Postgres ILIKE '%term%' ของเวอร์ชัน Next.js เดิม — เช่นค้นหา "มูลนิธิ"
// จะไม่เจอ "ครูมูลนิธิ" เพราะไม่ได้ขึ้นต้นด้วยคำนั้น เป็น trade-off ที่ยอมรับได้เพราะดึงทั้ง collection มา
// กรองฝั่ง client แทนไม่คุ้ม (โต scale ไม่ได้เมื่อข้อมูลมีเยอะ)
const SOURCES = [
  { col: 'partnerOrganizations', field: 'name', label: 'องค์กร', icon: '🤝', href: '/admin/partners' },
  { col: 'speakers', field: 'name', label: 'วิทยากร', icon: '🎤', href: '/admin/speakers' },
  { col: 'aidLocations', field: 'villageName', label: 'จุดลงพื้นที่', icon: '📍', href: '/admin/aid-map' },
  { col: 'boardCards', field: 'title', label: 'การ์ดบอร์ด', icon: '🗂', href: '/admin/board' },
]

export default function AdminGlobalSearch() {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    const t = term.trim()
    if (!t) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const all = await Promise.all(SOURCES.map(async (s) => {
          const qy = query(collection(db, s.col), where(s.field, '>=', t), where(s.field, '<=', t + ''), limit(5))
          const snap = await getDocs(qy)
          return snap.docs.map((d) => ({ id: d.id, label: d.data()[s.field], source: s }))
        }))
        setResults(all.flat())
      } catch (e) {
        // ไม่มีสิทธิ์อ่านบาง collection (role ต่ำเกินไป) ก็แค่ไม่โชว์ผลลัพธ์จากส่วนนั้น ไม่ต้อง error UI
        setResults([])
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [term])

  const toggle = () => {
    if (!open && inputRef.current) {
      const r = inputRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 8, left: r.left })
    }
    setOpen((v) => !v)
  }

  const goTo = (href) => { setOpen(false); setTerm(''); window.location.href = href }

  return (
    <div className="admin-global-search">
      <FontAwesomeIcon icon={faSearch} style={{ opacity: .5 }} />
      <input
        ref={inputRef}
        type="search"
        placeholder="ค้นหาองค์กร/วิทยากร/จุดลงพื้นที่/การ์ด..."
        value={term}
        onChange={(e) => { setTerm(e.target.value); setOpen(true) }}
        onFocus={toggle}
      />
      {open && term.trim() && createPortal(
        <>
          <div className="fab-hub-overlay" onClick={() => setOpen(false)} />
          <div className="notif-dropdown" style={{ top: pos.top, left: pos.left }}>
            <div className="notif-dropdown-head">ผลการค้นหา (ขึ้นต้นด้วย "{term}")</div>
            {results.length === 0 ? (
              <div className="notif-dropdown-empty">ไม่พบผลลัพธ์</div>
            ) : results.map((r) => (
              <div key={r.source.col + r.id} className="notif-dropdown-item" onClick={() => goTo(r.source.href)}>
                <div className="notif-dropdown-item-top">
                  <span className="notif-dropdown-item-name">{r.source.icon} {r.label}</span>
                </div>
                <div className="notif-dropdown-item-text">{r.source.label}</div>
              </div>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
