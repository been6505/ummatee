import { useMemo, useState } from 'react'
import VolunteerGuard from '../components/VolunteerGuard.jsx'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { useProducts, SHOP_SIZES_BY_CATEGORY } from '../data/shop.js'
import { stockIn, useStockMovements, stockLevel, LOW_STOCK_THRESHOLD } from '../data/inventory.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBoxesStacked, faTriangleExclamation, faPlus, faCaretUp, faCaretDown } from '@fortawesome/free-solid-svg-icons'

// ระบบคลัง Um Shop (/admin/shop/inventory) — แจ้งเตือนสินค้าใกล้หมด/หมด + รับสินค้าเข้าคลัง + ประวัติการเคลื่อนไหวสต็อก
// การตัดสต็อกตอนสั่งซื้อเป็นแบบอัตโนมัติอยู่แล้ว (ดู createOrder ใน src/data/orders.js) หน้านี้ไม่ต้องทำอะไรเพิ่ม

const MOVEMENT_LABEL = {
  order: 'ตัดสต็อก (คำสั่งซื้อ)',
  'stock-in': 'รับเข้าคลัง',
}

// คอลัมน์ไซซ์ในตารางแจ้งเติมสต็อก — ใช้ลำดับไซซ์มาตรฐานของเสื้อ (S,M,L,XL,2XL,3XL)
const SIZE_COLS = SHOP_SIZES_BY_CATEGORY['เสื้อ'] || ['S', 'M', 'L', 'XL', '2XL', '3XL']

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
  // การเรียงตารางแจ้งเติมสต็อก — เริ่มที่ "เหลือ" น้อยไปมาก, กดหัวคอลัมน์ "รหัส"/"เหลือ" เพื่อสลับ
  const [restockSort, setRestockSort] = useState({ key: 'total', dir: 'asc' })

  // เรียงตามรหัสสินค้า (um001, um002, ...) — numeric:true กันเคสเลขไม่เท่ากันหลัก เช่น um2 < um10
  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => (a.productId || '').localeCompare(b.productId || '', undefined, { numeric: true })),
    [products]
  )

  const lowStock = useMemo(() => products.filter((p) => stockLevel(p.stock) === 'low'), [products])
  const outOfStock = useMemo(() => products.filter((p) => stockLevel(p.stock) === 'out'), [products])

  // รายการที่ต้องเติมสต็อก — 1 แถวต่อ 1 สินค้า (doc) แสดงจำนวนแยกทุกไซซ์เป็นคอลัมน์ + รวมเหลือ
  // สินค้าที่มี sizeStock (เสื้อ) เข้าเงื่อนไขเมื่อไซซ์ใดไซซ์หนึ่งเหลือน้อย/หมด · สินค้าไม่มีไซซ์ใช้สต็อกรวม (คอลัมน์ไซซ์เป็น —)
  const restockRows = useMemo(() => {
    const rows = []
    products.forEach((p) => {
      const label = p.name + (p.type ? ` (${p.type})` : '')
      const code = p.productId || '—'
      const sizes = p.sizeStock && Object.keys(p.sizeStock).length > 0 ? p.sizeStock : null
      if (sizes) {
        const anyLow = Object.values(sizes).some((q) => (Number(q) || 0) <= LOW_STOCK_THRESHOLD)
        if (!anyLow) return
        const total = Object.values(sizes).reduce((s, q) => s + (Number(q) || 0), 0)
        rows.push({ id: p.id, code, name: label, sizes, total, sized: true })
      } else if (stockLevel(p.stock) !== 'ok') {
        rows.push({ id: p.id, code, name: label, sizes: null, total: Number.isFinite(p.stock) ? p.stock : 0, sized: false })
      }
    })
    const { key, dir } = restockSort
    const sign = dir === 'asc' ? 1 : -1
    return rows.sort((a, b) => {
      const cmp = key === 'code'
        ? (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }) // um2 < um10
        : a.total - b.total
      return cmp * sign
    })
  }, [products, restockSort])

  const restockSortBy = (key) => setRestockSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  const restockArrow = (key) => restockSort.key === key
    ? <FontAwesomeIcon icon={restockSort.dir === 'asc' ? faCaretUp : faCaretDown} style={{ marginLeft: 4 }} />
    : null

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
                    <th className="admin-th-sort" onClick={() => restockSortBy('code')}>รหัส{restockArrow('code')}</th>
                    <th>สินค้า</th>
                    {SIZE_COLS.map((sz) => <th key={sz} style={{ textAlign: 'center' }}>{sz}</th>)}
                    <th className="admin-th-sort" style={{ textAlign: 'right' }} onClick={() => restockSortBy('total')}>เหลือ{restockArrow('total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {restockRows.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'monospace' }}>{r.code}</td>
                      <td style={{ whiteSpace: 'normal', minWidth: 140 }}>{r.name}</td>
                      {SIZE_COLS.map((sz) => {
                        if (!r.sized) return <td key={sz} style={{ textAlign: 'center', color: '#ccc' }}>—</td>
                        const has = r.sizes[sz] !== undefined
                        if (!has) return <td key={sz} style={{ textAlign: 'center', color: '#ddd' }}>·</td>
                        const q = Number(r.sizes[sz]) || 0
                        const color = q <= 0 ? '#d84315' : q <= LOW_STOCK_THRESHOLD ? '#b45309' : 'inherit'
                        return <td key={sz} style={{ textAlign: 'center', color, fontWeight: q <= LOW_STOCK_THRESHOLD ? 700 : 400 }}>{q}</td>
                      })}
                      <td style={{ textAlign: 'right', fontWeight: 700, color: r.total <= 0 ? '#d84315' : '#b45309' }}>
                        {r.total <= 0 ? 'หมด' : r.total}
                      </td>
                    </tr>
                  ))}
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
