import { useEffect, useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase.js'
import { db } from '../firebase.js'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHouse, faFlag, faMoneyBill, faCalendar, faBagShopping, faHandshake, faBars, faXmark, faScrewdriverWrench, faEarthAsia, faChevronDown, faBullhorn, faAnglesLeft, faAnglesRight, faGlobe, faLayerGroup } from '@fortawesome/free-solid-svg-icons'

import { isVolunteerEmail } from '../useAdminRole.js'
import InstallAdminApp from './InstallAdminApp.jsx'

const NAV_GROUPS = [
  { label: 'หน้าหลัก', icon: faHouse, href: '/admin/dashboard' },
  { label: 'จัดการเว็บ', icon: faGlobe, href: '/admin/website' },
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
  { label: 'ใส่กรอบรูป', icon: faLayerGroup, href: '/admin/photo-frame' },
  {
    label: 'เงินบริจาค', icon: faMoneyBill, children: [
      { href: '/admin/donations', label: 'บันทึกเงินบริจาค' },
      { href: '/admin/financial-dashboard', label: 'แดชบอร์ดการเงิน' },
    ]
  },
  { label: 'อาสาสมัคร', icon: faHandshake, href: '/admin/volunteer' },
  { label: 'Email Broadcast', icon: faBullhorn, href: '/admin/dashboard/broadcast' },
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

function isGroupActive(group, path) {
  if (group.href) return path === group.href
  return group.children?.some((c) => path === c.href)
}

function NavGroup({ g, path, onNavigate }) {
  const active = isGroupActive(g, path)
  const [expanded, setExpanded] = useState(active)

  if (g.href) {
    return (
      <a href={g.href} className={`an-item${path === g.href ? ' active' : ''}`} onClick={onNavigate}>
        <FontAwesomeIcon icon={g.icon} /> {g.label}
      </a>
    )
  }

  return (
    <div className={`an-group${active ? ' an-group-active' : ''}`}>
      <button className="an-group-btn" onClick={() => setExpanded((v) => !v)}>
        <FontAwesomeIcon icon={g.icon} /> {g.label}
        <FontAwesomeIcon icon={faChevronDown} className={`an-chevron${expanded ? ' open' : ''}`} />
      </button>
      {expanded && (
        <div className="an-group-children">
          {g.children.map((c) => (
            <a key={c.href} href={c.href} className={`an-child${path === c.href ? ' active' : ''}`} onClick={onNavigate}>
              {c.icon && <FontAwesomeIcon icon={c.icon} style={{ marginRight: 5, fontSize: '.8em', opacity: .7 }} />}{c.label}
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

  const navContent = (
    <>
      {groups.map((g, i) => <NavGroup key={i} g={g} path={path} onNavigate={close} />)}
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
