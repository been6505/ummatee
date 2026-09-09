// แผนผังระบบแอดมิน — ผังเดียวที่บอกว่าระบบนี้มีอะไรบ้างและแต่ละส่วนต่อกันยังไง
//
// ทำไมต้องมี: ตอนนี้มีหน้าแอดมิน 35 หน้ากระจายอยู่ในเมนูหลายชั้น คนเข้าใหม่ (หรือคนที่ไม่ได้เข้ามานาน)
// ไม่มีทางรู้เลยว่ามีอะไรให้ใช้บ้าง ต้องกางเมนูไล่ทีละกลุ่ม
//
// ไฟล์นี้ไม่แตะ firebase — เป็นแค่ผังโครงสร้าง เทสต์ได้ตรงๆ
// ⚠️ href ทุกตัวต้องมีอยู่จริงใน PATH_TO_PAGE ของ App.jsx — มีเทสต์เช็คไว้แล้ว
//    (ผังที่ชี้ไปหน้าที่ไม่มีอยู่ แย่กว่าไม่มีผังเลย เพราะคนจะเชื่อว่ามีฟีเจอร์นั้น)

// ชั้นบนสุด — สิ่งที่ทุกอย่างวางอยู่บน ไม่ใช่หน้าที่กดเข้าไปทำงาน
export const CORE = [
  { key: 'team', label: 'ทีมงาน + สิทธิ์', desc: 'ใครเข้าถึงอะไรได้', href: '/admin/staff' },
  { key: 'assign', label: 'มอบหมายงาน', desc: 'ผู้รับผิดชอบต่อชิ้นงาน', href: '/admin/my-work' },
  { key: 'comment', label: 'คุยงานในที่เดียว', desc: 'คอมเมนต์ติดกับงาน', href: '/admin/board' },
  { key: 'audit', label: 'ร่องรอยการแก้ไข', desc: 'ใครเปลี่ยนอะไรเมื่อไหร่', href: '/admin/audit-log' },
]

// กลุ่มงานจริง — จัดตาม "งานที่ทำ" ไม่ใช่ตามชื่อ collection
export const GROUPS = [
  {
    key: 'plan',
    label: 'วางแผน',
    tone: 'plan',
    items: [
      { label: 'ปฏิทินคอนเทนต์', href: '/admin/calendar', desc: 'เดือน/สัปดาห์ + แม่แบบโพสต์' },
      { label: 'คลัง HOOK', href: '/admin/hooks', desc: 'ประโยคเปิดที่ใช้ได้ผล' },
      { label: 'ตารางไลฟ์สด', href: '/admin/live', desc: 'ไลฟ์ที่กำลังจะถึง' },
      { label: 'บอร์ดวางแผน', href: '/admin/board', desc: 'คัมบัง + มายด์แมป' },
      { label: 'งานของฉัน', href: '/admin/my-work', desc: 'งานที่มอบหมายให้เรา' },
    ],
  },
  {
    key: 'reach',
    label: 'สื่อสาร',
    tone: 'reach',
    items: [
      { label: 'จัดการเว็บ', href: '/admin/website', desc: 'เนื้อหาหน้าเว็บ public' },
      { label: 'แชท', href: '/admin/chat', desc: 'ข้อความจากผู้เยี่ยมชม' },
      { label: 'Email Broadcast', href: '/admin/dashboard/broadcast', desc: 'ส่งอีเมลถึงผู้ติดตาม' },
      { label: 'ประชุมวิดีโอ', href: '/admin/video-call', desc: 'ห้องประชุม + สตูดิโอไลฟ์' },
    ],
  },
  {
    key: 'network',
    label: 'เครือข่าย',
    tone: 'network',
    items: [
      { label: 'แคมเปญบริจาค', href: '/admin/campaigns', desc: 'ภาพรวมต่อแคมเปญ' },
      { label: 'องค์กรพันธมิตร', href: '/admin/partners', desc: 'ผู้ร่วมงาน' },
      { label: 'จุดลงพื้นที่', href: '/admin/aid-map', desc: 'แผนที่ความช่วยเหลือ' },
      { label: 'ร้านค้า B2UM', href: '/admin/b2um', desc: 'ร้านที่เข้าร่วมโครงการ' },
      { label: 'วิทยากร', href: '/admin/speakers', desc: 'วิทยากร/อินฟลูเอนเซอร์' },
      { label: 'อาสาสมัคร', href: '/admin/volunteer', desc: 'ผู้สมัครเป็นอาสา' },
    ],
  },
  {
    key: 'money',
    label: 'รายรับ',
    tone: 'money',
    items: [
      { label: 'um-shop — คำสั่งซื้อ', href: '/admin/shop/orders', desc: 'ออเดอร์ที่เข้ามา' },
      { label: 'um-shop — สินค้า', href: '/admin/shop', desc: 'จัดการสินค้า/สต็อก' },
      { label: 'รายงานยอดขาย', href: '/admin/shop/sales', desc: 'ยอดขายย้อนหลัง' },
      { label: 'รีวิว & แจ้งปัญหา', href: '/admin/shop/feedback', desc: 'ตรวจรีวิว/รับเรื่องลูกค้า' },
      { label: 'บันทึกเงินบริจาค', href: '/admin/donations', desc: 'รายการบริจาค' },
      { label: 'แดชบอร์ดการเงิน', href: '/admin/financial-dashboard', desc: 'ภาพรวมรายรับ' },
    ],
  },
]

// ปลายทาง — ที่ที่ผลของงานทั้งหมดไปโผล่
export const OUTPUT = [
  { label: 'เว็บไซต์สาธารณะ', href: '/', desc: 'หน้าแรก ummatee.org' },
  { label: 'um-shop', href: '/um-shop', desc: 'ร้านค้าออนไลน์' },
  { label: 'แดชบอร์ด Staff', href: '/admin/staff-dashboard', desc: 'สรุปงานของทีม' },
]

// ทุก href ในผัง (ใช้ในเทสต์ตรวจว่าไม่มีลิงก์ตาย)
export const allSystemMapHrefs = () => [
  ...CORE.map((c) => c.href),
  ...GROUPS.flatMap((g) => g.items.map((i) => i.href)),
  ...OUTPUT.map((o) => o.href),
]
