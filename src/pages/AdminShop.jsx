import { useMemo, useState } from 'react'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { useProducts, addProduct, updateProduct, deleteProduct, csvToList } from '../data/shop.js'

// จัดการสินค้า Um Shop (/admin/shop) — เพิ่ม/แก้ไข/ลบสินค้า หลายรายการ พร้อมค้นหา/กรอง/เรียง
// รูปภาพใช้เป็น URL (วางลิงก์รูป เช่นจาก Firebase Storage/Imgur/Drive ที่แชร์แบบสาธารณะ) — รองรับหลายรูปต่อสินค้า

const THB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH')

const EMPTY_FORM = {
  name: '', price: '', stock: '', category: '', description: '',
  colors: '', sizes: '', images: '',
}

export default function AdminShop() {
  const { user, loading } = useAdminAuth()
  const { products, loading: prodLoading } = useProducts()

  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [status, setStatus] = useState('')

  // ค้นหา/กรอง/เรียง
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean))
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
  const arrow = (key) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '')

  const startEdit = (p) => {
    setEditId(p.id)
    setForm({
      name: p.name || '',
      price: p.price ?? '',
      stock: p.stock ?? '',
      category: p.category || '',
      description: p.description || '',
      colors: (p.colors || []).join(', '),
      sizes: (p.sizes || []).join(', '),
      images: (p.images || []).join('\n'),
    })
    setStatus('')
  }
  const cancelEdit = () => { setEditId(null); setForm(EMPTY_FORM) }

  const save = async () => {
    if (!form.name.trim()) { setStatus('กรุณากรอกชื่อสินค้า'); return }
    setStatus('กำลังบันทึก...')
    try {
      const payload = {
        name: form.name.trim(),
        price: Number(form.price) || 0,
        stock: Number(form.stock) || 0,
        category: form.category.trim(),
        description: form.description.trim(),
        colors: csvToList(form.colors),
        sizes: csvToList(form.sizes),
        images: String(form.images || '').split('\n').map((s) => s.trim()).filter(Boolean),
      }
      if (editId) await updateProduct(editId, payload)
      else await addProduct(payload)
      cancelEdit()
      setStatus('บันทึกสำเร็จ ✓')
      setTimeout(() => setStatus(''), 2000)
    } catch (e) {
      setStatus('เกิดข้อผิดพลาด: ' + e.message)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('ลบสินค้านี้?')) return
    try { await deleteProduct(id) } catch (e) { window.alert('ลบไม่สำเร็จ: ' + e.message) }
  }

  return (
    <main className="admin-dash admin-qurban">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1>จัดการสินค้า Um Shop</h1>
            <p>เพิ่ม/แก้ไขสินค้า — แสดงผลที่หน้า <a href="/um-shop">/um-shop</a> ทันที</p>
          </div>
        </div>

        <div className="admin-card" style={{ marginBottom: 24 }}>
          <h4>{editId ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h4>
          <div className="admin-form-grid">
            <label>ชื่อสินค้า
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น เสื้อ Ummatee" />
            </label>
            <label>ราคา (บาท)
              <input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </label>
            <label>จำนวนคงเหลือ (stock)
              <input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </label>
            <label>หมวดหมู่
              <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="เช่น เสื้อผ้า" />
            </label>
            <label>สี (คั่นด้วย ,)
              <input type="text" value={form.colors} onChange={(e) => setForm({ ...form, colors: e.target.value })} placeholder="ดำ, ขาว, เขียว" />
            </label>
            <label>ขนาด (คั่นด้วย ,)
              <input type="text" value={form.sizes} onChange={(e) => setForm({ ...form, sizes: e.target.value })} placeholder="S, M, L, XL" />
            </label>
          </div>
          <div className="admin-form-grid" style={{ marginTop: 16 }}>
            <label style={{ gridColumn: '1 / -1' }}>รายละเอียดสินค้า
              <textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>ลิงก์รูปภาพ (หนึ่งลิงก์ต่อบรรทัด — รูปแรกใช้เป็นรูปหลัก)
              <textarea rows="3" value={form.images} onChange={(e) => setForm({ ...form, images: e.target.value })} placeholder={'https://...\nhttps://...'} />
            </label>
          </div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="admin-btn-primary" onClick={save}>{editId ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}</button>
            {editId && <button className="admin-btn" onClick={cancelEdit}>ยกเลิก</button>}
            {status && <span>{status}</span>}
          </div>
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
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>รูป</th>
                    <th className="admin-th-sort" onClick={sortBtn('name')}>ชื่อสินค้า{arrow('name')}</th>
                    <th className="admin-th-sort" onClick={sortBtn('category')}>หมวดหมู่{arrow('category')}</th>
                    <th className="admin-th-sort" onClick={sortBtn('price')}>ราคา{arrow('price')}</th>
                    <th className="admin-th-sort" onClick={sortBtn('stock')}>คงเหลือ{arrow('stock')}</th>
                    <th>สี/ขนาด</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id}>
                      <td>{p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="admin-shop-thumb" /> : '—'}</td>
                      <td>{p.name}</td>
                      <td>{p.category || '—'}</td>
                      <td>{THB(p.price)}</td>
                      <td style={p.stock <= 0 ? { color: '#d84315', fontWeight: 700 } : {}}>{p.stock}</td>
                      <td>{[...(p.colors || []), ...(p.sizes || [])].join(', ') || '—'}</td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="admin-btn" onClick={() => startEdit(p)}>แก้ไข</button>
                        <button className="admin-btn-danger" onClick={() => remove(p.id)}>ลบ</button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan="7" style={{ textAlign: 'center', color: '#999' }}>ยังไม่มีสินค้า — เพิ่มจากฟอร์มด้านบน</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
