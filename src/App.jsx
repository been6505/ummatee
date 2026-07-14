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
const AdminWebsite = lazyWithReload(() => import('./pages/AdminWebsite.jsx'))
const Shop = lazyWithReload(() => import('./pages/Shop.jsx'))
const ShopProductDetail = lazyWithReload(() => import('./pages/ShopProductDetail.jsx'))
const ShopCart = lazyWithReload(() => import('./pages/ShopCart.jsx'))
const ShopCheckout = lazyWithReload(() => import('./pages/ShopCheckout.jsx'))
const ShopOrderStatus = lazyWithReload(() => import('./pages/ShopOrderStatus.jsx'))
const ShopMyOrders = lazyWithReload(() => import('./pages/ShopMyOrders.jsx'))
const AdminShop = lazyWithReload(() => import('./pages/AdminShop.jsx'))
const AdminShopOrders = lazyWithReload(() => import('./pages/AdminShopOrders.jsx'))
const AdminShopOrderDetail = lazyWithReload(() => import('./pages/AdminShopOrderDetail.jsx'))
const AdminInventory = lazyWithReload(() => import('./pages/AdminInventory.jsx'))
const AdminShopSales = lazyWithReload(() => import('./pages/AdminShopSales.jsx'))
const FinancialDashboard = lazyWithReload(() => import('./pages/FinancialDashboard.jsx'))
const AdminFinancialDashboard = lazyWithReload(() => import('./pages/AdminFinancialDashboard.jsx'))
const AdminQRcode = lazyWithReload(() => import('./pages/AdminQRcode.jsx'))
const VolunteerRegister = lazyWithReload(() => import('./pages/VolunteerRegister.jsx'))
const AdminVolunteer = lazyWithReload(() => import('./pages/AdminVolunteer.jsx'))
const Give2 = lazyWithReload(() => import('./pages/Give2.jsx'))
const AdminGive = lazyWithReload(() => import('./pages/AdminGive.jsx'))
const AdminGiveReceiver = lazyWithReload(() => import('./pages/AdminGiveReceiver.jsx'))
const Missions = lazyWithReload(() => import('./pages/Missions.jsx'))
const AdminMissions = lazyWithReload(() => import('./pages/AdminMissions.jsx'))
const AdminBroadcast = lazyWithReload(() => import('./pages/AdminBroadcast.jsx'))
const B2um = lazyWithReload(() => import('./pages/B2um.jsx'))
const GiveReceive = lazyWithReload(() => import('./pages/GiveReceive.jsx'))
const Give2Cook = lazyWithReload(() => import('./pages/Give2Cook.jsx'))
const Give2ComReceive = lazyWithReload(() => import('./pages/Give2ComReceive.jsx'))
const Give2CookReceive = lazyWithReload(() => import('./pages/Give2CookReceive.jsx'))
const QuickDonation = lazyWithReload(() => import('./pages/QuickDonation.jsx'))
const QuickDonations = lazyWithReload(() => import('./pages/QuickDonations.jsx')) // เวอร์ชัน payment gateway (ยังไม่อยู่ใน nav)
import FloatingDonate from './components/FloatingDonate.jsx'

// แมประหว่าง URL path กับชื่อหน้า
const PATH_TO_PAGE = { '/': 'home', '/home': 'home', '/donation': 'donation', '/quick-donate': 'quick-donate', '/quick-donations': 'quick-donations', '/event': 'iftar', '/event/iftar-for-gaza': 'iftar', '/event/give-for-um': 'give', '/event/give-for-um/give2com': 'give2', '/event/give-for-um/give2cook': 'give2cook', '/event/give-for-um/b2um': 'b2um', '/event/give-for-um/receive': 'give-receive', '/event/give-for-um/receive/computer': 'give2com-receive', '/event/give-for-um/receive/equipment': 'give2cook-receive', '/missions': 'missions', '/missions/qurban2026': 'qurban', '/missions/quban2026': 'qurban', '/admin/event/iftar2026': 'admin-iftar', '/admin/missions': 'admin-missions', '/admin/missions/qurban2026': 'admin-qurban', '/admin/missions/qurban2026/edit': 'admin-qurban-edit', '/admin/donations': 'admin-donations', '/admin/calendar': 'admin-calendar', '/admin/dashboard': 'admin-home', '/admin/website': 'admin-website', '/um-shop': 'shop', '/um-shop/cart': 'shop-cart', '/um-shop/checkout': 'shop-checkout', '/um-shop/my-orders': 'shop-my-orders', '/admin/shop': 'admin-shop', '/admin/shop/orders': 'admin-shop-orders', '/admin/shop/inventory': 'admin-shop-inventory', '/admin/shop/sales': 'admin-shop-sales', '/challenge': 'challenge', '/admin/financial-dashboard': 'admin-financial', '/admin/qrcode': 'admin-register-event', '/volunteer/register': 'volunteer', '/admin/volunteer': 'admin-volunteer', '/admin/give': 'admin-give', '/admin/give/receiver': 'admin-give-receiver', '/admin/dashboard/broadcast': 'admin-broadcast' }
const PAGE_TO_PATH = { home: '/home', donation: '/donation', iftar: '/event/iftar-for-gaza', give: '/event/give-for-um', give2: '/event/give-for-um/give2com', b2um: '/event/give-for-um/b2um', 'give-receive': '/event/give-for-um/receive', 'give2com-receive': '/event/give-for-um/receive/computer', 'give2cook-receive': '/event/give-for-um/receive/equipment', 'give2cook': '/event/give-for-um/give2cook', qurban: '/missions/qurban2026', missions: '/missions', shop: '/um-shop', 'shop-cart': '/um-shop/cart', 'shop-checkout': '/um-shop/checkout', 'shop-my-orders': '/um-shop/my-orders', volunteer: '/volunteer/register' }

// path คำสั่งซื้อแบบไดนามิก /um-shop/order/<orderId> — เช็คก่อน path สินค้าเสมอ (มี 2 ระดับ ไม่ชนกับ /um-shop/:productId)
const shopOrderIdFromPath = () => {
  const m = window.location.pathname.match(/^\/um-shop\/order\/([^/]+)\/?$/)
  return m ? decodeURIComponent(m[1]) : null
}

// path จัดการคำสั่งซื้อของแอดมิน /admin/shop/orders/<orderId> — เช็คก่อน /admin/shop/orders (path ตายตัว) เสมอ
const adminShopOrderIdFromPath = () => {
  const m = window.location.pathname.match(/^\/admin\/shop\/orders\/([^/]+)\/?$/)
  return m ? decodeURIComponent(m[1]) : null
}

// path สินค้าแบบไดนามิก /um-shop/<productId หรือ Firestore doc id> — แยกออกจาก PATH_TO_PAGE แบบตายตัว
const shopDetailIdFromPath = () => {
  const m = window.location.pathname.match(/^\/um-shop\/([^/]+)\/?$/)
  return m ? decodeURIComponent(m[1]) : null
}

// อ่าน path ปัจจุบันจาก URL แล้วแปลงเป็นชื่อหน้า (ถ้าไม่รู้จักให้ไปหน้า home)
// เช็ค path ตายตัวก่อนเสมอ (เช่น /um-shop/cart) ไม่งั้นจะหลุดไปตีความเป็น productId ผิด
const pageFromPath = () => {
  if (PATH_TO_PAGE[window.location.pathname]) return PATH_TO_PAGE[window.location.pathname]
  if (adminShopOrderIdFromPath()) return 'admin-shop-order-detail'
  if (shopOrderIdFromPath()) return 'shop-order'
  if (shopDetailIdFromPath()) return 'shop-detail'
  return 'home'
}

export default function App() {
  const [page, setPage] = useState(pageFromPath)
  const [shopDetailId, setShopDetailId] = useState(shopDetailIdFromPath)
  const [shopOrderId, setShopOrderId] = useState(shopOrderIdFromPath)
  const [adminShopOrderId, setAdminShopOrderId] = useState(adminShopOrderIdFromPath)
  const [scrolled, setScrolled] = useState(false)
  const [maintenance, setMaintenance] = useState(false)

  // เช็คโหมดปิดปรับปรุง — โหลด firestore แบบ dynamic เหมือนตัวนับผู้เข้าชมด้านล่าง
  // (static import จากไฟล์นี้จะลาก firebase ทั้งก้อน ~700KB เข้า bundle หลักที่ทุกหน้าต้องโหลด)
  useEffect(() => {
    let unsub = () => {}
    let cancelled = false
    Promise.all([import('./firebase.js'), import('firebase/firestore')])
      .then(([{ db }, { doc, onSnapshot }]) => {
        if (cancelled) return
        unsub = onSnapshot(doc(db, 'config', 'site'), (snap) => {
          setMaintenance(snap.exists() ? !!snap.data().maintenance : false)
        }, () => {})
      })
      .catch(() => {})
    return () => { cancelled = true; unsub() }
  }, [])

  // เปลี่ยนหน้า + อัปเดต URL + เลื่อนขึ้นบนสุด — 'shop-detail'/'shop-order'/'admin-shop-order-detail' ต้องส่ง param มาด้วย
  // เช่น go('shop-detail', 'um001'), go('shop-order', orderId), go('admin-shop-order-detail', orderId)
  const go = (name, param) => {
    setPage(name)
    const path = name === 'shop-detail' ? `/um-shop/${encodeURIComponent(param)}`
      : name === 'shop-order' ? `/um-shop/order/${encodeURIComponent(param)}`
      : name === 'admin-shop-order-detail' ? `/admin/shop/orders/${encodeURIComponent(param)}`
      : (PAGE_TO_PATH[name] || '/')
    setShopDetailId(name === 'shop-detail' ? param : null)
    setShopOrderId(name === 'shop-order' ? param : null)
    setAdminShopOrderId(name === 'admin-shop-order-detail' ? param : null)
    if (window.location.pathname !== path) window.history.pushState({}, '', path)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  // รองรับปุ่ม back/forward ของเบราว์เซอร์
  useEffect(() => {
    const onPop = () => {
      setPage(pageFromPath())
      setShopDetailId(shopDetailIdFromPath())
      setShopOrderId(shopOrderIdFromPath())
      setAdminShopOrderId(adminShopOrderIdFromPath())
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // นับผู้เข้าชมเว็บไซต์ — นับครั้งเดียวต่อ session (ไม่นับซ้ำตอนเปลี่ยนหน้า) และข้ามหน้า admin
  useEffect(() => {
    if (window.location.pathname.startsWith('/admin')) return
    if (sessionStorage.getItem('umSiteVisited')) return
    sessionStorage.setItem('umSiteVisited', '1')
    Promise.all([import('./firebase.js'), import('firebase/firestore')])
      .then(([{ db }, { doc, setDoc, increment }]) => {
        setDoc(doc(db, 'stats', 'site'), { views: increment(1) }, { merge: true }).catch(() => {})
      })
      .catch(() => {})
  }, [])

  // สลับ manifest ตามโซนที่เปิดอยู่ — ให้ "เพิ่มไปหน้าจอโฮม" ในโซน /admin ติดตั้งเป็นแอปแยก
  // (ชื่อ/ไอคอนคนละอันจากแอปฝั่งลูกค้า) โดยไม่ต้องแยกโดเมน/build — สลับ href ของ <link rel="manifest"> เอาตอน route เปลี่ยน
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]')
    if (!link) return
    const isAdmin = window.location.pathname.startsWith('/admin')
    link.href = isAdmin ? '/admin-manifest.webmanifest' : '/manifest.webmanifest'
  }, [page])

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
    'admin-website': AdminWebsite,
    'admin-shop': AdminShop,
    'admin-shop-orders': AdminShopOrders,
    'admin-shop-inventory': AdminInventory,
    'admin-shop-sales': AdminShopSales,
    'admin-shop-order-detail': AdminShopOrderDetail,
    'challenge': FinancialDashboard,
    'admin-financial': AdminFinancialDashboard,
    'admin-register-event': AdminQRcode,
    'admin-volunteer': AdminVolunteer,
    'admin-give': AdminGive, 'admin-give-receiver': AdminGiveReceiver,
    'admin-missions': AdminMissions,
    'admin-broadcast': AdminBroadcast,
  }
  const Standalone = STANDALONE[page]

  // หน้า public — ถ้าอยู่ในโหมด maintenance ให้แสดงหน้าปรับปรุง
  if (maintenance && !Standalone) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0fdf4', padding: 24, textAlign: 'center' }}>
        <img src="/logo.png" alt="Ummatee" style={{ height: 72, marginBottom: 24 }} />
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#15803d', marginBottom: 12 }}>ขออภัย กำลังปรับปรุงระบบอยู่</h1>
        <p style={{ color: '#6b7280', fontSize: '1rem', maxWidth: 360 }}>ทีมงานกำลังปรับปรุงเว็บไซต์ให้ดียิ่งขึ้น กรุณากลับมาใหม่ในอีกสักครู่</p>
        <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginTop: 16 }}>We'll be back soon · Jazakallahu khairan 🤍</p>
      </div>
    )
  }

  if (Standalone) {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <Standalone orderId={page === 'admin-shop-order-detail' ? adminShopOrderId : undefined} />
        </Suspense>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <LangProvider>
        <NavCtx.Provider value={go}>
          <Nav scrolled={scrolled} />
          {/* ปุ่มลอย (บริจาค/ตะกร้า) ไม่ต้องมีตลอดขั้นตอนช้อป — เริ่มจากดูสินค้า/ตะกร้าไปจนจบ (เช็คเอาท์/ติดตามออเดอร์/ประวัติคำสั่งซื้อ) กันลอยทับปุ่มของหน้าเหล่านั้นเอง */}
          <FloatingDonate hidden={['shop-detail', 'shop-cart', 'shop-checkout', 'shop-order', 'shop-my-orders'].includes(page)} />
          <Suspense fallback={null}>
            {page === 'home' && <Home />}
            {page === 'donation' && <Donation />}
            {page === 'iftar' && <IftarForGaza />}
            {page === 'give' && <GiveForUm />}
            {page === 'qurban' && <Qurban2026 />}
            {page === 'shop' && <Shop />}
            {page === 'shop-detail' && <ShopProductDetail productId={shopDetailId} />}
            {page === 'shop-cart' && <ShopCart />}
            {page === 'shop-checkout' && <ShopCheckout />}
            {page === 'shop-my-orders' && <ShopMyOrders />}
            {page === 'shop-order' && <ShopOrderStatus orderId={shopOrderId} />}
            {page === 'volunteer' && <VolunteerRegister />}
            {page === 'missions' && <Missions />}
            {page === 'give2' && <Give2 />}
            {page === 'give2cook' && <Give2Cook />}
            {page === 'quick-donate' && <QuickDonation />}
            {page === 'quick-donations' && <QuickDonations />}
            {page === 'b2um' && <B2um />}
            {page === 'give-receive' && <GiveReceive />}
            {page === 'give2com-receive' && <Give2ComReceive />}
            {page === 'give2cook-receive' && <Give2CookReceive />}
          </Suspense>
        </NavCtx.Provider>
      </LangProvider>
    </ErrorBoundary>
  )
}
