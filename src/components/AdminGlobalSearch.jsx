import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { collection, query, where, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch } from '@fortawesome/free-solid-svg-icons'
import { SEARCH_COLLECTIONS, SEARCH_FIELD, queryToken, matchesTerm } from '../lib/searchIndex.js'

// ค้นหาแบบรวม (/admin) — ⚠️ ข้อจำกัด: Firestore ไม่รองรับ full-text "contains" ในตัว จึงใช้เทคนิค prefix-match
// มาตรฐาน (where(field,'>=',term) + where(field,'<=',term+'')) ซึ่งค้นได้แค่คำที่ "ขึ้นต้นตรงกัน"
// เท่านั้น ไม่ใช่ substring search แบบ Postgres ILIKE '%term%' ของเวอร์ชัน Next.js เดิม — เช่นค้นหา "มูลนิธิ"
// จะไม่เจอ "ครูมูลนิธิ" เพราะไม่ได้ขึ้นต้นด้วยคำนั้น เป็น trade-off ที่ยอมรับได้เพราะดึงทั้ง collection มา
// กรองฝั่ง client แทนไม่คุ้ม (โต scale ไม่ได้เมื่อข้อมูลมีเยอะ)
//
// แต่ละแหล่งยิง query แยกกันและ catch แยกกัน — แหล่งที่บัญชีนี้ไม่มีสิทธิ์อ่านจะเงียบไป
// ไม่ทำให้ผลลัพธ์จากแหล่งอื่นหาย (ดูเหตุผลในลูปด้านล่าง)
//
// hrefFor: บางแหล่งเปิดตรงไปที่รายการนั้นได้เลย (เช่นคำสั่งซื้อ) ไม่ต้องให้ผู้ใช้ไปหาต่อในหน้า list
// แหล่งที่ยังใช้ prefix-match (ไม่มีดัชนี searchTokens) — ส่วนที่มีดัชนีอยู่ใน SEARCH_COLLECTIONS
// - orders / ฟอร์มลงทะเบียนต่างๆ: เขียนจากฝั่งสาธารณะ (guest checkout / หน้าลงทะเบียน) ถ้าจะทำดัชนี
//   ต้องให้ผู้ใช้ทั่วไปเขียน searchTokens เองซึ่งเชื่อไม่ได้ และ firestore.rules คุมฟิลด์ไว้แน่นอยู่แล้ว
// - meetings: validMeeting() ใช้ keys().hasOnly() ระบุฟิลด์เป๊ะ เพิ่มฟิลด์ต้องแก้กฎด้วย
const PREFIX_SOURCES = [
  { col: 'meetings', field: 'title', label: 'ห้องประชุม', icon: '🎥', href: '/admin/video-call' },
  // คำสั่งซื้อ — ค้นด้วยเลขที่ออเดอร์ (ORD-0001) แล้วเปิดหน้าจัดการออเดอร์นั้นตรงๆ
  { col: 'orders', field: 'orderCode', label: 'คำสั่งซื้อ', icon: '📦', href: '/admin/shop/orders',
    hrefFor: (id) => `/admin/shop/orders/${id}` },
  // ผู้ลงทะเบียนต่างๆ — ค้นด้วย "ชื่อจริง" (ฟิลด์ fname) เพราะเป็นฟิลด์ที่ทุกฟอร์มมีเหมือนกัน
  { col: 'volunteerRegs', field: 'fname', label: 'อาสาสมัคร', icon: '🙋', href: '/admin/volunteer' },
  { col: 'iftarRegs', field: 'fname', label: 'ลงทะเบียน Iftar', icon: '🌙', href: '/admin/event/iftar2026' },
  { col: 'give2Regs', field: 'fname', label: 'ผู้บริจาค (คอม)', icon: '💻', href: '/admin/give' },
  { col: 'give2CookRegs', field: 'fname', label: 'ผู้บริจาค (อุปกรณ์)', icon: '🍳', href: '/admin/give' },
  { col: 'b2umRegs', field: 'shopName', label: 'ร้านค้า B2UM', icon: '🏪', href: '/admin/b2um' },
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
      // ต้อง catch ต่อ collection ไม่ใช่ครอบ Promise.all — ไม่งั้น collection เดียวที่อ่านไม่ได้ (role ต่ำเกินไป
      // หรือ error ชั่วคราว) ทำให้ Promise.all reject แล้วผลลัพธ์หายหมด กลายเป็น "ไม่พบผลลัพธ์" ทั้งที่ collection อื่นเจอ
      const token = queryToken(t)

      // 1) คอลเลกชันที่มีดัชนี — array-contains ⇒ พิมพ์คำกลางข้อความก็เจอ
      const indexed = token ? SEARCH_COLLECTIONS.map(async (s) => {
        const qy = query(collection(db, s.col), where(SEARCH_FIELD, 'array-contains', token), limit(5))
        const snap = await getDocs(qy).catch(() => null)
        if (!snap) return []
        return snap.docs
          // พิมพ์ยาวเกินที่ index ไว้ ⇒ token ถูกตัด ต้องกรองซ้ำไม่ให้ผลหลุดเกินที่พิมพ์จริง
          .filter((d) => matchesTerm(s.fields.map((f) => d.data()[f]).join(' '), t))
          .map((d) => ({ id: d.id, label: d.data()[s.titleField] || '(ไม่มีชื่อ)', source: s }))
      }) : []

      // 2) คอลเลกชันที่ยังไม่มีดัชนี — prefix-match แบบเดิม
      const prefixed = PREFIX_SOURCES.map(async (s) => {
        const qy = query(collection(db, s.col), where(s.field, '>=', t), where(s.field, '<=', t + ''), limit(5))
        const snap = await getDocs(qy).catch(() => null)
        if (!snap) return []
        return snap.docs.map((d) => ({ id: d.id, label: d.data()[s.field], source: s }))
      })

      const all = await Promise.all([...indexed, ...prefixed])
      setResults(all.flat())
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
        placeholder="ค้นหาทุกอย่างในระบบ (ขึ้นต้นด้วย...)"
        value={term}
        onChange={(e) => { setTerm(e.target.value); setOpen(true) }}
        onFocus={toggle}
      />
      {open && term.trim() && createPortal(
        <>
          <div className="fab-hub-overlay" onClick={() => setOpen(false)} />
          <div className="notif-dropdown" style={{ top: pos.top, left: pos.left }}>
            <div className="notif-dropdown-head">ผลการค้นหา "{term}"</div>
            {results.length === 0 ? (
              <div className="notif-dropdown-empty">ไม่พบผลลัพธ์</div>
            ) : results.map((r) => (
              <div key={r.source.col + r.id} className="notif-dropdown-item" onClick={() => goTo(r.source.hrefFor ? r.source.hrefFor(r.id) : r.source.href)}>
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
