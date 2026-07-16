import { useEffect, useState } from 'react'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { useAnnouncement, saveAnnouncement } from '../data/announcement.js'
import { useNavVisibility, saveNavVisibility, NAV_MENU_ITEMS } from '../data/navVisibility.js'
import { useHomeCards, saveHomeCards, EMPTY_CARD, CARD_COLORS, DEFAULT_HOME_CARDS } from '../data/homeCards.js'
import { uploadToCloudinary } from '../utils/cloudinary.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGlobe, faBullhorn, faCheck, faBars, faImage, faSpinner, faXmark, faArrowUp, faArrowDown, faPlus, faNewspaper, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons'

// จัดการเว็บฝั่ง public (/admin/website) — เมนู nav, แบนเนอร์ประกาศ และการ์ด Hero Feed หน้าแรก (แบบ CMS)
// เขียนที่ config/announcement + config/homeCards (public อ่านได้ทุกคน, แก้ได้เฉพาะแอดมิน — ดู firestore.rules)

// ── ตัวแก้ไขการ์ดหน้าแรก 1 ใบ ──
function CardEditor({ card, index, total, onChange, onMove, onRemove }) {
  const [uploading, setUploading] = useState(false)

  const set = (k) => (e) => onChange({ ...card, [k]: e.target.value })

  const uploadImages = async (e) => {
    const files = [...e.target.files]
    if (!files.length) return
    setUploading(true)
    try {
      const results = await Promise.all(files.map((f) => uploadToCloudinary(f, 'image')))
      onChange({ ...card, images: [...(card.images || []), ...results.map((r) => r.url)] })
    } catch (err) {
      window.alert('อัพโหลดไม่สำเร็จ: ' + err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }
  const removeImage = (i) => onChange({ ...card, images: card.images.filter((_, j) => j !== i) })

  return (
    <div className="admin-card" style={{ marginBottom: 14, borderLeft: card.enabled ? '4px solid var(--green-mid)' : '4px solid #ffab91' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <strong style={{ marginRight: 'auto' }}>การ์ดที่ {index + 1}{card.title ? ` — ${card.title}` : ''}</strong>
        <button type="button" className="admin-btn" disabled={index === 0} onClick={() => onMove(index, -1)} title="เลื่อนขึ้น"><FontAwesomeIcon icon={faArrowUp} /></button>
        <button type="button" className="admin-btn" disabled={index === total - 1} onClick={() => onMove(index, 1)} title="เลื่อนลง"><FontAwesomeIcon icon={faArrowDown} /></button>
        <button
          type="button" className="admin-btn"
          onClick={() => onChange({ ...card, enabled: !card.enabled })}
          style={card.enabled
            ? { background: '#e8f5e9', color: '#2e7d32', borderColor: '#a5d6a7' }
            : { background: '#fbe9e7', color: '#c62828', borderColor: '#ffab91' }}
        >{card.enabled ? 'แสดงอยู่' : 'ซ่อนอยู่'}</button>
        <button type="button" className="admin-btn-danger" style={{ padding: '8px 14px', fontSize: '.82rem' }} onClick={() => onRemove(index)}>ลบ</button>
      </div>

      <div className="admin-form-grid admin-form-grid-3col">
        <label>ป้ายหลัก (tag)
          <input type="text" value={card.tag} onChange={set('tag')} placeholder="เช่น 🌙 EVENT" />
        </label>
        <label>ป้ายรอง
          <input type="text" value={card.tag2} onChange={set('tag2')} placeholder="เช่น Gaza / 3–5 ก.ค. 2569" />
        </label>
        <label>สีปุ่ม
          <select value={card.color} onChange={set('color')}>
            {CARD_COLORS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <label>หัวข้อการ์ด
          <input type="text" value={card.title} onChange={set('title')} placeholder="เช่น Iftar For Gaza" />
        </label>
        <label>ข้อความปุ่ม
          <input type="text" value={card.btnText} onChange={set('btnText')} placeholder="เช่น ดูรายละเอียด" />
        </label>
        <label>ลิงก์ (path ภายในเว็บ)
          <input type="text" value={card.link} onChange={set('link')} placeholder="เช่น /event/iftar-for-gaza" />
        </label>
      </div>
      <label style={{ display: 'block', marginTop: 12, fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)' }}>
        คำอธิบาย
        <textarea rows="2" value={card.desc} onChange={set('desc')} style={{ display: 'block', width: '100%', marginTop: 6, fontWeight: 400, boxSizing: 'border-box', fontFamily: 'inherit', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd' }} />
      </label>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 8 }}>รูปโปสเตอร์ (หลายรูป = สไลด์วนอัตโนมัติ)</div>
        <label className="admin-upload-btn" style={{ opacity: uploading ? .6 : 1, pointerEvents: uploading ? 'none' : 'auto' }}>
          <FontAwesomeIcon icon={uploading ? faSpinner : faImage} spin={uploading} />
          {uploading ? ' กำลังอัพโหลด...' : ' เลือกรูป'}
          <input type="file" accept="image/*" multiple hidden onChange={uploadImages} />
        </label>
        {(card.images || []).length > 0 && (
          <div className="admin-media-preview" style={{ marginTop: 10 }}>
            {card.images.map((url, i) => (
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
  )
}

export default function AdminWebsite() {
  const { user, loading } = useAdminAuth()
  const { announcement, loading: annLoading } = useAnnouncement()
  const { visibility, loading: navLoading } = useNavVisibility()
  const { cards: savedCards, loading: cardsLoading } = useHomeCards(true)

  const [navSaving, setNavSaving] = useState(false)
  const [navSaved, setNavSaved] = useState(false)

  // การ์ดหน้าแรก — แก้ในเครื่องก่อน กด "บันทึกการ์ดหน้าแรก" ค่อยเขียนขึ้น Firestore ทีเดียว
  const [cards, setCards] = useState(null)
  const [cardsDirty, setCardsDirty] = useState(false)
  const [cardsSaving, setCardsSaving] = useState(false)
  const [cardsSaved, setCardsSaved] = useState(false)
  useEffect(() => {
    // sync จาก Firestore เฉพาะตอนโหลดเสร็จและยังไม่ได้แก้อะไรในเครื่อง — กันทับงานที่กำลังพิมพ์อยู่
    // ถ้าแอดมินยังไม่เคยบันทึก (savedCards === null) ให้เริ่มจากการ์ดมาตรฐาน 3 ใบ เพื่อให้แก้/บันทึกต่อได้เลย
    if (cardsLoading || cardsDirty) return
    setCards(savedCards !== null ? savedCards : DEFAULT_HOME_CARDS)
  }, [savedCards, cardsLoading, cardsDirty])

  const [enabled, setEnabled] = useState(false)
  const [text, setText] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!announcement) return
    setEnabled(!!announcement.enabled)
    setText(announcement.text || '')
    setLinkUrl(announcement.linkUrl || '')
    setLinkText(announcement.linkText || '')
  }, [announcement])

  if (loading) return null
  if (!user) return <AdminLogin />

  const save = async () => {
    setSaving(true)
    try {
      await saveAnnouncement({
        enabled,
        text: text.trim(),
        linkUrl: linkUrl.trim(),
        linkText: linkText.trim(),
        updatedAt: Date.now(),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } finally {
      setSaving(false)
    }
  }

  const setNavItem = async (key, show) => {
    setNavSaving(true)
    try {
      await saveNavVisibility({ [key]: show })
      setNavSaved(true)
      setTimeout(() => setNavSaved(false), 1200)
    } finally {
      setNavSaving(false)
    }
  }

  // ── จัดการการ์ดหน้าแรก ──
  const updateCard = (i, next) => { setCards((cs) => cs.map((c, j) => (j === i ? next : c))); setCardsDirty(true) }
  const moveCard = (i, dir) => {
    setCards((cs) => {
      const next = [...cs]
      const [item] = next.splice(i, 1)
      next.splice(i + dir, 0, item)
      return next
    })
    setCardsDirty(true)
  }
  const removeCard = (i) => {
    if (!window.confirm('ลบการ์ดนี้?')) return
    setCards((cs) => cs.filter((_, j) => j !== i))
    setCardsDirty(true)
  }
  const addCard = () => { setCards((cs) => [...(cs || []), { ...EMPTY_CARD }]); setCardsDirty(true) }
  // เพิ่มการ์ดมาตรฐาน 3 ใบ (Iftar/งานให้/อาสาสมัคร) ต่อท้ายชุดปัจจุบัน — เผื่อเคยบันทึกการ์ดของตัวเองไปแล้วอยากดึงการ์ดเดิมกลับมาจัดการ
  const addDefaults = () => { setCards((cs) => [...(cs || []), ...DEFAULT_HOME_CARDS.map((c) => ({ ...c }))]); setCardsDirty(true) }
  const saveCards = async () => {
    setCardsSaving(true)
    try {
      await saveHomeCards(cards)
      setCardsDirty(false)
      setCardsSaved(true)
      setTimeout(() => setCardsSaved(false), 1800)
    } catch (e) {
      window.alert('บันทึกไม่สำเร็จ: ' + e.message)
    } finally {
      setCardsSaving(false)
    }
  }

  return (
    <main className="admin-dash">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-card" style={{ marginBottom: 28, maxWidth: 640 }}>
          <div className="admin-card-head" style={{ marginBottom: 18 }}>
            <h4><FontAwesomeIcon icon={faBars} /> เมนู (Nav) หน้าเว็บ public</h4>
          </div>
          <p style={{ color: 'var(--ink-soft)', fontSize: '.88rem', marginBottom: 16 }}>
            ปิดรายการที่ไม่ต้องการให้แสดงในเมนูหลักของเว็บ (ไม่กระทบ URL เดิม เข้าตรงได้เหมือนเดิม แค่ซ่อนจากเมนู) — มีผลทันทีเมื่อกดปิด/เปิด
          </p>
          {navLoading ? 'กำลังโหลด…' : (
            <div className="admin-table-wrap">
              <table className="admin-table admin-nav-vis-table">
                <thead>
                  <tr>
                    <th>รายการ</th>
                    <th style={{ textAlign: 'center' }}>ไม่แสดง</th>
                    <th style={{ textAlign: 'center' }}>แสดง</th>
                  </tr>
                </thead>
                <tbody>
                  {NAV_MENU_ITEMS.map((item) => {
                    const shown = visibility?.[item.key] !== false
                    return (
                      <tr key={item.key}>
                        <td>{item.label}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button" disabled={navSaving}
                            onClick={() => setNavItem(item.key, false)}
                            className="admin-btn admin-nav-vis-btn"
                            aria-label="ซ่อน" title="ซ่อนจากเมนู"
                            style={!shown
                              ? { background: '#fbe9e7', color: '#c62828', borderColor: '#ffab91' }
                              : { opacity: .4 }}
                          ><FontAwesomeIcon icon={faEyeSlash} /></button>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button" disabled={navSaving}
                            onClick={() => setNavItem(item.key, true)}
                            className="admin-btn admin-nav-vis-btn"
                            aria-label="แสดง" title="แสดงในเมนู"
                            style={shown
                              ? { background: '#e8f5e9', color: '#2e7d32', borderColor: '#a5d6a7' }
                              : { opacity: .4 }}
                          ><FontAwesomeIcon icon={faEye} /></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {navSaved && <p style={{ color: '#2e7d32', fontSize: '.85rem', marginTop: 12 }}>บันทึกแล้ว ✓</p>}
        </div>

        <div className="admin-card" style={{ marginBottom: 28, maxWidth: 640 }}>
          <div className="admin-card-head" style={{ marginBottom: 18 }}>
            <h4><FontAwesomeIcon icon={faGlobe} /> จัดการเว็บ — แบนเนอร์/ประกาศหน้าแรก</h4>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, fontWeight: 600 }}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: 18, height: 18 }} />
            เปิดแสดงแบนเนอร์บนหน้าแรก
          </label>

          <div className="admin-form-group" style={{ marginBottom: 14 }}>
            <label>ข้อความประกาศ</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="เช่น 📢 เปิดจองงาน Iftar For Gaza 2026 แล้ววันนี้!"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(27,94,54,.2)', fontFamily: 'inherit', fontSize: '.95rem' }}
            />
          </div>

          <div className="admin-form-grid-3col" style={{ marginBottom: 18 }}>
            <div className="admin-form-group">
              <label>ลิงก์ (ไม่บังคับ)</label>
              <input type="text" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="/event/iftar-for-gaza" />
            </div>
            <div className="admin-form-group">
              <label>ข้อความลิงก์</label>
              <input type="text" value={linkText} onChange={(e) => setLinkText(e.target.value)} placeholder="ดูเพิ่มเติม" />
            </div>
          </div>

          {text && (
            <div className="site-announcement" style={{ borderRadius: 10, marginBottom: 18, position: 'relative' }}>
              <span className="site-announcement-text">
                {text}
                {linkUrl && <span className="site-announcement-link">{linkText || 'ดูเพิ่มเติม'}</span>}
              </span>
            </div>
          )}

          <button className="admin-btn-primary" onClick={save} disabled={saving || annLoading}>
            <FontAwesomeIcon icon={saved ? faCheck : faBullhorn} /> {saved ? 'บันทึกแล้ว ✓' : saving ? 'กำลังบันทึก…' : 'บันทึกประกาศ'}
          </button>
        </div>

        {/* ── การ์ด Hero Feed หน้าแรก (CMS) ── */}
        <div className="admin-card" style={{ marginBottom: 28, maxWidth: 760 }}>
          <div className="admin-card-head" style={{ marginBottom: 12 }}>
            <h4><FontAwesomeIcon icon={faNewspaper} /> การ์ดหน้าแรก (Hero Feed)</h4>
          </div>
          <p style={{ color: 'var(--ink-soft)', fontSize: '.88rem', marginBottom: 16 }}>
            จัดการการ์ดกิจกรรม/ประชาสัมพันธ์บนหน้าแรกได้เอง — เพิ่ม/แก้/สลับลำดับ/ซ่อน แล้วกด "บันทึกการ์ดหน้าแรก"
            {savedCards === null && !cardsLoading && ' (ตอนนี้แสดงการ์ดมาตรฐาน 3 ใบเดิม — แก้แล้วกดบันทึกเพื่อเริ่มจัดการเอง)'}
          </p>

          {cardsLoading || cards === null ? <p>กำลังโหลด…</p> : (
            <>
              {cards.map((card, i) => (
                <CardEditor
                  key={i} card={card} index={i} total={cards.length}
                  onChange={(next) => updateCard(i, next)}
                  onMove={moveCard}
                  onRemove={removeCard}
                />
              ))}
              {cards.length === 0 && (
                <p style={{ color: '#c62828', fontSize: '.88rem', marginBottom: 12 }}>
                  ⚠️ ไม่มีการ์ดเลย — หน้าแรกจะไม่แสดงส่วนการ์ดกิจกรรม
                </p>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                <button type="button" className="admin-btn" onClick={addCard}>
                  <FontAwesomeIcon icon={faPlus} /> เพิ่มการ์ด
                </button>
                <button type="button" className="admin-btn" onClick={addDefaults}>
                  <FontAwesomeIcon icon={faPlus} /> เพิ่มการ์ดมาตรฐาน (3 ใบ)
                </button>
                <button className="admin-btn-primary" onClick={saveCards} disabled={cardsSaving || (!cardsDirty && savedCards !== null)}>
                  <FontAwesomeIcon icon={cardsSaved ? faCheck : faNewspaper} /> {cardsSaved ? 'บันทึกแล้ว ✓' : cardsSaving ? 'กำลังบันทึก…' : 'บันทึกการ์ดหน้าแรก'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
