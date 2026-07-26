import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase.js'
import { db } from '../firebase.js'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHouse, faFlag, faMoneyBill, faCalendar, faBagShopping, faHandshake, faBars, faXmark, faScrewdriverWrench, faEarthAsia, faChevronDown, faBullhorn, faAnglesLeft, faAnglesRight, faGlobe, faComments, faBell } from '@fortawesome/free-solid-svg-icons'

import { isVolunteerEmail } from '../useAdminRole.js'
import InstallAdminApp from './InstallAdminApp.jsx'
import AdminChatFab from './AdminChatFab.jsx'
import AdminGlobalSearch from './AdminGlobalSearch.jsx'
import { useAdminChatList } from '../data/chat.js'
import { useNewOrdersCount, useNewOrders } from '../data/orders.js'
import useSunGradient from '../hooks/useSunGradient.js'
import useStaffRole, { hasStaffRole } from '../useStaffRole.js'
import { faUsers, faMapLocationDot, faTableColumns, faClockRotateLeft, faMicrophone, faBullseye, faVideo } from '@fortawesome/free-solid-svg-icons'

const NAV_GROUPS = [
  { label: 'หน้าหลัก', icon: faHouse, href: '/admin/dashboard' },
  { label: 'จัดการเว็บ', icon: faGlobe, href: '/admin/website' },
  { label: 'แชท', icon: faComments, href: '/admin/chat' },
  {
    label: 'Missions', icon: faEarthAsia, children: [
      { href: '/admin/missions', label: 'ภารกิจ' },
      { href: '/admin/missions/qurban2026', label: 'Qurban 2026' },
    ]
  },
  {
    label: 'Events', icon: faFlag, children: [
      { href: '/admin/event/iftar2026', label: 'Iftar For Gaza' },
      { href: '/admin/give', label: 'ส่งต่อของ' },
      { href: '/admin/give/receiver', label: 'ข้อมูลผู้รับ' },
      { href: '/admin/qrcode', label: 'เช็คอินหน้างาน' },
    ]
  },
  {
    label: 'Um Shop', icon: faBagShopping, children: [
      { href: '/admin/shop', label: 'จัดการสินค้า' },
      { href: '/admin/shop/new', label: 'เพิ่มสินค้า/โปรโมชั่น' },
      { href: '/admin/shop/orders', label: 'คำสั่งซื้อ' },
      { href: '/admin/shop/inventory', label: 'คลังสินค้า' },
      { href: '/admin/shop/sales', label: 'รายงานยอดขาย' },
    ]
  },
  { label: 'ปฏิทิน', icon: faCalendar, href: '/admin/calendar' },
  {
    label: 'เงินบริจาค', icon: faMoneyBill, children: [
      { href: '/admin/donations', label: 'บันทึกเงินบริจาค' },
      { href: '/admin/financial-dashboard', label: 'แดชบอร์ดการเงิน' },
    ]
  },
  { label: 'อาสาสมัคร', icon: faHandshake, href: '/admin/volunteer' },
  { label: 'Email Broadcast', icon: faBullhorn, href: '/admin/dashboard/broadcast' },
]

// เมนู CRM/บอร์ด/staff ใหม่ — ใช้ระบบ staff role ใหม่ (staff/{uid}) แยกจาก isAdmin/isVolunteer เดิม
// requireRoles: null = แค่ต้องมี staff doc ที่ active (ไม่จำกัด role) ไม่ null = ต้องอยู่ใน role list นั้น
const STAFF_NAV_GROUPS = [
  { label: 'แดชบอร์ด Staff', icon: faTableColumns, href: '/admin/staff-dashboard', requireRoles: ['admin', 'staff', 'social', 'field'] },
  {
    label: 'CRM', icon: faUsers, requireRoles: ['admin', 'staff', 'field'], children: [
      { href: '/admin/partners', label: 'องค์กรพันธมิตร' },
      { href: '/admin/aid-map', label: 'แผนที่จุดลงพื้นที่', icon: faMapLocationDot },
      { href: '/admin/speakers', label: 'วิทยากร/อินฟลูเอนเซอร์', icon: faMicrophone },
    ]
  },
  { label: 'แคมเปญบริจาค', icon: faBullseye, href: '/admin/campaigns', requireRoles: ['admin', 'staff', 'field'] },
  { label: 'งาน/อีเวนต์', icon: faFlag, href: '/admin/events', requireRoles: ['admin', 'staff', 'field'] },
  { label: 'บอร์ดวางแผน', icon: faTableColumns, href: '/admin/board', requireRoles: ['admin', 'staff', 'field'] },
  { label: 'ประชุมวิดีโอ', icon: faVideo, href: '/admin/video-call', requireRoles: ['admin', 'staff', 'field', 'social'] },
  { label: 'ประวัติการเปลี่ยนแปลง', icon: faClockRotateLeft, href: '/admin/audit-log', requireRoles: ['admin'] },
  { label: 'จัดการ Staff', icon: faUsers, href: '/admin/staff', requireRoles: ['admin'] },
]

const VOLUNTEER_NAV = [
  {
    label: 'Events', icon: faFlag, children: [
      { href: '/admin/event/iftar2026', label: 'Iftar For Gaza' },
      { href: '/admin/give', label: 'ส่งต่อของ' },
      { href: '/admin/qrcode', label: 'เช็คอินหน้างาน' },
    ]
  },
]

// กระดิ่งแจ้งเตือน — รวม 2 แหล่ง: แชทที่ยังไม่อ่าน + คำสั่งซื้อใหม่ กดแล้วพาไปหน้านั้นๆ
function notifTimeLabel(ts) {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(ts) // แชทเป็น Firestore Timestamp, ออเดอร์เป็นเลข ms ธรรมดา (Date.now())
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })
}
const notifTHB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH')

// กระดิ่งแจ้งเตือน — กดแล้วเด้งรายการแจ้งเตือน (แชทที่ยังไม่อ่าน + คำสั่งซื้อใหม่) แบบลอยอยู่หน้าเดิม ไม่พาไปเปลี่ยนหน้า
// ใช้ position:fixed วัดตำแหน่งจากปุ่มจริง (getBoundingClientRect) กันโดน overflow:hidden ของ sidebar ตัดขอบ
function NotifBell({ canSeeOrders }) {
  const { chats } = useAdminChatList()
  const newOrders = useNewOrders(canSeeOrders)
  const unreadChats = chats.filter((c) => c.unreadByAdmin)
  const total = unreadChats.length + newOrders.length
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const mobile = window.innerWidth < 769
      setPos(mobile ? { top: r.bottom + 8, center: true } : { top: r.bottom + 8, left: r.left })
    }
    setOpen((v) => !v)
  }

  const goTo = (href) => { setOpen(false); window.location.href = href }

  // เรนเดอร์ผ่าน portal ไปที่ document.body — กัน .admin-nav (มี transform+overflow:hidden บนเดสก์ท็อป)
  // สร้าง containing block ใหม่ให้ position:fixed ลูกในตัวมันเอง ทำให้ dropdown โดนตัดขอบ/บังไปกับ sidebar
  return (
    <>
      <button ref={btnRef} className="admin-nav-bell" onClick={toggle} aria-label="การแจ้งเตือน">
        <FontAwesomeIcon icon={faBell} />
        {total > 0 && <span className="admin-nav-bell-badge">{total}</span>}
      </button>

      {open && createPortal(
        <>
          <div className="fab-hub-overlay" onClick={() => setOpen(false)} />
          <div
            className={`notif-dropdown${pos.center ? ' notif-dropdown-center' : ''}`}
            style={pos.center ? { top: pos.top } : { top: pos.top, left: pos.left }}
          >
            <div className="notif-dropdown-head">การแจ้งเตือน{total > 0 ? ` (${total})` : ''}</div>
            {total === 0 ? (
              <div className="notif-dropdown-empty">ไม่มีแจ้งเตือนใหม่</div>
            ) : (
              <>
                {newOrders.map((o) => (
                  <div key={o.id} className="notif-dropdown-item" onClick={() => goTo(`/admin/shop/orders/${o.id}`)}>
                    <div className="notif-dropdown-item-top">
                      <span className="notif-dropdown-item-name">📦 {o.orderCode}</span>
                      <span className="notif-dropdown-item-time">{notifTimeLabel(o.createdAt)}</span>
                    </div>
                    <div className="notif-dropdown-item-text">
                      {o.customer?.fullName || [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ')} · {notifTHB(o.total)}
                    </div>
                  </div>
                ))}
                {unreadChats.map((c) => (
                  <div key={c.id} className="notif-dropdown-item" onClick={() => goTo(`/admin/chat/${encodeURIComponent(c.id)}`)}>
                    <div className="notif-dropdown-item-top">
                      <span className="notif-dropdown-item-name">💬 {c.visitorName || `ผู้เยี่ยมชม ${c.id.slice(0, 6)}`}</span>
                      <span className="notif-dropdown-item-time">{notifTimeLabel(c.lastMessageAt)}</span>
                    </div>
                    <div className="notif-dropdown-item-text">{c.lastMessageText}</div>
                  </div>
                ))}
              </>
            )}
            <a className="notif-dropdown-all" href="/admin/shop/orders" onClick={() => setOpen(false)}>ดูคำสั่งซื้อทั้งหมด →</a>
          </div>
        </>,
        document.body
      )}
    </>
  )
}

function isGroupActive(group, path) {
  if (group.href) return path === group.href
  return group.children?.some((c) => path === c.href)
}

function NavGroup({ g, path, onNavigate, badges }) {
  const active = isGroupActive(g, path)
  const [expanded, setExpanded] = useState(active)

  if (g.href) {
    return (
      <a href={g.href} className={`an-item${path === g.href ? ' active' : ''}`} onClick={onNavigate}>
        <span><FontAwesomeIcon icon={g.icon} /> {g.label}</span>
        {badges?.[g.href] > 0 && <span className="an-badge">{badges[g.href]}</span>}
      </a>
    )
  }

  // ยอดรวม badge ของลูกทั้งหมด — โชว์ที่หัวกลุ่มด้วย เผื่อกลุ่มยังปิดอยู่ (เช่น "คำสั่งซื้อ" มีออเดอร์ใหม่แต่ "Um Shop" ยังไม่ได้กางเมนู)
  const groupBadgeTotal = g.children?.reduce((s, c) => s + (badges?.[c.href] || 0), 0) || 0

  return (
    <div className={`an-group${active ? ' an-group-active' : ''}`}>
      <button className="an-group-btn" onClick={() => setExpanded((v) => !v)}>
        <span><FontAwesomeIcon icon={g.icon} /> {g.label}</span>
        {groupBadgeTotal > 0 && <span className="an-badge">{groupBadgeTotal}</span>}
        <FontAwesomeIcon icon={faChevronDown} className={`an-chevron${expanded ? ' open' : ''}`} />
      </button>
      {expanded && (
        <div className="an-group-children">
          {g.children.map((c) => (
            <a key={c.href} href={c.href} className={`an-child${path === c.href ? ' active' : ''}`} onClick={onNavigate}>
              <span>{c.icon && <FontAwesomeIcon icon={c.icon} style={{ marginRight: 5, fontSize: '.8em', opacity: .7 }} />}{c.label}</span>
              {badges?.[c.href] > 0 && <span className="an-badge">{badges[c.href]}</span>}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function DevButton() {
  const [maintenance, setMaintenance] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'config', 'site'))
      .then((snap) => setMaintenance(snap.exists() ? !!snap.data().maintenance : false))
      .catch(() => setMaintenance(false))
  }, [])

  const toggle = async () => {
    setSaving(true)
    const next = !maintenance
    await setDoc(doc(db, 'config', 'site'), { maintenance: next }, { merge: true })
    setMaintenance(next)
    setSaving(false)
  }

  if (maintenance === null) return null
  return (
    <button
      onClick={toggle}
      disabled={saving}
      style={{
        margin: '4px 0',
        padding: '8px 14px',
        borderRadius: 8,
        border: 'none',
        cursor: saving ? 'not-allowed' : 'pointer',
        fontWeight: 700,
        fontSize: '.85rem',
        background: maintenance ? '#fbbf24' : '#374151',
        color: maintenance ? '#1f2937' : '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      🛠 {saving ? '...' : maintenance ? 'ปิด Maintenance' : 'เปิด Maintenance'}
    </button>
  )
}

export default function AdminNav() {
  useSunGradient() // ไล่สีพื้นหลัง .admin-dash ตามเวลา/ตำแหน่งดวงอาทิตย์ (กรุงเทพฯ)
  const path = window.location.pathname
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  // ปิด/เปิด sidebar บนเดสก์ท็อป (จำค่าไว้ใน localStorage) — บนมือถือใช้ drawer เดิม ไม่เกี่ยวกัน
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('adminNavCollapsed') === '1')
  useEffect(() => {
    document.documentElement.classList.toggle('admin-nav-collapsed', collapsed)
    localStorage.setItem('adminNavCollapsed', collapsed ? '1' : '0')
    return () => document.documentElement.classList.remove('admin-nav-collapsed')
  }, [collapsed])

  // ล็อคการเลื่อนพื้นหลังขณะเปิด drawer + ปิดด้วยปุ่ม Esc
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open])

  const email = auth.currentUser?.email || ''
  const isVolunteer = isVolunteerEmail(email)
  const groups = isVolunteer ? VOLUNTEER_NAV : NAV_GROUPS
  const newOrders = useNewOrdersCount(!isVolunteer)
  const badges = newOrders > 0 ? { '/admin/shop/orders': newOrders } : null

  // ระบบ staff role ใหม่ (CRM/บอร์ด/audit log) — ซ่อนกลุ่มเมนูที่บัญชีปัจจุบันไม่มีสิทธิ์เข้าถึง
  // แค่ระดับ UI เท่านั้น ของจริงบังคับที่ firestore.rules (isStaffRole) เสมอ
  const { staff } = useStaffRole(auth.currentUser)
  const visibleStaffGroups = STAFF_NAV_GROUPS.filter((g) => !g.requireRoles || hasStaffRole(staff, g.requireRoles))

  const navContent = (
    <>
      {groups.map((g, i) => <NavGroup key={i} g={g} path={path} onNavigate={close} badges={badges} />)}
      {visibleStaffGroups.length > 0 && (
        <div className="admin-nav-section-divider" />
      )}
      {visibleStaffGroups.map((g, i) => <NavGroup key={`staff-${i}`} g={g} path={path} onNavigate={close} badges={null} />)}
      <InstallAdminApp />
      {email && (
        <span className="admin-nav-user">{email}</span>
      )}
      {email === 'akasitlove@gmail.com' && <DevButton />}
      <button className="admin-nav-logout" onClick={() => signOut(auth)}>ออกจากระบบ</button>
    </>
  )

  return (
    <>
      <nav className="admin-nav">
        <div className="admin-nav-brand">
          <span><FontAwesomeIcon icon={faScrewdriverWrench} /> {isVolunteer ? 'Volunteer' : 'Admin'}</span>
          {!isVolunteer && <AdminGlobalSearch />}
          <NotifBell canSeeOrders={!isVolunteer} />
          <button
            type="button"
            className="admin-nav-collapse-btn"
            onClick={() => setCollapsed(true)}
            aria-label="ปิด sidebar"
            title="ปิด sidebar"
          >
            <FontAwesomeIcon icon={faAnglesLeft} />
          </button>
        </div>
        <div className="admin-nav-links">{navContent}</div>
        <button className="admin-nav-toggle" onClick={() => setOpen(true)} aria-label="เปิดเมนู">
          <FontAwesomeIcon icon={faBars} />
        </button>
      </nav>

      {/* ปุ่มลอยเปิด sidebar กลับ — โชว์เฉพาะเดสก์ท็อปตอน sidebar ถูกปิด */}
      <button
        type="button"
        className="admin-nav-reopen-btn"
        onClick={() => setCollapsed(false)}
        aria-label="เปิด sidebar"
        title="เปิด sidebar"
      >
        <FontAwesomeIcon icon={faAnglesRight} />
      </button>

      <AdminChatFab />

      <div
        className={`admin-drawer-backdrop ${open ? 'show' : ''}`}
        onClick={close}
        aria-hidden="true"
      />
      <div className={`admin-drawer ${open ? 'show' : ''}`} role="dialog" aria-modal="true">
        <button className="drawer-close" onClick={close} aria-label="ปิดเมนู">
          <FontAwesomeIcon icon={faXmark} />
        </button>
        {navContent}
      </div>
    </>
  )
}
