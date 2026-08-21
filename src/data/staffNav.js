import {
  faTableColumns, faCalendar, faGlobe, faUsers, faMapLocationDot, faMicrophone,
  faBullseye, faFlag, faVideo, faClockRotateLeft, faListCheck, faTowerBroadcast,
  faDiagramProject, faBolt, faNewspaper,
} from '@fortawesome/free-solid-svg-icons'
import { hasStaffRole } from '../useStaffRole.js'

// เมนูฝั่ง staff (ระบบ staff/{uid} role) — แหล่งเดียวที่ใช้ร่วมกันระหว่างแถบเมนูซ้าย (AdminNav)
// และการ์ดทางลัดในหน้าแดชบอร์ด Staff (AdminDashboard2) เพิ่มเมนูใหม่ที่นี่ที่เดียวแล้วขึ้นทั้งสองที่
//
// จัดกลุ่มตาม "งานที่กำลังจะทำ" ไม่ใช่ตามชนิดข้อมูล — คนเปิดเมนูมาเพราะจะทำอะไรสักอย่าง
// ไม่ได้มาเพราะอยากดูว่ามี collection อะไรบ้าง (โครงเดียวกับที่ใช้ในหน้าแผนผังระบบ)
//
// requireRoles: ต้องมี staff doc ที่ active และ role อยู่ในลิสต์
// superOnly:    เฉพาะแอดมินสูงสุดบัญชีเดียว ไม่ผูกกับ staff role (ให้สิทธิ์คนอื่น + ดูร่องรอยของทุกคน)
const CONTENT_ROLES = ['admin', 'staff', 'social']
const FIELD_ROLES = ['admin', 'staff', 'field']
const ALL_ROLES = ['admin', 'staff', 'social', 'field']

export const STAFF_NAV_GROUPS = [
  { label: 'แผนผังระบบ', icon: faDiagramProject, href: '/admin/system-map', requireRoles: ALL_ROLES },
  { label: 'งานของฉัน', icon: faListCheck, href: '/admin/my-work', requireRoles: ALL_ROLES },
  { label: 'แดชบอร์ด Staff', icon: faTableColumns, href: '/admin/staff-dashboard', requireRoles: ALL_ROLES },
  {
    label: 'ทำคอนเทนต์', icon: faCalendar, requireRoles: CONTENT_ROLES, children: [
      { href: '/admin/calendar', label: 'ปฏิทินคอนเทนต์', icon: faCalendar },
      { href: '/admin/hooks', label: 'คลัง HOOK', icon: faBolt },
      { href: '/admin/live', label: 'ตารางไลฟ์สด', icon: faTowerBroadcast },
      { href: '/admin/website', label: 'จัดการเว็บ', icon: faGlobe },
    ]
  },
  // ข่าวความคืบหน้า: ALL_ROLES เพราะ 'field' คือคนลงพื้นที่จริง = คนที่มีเรื่องมารายงานที่สุด
  // (สิทธิ์ของ publicUpdates ใน firestore.rules ตั้งไว้ให้ตรงกับลิสต์นี้)
  { label: 'ข่าวความคืบหน้า', icon: faNewspaper, href: '/admin/updates', requireRoles: ALL_ROLES },
  {
    label: 'วางแผนงาน', icon: faTableColumns, requireRoles: FIELD_ROLES, children: [
      { href: '/admin/board', label: 'บอร์ดวางแผน', icon: faTableColumns },
      { href: '/admin/campaigns', label: 'แคมเปญบริจาค', icon: faBullseye },
      { href: '/admin/events', label: 'งาน/อีเวนต์', icon: faFlag },
    ]
  },
  {
    label: 'เครือข่าย', icon: faUsers, requireRoles: FIELD_ROLES, children: [
      { href: '/admin/partners', label: 'องค์กรพันธมิตร', icon: faUsers },
      { href: '/admin/aid-map', label: 'แผนที่จุดลงพื้นที่', icon: faMapLocationDot },
      { href: '/admin/speakers', label: 'วิทยากร/อินฟลูเอนเซอร์', icon: faMicrophone },
    ]
  },
  { label: 'ประชุมวิดีโอ', icon: faVideo, href: '/admin/video-call', requireRoles: ALL_ROLES },
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

// แผ่กลุ่มที่มีเมนูย่อยออกเป็นรายการเดี่ยว — การ์ดทางลัดในแดชบอร์ดต้องกดไปหน้าจริงได้ทันที
// ต่างจากเมนูซ้ายที่กดแล้วกางเป็นลิสต์ย่อยก่อน
export function flattenStaffNav(groups) {
  return groups.flatMap((g) => (
    g.children
      ? g.children.map((c) => ({ ...c, icon: c.icon || g.icon, group: g.label }))
      : [g]
  ))
}
