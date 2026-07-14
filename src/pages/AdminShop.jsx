import { useEffect, useMemo, useState } from 'react'
import VolunteerGuard from '../components/VolunteerGuard.jsx'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import {
  useProducts, addProduct, updateProduct, deleteProduct, csvToList,
  usePromotions, addPromotion, deletePromotion, applyPromotion, SHOP_SIZES_BY_CATEGORY,
} from '../data/shop.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCaretUp, faCaretDown, faImage, faXmark, faSpinner, faTag, faPencil, faCheck } from '@fortawesome/free-solid-svg-icons'

import { uploadToCloudinary } from '../utils/cloudinary.js'

// จัดการสินค้า Um Shop (/admin/shop) — เพิ่ม/แก้ไข/ลบสินค้า หลายรายการ พร้อมค้นหา/กรอง/เรียง

const SHOP_CATEGORIES = ['หมวก', 'เสื้อ', 'กระบอกน้ำ', 'กระเป๋า', 'สติกเกอร์']
// ประเภท เฉพาะหมวดหมู่ "เสื้อ" เท่านั้น — หมวดหมู่อื่นยังไม่มีตัวเลือกสำเร็จรูป (ใส่เองในช่องขนาดได้)
// ลำดับไซซ์ (S,M,L,XL,...) ใช้ค่ากลางจาก data/pricing.js ร่วมกับหน้า public เพื่อให้ลำดับตรงกันเสมอ
const SHOP_TYPES_BY_CATEGORY = { 'เสื้อ': ['แขนสั้น', 'แขนยาว', 'เด็กเล็ก'] }

const THB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH')

const EMPTY_FORM = {
  productId: '', name: '', price: '', stock: '', category: '', type: '', description: '',
  colors: '', sizes: '', sizeStock: {}, images: [], promoId: '',
}

// รหัสสินค้า um001, um002, ... — คำนวณเลขถัดไปจากรหัสสูงสุดที่มีอยู่
const nextProductId = (products) => {
  const nums = products
    .map((p) => /^um(\d+)$/i.exec((p.productId || '').trim()))
    .filter(Boolean)
    .map((m) => parseInt(m[1], 10))
  const max = nums.length ? Math.max(...nums) : 0
  return 'um' + String(max + 1).padStart(3, '0')
}

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
  const { promotions, loading: promoLoading } = usePromotions()

  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [status, setStatus] = useState('')
  const [uploading, setUploading] = useState(false)

  const [promoForm, setPromoForm] = useState(EMPTY_PROMO)
  const [promoStatus, setPromoStatus] = useState('')

  // ค้นหา/กรอง/เรียง
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [sortKey, setSortKey] = useState('productId')
  const [sortDir, setSortDir] = useState('asc')

  const suggestedId = useMemo(() => nextProductId(products), [products])

  // เติมรหัสสินค้าให้อัตโนมัติตอนเพิ่มสินค้าใหม่ (ไม่ยุ่งตอนแก้ไขสินค้าเดิม หรือถ้าผู้ใช้พิมพ์เองแล้ว)
  useEffect(() => {
    if (!editId && !form.productId && !prodLoading) {
      setForm((f) => ({ ...f, productId: suggestedId }))
    }
  }, [editId, form.productId, prodLoading, suggestedId])

  const categories = useMemo(() => {
    const fromProducts = products.map((p) => p.category).filter(Boolean)
    const set = new Set([...SHOP_CATEGORIES, ...fromProducts])
    return [...set]
  }, [products])

  // สีที่เคยกรอกไว้แล้วในสินค้าอื่น — เสนอเป็นตัวเลือกใน dropdown (datalist) ตอนกรอกครั้งถัดไป
  const knownColors = useMemo(() => {
    const set = new Set()
    products.forEach((p) => (p.colors || []).forEach((c) => c && set.add(c)))
    return [...set].sort()
  }, [products])

  // ชื่อสินค้าที่เคยใส่ไว้แล้ว — เสนอเป็นตัวเลือกใน dropdown (datalist) ตอนกรอกครั้งถัดไป
  const knownNames = useMemo(() => {
    const set = new Set()
    products.forEach((p) => p.name && set.add(p.name))
    return [...set].sort()
  }, [products])

  const typeOptions = SHOP_TYPES_BY_CATEGORY[form.category] || []
  const sizeOptions = SHOP_SIZES_BY_CATEGORY[form.category] || []
  const selectedSizes = csvToList(form.sizes)
  // เพิ่ม/เอาไซซ์ออก — ตอนเพิ่มเริ่มจำนวนที่ 0 (แอดมินค่อยกรอกจำนวนจริงทีหลัง), ตอนเอาออกลบ key ออกจาก sizeStock ด้วย
  const toggleSizeChip = (sz) => {
    const cur = csvToList(form.sizes)
    if (cur.includes(sz)) {
      const next = cur.filter((s) => s !== sz)
      setForm((f) => { const sizeStock = { ...f.sizeStock }; delete sizeStock[sz]; return { ...f, sizes: next.join(', '), sizeStock } })
    } else {
      const next = [...cur, sz]
      setForm((f) => ({ ...f, sizes: next.join(', '), sizeStock: { ...f.sizeStock, [sz]: f.sizeStock[sz] ?? 0 } }))
    }
  }
  const setSizeQty = (sz, qty) => setForm((f) => ({ ...f, sizeStock: { ...f.sizeStock, [sz]: qty } }))
  const sizeStockTotal = Object.values(form.sizeStock).reduce((s, v) => s + (Number(v) || 0), 0)

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

  const uploadImages = async (e) => {
    const files = [...e.target.files]
    if (!files.length) return
    setUploading(true)
    try {
      const results = await Promise.all(files.map((f) => uploadToCloudinary(f, 'image')))
      setForm((f) => ({ ...f, images: [...f.images, ...results.map((r) => r.url)] }))
    } catch (err) {
      setStatus('อัพโหลดไม่สำเร็จ: ' + err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removeImage = (i) => setForm((f) => ({ ...f, images: f.images.filter((_, j) => j !== i) }))

  const startEdit = (p) => {
    setEditId(p.id)
    setForm({
      productId: p.productId || '',
      name: p.name || '',
      price: p.price ?? '',
      stock: p.stock ?? '',
      category: p.category || '',
      type: p.type || '',
      description: p.description || '',
      colors: (p.colors || []).join(', '),
      sizes: (p.sizes || []).join(', '),
      sizeStock: p.sizeStock || {},
      images: p.images || [],
      promoId: '',
    })
    setStatus('')
  }
  const cancelEdit = () => { setEditId(null); setForm(EMPTY_FORM) }

  const save = async () => {
    if (!form.name.trim()) { setStatus('กรุณากรอกชื่อสินค้า'); return }
    setStatus('กำลังบันทึก...')
    try {
      const priceNum = Number(form.price) || 0
      // สินค้าที่มีตัวเลือกไซซ์มาตรฐาน (เสื้อ) นับสต็อกแยกต่อไซซ์ — stock รวมคำนวณจากผลรวมอัตโนมัติ
      // เพื่อให้หน้า public ปิดปุ่มไซซ์ที่ของหมดได้ทีละไซซ์ (ไม่ใช่ปิดทั้งสีทีเดียวเหมือนเดิม)
      const hasSizeStock = sizeOptions.length > 0
      const sizeStockClean = hasSizeStock
        ? Object.fromEntries(Object.entries(form.sizeStock).map(([k, v]) => [k, Number(v) || 0]))
        : null
      const payload = {
        productId: form.productId.trim() || suggestedId,
        name: form.name.trim(),
        price: priceNum,
        stock: hasSizeStock ? sizeStockTotal : (Number(form.stock) || 0),
        category: form.category.trim(),
        type: form.type.trim(),
        description: form.description.trim(),
        colors: csvToList(form.colors),
        sizes: hasSizeStock ? Object.keys(sizeStockClean).filter((k) => sizeStockClean[k] > 0) : csvToList(form.sizes),
        sizeStock: sizeStockClean,
        images: form.images,
      }
      // เลือกโปรโมชั่นในฟอร์ม → คำนวณราคาส่วนลดจากราคาปัจจุบันแล้วบันทึกไปด้วย (ไม่เลือก = ไม่แตะราคาส่วนลดเดิม)
      if (form.promoId) {
        const promo = promotions.find((p) => p.id === form.promoId)
        if (promo) payload.discountPrice = applyPromotion(priceNum, promo)
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

  const toggleActive = (p) => updateProduct(p.id, { active: p.active === false })

  const remove = async (id) => {
    if (!window.confirm('ลบสินค้านี้?')) return
    try { await deleteProduct(id) } catch (e) { window.alert('ลบไม่สำเร็จ: ' + e.message) }
  }

  const saveNewPromotion = async () => {
    if (!promoForm.label.trim()) { setPromoStatus('กรุณาตั้งชื่อโปรโมชั่น'); return }
    const val = Number(promoForm.value)
    if (!promoForm.value || isNaN(val) || val <= 0) { setPromoStatus('กรุณากรอกจำนวนส่วนลด'); return }
    setPromoStatus('กำลังบันทึก...')
    try {
      await addPromotion({ label: promoForm.label.trim(), type: promoForm.type, value: val })
      setPromoForm(EMPTY_PROMO)
      setPromoStatus('')
    } catch (e) {
      setPromoStatus('เกิดข้อผิดพลาด: ' + e.message)
    }
  }

  const removePromotion = async (id) => {
    if (!window.confirm('ลบโปรโมชั่นนี้?')) return
    try { await deletePromotion(id) } catch (e) { window.alert('ลบไม่สำเร็จ: ' + e.message) }
  }

  return (<VolunteerGuard>
    <main className="admin-dash admin-qurban admin-shop-wide">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1>จัดการสินค้า Um Shop</h1>
            <p>เพิ่ม/แก้ไขสินค้า — แสดงผลที่หน้า <a href="/um-shop">/um-shop</a> ทันที</p>
          </div>
        </div>

        <div className="admin-shop-top-grid">
        <div className="admin-card">
          <h4>{editId ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h4>
          <div className="admin-form-grid admin-form-grid-3col">
            {/* แถว 1: รหัสสินค้า / ชื่อสินค้า / หมวดหมู่ */}
            <label>รหัสสินค้า
              <input type="text" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} placeholder={suggestedId} />
            </label>
            <label>ชื่อสินค้า
              <input
                type="text" list="knownNamesList" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น เสื้อ Ummatee"
              />
              <datalist id="knownNamesList">
                {knownNames.map((n) => <option key={n} value={n} />)}
              </datalist>
            </label>
            <label>หมวดหมู่
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">— เลือกหมวดหมู่ —</option>
                {SHOP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            {/* แถว 2: สี / ขนาด / ประเภท — ประเภท+ตัวเลือกขนาดด่วน ขึ้นอยู่กับหมวดหมู่ที่เลือก */}
            <label>สี (คั่นด้วย ,)
              <input
                type="text" list="knownColorsList" value={form.colors}
                onChange={(e) => setForm({ ...form, colors: e.target.value })}
                placeholder="ดำ, ขาว, เขียว"
              />
              <datalist id="knownColorsList">
                {knownColors.map((c) => <option key={c} value={c} />)}
              </datalist>
            </label>
            <label>ขนาด
              {sizeOptions.length > 0 ? (
                <>
                  <select value="" onChange={(e) => { if (e.target.value) toggleSizeChip(e.target.value) }}>
                    <option value="">+ เพิ่มขนาด — {selectedSizes.length ? selectedSizes.join(', ') : 'ยังไม่เลือก'}</option>
                    {sizeOptions.map((sz) => (
                      <option key={sz} value={sz}>{selectedSizes.includes(sz) ? `✓ ${sz} (กดเพื่อเอาออก)` : sz}</option>
                    ))}
                  </select>
                  {selectedSizes.length > 0 && (
                    <div className="size-stock-rows">
                      {selectedSizes.map((sz) => (
                        <div key={sz} className="size-stock-row">
                          <span className="size-chip selected">{sz}</span>
                          <input
                            type="number" min="0" className="size-stock-input"
                            value={form.sizeStock[sz] ?? 0}
                            onChange={(e) => setSizeQty(sz, e.target.value)}
                            placeholder="จำนวน"
                          />
                          <button type="button" className="size-stock-remove" onClick={() => toggleSizeChip(sz)} aria-label={`เอาไซซ์ ${sz} ออก`}>
                            <FontAwesomeIcon icon={faXmark} />
                          </button>
                        </div>
                      ))}
                      <div className="size-stock-total">รวมทุกไซซ์: {sizeStockTotal} ชิ้น</div>
                    </div>
                  )}
                </>
              ) : (
                <input type="text" value={form.sizes} onChange={(e) => setForm({ ...form, sizes: e.target.value })} placeholder="S, M, L, XL (คั่นด้วย ,)" />
              )}
            </label>
            <label>ประเภท
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} disabled={typeOptions.length === 0}>
                <option value="">{typeOptions.length ? '— เลือกประเภท —' : 'ไม่มีตัวเลือกสำหรับหมวดหมู่นี้'}</option>
                {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>

            {/* แถว 3: ราคา / จำนวนคงเหลือ / โปรโมชั่น */}
            <label>ราคา (บาท)
              <input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </label>
            <label>จำนวนคงเหลือ (stock)
              {sizeOptions.length > 0
                ? <input type="number" value={sizeStockTotal} disabled title="คำนวณรวมจากจำนวนแต่ละไซซ์ด้านบนอัตโนมัติ — แก้ที่ช่องไซซ์แทน" />
                : <input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />}
            </label>
            <label>โปรโมชั่น
              <select value={form.promoId} onChange={(e) => setForm({ ...form, promoId: e.target.value })}>
                <option value="">— ไม่ใช้โปรโมชั่น —</option>
                {promotions.map((promo) => (
                  <option key={promo.id} value={promo.id}>
                    {promo.label} ({promo.type === 'percent' ? `${promo.value}%` : THB(promo.value)})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="admin-form-grid admin-form-grid-2col" style={{ marginTop: 16 }}>
            <label>รายละเอียดสินค้า
              <textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <div>
              <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 8 }}>รูปภาพสินค้า (รูปแรกเป็นรูปหลัก)</div>
              <label className="admin-upload-btn" style={{ opacity: uploading ? .6 : 1, pointerEvents: uploading ? 'none' : 'auto' }}>
                <FontAwesomeIcon icon={uploading ? faSpinner : faImage} spin={uploading} />
                {uploading ? ' กำลังอัพโหลด...' : ' เลือกรูปภาพสินค้า'}
                <input type="file" accept="image/*" multiple hidden onChange={uploadImages} />
              </label>
              {form.images.length > 0 && (
                <div className="admin-media-preview" style={{ marginTop: 10 }}>
                  {form.images.map((url, i) => (
                    <div key={i} className="admin-media-thumb">
                      <img src={url} alt="" />
                      {i === 0 && <span className="admin-media-main">หลัก</span>}
                      <button type="button" className="admin-media-remove" onClick={() => removeImage(i)}><FontAwesomeIcon icon={faXmark} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="admin-btn-primary" onClick={save}>{editId ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}</button>
            {editId && <button className="admin-btn" onClick={cancelEdit}>ยกเลิก</button>}
            {status && <span>{status}</span>}
          </div>
        </div>

        <div className="admin-card">
          <h4><FontAwesomeIcon icon={faTag} /> โปรโมชั่น</h4>
          <p style={{ fontSize: '.82rem', color: 'var(--ink-soft)', marginBottom: 12 }}>
            ตั้งส่วนลดไว้เป็นชิป แล้วเลือกใช้ได้ทันทีในคอลัมน์ "ราคาส่วนลด" ของแต่ละสินค้า
          </p>

          {promoLoading ? <p style={{ fontSize: '.85rem', color: 'var(--ink-soft)' }}>กำลังโหลด...</p> : (
            promotions.length > 0 && (
              <div className="promo-list">
                <div className="promo-list-head">โปรโมชั่นทั้งหมด ({promotions.length})</div>
                {promotions.map((promo) => (
                  <div key={promo.id} className="promo-list-row">
                    <span className="promo-list-name">{promo.label}</span>
                    <span className="promo-list-value">
                      {promo.type === 'percent' ? `ลด ${promo.value}%` : `ลด ${THB(promo.value)}`}
                    </span>
                    <button
                      type="button"
                      className="promo-list-remove"
                      onClick={() => removePromotion(promo.id)}
                      aria-label={`ลบโปรโมชั่น ${promo.label}`}
                    >
                      <FontAwesomeIcon icon={faXmark} />
                    </button>
                  </div>
                ))}
              </div>
            )
          )}

          <div className="admin-form-grid">
            <label>ชื่อโปรโมชั่น
              <input
                type="text" value={promoForm.label}
                onChange={(e) => setPromoForm({ ...promoForm, label: e.target.value })}
                placeholder="เช่น ลดรับรอมฎอน"
              />
            </label>
            <label>ประเภทส่วนลด
              <select value={promoForm.type} onChange={(e) => setPromoForm({ ...promoForm, type: e.target.value })}>
                <option value="percent">เปอร์เซ็นต์ (%)</option>
                <option value="amount">จำนวนเงิน (บาท)</option>
              </select>
            </label>
            <label>ค่าส่วนลด
              <input
                type="number" min="0" value={promoForm.value}
                onChange={(e) => setPromoForm({ ...promoForm, value: e.target.value })}
                placeholder={promoForm.type === 'percent' ? 'เช่น 10' : 'เช่น 50'}
              />
            </label>
          </div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="admin-btn-primary" onClick={saveNewPromotion}>เพิ่มโปรโมชั่น</button>
            {promoStatus && <span style={{ fontSize: '.82rem', color: promoStatus.startsWith('เกิด') || promoStatus.startsWith('กรุณา') ? '#dc2626' : 'var(--ink-soft)' }}>{promoStatus}</span>}
          </div>
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
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="admin-btn" onClick={() => startEdit(p)}>แก้ไข</button>
                        <button className="admin-btn-danger" onClick={() => remove(p.id)}>ลบ</button>
                      </td>
                    </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan="11" style={{ textAlign: 'center', color: '#999' }}>ยังไม่มีสินค้า — เพิ่มจากฟอร์มด้านบน</td></tr>
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
