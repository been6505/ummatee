import { useEffect, useMemo, useState } from 'react'
import VolunteerGuard from '../components/VolunteerGuard.jsx'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import {
  useProducts, addProduct, updateProduct, csvToList,
  usePromotions, addPromotion, deletePromotion, applyPromotion, SHOP_SIZES_BY_CATEGORY,
} from '../data/shop.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faImage, faXmark, faSpinner, faTag, faCamera } from '@fortawesome/free-solid-svg-icons'

import { uploadToCloudinary } from '../utils/cloudinary.js'

// เพิ่มสินค้าใหม่ / แก้ไขสินค้า / โปรโมชั่น (/admin/shop/new) — แยกออกมาจาก /admin/shop เพื่อให้หน้ารายการสินค้าโล่งขึ้น
// รับ mode + productId ผ่าน path แบบไดนามิก: /admin/shop/new/edit/<id> หรือ /admin/shop/new/duplicate/<id>

const SHOP_CATEGORIES = ['หมวก', 'เสื้อ', 'กระบอกน้ำ', 'กระเป๋า', 'สติกเกอร์']
const SHOP_TYPES_BY_CATEGORY = { 'เสื้อ': ['แขนสั้น', 'แขนยาว', 'เด็กเล็ก'] }

const THB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH')

const EMPTY_FORM = {
  productId: '', name: '', price: '', stock: '', category: '', type: '', description: '',
  colors: '', sizes: '', sizeStock: {}, images: [], promoId: '',
}

const nextProductId = (products) => {
  const nums = products
    .map((p) => /^um(\d+)$/i.exec((p.productId || '').trim()))
    .filter(Boolean)
    .map((m) => parseInt(m[1], 10))
  const max = nums.length ? Math.max(...nums) : 0
  return 'um' + String(max + 1).padStart(3, '0')
}

const EMPTY_PROMO = { label: '', type: 'percent', value: '' }

export default function AdminShopNew({ mode, seedId }) {
  const { user, loading } = useAdminAuth()
  const { products, loading: prodLoading } = useProducts()
  const { promotions, loading: promoLoading } = usePromotions()

  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [origStock, setOrigStock] = useState(null)
  const [status, setStatus] = useState('')
  const [uploading, setUploading] = useState(false)
  const [seeded, setSeeded] = useState(false)

  const [promoForm, setPromoForm] = useState(EMPTY_PROMO)
  const [promoStatus, setPromoStatus] = useState('')

  const suggestedId = useMemo(() => nextProductId(products), [products])

  // โหลดสินค้าต้นทางตาม mode (edit/duplicate) ครั้งเดียวเมื่อข้อมูลสินค้าพร้อม
  useEffect(() => {
    if (seeded || prodLoading || !seedId) return
    const p = products.find((x) => x.id === seedId)
    if (!p) return
    if (mode === 'edit') {
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
      setOrigStock({ stock: p.stock ?? '', sizeStock: JSON.stringify(p.sizeStock || {}) })
    } else if (mode === 'duplicate') {
      setForm({
        ...EMPTY_FORM,
        productId: '',
        name: p.name || '',
        category: p.category || '',
        type: p.type || '',
        description: p.description || '',
        price: p.price ?? '',
      })
      setStatus('ทำสำเนาแล้ว — กรอกสี/จำนวน/รูป ของตัวเลือกใหม่ แล้วกด "เพิ่มสินค้า"')
    }
    setSeeded(true)
  }, [seeded, prodLoading, seedId, mode, products])

  // เติมรหัสสินค้าอัตโนมัติเฉพาะโหมด "เพิ่มใหม่/ทำสำเนา" เท่านั้น — โหมดแก้ไขห้ามเติม
  // (กันเคส race: seed effect เพิ่งตั้ง productId=รหัสจริง แต่ editId ยังไม่อัปเดตในเฟรมเดียวกัน แล้วโดนเขียนทับด้วยรหัสถัดไป)
  useEffect(() => {
    if (mode === 'edit') return
    if (!editId && !form.productId && !prodLoading) {
      setForm((f) => ({ ...f, productId: suggestedId }))
    }
  }, [mode, editId, form.productId, prodLoading, suggestedId])

  const knownColors = useMemo(() => {
    const set = new Set()
    products.forEach((p) => (p.colors || []).forEach((c) => c && set.add(c)))
    return [...set].sort()
  }, [products])

  const knownNames = useMemo(() => {
    const set = new Set()
    products.forEach((p) => p.name && set.add(p.name))
    return [...set].sort()
  }, [products])

  const typeOptions = SHOP_TYPES_BY_CATEGORY[form.category] || []
  const sizeOptions = SHOP_SIZES_BY_CATEGORY[form.category] || []
  const selectedSizes = csvToList(form.sizes)
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

  const categories = useMemo(() => {
    const fromProducts = products.map((p) => p.category).filter(Boolean)
    const set = new Set([...SHOP_CATEGORIES, ...fromProducts])
    return [...set]
  }, [products])

  if (loading) return null
  if (!user) return <AdminLogin />

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

  const cancelEdit = () => { setEditId(null); setForm(EMPTY_FORM); setOrigStock(null) }

  const save = async () => {
    if (!form.name.trim()) { setStatus('กรุณากรอกชื่อสินค้า'); return }
    setStatus('กำลังบันทึก...')
    try {
      const priceNum = Number(form.price) || 0
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
      if (form.promoId) {
        const promo = promotions.find((p) => p.id === form.promoId)
        if (promo) payload.discountPrice = applyPromotion(priceNum, promo)
      }
      if (editId && origStock
          && String(form.stock) === String(origStock.stock)
          && JSON.stringify(sizeStockClean ?? {}) === (hasSizeStock ? origStock.sizeStock : JSON.stringify({}))) {
        delete payload.stock
        delete payload.sizeStock
        if (hasSizeStock) delete payload.sizes
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
            <h1>{editId ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'} / โปรโมชั่น</h1>
            <p>บันทึกแล้วกลับไปดูรายการที่ <a href="/admin/shop">/admin/shop</a></p>
          </div>
          <a className="admin-btn" href="/admin/shop">กลับไปรายการสินค้า</a>
        </div>

        <div className="admin-shop-top-grid">
        <div className="admin-card admin-shop-form-card">
          <h4>{editId ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h4>
          <div className="admin-form-grid admin-form-grid-3col">
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
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label className="admin-upload-btn" style={{ opacity: uploading ? .6 : 1, pointerEvents: uploading ? 'none' : 'auto' }}>
                  <FontAwesomeIcon icon={uploading ? faSpinner : faImage} spin={uploading} />
                  {uploading ? ' กำลังอัพโหลด...' : ' เลือกรูปภาพสินค้า'}
                  <input type="file" accept="image/*" multiple hidden onChange={uploadImages} />
                </label>
                <label className="admin-upload-btn" style={{ opacity: uploading ? .6 : 1, pointerEvents: uploading ? 'none' : 'auto' }} title="ถ่ายภาพด้วยกล้อง">
                  <FontAwesomeIcon icon={faCamera} />
                  {' ถ่ายภาพ'}
                  <input type="file" accept="image/*" capture="environment" hidden onChange={uploadImages} />
                </label>
              </div>
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
      </div>
    </main>
  </VolunteerGuard>)
}
