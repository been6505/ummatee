import { useEffect, useMemo, useState } from 'react'
import VolunteerGuard from '../components/VolunteerGuard.jsx'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { useOrders, STATUS_LABEL, adminStatusLabel, deleteOrder, markOrdersSeen } from '../data/orders.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash } from '@fortawesome/free-solid-svg-icons'

// รายการคำสั่งซื้อทั้งหมด (/admin/shop/orders) — กรองตามสถานะ คลิกแถวเพื่อไปหน้าติดตาม/จัดการคำสั่งซื้อนั้น
const THB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH')
const orderTimeLabel = (ts) => {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
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

  // เข้าหน้านี้แล้วถือว่าเห็นออเดอร์ทั้งหมด ณ ตอนนี้แล้ว — เคลียร์ badge "ใหม่" บน nav/กระดิ่ง
  useEffect(() => { markOrdersSeen() }, [])

  // ลบออเดอร์ — ยืนยันก่อนเสมอ (ลบถาวร ไม่คืนสต็อกที่ตัดไปแล้วให้อัตโนมัติ)
  const handleDelete = (o) => {
    if (!window.confirm(`ลบคำสั่งซื้อ ${o.orderCode} ถาวร?\n\nการลบไม่คืนสต็อกสินค้าที่ตัดไปแล้วให้อัตโนมัติ ถ้าเป็นออเดอร์จริง (ไม่ใช่ทดสอบ) ต้องไปเติมคลังคืนเองที่หน้าคลังสินค้า`)) return
    deleteOrder(o.id).catch((e) => alert('ลบไม่สำเร็จ: ' + e.message))
  }

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
                    <th>เลขที่คำสั่งซื้อ</th><th>เวลา</th><th>ชื่อลูกค้า</th><th>อีเมล</th><th>เบอร์โทร</th>
                    <th style={{ textAlign: 'right' }}>ยอดรวม</th><th>สถานะ</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr key={o.id}>
                      <td style={{ fontFamily: 'monospace' }}>{o.orderCode}</td>
                      <td style={{ color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{orderTimeLabel(o.createdAt)}</td>
                      <td>{o.customer?.fullName || [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ')}</td>
                      <td style={{ color: 'var(--ink-soft)' }}>{o.customer?.email}</td>
                      <td>{o.customer?.phone}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{THB(o.total)}</td>
                      <td>
                        <span style={{ color: o.status === 'pending_payment' && o.paymentDeclaredAt ? '#dc2626' : STATUS_COLOR[o.status], fontWeight: 700 }}>
                          {adminStatusLabel(o)}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <a className="admin-btn" href={`/admin/shop/orders/${o.id}`}>จัดการ</a>
                        <button type="button" className="admin-btn-danger admin-icon-btn" onClick={() => handleDelete(o)} aria-label="ลบคำสั่งซื้อ" title="ลบคำสั่งซื้อ">
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan="8" style={{ textAlign: 'center', color: '#999' }}>ไม่มีคำสั่งซื้อในสถานะนี้</td></tr>
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
