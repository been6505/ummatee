import { useMemo, useState } from 'react'
import VolunteerGuard from '../components/VolunteerGuard.jsx'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import {
  useProducts, updateProduct, deleteProduct,
  usePromotions, applyPromotion,
} from '../data/shop.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCaretUp, faCaretDown, faPencil, faCheck } from '@fortawesome/free-solid-svg-icons'

// จัดการสินค้า Um Shop (/admin/shop) — รายการสินค้า ค้นหา/กรอง/เรียง/ลบ/แสดง-ซ่อน
// เพิ่มสินค้าใหม่/แก้ไข/โปรโมชั่น อยู่ที่หน้าแยก /admin/shop/new (AdminShopNew.jsx)

const SHOP_CATEGORIES = ['หมวก', 'เสื้อ', 'กระบอกน้ำ', 'กระเป๋า', 'สติกเกอร์']

const THB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH')

// ── ช่องราคาส่วนลดในตารางสินค้า — เลือกจากชิปโปรโมชั่น หรือกำหนดราคาเอง ──
function DiscountCell({ product, promotions }) {
  const [editing, setEditing] = useState(false)
  const [customPrice, setCustomPrice] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async (discountPrice) => {
    setSaving(true)
    try {
      await updateProduct(product.id, { discountPrice })
      setEditing(false)
    } catch (e) {
      window.alert('บันทึกราคาส่วนลดไม่สำเร็จ: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const applyChip = (promo) => save(applyPromotion(product.price, promo))
  const applyCustom = () => {
    const v = Number(customPrice)
    if (!customPrice || isNaN(v) || v < 0) return
    save(Math.round(v * 100) / 100)
  }
  const clear = () => save(null)

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {product.discountPrice != null
          ? <span style={{ color: '#d84315', fontWeight: 700 }}>{THB(product.discountPrice)}</span>
          : <span style={{ color: '#999' }}>—</span>}
        <button
          type="button"
          className="admin-btn"
          style={{ fontSize: '.72rem', padding: '3px 8px' }}
          onClick={() => { setCustomPrice(product.discountPrice ?? ''); setEditing(true) }}
        >
          <FontAwesomeIcon icon={faPencil} />
        </button>
      </div>
    )
  }

  return (
    <div className="discount-edit-box">
      {promotions.length > 0 && (
        <div className="ship-chip-wrap" style={{ marginBottom: 6 }}>
          {promotions.map((promo) => (
            <button
              key={promo.id}
              type="button"
              className="ship-status-chip"
              disabled={saving}
              onClick={() => applyChip(promo)}
              title={`ราคาหลังลด: ${THB(applyPromotion(product.price, promo))}`}
            >
              {promo.label}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input
          type="number" min="0" placeholder="ราคาเอง" value={customPrice}
          onChange={(e) => setCustomPrice(e.target.value)}
          style={{ width: 90, padding: '4px 8px', fontSize: '.85rem' }}
        />
        <button type="button" className="admin-btn" style={{ fontSize: '.75rem', padding: '4px 10px' }} onClick={applyCustom} disabled={saving}>
          <FontAwesomeIcon icon={faCheck} />
        </button>
        {product.discountPrice != null && (
          <button type="button" className="admin-btn-danger" style={{ fontSize: '.75rem', padding: '4px 10px' }} onClick={clear} disabled={saving}>ล้าง</button>
        )}
        <button type="button" className="admin-btn" style={{ fontSize: '.75rem', padding: '4px 10px' }} onClick={() => setEditing(false)}>ปิด</button>
      </div>
    </div>
  )
}

const EMPTY_PROMO = { label: '', type: 'percent', value: '' }

export default function AdminShop() {
  const { user, loading } = useAdminAuth()
  const { products, loading: prodLoading } = useProducts()
  const { promotions } = usePromotions()

  // ค้นหา/กรอง/เรียง
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [sortKey, setSortKey] = useState('productId')
  const [sortDir, setSortDir] = useState('asc')

  const categories = useMemo(() => {
    const fromProducts = products.map((p) => p.category).filter(Boolean)
    const set = new Set([...SHOP_CATEGORIES, ...fromProducts])
    return [...set]
  }, [products])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return products
      .filter((p) => (filterCat === 'all' ? true : p.category === filterCat))
      .filter((p) => !s || [p.name, p.description, p.category].some((x) => (x || '').toLowerCase().includes(s)))
      .sort((a, b) => {
        let cmp = 0
        if (sortKey === 'price') cmp = (a.price || 0) - (b.price || 0)
        else if (sortKey === 'stock') cmp = (a.stock || 0) - (b.stock || 0)
        else if (sortKey === 'category') cmp = (a.category || '').localeCompare(b.category || '')
        else if (sortKey === 'type') cmp = (a.type || '').localeCompare(b.type || '')
        else if (sortKey === 'productId') cmp = (a.productId || '').localeCompare(b.productId || '', undefined, { numeric: true })
        else cmp = (a.name || '').localeCompare(b.name || '')
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [products, search, filterCat, sortKey, sortDir])

  if (loading) return null
  if (!user) return <AdminLogin />

  const sortBtn = (key) => () => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }
  const arrow = (key) => sortKey === key ? <FontAwesomeIcon icon={sortDir === 'asc' ? faCaretUp : faCaretDown} style={{ marginLeft: 4 }} /> : null

  const toggleActive = (p) => updateProduct(p.id, { active: p.active === false })

  const remove = async (id) => {
    if (!window.confirm('ลบสินค้านี้?')) return
    try { await deleteProduct(id) } catch (e) { window.alert('ลบไม่สำเร็จ: ' + e.message) }
  }

  return (<VolunteerGuard>
    <main className="admin-dash admin-qurban admin-shop-wide">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1>จัดการสินค้า Um Shop</h1>
            <p>แสดงผลที่หน้า <a href="/um-shop">/um-shop</a> ทันที — เพิ่มสินค้าใหม่/แก้ไข/โปรโมชั่นที่หน้าแยก</p>
          </div>
          <a className="admin-btn-primary" href="/admin/shop/new">+ เพิ่มสินค้าใหม่ / โปรโมชั่น</a>
        </div>

        {prodLoading ? <p>กำลังโหลดข้อมูล...</p> : (
          <div className="admin-card">
            <div className="admin-card-head">
              <h4>รายการสินค้า ({filtered.length}/{products.length})</h4>
              <div className="admin-filters">
                <input type="search" placeholder="ค้นหาสินค้า..." value={search} onChange={(e) => setSearch(e.target.value)} />
                {categories.length > 0 && (
                  <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
                    <option value="all">ทุกหมวดหมู่</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                {(search || filterCat !== 'all') && (
                  <button className="admin-btn" onClick={() => { setSearch(''); setFilterCat('all') }}>ล้าง</button>
                )}
              </div>
            </div>
            {/* เดสก์ท็อป: ตารางเต็ม (เรียงคอลัมน์ได้) — ซ่อนบนมือถือ ดู .admin-shop-cards แทน */}
            <div className="admin-table-wrap admin-shop-table-desktop">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>รูป</th>
                    <th className="admin-th-sort" onClick={sortBtn('productId')}>รหัสสินค้า{arrow('productId')}</th>
                    <th className="admin-th-sort" onClick={sortBtn('name')}>ชื่อสินค้า{arrow('name')}</th>
                    <th className="admin-th-sort" onClick={sortBtn('category')}>หมวดหมู่{arrow('category')}</th>
                    <th className="admin-th-sort" onClick={sortBtn('type')}>ประเภท{arrow('type')}</th>
                    <th className="admin-th-sort" onClick={sortBtn('price')}>ราคา{arrow('price')}</th>
                    <th>ราคาส่วนลด</th>
                    <th className="admin-th-sort" onClick={sortBtn('stock')}>คงเหลือ{arrow('stock')}</th>
                    <th>สี/ขนาด</th>
                    <th>แสดงผล</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const isActive = p.active !== false
                    return (
                    <tr key={p.id} style={isActive ? {} : { opacity: 0.55 }}>
                      <td>{p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="admin-shop-thumb" /> : '—'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{p.productId || '—'}</td>
                      <td>{p.name}</td>
                      <td>{p.category || '—'}</td>
                      <td>{p.type || '—'}</td>
                      <td>{THB(p.price)}</td>
                      <td><DiscountCell product={p} promotions={promotions} /></td>
                      <td style={p.stock <= 0 ? { color: '#d84315', fontWeight: 700 } : {}}>{p.stock}</td>
                      <td>{[...(p.colors || []), ...(p.sizes || [])].join(', ') || '—'}</td>
                      <td>
                        <button
                          className="admin-btn"
                          onClick={() => toggleActive(p)}
                          title={isActive ? 'คลิกเพื่อซ่อนจากหน้าร้าน' : 'คลิกเพื่อแสดงในหน้าร้าน'}
                          style={isActive
                            ? { background: '#e8f5e9', color: '#2e7d32', borderColor: '#a5d6a7' }
                            : { background: '#fbe9e7', color: '#c62828', borderColor: '#ffab91' }}
                        >
                          {isActive ? 'แสดงอยู่' : 'ซ่อนอยู่'}
                        </button>
                      </td>
                      <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <a className="admin-btn" href={`/admin/shop/new/edit/${p.id}`}>แก้ไข</a>
                        <a className="admin-btn" href={`/admin/shop/new/duplicate/${p.id}`} title="คัดลอกชื่อ/หมวด/ประเภท ไปสร้างสี/ตัวเลือกใหม่ (จับกลุ่มการ์ดเดียวกัน)">ทำสำเนา</a>
                        <button className="admin-btn-danger" onClick={() => remove(p.id)}>ลบ</button>
                      </td>
                    </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan="11" style={{ textAlign: 'center', color: '#999' }}>ยังไม่มีสินค้า — <a href="/admin/shop/new">เพิ่มสินค้าใหม่</a></td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* มือถือ: การ์ด 2 แถว — แถวบน รูป+ชื่อ+ราคา / แถวล่าง คงเหลือ+สถานะ+ปุ่ม (ซ่อนบนเดสก์ท็อป) */}
            <div className="admin-shop-cards">
              {filtered.map((p) => {
                const isActive = p.active !== false
                return (
                  <div key={p.id} className={`admin-shop-card ${isActive ? '' : 'is-hidden'}`}>
                    <div className="asc-top">
                      <div className="asc-thumb">
                        {p.images?.[0] ? <img src={p.images[0]} alt={p.name} /> : <span className="asc-thumb-ph">—</span>}
                      </div>
                      <div className="asc-info">
                        <div className="asc-name">{p.name}</div>
                        <div className="asc-code">{p.productId || '—'}{p.category ? ` · ${p.category}` : ''}{p.type ? ` · ${p.type}` : ''}</div>
                        {[...(p.colors || []), ...(p.sizes || [])].length > 0 && (
                          <div className="asc-variant">{[...(p.colors || []), ...(p.sizes || [])].join(', ')}</div>
                        )}
                      </div>
                      <div className="asc-price">
                        {p.discountPrice != null
                          ? <><span className="asc-price-old">{THB(p.price)}</span><span className="asc-price-now">{THB(p.discountPrice)}</span></>
                          : <span className="asc-price-now">{THB(p.price)}</span>}
                      </div>
                    </div>
                    {/* แถว 2: คงเหลือ + ปุ่มแสดง/ซ่อน (ชิดขวา) */}
                    <div className="asc-row asc-row-status">
                      <span className={`asc-stock ${p.stock <= 0 ? 'out' : ''}`}>คงเหลือ {p.stock}</span>
                      <button
                        className="admin-btn asc-status-btn"
                        onClick={() => toggleActive(p)}
                        style={isActive
                          ? { background: '#e8f5e9', color: '#2e7d32', borderColor: '#a5d6a7' }
                          : { background: '#fbe9e7', color: '#c62828', borderColor: '#ffab91' }}
                      >{isActive ? 'แสดงอยู่' : 'ซ่อนอยู่'}</button>
                    </div>
                    {/* แถว 3: ปุ่มจัดการ แก้ไข/ทำสำเนา/ลบ (ชิดขวา) */}
                    <div className="asc-row asc-row-actions">
                      <a className="admin-btn" href={`/admin/shop/new/edit/${p.id}`}>แก้ไข</a>
                      <a className="admin-btn" href={`/admin/shop/new/duplicate/${p.id}`}>ทำสำเนา</a>
                      <button className="admin-btn-danger" onClick={() => remove(p.id)}>ลบ</button>
                    </div>
                  </div>
                )
              })}
              {filtered.length === 0 && (
                <p style={{ textAlign: 'center', color: '#999', padding: '30px 0' }}>ยังไม่มีสินค้า — <a href="/admin/shop/new">เพิ่มสินค้าใหม่</a></p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  </VolunteerGuard>)
}
