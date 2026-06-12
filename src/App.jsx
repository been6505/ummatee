import { lazy, Suspense, useEffect, useState } from 'react'
import { NavCtx } from './navContext'
import { LangProvider } from './i18n.jsx'
import Nav from './components/Nav.jsx'
import Home from './pages/Home.jsx'

// โหลดเฉพาะหน้าที่ผู้ใช้เปิดจริง (code-splitting) — ลดขนาด JS ตอนโหลดครั้งแรก
const Donation = lazy(() => import('./pages/Donation.jsx'))
const IftarForGaza = lazy(() => import('./pages/IftarForGaza.jsx'))
const GiveForUm = lazy(() => import('./pages/GiveForUm.jsx'))
const Qurban2026 = lazy(() => import('./pages/Qurban2026.jsx'))
const AdminIftarDashboard = lazy(() => import('./pages/AdminIftarDashboard.jsx'))
const AdminQurbanDashboard = lazy(() => import('./pages/AdminQurbanDashboard.jsx'))
const AdminQurbanEdit = lazy(() => import('./pages/AdminQurbanEdit.jsx'))
const AdminHome = lazy(() => import('./pages/AdminHome.jsx'))

// แมประหว่าง URL path กับชื่อหน้า
const PATH_TO_PAGE = { '/': 'home', '/home': 'home', '/donation': 'donation', '/event': 'iftar', '/event/iftar-for-gaza': 'iftar', '/event/give-for-um': 'give', '/missions/qurban2026': 'qurban', '/missions/quban2026': 'qurban', '/admin/event/iftar2026': 'admin-iftar', '/admin/missions/qurban2026': 'admin-qurban', '/admin/missions/qurban2026/edit': 'admin-qurban-edit', '/admin/dashboard': 'admin-home' }
const PAGE_TO_PATH = { home: '/home', donation: '/donation', iftar: '/event/iftar-for-gaza', give: '/event/give-for-um', qurban: '/missions/qurban2026' }

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

  // หน้า admin เรนเดอร์แยกเดี่ยว ๆ ไม่มี Nav/Footer ของเว็บหลัก
  if (page === 'admin-iftar') return <Suspense fallback={null}><AdminIftarDashboard /></Suspense>
  if (page === 'admin-qurban') return <Suspense fallback={null}><AdminQurbanDashboard /></Suspense>
  if (page === 'admin-qurban-edit') return <Suspense fallback={null}><AdminQurbanEdit /></Suspense>
  if (page === 'admin-home') return <Suspense fallback={null}><AdminHome /></Suspense>

  return (
    <LangProvider>
      <NavCtx.Provider value={go}>
        <Nav scrolled={scrolled} />
        <Suspense fallback={null}>
          {page === 'home' && <Home />}
          {page === 'donation' && <Donation />}
          {page === 'iftar' && <IftarForGaza />}
          {page === 'give' && <GiveForUm />}
          {page === 'qurban' && <Qurban2026 />}
        </Suspense>
      </NavCtx.Provider>
    </LangProvider>
  )
}
