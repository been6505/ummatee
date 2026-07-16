import { useMemo, useState } from 'react'
import VolunteerGuard from '../components/VolunteerGuard.jsx'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { useProducts } from '../data/shop.js'
import { stockIn, useStockMovements, stockLevel, LOW_STOCK_THRESHOLD } from '../data/inventory.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBoxesStacked, faTriangleExclamation, faPlus } from '@fortawesome/free-solid-svg-icons'

// ระบบคลัง Um Shop (/admin/shop/inventory) — แจ้งเตือนสินค้าใกล้หมด/หมด + รับสินค้าเข้าคลัง + ประวัติการเคลื่อนไหวสต็อก
// การตัดสต็อกตอนสั่งซื้อเป็นแบบอัตโนมัติอยู่แล้ว (ดู createOrder ใน src/data/orders.js) หน้านี้ไม่ต้องทำอะไรเพิ่ม

const MOVEMENT_LABEL = {
  order: 'ตัดสต็อก (คำสั่งซื้อ)',
  'stock-in': 'รับเข้าคลัง',
}

function fmtDate(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function StockInForm({ products }) {
  const [productId, setProductId] = useState('')
  const [size, setSize] = useState('')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  const product = products.find((p) => p.id === productId)
  const sizeOptions = product?.sizeStock ? Object.keys(product.sizeStock) : []

  const submit = async () => {
    setStatus('')
    if (!product) { setStatus('กรุณาเลือกสินค้า'); return }
    if (sizeOptions.length > 0 && !size) { setStatus('กรุณาเลือกไซซ์ที่รับเข้า'); return }
    const n = Number(qty)
    if (!qty || isNaN(n) || n <= 0) { setStatus('กรุณาใส่จำนวนที่มากกว่า 0'); return }
    setSaving(true)
    try {
      await stockIn(product, n, reason, size)
      setStatus(`รับเข้าคลังสำเร็จ — ${product.name}${size ? ` ไซซ์ ${size}` : ''} +${n}`)
      setQty(''); setReason(''); setSize('')
    } catch (e) {
      setStatus('เกิดข้อผิดพลาด: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-card">
      <h4><FontAwesomeIcon icon={faPlus} /> รับสินค้าเข้าคลัง</h4>
      <div className="admin-form-grid">
        <label>สินค้า
          <select value={productId} onChange={(e) => { setProductId(e.target.value); setSize('') }}>
            <option value="">— เลือกสินค้า —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.productId ? `[${p.productId}] ` : ''}{p.name}{p.type ? ` (${p.type})` : ''} (คงเหลือ {Number.isFinite(p.stock) ? p.stock : '—'})</option>
            ))}
          </select>
        </label>
        {sizeOptions.length > 0 && (
          <label>ไซซ์ที่รับเข้า
            <select value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="">— เลือกไซซ์ —</option>
              {sizeOptions.map((sz) => (
                <option key={sz} value={sz}>{sz} (คงเหลือ {Number(product.sizeStock[sz]) || 0})</option>
              ))}
            </select>
          </label>
        )}
        <label>จำนวนที่รับเข้า
          <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="เช่น 20" />
        </label>
        <label>หมายเหตุ (ไม่บังคับ)
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น สั่งผลิตล็อตใหม่" />
        </label>
      </div>
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="admin-btn-primary" onClick={submit} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'รับเข้าคลัง'}</button>
        {status && <span style={{ fontSize: '.85rem', color: status.startsWith('เกิด') ? '#dc2626' : 'var(--ink-soft)' }}>{status}</span>}
      </div>
    </div>
  )
}

export default function AdminInventory() {
  const { user, loading: authLoading } = useAdminAuth()
  const authed = !!user
  const { products, loading: prodLoading } = useProducts()
  const { rows: movements, loading: movLoading } = useStockMovements()
  const [productFilter, setProductFilter] = useState('')

  // เรียงตามรหัสสินค้า (um001, um002, ...) — numeric:true กันเคสเลขไม่เท่ากันหลัก เช่น um2 < um10
  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => (a.productId || '').localeCompare(b.productId || '', undefined, { numeric: true })),
    [products]
  )

  const lowStock = useMemo(() => products.filter((p) => stockLevel(p.stock) === 'low'), [products])
  const outOfStock = useMemo(() => products.filter((p) => stockLevel(p.stock) === 'out'), [products])

  // รายการที่ต้องเติมสต็อก แยกเป็นราย "ไซซ์" สำหรับสินค้าที่มี sizeStock (เสื้อ) — ไซซ์ไหนเหลือน้อย/หมดก็ขึ้นแถวของมันเอง
  // สินค้าที่ไม่มีไซซ์ (หมวก/กระเป๋า ฯลฯ) ใช้สต็อกรวมทั้งชิ้น ขนาดแสดงเป็น "—"
  const restockRows = useMemo(() => {
    const rows = []
    products.forEach((p) => {
      const label = p.name + (p.type ? ` (${p.type})` : '')
      const code = p.productId || '—'
      const sizes = p.sizeStock && Object.keys(p.sizeStock).length > 0 ? p.sizeStock : null
      if (sizes) {
        Object.entries(sizes).forEach(([sz, qty]) => {
          const n = Number(qty) || 0
          if (n <= LOW_STOCK_THRESHOLD) rows.push({ id: p.id + '|' + sz, code, name: label, size: sz, remaining: n })
        })
      } else if (stockLevel(p.stock) !== 'ok') {
        rows.push({ id: p.id, code, name: label, size: '—', remaining: Number.isFinite(p.stock) ? p.stock : 0 })
      }
    })
    return rows.sort((a, b) => a.remaining - b.remaining) // เหลือน้อยสุด (หมด) ขึ้นก่อน
  }, [products])

  const filteredMovements = useMemo(
    () => (productFilter ? movements.filter((m) => m.productId === productFilter) : movements),
    [movements, productFilter]
  )

  if (authLoading) return null
  if (!authed) return <AdminLogin />

  return (<VolunteerGuard>
    <main className="admin-dash admin-qurban admin-shop-wide">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1><FontAwesomeIcon icon={faBoxesStacked} /> คลังสินค้า Um Shop</h1>
            <p>สต็อกตัดอัตโนมัติเมื่อมีคำสั่งซื้อ — หน้านี้ใช้รับสินค้าเข้าคลังและดูประวัติการเคลื่อนไหว</p>
          </div>
        </div>

        <div className="admin-stats">
          <div className="admin-stat"><div className="v">{products.length}</div><div className="l">สินค้าทั้งหมด</div></div>
          <div className="admin-stat"><div className="v" style={{ color: '#d84315' }}>{outOfStock.length}</div><div className="l">สินค้าหมด</div></div>
          <div className="admin-stat"><div className="v" style={{ color: '#b45309' }}>{lowStock.length}</div><div className="l">ใกล้หมด (≤{LOW_STOCK_THRESHOLD})</div></div>
        </div>

        {!prodLoading && restockRows.length > 0 && (
          <div className="admin-card" style={{ marginTop: 20, borderColor: '#fca5a5' }}>
            <h4><FontAwesomeIcon icon={faTriangleExclamation} style={{ color: '#dc2626' }} /> สินค้าต้องเติมสต็อก ({restockRows.length})</h4>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>รหัส</th>
                    <th>สินค้า</th>
                    <th style={{ textAlign: 'center' }}>ขนาด</th>
                    <th style={{ textAlign: 'right' }}>เหลือ</th>
                  </tr>
                </thead>
                <tbody>
                  {restockRows.map((r) => {
                    const out = r.remaining <= 0
                    return (
                      <tr key={r.id}>
                        <td style={{ fontFamily: 'monospace' }}>{r.code}</td>
                        <td style={{ whiteSpace: 'normal', minWidth: 140 }}>{r.name}</td>
                        <td style={{ textAlign: 'center' }}>{r.size}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: out ? '#d84315' : '#b45309' }}>
                          {out ? 'หมด' : r.remaining}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="admin-shop-top-grid" style={{ marginTop: 20 }}>
          <StockInForm products={products} />

          <div className="admin-card">
            <h4>สินค้าคงเหลือทั้งหมด</h4>
            <div className="admin-table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="admin-table">
                <thead><tr><th>รหัส</th><th>ชื่อสินค้า</th><th>คงเหลือ</th></tr></thead>
                <tbody>
                  {sortedProducts.map((p) => {
                    const level = stockLevel(p.stock)
                    return (
                      <tr key={p.id}>
                        <td style={{ fontFamily: 'monospace' }}>{p.productId || '—'}</td>
                        <td>{p.name}</td>
                        <td style={level === 'out' ? { color: '#d84315', fontWeight: 700 } : level === 'low' ? { color: '#b45309', fontWeight: 700 } : {}}>
                          {Number.isFinite(p.stock) ? p.stock : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="admin-card" style={{ marginTop: 20 }}>
          <div className="admin-card-head">
            <h4>ประวัติการเคลื่อนไหวสต็อก ({filteredMovements.length})</h4>
            <div className="admin-filters">
              <select className="admin-select" value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
                <option value="">ทุกสินค้า</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          {movLoading ? <p>กำลังโหลด...</p> : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>วันที่</th><th>สินค้า</th><th>ประเภท</th><th>จำนวน</th><th>อ้างอิง/หมายเหตุ</th></tr></thead>
                <tbody>
                  {filteredMovements.map((m) => (
                    <tr key={m.id}>
                      <td>{fmtDate(m.at)}</td>
                      <td>{m.productCode ? `[${m.productCode}] ` : ''}{m.productName || m.productId}</td>
                      <td>{MOVEMENT_LABEL[m.type] || m.type}</td>
                      <td style={m.qty < 0 ? { color: '#d84315', fontWeight: 700 } : { color: '#15803d', fontWeight: 700 }}>{m.qty > 0 ? `+${m.qty}` : m.qty}</td>
                      <td>{m.orderCode || m.reason || '—'}</td>
                    </tr>
                  ))}
                  {filteredMovements.length === 0 && (
                    <tr><td colSpan="5" style={{ textAlign: 'center', color: '#999' }}>ยังไม่มีประวัติ</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  </VolunteerGuard>)
}
