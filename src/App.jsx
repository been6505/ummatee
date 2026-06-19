import { lazy, Suspense, useEffect, useState } from 'react'
import { NavCtx } from './navContext'
import { LangProvider } from './i18n.jsx'
import Nav from './components/Nav.jsx'
import Home from './pages/Home.jsx'
import ErrorBoundary, { isChunkLoadError } from './components/ErrorBoundary.jsx'

// โหลด chunk แบบ lazy พร้อมกู้คืนอัตโนมัติ: ถ้า chunk โหลดไม่ได้ (มักเกิดหลัง deploy เพราะ
// hash เปลี่ยนแต่เบราว์เซอร์ยังถือ index.html เก่า) ให้ reload 1 ครั้งเพื่อดึงไฟล์ชุดใหม่
const lazyWithReload = (factory) =>
  lazy(() =>
    factory()
      .then((mod) => { sessionStorage.removeItem('chunkReload'); return mod })
      .catch((err) => {
        if (isChunkLoadError(err) && !sessionStorage.getItem('chunkReload')) {
          sessionStorage.setItem('chunkReload', '1')
          window.location.reload()
          return new Promise(() => {}) // ค้างไว้ระหว่างกำลัง reload
        }
        throw err
      })
  )

// โหลดเฉพาะหน้าที่ผู้ใช้เปิดจริง (code-splitting) — ลดขนาด JS ตอนโหลดครั้งแรก
const Donation = lazyWithReload(() => import('./pages/Donation.jsx'))
const IftarForGaza = lazyWithReload(() => import('./pages/IftarForGaza.jsx'))
const GiveForUm = lazyWithReload(() => import('./pages/GiveForUm.jsx'))
const Qurban2026 = lazyWithReload(() => import('./pages/Qurban2026.jsx'))
const AdminIftarDashboard = lazyWithReload(() => import('./pages/AdminIftarDashboard.jsx'))
const AdminQurbanDashboard = lazyWithReload(() => import('./pages/AdminQurbanDashboard.jsx'))
const AdminQurbanEdit = lazyWithReload(() => import('./pages/AdminQurbanEdit.jsx'))
const AdminDonations = lazyWithReload(() => import('./pages/AdminDonations.jsx'))
const AdminCalendar = lazyWithReload(() => import('./pages/AdminCalendar.jsx'))
const AdminHome = lazyWithReload(() => import('./pages/AdminHome.jsx'))
const Shop = lazyWithReload(() => import('./pages/Shop.jsx'))
const AdminShop = lazyWithReload(() => import('./pages/AdminShop.jsx'))
const FinancialDashboard = lazyWithReload(() => import('./pages/FinancialDashboard.jsx'))
const AdminFinancialDashboard = lazyWithReload(() => import('./pages/AdminFinancialDashboard.jsx'))
const AdminRegisterEvent = lazyWithReload(() => import('./pages/AdminRegisterEvent.jsx'))
const VolunteerRegister = lazyWithReload(() => import('./pages/VolunteerRegister.jsx'))
const AdminVolunteer = lazyWithReload(() => import('./pages/AdminVolunteer.jsx'))
const Give2 = lazyWithReload(() => import('./pages/Give2.jsx'))
const AdminGive = lazyWithReload(() => import('./pages/AdminGive.jsx'))

// แมประหว่าง URL path กับชื่อหน้า
const PATH_TO_PAGE = { '/': 'home', '/home': 'home', '/donation': 'donation', '/event': 'iftar', '/event/iftar-for-gaza': 'iftar', '/event/give-for-um': 'give', '/event/give-for-um/give2': 'give2', '/missions/qurban2026': 'qurban', '/missions/quban2026': 'qurban', '/admin/event/iftar2026': 'admin-iftar', '/admin/missions/qurban2026': 'admin-qurban', '/admin/missions/qurban2026/edit': 'admin-qurban-edit', '/admin/donations': 'admin-donations', '/admin/calendar': 'admin-calendar', '/admin/dashboard': 'admin-home', '/um-shop': 'shop', '/admin/shop': 'admin-shop', '/challenge': 'challenge', '/admin/financial-dashboard': 'admin-financial', '/admin/register-event': 'admin-register-event', '/volunteer/register': 'volunteer', '/admin/volunteer': 'admin-volunteer', '/admin/give': 'admin-give' }
const PAGE_TO_PATH = { home: '/home', donation: '/donation', iftar: '/event/iftar-for-gaza', give: '/event/give-for-um', qurban: '/missions/qurban2026', shop: '/um-shop' }

// อ่าน path ปัจจุบันจาก URL แล้วแปลงเป็นชื่อหน้า (ถ้าไม่รู้จักให้ไปหน้า home)
const pageFromPath = () => PATH_TO_PAGE[window.location.pathname] || 'home'

export default function App() {
  const [page, setPage] = useState(pageFromPath)
  const [scrolled, setScrolled] = useState(false)

  // เปลี่ยนหน้า + อัปเดต URL + เลื่อนขึ้นบนสุด
  const go = (name) => {
    setPage(name)
    const path = PAGE_TO_PATH[name] || '/'
    if (window.location.pathname !== path) window.history.pushState({}, '', path)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  // รองรับปุ่ม back/forward ของเบราว์เซอร์
  useEffect(() => {
    const onPop = () => {
      setPage(pageFromPath())
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // nav จะโปร่งใสเฉพาะตอนอยู่หน้าแรกและยังไม่ scroll
  useEffect(() => {
    const onScroll = () => setScrolled(!(page === 'home' && window.scrollY < 40))
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [page])

  // หน้าที่เรนเดอร์แยกเดี่ยว ๆ ไม่มี Nav/Footer ของเว็บหลัก (admin + แดชบอร์ดการเงินสำหรับขึ้นจอ)
  const STANDALONE = {
    'admin-iftar': AdminIftarDashboard,
    'admin-qurban': AdminQurbanDashboard,
    'admin-qurban-edit': AdminQurbanEdit,
    'admin-donations': AdminDonations,
    'admin-calendar': AdminCalendar,
    'admin-home': AdminHome,
    'admin-shop': AdminShop,
    'challenge': FinancialDashboard,
    'admin-financial': AdminFinancialDashboard,
    'admin-register-event': AdminRegisterEvent,
    'admin-volunteer': AdminVolunteer,
    'give2': Give2,
    'admin-give': AdminGive,
  }
  const Standalone = STANDALONE[page]
  if (Standalone) {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}><Standalone /></Suspense>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <LangProvider>
        <NavCtx.Provider value={go}>
          <Nav scrolled={scrolled} />
          <Suspense fallback={null}>
            {page === 'home' && <Home />}
            {page === 'donation' && <Donation />}
            {page === 'iftar' && <IftarForGaza />}
            {page === 'give' && <GiveForUm />}
            {page === 'qurban' && <Qurban2026 />}
            {page === 'shop' && <Shop />}
            {page === 'volunteer' && <VolunteerRegister />}
          </Suspense>
        </NavCtx.Provider>
      </LangProvider>
    </ErrorBoundary>
  )
}
