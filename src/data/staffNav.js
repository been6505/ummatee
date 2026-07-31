import {
  faTableColumns, faCalendar, faGlobe, faUsers, faMapLocationDot, faMicrophone,
  faBullseye, faFlag, faVideo, faClockRotateLeft, faListCheck, faTowerBroadcast,
} from '@fortawesome/free-solid-svg-icons'
import { hasStaffRole } from '../useStaffRole.js'

// เมนูฝั่ง staff (ระบบ staff/{uid} role) — แหล่งเดียวที่ใช้ร่วมกันระหว่างแถบเมนูซ้าย (AdminNav)
// และการ์ดทางลัดในหน้าแดชบอร์ด Staff (AdminDashboard2) เพิ่มเมนูใหม่ที่นี่ที่เดียวแล้วขึ้นทั้งสองที่
//
// requireRoles: ต้องมี staff doc ที่ active และ role อยู่ในลิสต์
// superOnly:    เฉพาะแอดมินสูงสุดบัญชีเดียว ไม่ผูกกับ staff role (ให้สิทธิ์คนอื่น + ดูร่องรอยของทุกคน)
export const STAFF_NAV_GROUPS = [
  { label: 'แดชบอร์ด Staff', icon: faTableColumns, href: '/admin/staff-dashboard', requireRoles: ['admin', 'staff', 'social', 'field'] },
  { label: 'งานของฉัน', icon: faListCheck, href: '/admin/my-work', requireRoles: ['admin', 'staff', 'social', 'field'] },
  { label: 'ปฏิทินคอนเทนต์', icon: faCalendar, href: '/admin/calendar', requireRoles: ['admin', 'staff', 'social'] },
  { label: 'ตารางไลฟ์สด', icon: faTowerBroadcast, href: '/admin/live', requireRoles: ['admin', 'staff', 'social'] },
  { label: 'จัดการเว็บ', icon: faGlobe, href: '/admin/website', requireRoles: ['admin', 'staff', 'social'] },
  {
    label: 'CRM', icon: faUsers, requireRoles: ['admin', 'staff', 'field'], children: [
      { href: '/admin/partners', label: 'องค์กรพันธมิตร', icon: faUsers },
      { href: '/admin/aid-map', label: 'แผนที่จุดลงพื้นที่', icon: faMapLocationDot },
      { href: '/admin/speakers', label: 'วิทยากร/อินฟลูเอนเซอร์', icon: faMicrophone },
    ]
  },
  { label: 'แคมเปญบริจาค', icon: faBullseye, href: '/admin/campaigns', requireRoles: ['admin', 'staff', 'field'] },
  { label: 'งาน/อีเวนต์', icon: faFlag, href: '/admin/events', requireRoles: ['admin', 'staff', 'field'] },
  { label: 'บอร์ดวางแผน', icon: faTableColumns, href: '/admin/board', requireRoles: ['admin', 'staff', 'field'] },
  { label: 'ประชุมวิดีโอ', icon: faVideo, href: '/admin/video-call', requireRoles: ['admin', 'staff', 'field', 'social'] },
  { label: 'ประวัติการเปลี่ยนแปลง', icon: faClockRotateLeft, href: '/admin/audit-log', superOnly: true },
  { label: 'จัดการ Staff', icon: faUsers, href: '/admin/staff', superOnly: true },
]

// กรองตามสิทธิ์ — ตรรกะเดียวกันทั้งเมนูซ้ายและการ์ดในแดชบอร์ด
// isOwner = เจ้าของระบบ (break-glass): เห็นทุกเมนูแม้ยังไม่มีใครถูกตั้ง role 'admin' เลย
export function visibleStaffNav(staff, { isOwner = false, isSuper = false } = {}) {
  return STAFF_NAV_GROUPS.filter((g) => (
    g.superOnly ? isSuper : (isOwner || !g.requireRoles || hasStaffRole(staff, g.requireRoles))
  ))
}

// แผ่กลุ่มที่มีเมนูย่อย (เช่น CRM) ออกเป็นรายการเดี่ยว — การ์ดทางลัดในแดชบอร์ดต้องกดไปหน้าจริงได้ทันที
// ต่างจากเมนูซ้ายที่กดแล้วกางเป็นลิสต์ย่อยก่อน
export function flattenStaffNav(groups) {
  return groups.flatMap((g) => (
    g.children
      ? g.children.map((c) => ({ ...c, icon: c.icon || g.icon, group: g.label }))
      : [g]
  ))
}
