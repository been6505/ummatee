import { useEffect, useState } from 'react'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { useAnnouncement, saveAnnouncement } from '../data/announcement.js'
import { useNavVisibility, saveNavVisibility, NAV_MENU_ITEMS } from '../data/navVisibility.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGlobe, faBullhorn, faCheck, faBars } from '@fortawesome/free-solid-svg-icons'

// จัดการเว็บฝั่ง public (/admin/website) — เริ่มจากแบนเนอร์/ประกาศหน้าแรก
// เขียนที่ config/announcement (public อ่านได้ทุกคน, แก้ได้เฉพาะแอดมิน — ดู firestore.rules)

export default function AdminWebsite() {
  const { user, loading } = useAdminAuth()
  const { announcement, loading: annLoading } = useAnnouncement()
  const { visibility, loading: navLoading } = useNavVisibility()

  const [navSaving, setNavSaving] = useState(false)
  const [navSaved, setNavSaved] = useState(false)

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

  const toggleNavItem = async (key, currentlyShown) => {
    setNavSaving(true)
    try {
      await saveNavVisibility({ [key]: !currentlyShown })
      setNavSaved(true)
      setTimeout(() => setNavSaved(false), 1200)
    } finally {
      setNavSaving(false)
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {navLoading ? 'กำลังโหลด…' : NAV_MENU_ITEMS.map((item) => {
              const shown = visibility?.[item.key] !== false
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={navSaving}
                  onClick={() => toggleNavItem(item.key, shown)}
                  className="admin-btn"
                  style={shown
                    ? { background: '#e8f5e9', color: '#2e7d32', borderColor: '#a5d6a7' }
                    : { background: '#fbe9e7', color: '#c62828', borderColor: '#ffab91' }}
                >
                  {item.label} — {shown ? 'แสดงอยู่' : 'ซ่อนอยู่'}
                </button>
              )
            })}
          </div>
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
      </div>
    </main>
  )
}
