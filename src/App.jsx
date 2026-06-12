import { useEffect, useState } from 'react'
import { NavCtx } from './navContext'
import { LangProvider } from './i18n.jsx'
import Nav from './components/Nav.jsx'
import Home from './pages/Home.jsx'
import Donation from './pages/Donation.jsx'
import IftarForGaza from './pages/IftarForGaza.jsx'
import GiveForUm from './pages/GiveForUm.jsx'
import Qurban2026 from './pages/Qurban2026.jsx'
import AdminIftarDashboard from './pages/AdminIftarDashboard.jsx'
import AdminQurbanDashboard from './pages/AdminQurbanDashboard.jsx'
import AdminHome from './pages/AdminHome.jsx'

// แมประหว่าง URL path กับชื่อหน้า
const PATH_TO_PAGE = { '/': 'home', '/home': 'home', '/donation': 'donation', '/event': 'iftar', '/event/iftar-for-gaza': 'iftar', '/event/give-for-um': 'give', '/missions/qurban2026': 'qurban', '/missions/quban2026': 'qurban', '/admin/dashboard/event/iftar-for-gaza': 'admin-iftar', '/admin/missions/qurban2026': 'admin-qurban', '/admin/dashboard': 'admin-home' }
const PAGE_TO_PATH = { home: '/home', donation: '/donation', iftar: '/event/iftar-for-gaza', give: '/event/give-for-um', qurban: '/missions/qurban2026' }

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

  if (page === 'admin-iftar') return <AdminIftarDashboard />
  if (page === 'admin-qurban') return <AdminQurbanDashboard />
  if (page === 'admin-home') return <AdminHome />

  return (
    <LangProvider>
      <NavCtx.Provider value={go}>
        <Nav scrolled={scrolled} />
        {page === 'home' && <Home />}
        {page === 'donation' && <Donation />}
        {page === 'iftar' && <IftarForGaza />}
        {page === 'give' && <GiveForUm />}
        {page === 'qurban' && <Qurban2026 />}
      </NavCtx.Provider>
    </LangProvider>
  )
}
