import { useEffect, useState } from 'react'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import { useAnnouncement, saveAnnouncement } from '../data/announcement.js'
import { useNavVisibility, saveNavVisibility, NAV_MENU_ITEMS } from '../data/navVisibility.js'
import { useHomeCards, saveHomeCards, EMPTY_CARD, CARD_COLORS, DEFAULT_HOME_CARDS, L } from '../data/homeCards.js'
import { useFocusCards, saveFocusCards, EMPTY_FOCUS_CARD, FOCUS_VARIANTS, DEFAULT_FOCUS_CARDS } from '../data/focusCards.js'
import { useSiteContent, saveSiteContent, isSiteImageValue } from '../data/siteContent.js'
import { uploadToCloudinary } from '../utils/cloudinary.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGlobe, faBullhorn, faCheck, faBars, faImage, faSpinner, faXmark, faArrowUp, faArrowDown, faPlus, faNewspaper, faEye, faEyeSlash, faPenToSquare, faTrash } from '@fortawesome/free-solid-svg-icons'
import ListSkeleton from '../components/ListSkeleton.jsx'

// รายการ key เนื้อหาท้ายเว็บ (footer) ที่มีอยู่แล้วในโค้ด — โชว์เป็นแถวสำเร็จรูปให้แก้ง่าย
const FOOTER_CONTENT_KEYS = [
  { key: 'footerTagline_th', label: 'คำโปรยท้ายเว็บ (ไทย)', placeholder: 'มูลนิธิอุมมะตี — ให้ 100 ถึง 100' },
  { key: 'footerTagline_en', label: 'คำโปรยท้ายเว็บ (EN)', placeholder: 'Ummatee Foundation — Give 100, Reach 100' },
  { key: 'footerTagline_ar', label: 'คำโปรยท้ายเว็บ (AR)', placeholder: 'مؤسسة أمّتي — أعطِ ١٠٠ تصل ١٠٠' },
  { key: 'footerEmail', label: 'อีเมลติดต่อ', placeholder: 'ummatee.thailand@gmail.com' },
  { key: 'footerMapUrl', label: 'ลิงก์แผนที่ (Google Maps)', placeholder: 'https://maps.app.goo.gl/...' },
  { key: 'footerMapLabel', label: 'ข้อความลิงก์แผนที่', placeholder: 'Office Ummatee Thailand' },
]

// จัดการเว็บฝั่ง public (/admin/website) — เมนู nav, แบนเนอร์ประกาศ และการ์ด Hero Feed หน้าแรก (แบบ CMS)
// เขียนที่ config/announcement + config/homeCards (public อ่านได้ทุกคน, แก้ได้เฉพาะแอดมิน — ดู firestore.rules)

const CARD_LANGS = [['th', 'ไทย'], ['en', 'EN'], ['ar', 'AR']]

// ── ตัวแก้ไขการ์ดหน้าแรก 1 ใบ ──
function CardEditor({ card, index, total, onChange, onMove, onRemove }) {
  const [uploading, setUploading] = useState(false)

  const set = (k) => (e) => onChange({ ...card, [k]: e.target.value })
  // ฟิลด์ที่แปลได้ (title/desc/btnText) — เก็บเป็น object {th,en,ar} รองรับค่าเดิมที่เป็น string
  const asObj = (v) => (v && typeof v === 'object') ? v : { th: v || '', en: '', ar: '' }
  const setL = (k, lang) => (e) => onChange({ ...card, [k]: { ...asObj(card[k]), [lang]: e.target.value } })
  const valL = (k, lang) => asObj(card[k])[lang] || ''

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
        <strong style={{ marginRight: 'auto' }}>การ์ดที่ {index + 1}{L(card.title, 'th') ? ` — ${L(card.title, 'th')}` : ''}</strong>
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
        <label>ป้ายหลัก (tag) — ใช้ร่วมทุกภาษา
          <input type="text" value={card.tag} onChange={set('tag')} placeholder="เช่น 🌙 EVENT" />
        </label>
        <label>ป้ายรอง — ใช้ร่วมทุกภาษา
          <input type="text" value={card.tag2} onChange={set('tag2')} placeholder="เช่น Gaza / 3–5 ก.ค. 2569" />
        </label>
        <label>สีปุ่ม
          <select value={card.color} onChange={set('color')}>
            {CARD_COLORS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
      </div>

      {/* หัวข้อ — 3 ภาษา (EN/AR เว้นว่างได้ จะใช้ไทยแทน) */}
      <div style={{ marginTop: 12, fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 6 }}>หัวข้อการ์ด (3 ภาษา)</div>
      <div className="admin-form-grid admin-form-grid-3col">
        {CARD_LANGS.map(([lg, lb]) => (
          <label key={lg}>{lb}
            <input type="text" value={valL('title', lg)} onChange={setL('title', lg)} placeholder={lg === 'th' ? 'เช่น Iftar For Gaza' : `(${lb}) เว้นว่าง = ใช้ไทย`} />
          </label>
        ))}
      </div>

      {/* ข้อความปุ่ม — 3 ภาษา */}
      <div style={{ marginTop: 12, fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 6 }}>ข้อความปุ่ม (3 ภาษา)</div>
      <div className="admin-form-grid admin-form-grid-3col">
        {CARD_LANGS.map(([lg, lb]) => (
          <label key={lg}>{lb}
            <input type="text" value={valL('btnText', lg)} onChange={setL('btnText', lg)} placeholder={lg === 'th' ? 'เช่น ดูรายละเอียด' : `(${lb})`} />
          </label>
        ))}
      </div>

      <label style={{ display: 'block', marginTop: 12, fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)' }}>
        ลิงก์ (path ภายในเว็บ)
        <input type="text" value={card.link} onChange={set('link')} placeholder="เช่น /event/iftar-for-gaza" style={{ display: 'block', width: '100%', marginTop: 6, fontWeight: 400, boxSizing: 'border-box' }} />
      </label>

      {/* คำอธิบาย — 3 ภาษา */}
      <div style={{ marginTop: 12, fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 6 }}>คำอธิบาย (3 ภาษา)</div>
      {CARD_LANGS.map(([lg, lb]) => (
        <label key={lg} style={{ display: 'block', marginBottom: 8, fontSize: '.82rem', fontWeight: 600, color: 'var(--ink-soft)' }}>{lb}
          <textarea rows="2" value={valL('desc', lg)} onChange={setL('desc', lg)} placeholder={lg === 'th' ? 'คำอธิบายภาษาไทย' : `(${lb}) เว้นว่าง = ใช้ไทย`} style={{ display: 'block', width: '100%', marginTop: 4, fontWeight: 400, boxSizing: 'border-box', fontFamily: 'inherit', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd' }} />
        </label>
      ))}

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 8 }}>รูปโปสเตอร์ (หลายรูป = สไลด์วนอัตโนมัติ)</div>
        <label className="admin-upload-btn" style={{ opacity: uploading ? .6 : 1, pointerEvents: uploading ? 'none' : 'auto' }}>
          <FontAwesomeIcon icon={uploading ? faSpinner : faImage} spin={uploading} />
          {uploading ? ' กำลังอัพโหลด...' : ' เลือกรูป'}
          <input type="file" accept="image/*,.heic,.heif,.cr2,.cr3,.nef,.arw,.raf,.rw2,.dng,.orf,.sr2,.raw" multiple hidden onChange={uploadImages} />
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

// ── ตัวแก้ไขการ์ดทางลัดหน้าแรก 1 ใบ ──
// แยกจาก CardEditor เพราะฟิลด์ต่างกันเกือบทั้งหมด (ไม่มีรูป/ป้ายรอง, tag แปลได้, มี variant แทน color)
function FocusCardEditor({ card, index, total, onChange, onMove, onRemove }) {
  const asObj = (v) => (v && typeof v === 'object') ? v : { th: v || '', en: '', ar: '' }
  const set = (k) => (e) => onChange({ ...card, [k]: e.target.value })
  const setL = (k, lang) => (e) => onChange({ ...card, [k]: { ...asObj(card[k]), [lang]: e.target.value } })
  const valL = (k, lang) => asObj(card[k])[lang] || ''

  const langRow = (field, heading, placeholderTh) => (
    <>
      <div style={{ marginTop: 12, fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 6 }}>{heading}</div>
      <div className="admin-form-grid admin-form-grid-3col">
        {CARD_LANGS.map(([lg, lb]) => (
          <label key={lg}>{lb}
            <input type="text" value={valL(field, lg)} onChange={setL(field, lg)} placeholder={lg === 'th' ? placeholderTh : `(${lb}) เว้นว่าง = ใช้ไทย`} />
          </label>
        ))}
      </div>
    </>
  )

  return (
    <div className="admin-card" style={{ marginBottom: 14, borderLeft: card.enabled ? '4px solid var(--green-mid)' : '4px solid #ffab91' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <strong style={{ marginRight: 'auto' }}>การ์ดทางลัดที่ {index + 1}{L(card.title, 'th') ? ` — ${L(card.title, 'th')}` : ''}</strong>
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

      <div className="admin-form-grid admin-form-grid-2col">
        <label>ลิงก์ (path ภายในเว็บ)
          <input type="text" value={card.link || ''} onChange={set('link')} placeholder="เช่น /donation" />
        </label>
        <label>สีการ์ด
          <select value={card.variant || 'iftar'} onChange={set('variant')}>
            {FOCUS_VARIANTS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>
        </label>
      </div>

      {langRow('tag', 'ป้ายบนการ์ด (3 ภาษา)', 'เช่น 🌙 EVENT · กิจกรรม')}
      {langRow('title', 'หัวข้อการ์ด (3 ภาษา)', 'เช่น Iftar For Gaza')}
      {langRow('linkText', 'ข้อความลิงก์ท้ายการ์ด (3 ภาษา)', 'เช่น ดูบัญชีบริจาค')}

      <div style={{ marginTop: 12, fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 6 }}>คำอธิบาย (3 ภาษา)</div>
      {CARD_LANGS.map(([lg, lb]) => (
        <label key={lg} style={{ display: 'block', marginBottom: 8, fontSize: '.82rem', fontWeight: 600, color: 'var(--ink-soft)' }}>{lb}
          <textarea rows="2" value={valL('desc', lg)} onChange={setL('desc', lg)} placeholder={lg === 'th' ? 'คำอธิบายภาษาไทย' : `(${lb}) เว้นว่าง = ใช้ไทย`} style={{ display: 'block', width: '100%', marginTop: 4, fontWeight: 400, boxSizing: 'border-box', fontFamily: 'inherit', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd' }} />
        </label>
      ))}
    </div>
  )
}

// ── แถวฟิลด์รูปภาพอิสระ 1 รายการ (key + อัพโหลดรูปผ่าน Cloudinary) ──
function ImageFieldRow({ row, onKeyChange, onUrlChange, onRemove }) {
  const [uploading, setUploading] = useState(false)

  const uploadImage = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const result = await uploadToCloudinary(file, 'image')
      onUrlChange(result.url)
    } catch (err) {
      window.alert('อัพโหลดไม่สำเร็จ: ' + err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        type="text" placeholder="key เช่น heroBannerImage" value={row.key}
        onChange={(e) => onKeyChange(e.target.value)}
        style={{ flex: '0 0 220px' }}
      />
      {row.url && <img src={row.url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid #ddd' }} />}
      <label className="admin-upload-btn" style={{ opacity: uploading ? .6 : 1, pointerEvents: uploading ? 'none' : 'auto' }}>
        <FontAwesomeIcon icon={uploading ? faSpinner : faImage} spin={uploading} />
        {uploading ? ' กำลังอัพโหลด...' : row.url ? ' เปลี่ยนรูป' : ' เลือกรูป'}
        <input type="file" accept="image/*,.heic,.heif,.cr2,.cr3,.nef,.arw,.raf,.rw2,.dng,.orf,.sr2,.raw" hidden onChange={uploadImage} />
      </label>
      <button type="button" className="admin-btn-danger" onClick={onRemove} aria-label="ลบฟิลด์นี้" title="ลบ">
        <FontAwesomeIcon icon={faTrash} />
      </button>
    </div>
  )
}

export default function AdminWebsite() {
  const { user, loading } = useAdminAuth()
  const { announcement, loading: annLoading } = useAnnouncement()
  const { visibility, loading: navLoading } = useNavVisibility()
  const { cards: savedCards, loading: cardsLoading } = useHomeCards(true)
  const { cards: savedFocusCards, loading: focusLoading } = useFocusCards(true)
  const { content: siteContentSaved, loading: siteContentLoading } = useSiteContent()

  // เนื้อหาเว็บทั่วไป (key-value) — แก้ในเครื่องก่อน กด "บันทึกเนื้อหาเว็บ" ค่อยเขียนขึ้น Firestore ทีเดียว เหมือนการ์ดหน้าแรก
  const [siteContent, setSiteContent] = useState(null)
  const [contentDirty, setContentDirty] = useState(false)
  const [contentSaving, setContentSaving] = useState(false)
  const [contentSaved, setContentSaved] = useState(false)
  const [customRows, setCustomRows] = useState([]) // [{key, value}] — ฟิลด์ข้อความอิสระที่แอดมินเพิ่มเอง นอกเหนือจาก key มาตรฐานด้านบน
  const [customImageRows, setCustomImageRows] = useState([]) // [{key, url}] — ฟิลด์รูปภาพอิสระ (value เก็บเป็น {type:'image', url})
  useEffect(() => {
    if (siteContentLoading || contentDirty) return
    const data = siteContentSaved || {}
    setSiteContent(data)
    const knownKeys = FOOTER_CONTENT_KEYS.map((f) => f.key)
    const entries = Object.entries(data).filter(([k]) => !knownKeys.includes(k))
    setCustomRows(entries.filter(([, v]) => !isSiteImageValue(v)).map(([key, value]) => ({ key, value })))
    setCustomImageRows(entries.filter(([, v]) => isSiteImageValue(v)).map(([key, v]) => ({ key, url: v.url })))
  }, [siteContentSaved, siteContentLoading, contentDirty])

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

  // การ์ดทางลัดหน้าแรก — แยกสถานะ/ปุ่มบันทึกจากการ์ด Hero Feed คนละชุด (คนละ doc)
  const [focusCards, setFocusCards] = useState(null)
  const [focusDirty, setFocusDirty] = useState(false)
  const [focusSaving, setFocusSaving] = useState(false)
  const [focusSaved, setFocusSaved] = useState(false)
  useEffect(() => {
    if (focusLoading || focusDirty) return
    setFocusCards(savedFocusCards !== null ? savedFocusCards : DEFAULT_FOCUS_CARDS)
  }, [savedFocusCards, focusLoading, focusDirty])

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

  // ── จัดการการ์ดทางลัดหน้าแรก ──
  const updateFocusCard = (i, next) => { setFocusCards((cs) => cs.map((c, j) => (j === i ? next : c))); setFocusDirty(true) }
  const moveFocusCard = (i, dir) => {
    setFocusCards((cs) => {
      const next = [...cs]
      const [item] = next.splice(i, 1)
      next.splice(i + dir, 0, item)
      return next
    })
    setFocusDirty(true)
  }
  const removeFocusCard = (i) => {
    if (!window.confirm('ลบการ์ดทางลัดนี้?')) return
    setFocusCards((cs) => cs.filter((_, j) => j !== i))
    setFocusDirty(true)
  }
  const addFocusCard = () => { setFocusCards((cs) => [...(cs || []), { ...EMPTY_FOCUS_CARD }]); setFocusDirty(true) }
  const addFocusDefaults = () => { setFocusCards((cs) => [...(cs || []), ...DEFAULT_FOCUS_CARDS.map((c) => ({ ...c }))]); setFocusDirty(true) }
  const saveFocus = async () => {
    setFocusSaving(true)
    try {
      await saveFocusCards(focusCards)
      setFocusDirty(false)
      setFocusSaved(true)
      setTimeout(() => setFocusSaved(false), 1800)
    } catch (e) {
      window.alert('บันทึกไม่สำเร็จ: ' + e.message)
    } finally {
      setFocusSaving(false)
    }
  }

  // ── จัดการเนื้อหาเว็บทั่วไป (key-value) ──
  const setKnownField = (key, value) => { setSiteContent((c) => ({ ...(c || {}), [key]: value })); setContentDirty(true) }
  const addCustomRow = () => { setCustomRows((rs) => [...rs, { key: '', value: '' }]); setContentDirty(true) }
  const updateCustomRow = (i, field, val) => {
    setCustomRows((rs) => rs.map((r, j) => (j === i ? { ...r, [field]: val } : r)))
    setContentDirty(true)
  }
  const removeCustomRow = (i) => { setCustomRows((rs) => rs.filter((_, j) => j !== i)); setContentDirty(true) }
  const addCustomImageRow = () => { setCustomImageRows((rs) => [...rs, { key: '', url: '' }]); setContentDirty(true) }
  const updateCustomImageKey = (i, key) => {
    setCustomImageRows((rs) => rs.map((r, j) => (j === i ? { ...r, key } : r)))
    setContentDirty(true)
  }
  const setCustomImageUrl = (i, url) => {
    setCustomImageRows((rs) => rs.map((r, j) => (j === i ? { ...r, url } : r)))
    setContentDirty(true)
  }
  const removeCustomImageRow = (i) => { setCustomImageRows((rs) => rs.filter((_, j) => j !== i)); setContentDirty(true) }
  const saveSiteContentAll = async () => {
    setContentSaving(true)
    try {
      const merged = { ...(siteContent || {}) }
      customRows.forEach(({ key, value }) => { if (key.trim()) merged[key.trim()] = value })
      customImageRows.forEach(({ key, url }) => { if (key.trim() && url) merged[key.trim()] = { type: 'image', url } })
      await saveSiteContent(merged)
      setContentDirty(false)
      setContentSaved(true)
      setTimeout(() => setContentSaved(false), 1800)
    } catch (e) {
      window.alert('บันทึกไม่สำเร็จ: ' + e.message)
    } finally {
      setContentSaving(false)
    }
  }

  // ระบบ staff role คุมแทน email allowlist เดิม — ทีมงานแก้เนื้อหาเว็บได้ (firestore.rules เปิดให้เฉพาะ
  // 5 เอกสารเนื้อหา ส่วน maintenance mode / เลขบัญชีธนาคาร ยังเป็นของเจ้าของเท่านั้น)
  return (
    <StaffRoleGuard allowedRoles={['admin', 'staff', 'social']}>{() => (
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
          {navLoading ? <ListSkeleton rows={2} /> : (
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

          {cardsLoading || cards === null ? <ListSkeleton /> : (
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

        {/* ── การ์ดทางลัด 3 ใบใต้หัวข้อ "สองหนทางแห่งการให้" (CMS) ── */}
        <div className="admin-card" style={{ marginBottom: 28, maxWidth: 760 }}>
          <div className="admin-card-head" style={{ marginBottom: 12 }}>
            <h4><FontAwesomeIcon icon={faNewspaper} /> การ์ดทางลัดหน้าแรก (Iftar / บริจาค / อาสาสมัคร)</h4>
          </div>
          <p style={{ color: 'var(--ink-soft)', fontSize: '.88rem', marginBottom: 16 }}>
            การ์ดสี 3 ใบใต้หัวข้อ "เริ่มต้นทำความดีได้ตั้งแต่วันนี้" — เพิ่ม/แก้/สลับลำดับ/ซ่อน แล้วกด "บันทึกการ์ดทางลัด"
            {savedFocusCards === null && !focusLoading && ' (ตอนนี้แสดงการ์ดตั้งต้น 3 ใบเดิม — แก้แล้วกดบันทึกเพื่อเริ่มจัดการเอง)'}
          </p>

          {focusLoading || focusCards === null ? <ListSkeleton /> : (
            <>
              {focusCards.map((card, i) => (
                <FocusCardEditor
                  key={i} card={card} index={i} total={focusCards.length}
                  onChange={(next) => updateFocusCard(i, next)}
                  onMove={moveFocusCard}
                  onRemove={removeFocusCard}
                />
              ))}
              {focusCards.length === 0 && (
                <p style={{ color: '#c62828', fontSize: '.88rem', marginBottom: 12 }}>
                  ⚠️ ไม่มีการ์ดทางลัดเลย — หน้าแรกจะไม่แสดงส่วนนี้
                </p>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                <button type="button" className="admin-btn" onClick={addFocusCard}>
                  <FontAwesomeIcon icon={faPlus} /> เพิ่มการ์ดทางลัด
                </button>
                <button type="button" className="admin-btn" onClick={addFocusDefaults}>
                  <FontAwesomeIcon icon={faPlus} /> เพิ่มการ์ดตั้งต้น (3 ใบ)
                </button>
                <button className="admin-btn-primary" onClick={saveFocus} disabled={focusSaving || (!focusDirty && savedFocusCards !== null)}>
                  <FontAwesomeIcon icon={focusSaved ? faCheck : faNewspaper} /> {focusSaved ? 'บันทึกแล้ว ✓' : focusSaving ? 'กำลังบันทึก…' : 'บันทึกการ์ดทางลัด'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── เนื้อหาเว็บทั่วไป (CMS แบบ key-value) ── */}
        <div className="admin-card" style={{ marginBottom: 28, maxWidth: 760 }}>
          <div className="admin-card-head" style={{ marginBottom: 12 }}>
            <h4><FontAwesomeIcon icon={faPenToSquare} /> เนื้อหาเว็บ (ท้ายเว็บ + ข้อความอื่นๆ)</h4>
          </div>
          <p style={{ color: 'var(--ink-soft)', fontSize: '.88rem', marginBottom: 16 }}>
            แก้ข้อความติดต่อ/คำโปรยท้ายเว็บได้เอง โดยไม่ต้องให้ dev แก้โค้ด — ช่องไหนเว้นว่างจะใช้ข้อความเดิมของเว็บแทน
            ด้านล่างสุดยังเพิ่มฟิลด์เนื้อหาอิสระของตัวเองได้ (key ใหม่) เผื่อใช้ในหน้าอื่นภายหลัง
          </p>
          {siteContentLoading || siteContent === null ? <ListSkeleton /> : (
            <>
              <div className="admin-form-grid admin-form-grid-2col">
                {FOOTER_CONTENT_KEYS.map((f) => (
                  <label key={f.key}>{f.label}
                    <input
                      type="text"
                      value={siteContent[f.key] || ''}
                      placeholder={f.placeholder}
                      onChange={(e) => setKnownField(f.key, e.target.value)}
                    />
                  </label>
                ))}
              </div>

              <div style={{ marginTop: 20, fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 8 }}>
                ฟิลด์เนื้อหาอิสระ (key ที่ตั้งเอง)
              </div>
              {customRows.map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <input
                    type="text" placeholder="key เช่น aboutPageTitle" value={row.key}
                    onChange={(e) => updateCustomRow(i, 'key', e.target.value)}
                    style={{ flex: '0 0 220px' }}
                  />
                  <input
                    type="text" placeholder="ข้อความ" value={row.value}
                    onChange={(e) => updateCustomRow(i, 'value', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="admin-btn-danger" onClick={() => removeCustomRow(i)} aria-label="ลบฟิลด์นี้" title="ลบ">
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              ))}

              <div style={{ marginTop: 20, fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 8 }}>
                ฟิลด์รูปภาพ (key ที่ตั้งเอง)
              </div>
              {customImageRows.map((row, i) => (
                <ImageFieldRow
                  key={i} row={row}
                  onKeyChange={(k) => updateCustomImageKey(i, k)}
                  onUrlChange={(url) => setCustomImageUrl(i, url)}
                  onRemove={() => removeCustomImageRow(i)}
                />
              ))}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                <button type="button" className="admin-btn" onClick={addCustomRow}>
                  <FontAwesomeIcon icon={faPlus} /> เพิ่มฟิลด์เนื้อหา
                </button>
                <button type="button" className="admin-btn" onClick={addCustomImageRow}>
                  <FontAwesomeIcon icon={faImage} /> เพิ่มฟิลด์รูปภาพ
                </button>
                <button className="admin-btn-primary" onClick={saveSiteContentAll} disabled={contentSaving || !contentDirty}>
                  <FontAwesomeIcon icon={contentSaved ? faCheck : faPenToSquare} /> {contentSaved ? 'บันทึกแล้ว ✓' : contentSaving ? 'กำลังบันทึก…' : 'บันทึกเนื้อหาเว็บ'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )}</StaffRoleGuard>
  )
}
