import { useMemo } from 'react'
import VolunteerGuard from '../components/VolunteerGuard.jsx'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { useOrders } from '../data/orders.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChartLine } from '@fortawesome/free-solid-svg-icons'

// รายงานยอดขาย Um Shop (/admin/shop/sales) — สรุปจากคำสั่งซื้อทั้งหมดใน Firestore
// "ยอดขาย" นับเฉพาะออเดอร์ที่ยืนยันการชำระเงินแล้ว (สถานะพ้น pending_payment ไปแล้ว)

const THB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH')
const PAID_STATUSES = ['preparing', 'shipping', 'delivered']

const monthKey = (ms) => {
  const d = new Date(ms || 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const monthLabel = (key) => {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('th-TH', { year: 'numeric', month: 'long' })
}

export default function AdminShopSales() {
  const { user, loading: authLoading } = useAdminAuth()
  const { orders, loading } = useOrders()

  const paid = useMemo(() => orders.filter((o) => PAID_STATUSES.includes(o.status)), [orders])
  const pending = useMemo(() => orders.filter((o) => o.status === 'pending_payment'), [orders])

  const totalRevenue = paid.reduce((s, o) => s + (o.itemsTotal || 0), 0)
  const totalShipping = paid.reduce((s, o) => s + (o.shippingFee || 0), 0)

  // ยอดขายรายเดือน (เดือนล่าสุดก่อน)
  const byMonth = useMemo(() => {
    const map = {}
    paid.forEach((o) => {
      const k = monthKey(o.createdAt)
      map[k] = map[k] || { revenue: 0, count: 0 }
      map[k].revenue += o.itemsTotal || 0
      map[k].count += 1
    })
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]))
  }, [paid])

  // สินค้าขายดี — รวมจำนวน/ยอดจากรายการในออเดอร์ที่จ่ายแล้ว
  const topProducts = useMemo(() => {
    const map = {}
    paid.forEach((o) => (o.items || []).forEach((i) => {
      const k = i.productDocId || i.productId || i.name
      map[k] = map[k] || { name: i.name, code: i.productId || '', qty: 0, revenue: 0 }
      map[k].qty += i.qty || 0
      map[k].revenue += (i.price || 0) * (i.qty || 0)
    }))
    return Object.values(map).sort((a, b) => b.revenue - a.revenue)
  }, [paid])

  if (authLoading) return null
  if (!user) return <AdminLogin />

  return (<VolunteerGuard>
    <main className="admin-dash admin-qurban admin-shop-wide">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1><FontAwesomeIcon icon={faChartLine} /> รายงานยอดขาย Um Shop</h1>
            <p>นับเฉพาะออเดอร์ที่ยืนยันการชำระเงินแล้ว · ยอดสินค้าไม่รวมค่าจัดส่ง</p>
          </div>
        </div>

        {loading ? <p style={{ padding: 40, textAlign: 'center' }}>กำลังโหลดข้อมูล...</p> : (<>
          <div className="admin-stats">
            <div className="admin-stat"><div className="v">{THB(totalRevenue)}</div><div className="l">ยอดขายสินค้า</div></div>
            <div className="admin-stat"><div className="v">{THB(totalShipping)}</div><div className="l">ค่าจัดส่งที่เก็บ</div></div>
            <div className="admin-stat"><div className="v">{paid.length}</div><div className="l">ออเดอร์ชำระแล้ว</div></div>
            <div className="admin-stat"><div className="v" style={pending.length ? { color: '#b45309' } : {}}>{pending.length}</div><div className="l">รอชำระเงิน</div></div>
          </div>

          <div className="admin-shop-top-grid" style={{ marginTop: 20 }}>
            <div className="admin-card">
              <h4>ยอดขายรายเดือน</h4>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>เดือน</th><th style={{ textAlign: 'right' }}>ออเดอร์</th><th style={{ textAlign: 'right' }}>ยอดขาย</th></tr></thead>
                  <tbody>
                    {byMonth.map(([k, v]) => (
                      <tr key={k}>
                        <td>{monthLabel(k)}</td>
                        <td style={{ textAlign: 'right' }}>{v.count}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{THB(v.revenue)}</td>
                      </tr>
                    ))}
                    {byMonth.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', color: '#999' }}>ยังไม่มียอดขาย</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="admin-card">
              <h4>สินค้าขายดี</h4>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>สินค้า</th><th style={{ textAlign: 'right' }}>ขายได้ (ชิ้น)</th><th style={{ textAlign: 'right' }}>ยอดขาย</th></tr></thead>
                  <tbody>
                    {topProducts.map((p) => (
                      <tr key={p.code || p.name}>
                        <td>{p.code ? <span style={{ fontFamily: 'monospace', color: 'var(--ink-soft)' }}>[{p.code}] </span> : ''}{p.name}</td>
                        <td style={{ textAlign: 'right' }}>{p.qty}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{THB(p.revenue)}</td>
                      </tr>
                    ))}
                    {topProducts.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', color: '#999' }}>ยังไม่มียอดขาย</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>)}
      </div>
    </main>
  </VolunteerGuard>)
}
