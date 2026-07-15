import { useMemo, useState } from 'react'
import VolunteerGuard from '../components/VolunteerGuard.jsx'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { useOrders, STATUS_LABEL, adminStatusLabel } from '../data/orders.js'

// รายการคำสั่งซื้อทั้งหมด (/admin/shop/orders) — กรองตามสถานะ คลิกแถวเพื่อไปหน้าติดตาม/จัดการคำสั่งซื้อนั้น
const THB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH')
const STATUS_COLOR = {
  pending_payment: '#d97706', preparing: '#2563eb', shipping: '#7c3aed', delivered: '#15803d',
}

export default function AdminShopOrders() {
  const { user, loading } = useAdminAuth()
  const { orders, loading: ordersLoading } = useOrders()
  const [filter, setFilter] = useState('all')

  const filtered = useMemo(
    () => filter === 'all' ? orders : orders.filter((o) => o.status === filter),
    [orders, filter]
  )

  if (loading) return null
  if (!user) return <AdminLogin />

  return (<VolunteerGuard>
    <main className="admin-dash admin-shop-wide">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1>คำสั่งซื้อ Um Shop</h1>
            <p>ตรวจสอบและจัดการคำสั่งซื้อทั้งหมด</p>
          </div>
        </div>

        <div className="admin-card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
          <div className="admin-table-wrap">
            <table className="admin-table admin-status-filter-table">
              <thead>
                <tr><th>สถานะ</th><th style={{ textAlign: 'right' }}>จำนวน</th></tr>
              </thead>
              <tbody>
                <tr className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
                  <td>ทั้งหมด</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{orders.length}</td>
                </tr>
                {Object.entries(STATUS_LABEL).map(([key, label]) => (
                  <tr key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>
                    <td style={{ color: STATUS_COLOR[key], fontWeight: 700 }}>{label}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{orders.filter((o) => o.status === key).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {ordersLoading ? <p>กำลังโหลดข้อมูล...</p> : (
          <div className="admin-card">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>เลขที่คำสั่งซื้อ</th><th>ลูกค้า</th><th>เบอร์โทร</th>
                    <th style={{ textAlign: 'right' }}>ยอดรวม</th><th>สถานะ</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr key={o.id}>
                      <td style={{ fontFamily: 'monospace' }}>{o.orderCode}</td>
                      <td>
                        {o.customer?.firstName} {o.customer?.lastName}
                        {o.customer?.email && <div style={{ fontSize: '.78rem', color: 'var(--ink-soft)' }}>{o.customer.email}</div>}
                      </td>
                      <td>{o.customer?.phone}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{THB(o.total)}</td>
                      <td>
                        <span style={{ color: o.status === 'pending_payment' && o.paymentDeclaredAt ? '#dc2626' : STATUS_COLOR[o.status], fontWeight: 700 }}>
                          {adminStatusLabel(o)}
                        </span>
                      </td>
                      <td><a className="admin-btn" href={`/admin/shop/orders/${o.id}`}>จัดการ</a></td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan="6" style={{ textAlign: 'center', color: '#999' }}>ไม่มีคำสั่งซื้อในสถานะนี้</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  </VolunteerGuard>)
}
