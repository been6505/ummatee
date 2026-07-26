import { useEffect, useMemo, useState } from 'react'
import VolunteerGuard from '../components/VolunteerGuard.jsx'
import { collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { useAdminChatList, useChatMessages, sendAdminReply, markChatReadByAdmin, isSafeHttpUrl } from '../data/chat.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChevronLeft, faChevronRight, faCheck, faImage, faXmark, faCopy, faSpinner,
  faPlug, faLink, faArrowUpRightFromSquare, faPaperPlane, faTriangleExclamation, faCalendarDays,
  faComments, faGlobe, faComment, faArrowLeft, faChartLine, faMessage,
} from '@fortawesome/free-solid-svg-icons'
import { faLine, faFacebookMessenger, faInstagram } from '@fortawesome/free-brands-svg-icons'

import { uploadToCloudinary } from '../utils/cloudinary.js'

// ป้ายแพลตฟอร์มของกล่องข้อความ — เหมือน AdminChat.jsx (เพิ่ม instagram ที่ยังไม่มีในไฟล์นั้น)
const CHAT_PLATFORM_BADGE = {
  web: { icon: faGlobe, label: 'เว็บไซต์', color: '#16a34a' },
  line: { icon: faLine, label: 'LINE', color: '#06c755' },
  facebook: { icon: faFacebookMessenger, label: 'Messenger', color: '#0084ff' },
  instagram: { icon: faInstagram, label: 'Instagram', color: '#e1306c' },
}
function ChatPlatformBadge({ platform }) {
  const p = CHAT_PLATFORM_BADGE[platform] || CHAT_PLATFORM_BADGE.web
  return <FontAwesomeIcon icon={p.icon || faComment} style={{ color: p.color }} title={p.label} />
}
function chatTimeLabel(ts) {
  if (!ts?.toDate) return ''
  const d = ts.toDate()
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })
}

// แท็บ "กล่องข้อความ" — ดึงข้อมูล chats ทุกแพลตฟอร์ม (LINE/Messenger/Instagram) จาก Firestore เดียวกับ AdminChat.jsx
// ใช้ hook เดิม (useAdminChatList, useChatMessages, sendAdminReply, markChatReadByAdmin) ไม่แก้ AdminChat.jsx เอง
function ChatInboxTab() {
  const { chats, loading: chatsLoading } = useAdminChatList()
  const [openChatId, setOpenChatId] = useState(null)
  const { messages } = useChatMessages(openChatId)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => { if (openChatId) markChatReadByAdmin(openChatId).catch(() => {}) }, [openChatId])

  const openChat = chats.find((c) => c.id === openChatId)
  const title = openChat ? (openChat.visitorName || `ผู้เยี่ยมชม ${openChatId.slice(0, 6)}`) : ''

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || sending || !openChatId) return
    setSending(true)
    setText('')
    try { await sendAdminReply(openChatId, trimmed) } catch { setText(trimmed) } finally { setSending(false) }
  }

  if (openChatId) {
    return (
      <div className="admin-card">
        <div className="admin-chat-thread-head">
          <button className="admin-chat-back" onClick={() => setOpenChatId(null)} aria-label="กลับไปรายการแชท">
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <span><ChatPlatformBadge platform={openChat?.platform} /> {title}</span>
        </div>
        <div className="admin-chat-body">
          {messages.map((m) => (
            m.type === 'product' && m.product ? (
              <a
                key={m.id} href={isSafeHttpUrl(m.product.url) ? m.product.url : '#'}
                {...(isSafeHttpUrl(m.product.url) ? { target: '_blank', rel: 'noopener noreferrer' } : { onClick: (e) => e.preventDefault() })}
                className={`chat-bubble admin-msg-${m.sender === 'admin' ? 'mine' : 'theirs'} chat-product-card`}
              >
                {isSafeHttpUrl(m.product.image) && <img src={m.product.image} alt={m.product.name} />}
                <div className="chat-product-info">
                  <div className="chat-product-name">{m.product.name}</div>
                  {m.product.price != null && <div className="chat-product-price">฿{Number(m.product.price).toLocaleString('th-TH')}</div>}
                </div>
              </a>
            ) : (
              <div key={m.id} className={`chat-bubble admin-msg-${m.sender === 'admin' ? 'mine' : 'theirs'}`}>{m.text}</div>
            )
          ))}
        </div>
        <form className="admin-chat-input" onSubmit={submit}>
          <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="พิมพ์ข้อความตอบกลับ..." maxLength={2000} />
          <button type="submit" disabled={!text.trim() || sending}>ส่ง</button>
        </form>
      </div>
    )
  }

  return (
    <div className="admin-card">
      <h4><FontAwesomeIcon icon={faComments} /> กล่องข้อความ (LINE / Messenger / Instagram)</h4>
      <div className="admin-chat-list">
        {!chatsLoading && chats.length === 0 && <div className="admin-chat-empty">ยังไม่มีแชทเข้ามา</div>}
        {chats.map((c) => (
          <div key={c.id} className="admin-chat-item" onClick={() => setOpenChatId(c.id)}>
            <div className="admin-chat-item-top">
              <span className="admin-chat-item-name"><ChatPlatformBadge platform={c.platform} /> {c.visitorName || `ผู้เยี่ยมชม ${c.id.slice(0, 6)}`}</span>
              <span>{chatTimeLabel(c.lastMessageAt)}{c.unreadByAdmin && <span className="admin-chat-dot" />}</span>
            </div>
            <div className="admin-chat-item-text">{c.lastSender === 'admin' ? 'คุณ: ' : ''}{c.lastMessageText}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
// เว็บ Content Hub (Vercel) ที่ทำหน้าที่เชื่อม OAuth + โพสต์จริง — ประกาศไว้บนสุดเพราะใช้หลายจุดในไฟล์นี้
const CONTENT_HUB_URL = 'https://content-hub-olive.vercel.app'

// แท็บ "คอมเมนต์" และ "ภาพรวมเพจ" — ดึงข้อมูลจริงจากแพลตฟอร์มต้องใช้ access token ที่เก็บฝั่งเซิร์ฟเวอร์
// ซึ่งอยู่ในฐานข้อมูลของ Content Hub หน้านี้เข้าถึงไม่ได้ (เดิมเรียก Cloud Functions ที่ไม่เคย deploy
// ทำให้เด้ง alert error ทุกครั้งที่เปิดแท็บ) จึงเปลี่ยนเป็นบอกทางไป Content Hub ตรงๆ แทน
function HubOnlyTab({ icon, title, desc, hubPath }) {
  return (
    <div className="admin-card">
      <h4><FontAwesomeIcon icon={icon} /> {title}</h4>
      <p style={{ color: 'var(--ink-soft)', fontSize: '.88rem', marginBottom: 14 }}>{desc}</p>
      <button
        className="admin-btn-primary"
        onClick={() => window.open(`${CONTENT_HUB_URL}${hubPath}`, '_blank', 'noopener,noreferrer')}
      >
        <FontAwesomeIcon icon={faArrowUpRightFromSquare} /> เปิดใน Content Hub
      </button>
    </div>
  )
}

function CommentsTab() {
  return (
    <HubOnlyTab
      icon={faMessage}
      title="คอมเมนต์บนโพสต์"
      desc="คอมเมนต์ของโพสต์ที่เผยแพร่จริงดูได้ที่ Content Hub เพราะต้องใช้ token ของแต่ละแพลตฟอร์มที่เก็บไว้ฝั่งเซิร์ฟเวอร์ที่นั่น"
      hubPath="/posts"
    />
  )
}

function InsightsTab() {
  return (
    <HubOnlyTab
      icon={faChartLine}
      title="ภาพรวมเพจ"
      desc="ยอดเข้าถึง เอนเกจ และสถิติเพจดูได้ที่ Content Hub ซึ่งเป็นที่เก็บการเชื่อมต่อบัญชีของแต่ละแพลตฟอร์ม"
      hubPath="/accounts"
    />
  )
}

// เชื่อมบัญชีโซเชียล + โพสต์จริง ทำที่ Content Hub (เว็บแยก บน Vercel) ไม่ใช่ที่นี่
//
// ทำไมไม่ทำในหน้านี้เลย: OAuth ต้องมีเซิร์ฟเวอร์ เพราะขั้นแลก code เป็น token ต้องใช้ client_secret
// ซึ่งห้ามอยู่ในโค้ดฝั่งเบราว์เซอร์ และ access token ต้องเก็บฝั่งเซิร์ฟเวอร์ ummatee เป็น static site
// (Firebase Hosting + Firestore บนแพลน Spark) ไม่มีเซิร์ฟเวอร์ให้ทำสองอย่างนี้
//
// เคยเขียน Cloud Functions ไว้ครบแล้ว (functions/index.js) แต่ deploy ไม่ได้เพราะต้องอัปเกรดเป็น
// แพลน Blaze (ผูกบัตร) — endpoint จึงตอบ 404 เสมอ ปุ่มเดิมที่ชี้ไปที่นั้นกดแล้วพาไปหน้า error
// จึงเปลี่ยนมาส่งต่อไป Content Hub ที่ deploy ใช้งานได้จริงอยู่แล้วแทน
const SOCIAL_PLATFORMS = [
  { id: 'facebook', label: 'Facebook', color: '#1877f2', needsVideo: false },
  { id: 'instagram', label: 'Instagram', color: '#e1306c', needsVideo: false },
  { id: 'threads', label: 'Threads', color: '#000', needsVideo: false },
  { id: 'youtube', label: 'YouTube', color: '#ff0000', needsVideo: true },
  { id: 'tiktok', label: 'TikTok', color: '#111', needsVideo: true },
]
const REAL_STATUS_LABEL = { publishing: 'กำลังโพสต์...', posted: 'โพสต์จริงแล้ว', partial: 'โพสต์สำเร็จบางแพลตฟอร์ม', failed: 'โพสต์จริงไม่สำเร็จ' }

const PLATFORM_OPEN = {
  facebook: 'https://www.facebook.com/',
  instagram: 'https://www.instagram.com/',
  tiktok: 'https://www.tiktok.com/upload',
  youtube: 'https://studio.youtube.com/',
  x: null, // filled dynamically with text
  line: 'https://manager.line.biz/',
}

// ปฏิทินวางแผนคอนเทนต์ (/admin/calendar) — เพิ่มกิจกรรม/โพสต์ ตั้งเวลา เลือกแพลตฟอร์ม (ข้อความเท่านั้น เพิ่มรูป/วิดีโอได้ทีหลัง)
// เก็บใน Firestore (collection: contentPosts)
// หมายเหตุ: ระบบนี้เก็บ "แผนโพสต์" — การโพสต์จริงลงแต่ละแพลตฟอร์มยังต้องทำผ่านแอปของแพลตฟอร์มนั้น

const PLATFORMS = [
  { id: 'facebook', label: 'Facebook', color: '#1877f2' },
  { id: 'instagram', label: 'Instagram', color: '#e1306c' },
  { id: 'tiktok', label: 'TikTok', color: '#111' },
  { id: 'youtube', label: 'YouTube', color: '#ff0000' },
  { id: 'x', label: 'X', color: '#444' },
  { id: 'line', label: 'LINE', color: '#06c755' },
]

const STATUS = { draft: 'ฉบับร่าง', scheduled: 'ตั้งเวลาแล้ว', posted: 'โพสต์แล้ว' }
const STATUS_COLOR = { draft: '#999', scheduled: '#c9a84c', posted: '#2e7d52' }

// ชนิดคอนเทนต์ + สถานะอนุมัติ (ข้อ 4 ของแผน admin-intranet-plan.md) — เพิ่มเป็น field ใหม่ทั้งหมด ไม่แตะ field เดิม
const CONTENT_TYPE_LABEL = { post: 'โพสต์', live: 'ไลฟ์สด' }
const APPROVAL_LABEL = { draft: 'ร่าง', pending_review: 'รอตรวจ', approved: 'อนุมัติแล้ว', rejected: 'ถูกตีกลับ' }
const APPROVAL_COLOR = { draft: '#999', pending_review: '#c9a84c', approved: '#2e7d52', rejected: '#c0392b' }
const LIVE_PLATFORM_OPTIONS = ['facebook', 'tiktok', 'youtube']

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const TH_DAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

const HIJRI_MONTHS = [
  'มุฮัรรอม', 'ศอฟัร', 'รอบีอุลเอาวัล', 'รอบีอุษษานี',
  'ญุมาดัลอูลา', 'ญุมาดัลอาคิเราะห์', 'รอญับ', 'ชะอฺบาน',
  'รอมฎอน', 'เชาวาล', 'ซุลกิอฺดะฮฺ', 'ซุลหิจญะฮฺ',
]

function getHijri(date) {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'numeric', year: 'numeric',
    }).formatToParts(date)
    const v = {}
    for (const p of parts) v[p.type] = p.value
    return { d: +v.day, m: +v.month - 1, y: +v.year }
  } catch { return null }
}

const pad = (n) => String(n).padStart(2, '0')
const dateKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`
const todayKey = () => { const t = new Date(); return dateKey(t.getFullYear(), t.getMonth(), t.getDate()) }

const EMPTY_FORM = {
  title: '', text: '', time: '10:00', platforms: [], status: 'scheduled', mediaUrls: [], mediaPublicIds: [], realPublish: false,
  campaignId: '', contentType: 'post', liveScheduledAt: '', livePlatforms: [], liveHost: '', approvalStatus: 'draft',
}

export default function AdminCalendar() {
  const { user, loading } = useAdminAuth()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-11
  const [selected, setSelected] = useState(todayKey())

  const [posts, setPosts] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [status, setStatus] = useState('')
  const [uploading, setUploading] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [showHub, setShowHub] = useState(false)
  const [mainTab, setMainTab] = useState('calendar') // 'calendar' | 'chat' | 'comments' | 'insights'
  const [socialNotice, setSocialNotice] = useState('')

  useEffect(() => {
    if (!user) return // อย่าเปิด listener ก่อนล็อกอิน (contentPosts อ่านได้เฉพาะแอดมิน) — กัน permission-denied และข้อมูลว่างหลังล็อกอินบนหน้า
    const unsub = onSnapshot(collection(db, 'contentPosts'), (snap) => {
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [user])

  useEffect(() => {
    if (!user) return
    const unsub = onSnapshot(collection(db, 'campaigns'), (snap) => setCampaigns(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    return unsub
  }, [user])

  // ไม่ดึงสถานะ "เชื่อมต่อแล้ว/ยังไม่เชื่อม" มาแสดงที่นี่ — token เก็บอยู่ในฐานข้อมูลของ Content Hub
  // หน้านี้อ่านไม่ได้ (คนละระบบ) ถ้าเดาแล้วโชว์ว่า "ยังไม่ได้เชื่อมต่อ" ทุกอันจะเป็นข้อมูลผิดเสมอ
  // สถานะจริงดูได้ที่หน้า Accounts ของ Content Hub เท่านั้น

  // เปิดหน้าเชื่อมบัญชีของ Content Hub (แท็บใหม่) — ที่นั่นมีปุ่มเชื่อมต่อจริงของทั้ง 5 แพลตฟอร์ม
  // ล็อกอินด้วยรหัสผ่านของ Content Hub เองครั้งแรก แล้วกดเชื่อมต่อได้เลย
  const openContentHub = (path = '/accounts') => {
    window.open(`${CONTENT_HUB_URL}${path}`, '_blank', 'noopener,noreferrer')
  }

  // "โพสต์จริง" ทำที่ Content Hub — คัดลอกข้อความ+ลิงก์รูปของโพสต์นี้ไว้ในคลิปบอร์ดให้ก่อน
  // แล้วเปิดหน้า compose ของ Content Hub ให้วางต่อ (สองระบบเก็บข้อมูลแยกกัน ส่งข้ามให้อัตโนมัติไม่ได้)
  const publishNow = async (postId) => {
    const p = posts.find((x) => x.id === postId)
    if (!p) return
    const text = [p.title, p.text, ...(p.mediaUrls || [])].filter(Boolean).join('\n\n')
    try { await navigator.clipboard.writeText(text) } catch { /* คลิปบอร์ดใช้ไม่ได้ก็ยังเปิดหน้าให้ */ }
    setSocialNotice('คัดลอกเนื้อหาโพสต์แล้ว — วางในหน้า Content Hub ที่เพิ่งเปิดขึ้นมาได้เลย')
    openContentHub('/compose')
  }

  // โพสต์จัดกลุ่มตามวันที่ ใช้แสดงจุดบนปฏิทิน
  const byDate = useMemo(() => {
    const m = {}
    posts.forEach((p) => { (m[p.date] = m[p.date] || []).push(p) })
    Object.values(m).forEach((arr) => arr.sort((a, b) => (a.time || '').localeCompare(b.time || '')))
    return m
  }, [posts])

  if (loading) return null
  if (!user) return <AdminLogin />

  // ตารางวันของเดือนที่แสดง (เริ่มวันอาทิตย์)
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(year - 1) } else setMonth(month - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(year + 1) } else setMonth(month + 1) }

  const togglePlatform = (id) => {
    setForm((f) => ({
      ...f,
      platforms: f.platforms.includes(id) ? f.platforms.filter((p) => p !== id) : [...f.platforms, id],
    }))
  }

  const uploadMedia = async (e) => {
    const files = [...e.target.files]
    if (!files.length) return
    setUploading(true)
    try {
      const results = await Promise.all(files.map((f) => uploadToCloudinary(f, 'auto')))
      setForm((f) => ({
        ...f,
        mediaUrls: [...f.mediaUrls, ...results.map((r) => r.url)],
        // เก็บคู่กับ mediaUrls (index ตรงกัน) ไว้ใช้ตอนลบไฟล์จริงออกจาก Cloudinary หลังโพสต์สำเร็จ (ดู cleanupPublishedMedia)
        mediaPublicIds: [...(f.mediaPublicIds || []), ...results.map((r) => ({ publicId: r.publicId, resourceType: r.type }))],
      }))
    } catch (err) {
      setStatus('อัพโหลดไม่สำเร็จ: ' + err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removeMedia = (i) => setForm((f) => ({
    ...f,
    mediaUrls: f.mediaUrls.filter((_, j) => j !== i),
    mediaPublicIds: (f.mediaPublicIds || []).filter((_, j) => j !== i),
  }))

  const copyAndOpen = async (p, platform) => {
    const text = [p.title, p.text, ...(p.mediaUrls || [])].filter(Boolean).join('\n\n')
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopiedId(p.id + platform)
    setTimeout(() => setCopiedId(null), 2000)
    const url = platform === 'x'
      ? `https://x.com/intent/post?text=${encodeURIComponent((p.title || '') + (p.text ? '\n' + p.text : ''))}`
      : PLATFORM_OPEN[platform]
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  const startEdit = (p) => {
    setEditId(p.id)
    setForm({
      title: p.title, text: p.text || '', time: p.time || '10:00', platforms: p.platforms || [], status: p.status || 'scheduled',
      mediaUrls: p.mediaUrls || [], mediaPublicIds: p.mediaPublicIds || [], realPublish: p.realPublish || false,
      campaignId: p.campaignId || '', contentType: p.contentType || 'post', liveScheduledAt: p.liveScheduledAt || '',
      livePlatforms: p.livePlatforms || [], liveHost: p.liveHost || '', approvalStatus: p.approvalStatus || 'draft',
    })
  }
  const cancelEdit = () => { setEditId(null); setForm(EMPTY_FORM) }

  const save = async () => {
    if (!form.title.trim()) { setStatus('กรุณากรอกชื่อกิจกรรม/โพสต์'); return }
    setStatus('กำลังบันทึก...')
    try {
      const payload = {
        date: selected,
        time: form.time,
        title: form.title.trim(),
        text: form.text.trim(),
        platforms: form.platforms,
        status: form.status,
        mediaUrls: form.mediaUrls,
        mediaPublicIds: form.mediaPublicIds,
        realPublish: form.realPublish,
        campaignId: form.campaignId || null,
        contentType: form.contentType,
        approvalStatus: form.approvalStatus,
        ...(form.contentType === 'live' ? {
          liveScheduledAt: form.liveScheduledAt || '',
          livePlatforms: form.livePlatforms,
          liveHost: form.liveHost.trim(),
        } : {}),
      }
      if (editId) {
        await updateDoc(doc(db, 'contentPosts', editId), payload)
      } else {
        await addDoc(collection(db, 'contentPosts'), { ...payload, createdAt: Date.now() })
      }
      cancelEdit()
      setStatus('บันทึกสำเร็จ ✓')
      setTimeout(() => setStatus(''), 2000)
    } catch (e) {
      setStatus('เกิดข้อผิดพลาด: ' + e.message)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('ลบโพสต์นี้?')) return
    try { await deleteDoc(doc(db, 'contentPosts', id)) } catch (e) { window.alert('ลบไม่สำเร็จ: ' + e.message) }
  }

  const markPosted = async (p) => {
    try { await updateDoc(doc(db, 'contentPosts', p.id), { status: 'posted' }) } catch (e) { window.alert(e.message) }
  }

  // เปลี่ยนสถานะอนุมัติ — บังคับที่ UI เท่านั้นในรอบนี้ (contentPosts ทั้ง collection เขียนได้เฉพาะ isFullAdmin()
  // อยู่แล้วตาม firestore.rules เดิม ซึ่งเข้มกว่า "เฉพาะ admin" ที่โจทย์ขอสำหรับฟิลด์นี้อยู่แล้ว จึงไม่ต้องเพิ่ม
  // rule แยกฟิลด์ — แต่ไม่ได้แยกสิทธิ์ staff/field ที่ไม่ใช่ isFullAdmin ออกจาก field อื่นๆ ของโพสต์เดียวกัน)
  const setApproval = async (p, approvalStatus) => {
    try { await updateDoc(doc(db, 'contentPosts', p.id), { approvalStatus }) } catch (e) { window.alert(e.message) }
  }

  const dayPosts = byDate[selected] || []
  const selDate = new Date(selected)

  return (<VolunteerGuard>
    <main className="admin-dash admin-qurban">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1>ปฏิทินคอนเทนต์</h1>
            <p>วางแผนกิจกรรมและโพสต์ลงโซเชียล — เลือกวัน เพิ่มโพสต์ ตั้งเวลา เลือกแพลตฟอร์ม</p>
          </div>
          <button type="button" className="admin-btn-primary" onClick={() => setShowHub((v) => !v)}>
            <FontAwesomeIcon icon={faPlug} /> {showHub ? 'ปิดการเชื่อมต่อแพลตฟอร์ม' : 'เชื่อมต่อแพลตฟอร์ม / โพสต์จริง'}
          </button>
        </div>

        {showHub && (
          <div className="admin-card" style={{ marginBottom: 20 }}>
            <h4><FontAwesomeIcon icon={faLink} /> เชื่อมบัญชี &amp; โพสต์จริงลงแพลตฟอร์ม</h4>
            <p style={{ color: 'var(--ink-soft)', fontSize: '.85rem', marginBottom: 14 }}>
              การเชื่อมบัญชีและโพสต์จริงทำที่ <strong>Content Hub</strong> (เว็บแยก) เพราะการเชื่อมต่อแบบ OAuth ต้องมีเซิร์ฟเวอร์
              เก็บกุญแจและ token ไว้อย่างปลอดภัย ซึ่งเว็บนี้ไม่มี — กดปุ่มด้านล่างเพื่อไปเชื่อมต่อ (ล็อกอินด้วยรหัสผ่านของ
              Content Hub ครั้งแรกครั้งเดียว) เชื่อมแล้วโพสต์ได้ทั้ง 5 แพลตฟอร์มจากที่นั่น
            </p>
            {socialNotice && (
              <p style={{ background: '#eef7ee', border: '1px solid #b7ddb7', borderRadius: 8, padding: '10px 12px', fontSize: '.82rem', color: '#2e7d52', marginBottom: 14 }}>
                {socialNotice}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              <button className="admin-btn-primary" onClick={() => openContentHub('/accounts')}>
                <FontAwesomeIcon icon={faLink} /> เชื่อมต่อแพลตฟอร์ม
              </button>
              <button className="admin-btn" onClick={() => openContentHub('/compose')}>
                <FontAwesomeIcon icon={faPaperPlane} /> ไปหน้าสร้างโพสต์
              </button>
              <button className="admin-btn" onClick={() => openContentHub('/posts')}>
                ประวัติโพสต์
              </button>
            </div>
            {/* แสดงแค่รายชื่อแพลตฟอร์มที่รองรับ ไม่โชว์สถานะเชื่อมต่อ เพราะหน้านี้อ่านสถานะจริงไม่ได้ */}
            <div className="admin-cal-social-list">
              {SOCIAL_PLATFORMS.map((pl) => (
                <div key={pl.id} className="admin-cal-social-row">
                  <span className="admin-cal-social-dot" style={{ background: pl.color }} />
                  <div style={{ flex: 1 }}>
                    <strong>{pl.label}</strong>
                    <div style={{ fontSize: '.8rem', color: '#999' }}>
                      {pl.needsVideo ? 'ต้องมีไฟล์วิดีโอ' : 'โพสต์ข้อความ/รูป/วิดีโอได้'}
                    </div>
                  </div>
                  <button className="admin-btn" onClick={() => openContentHub('/accounts')}>
                    <FontAwesomeIcon icon={faArrowUpRightFromSquare} /> เชื่อมต่อ
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="admin-cal-tabs" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button className="admin-btn" style={mainTab === 'calendar' ? { background: 'var(--brand, #2e7d52)', color: '#fff' } : {}} onClick={() => setMainTab('calendar')}>
            <FontAwesomeIcon icon={faCalendarDays} /> ปฏิทิน
          </button>
          <button className="admin-btn" style={mainTab === 'chat' ? { background: 'var(--brand, #2e7d52)', color: '#fff' } : {}} onClick={() => setMainTab('chat')}>
            <FontAwesomeIcon icon={faComments} /> กล่องข้อความ
          </button>
          <button className="admin-btn" style={mainTab === 'comments' ? { background: 'var(--brand, #2e7d52)', color: '#fff' } : {}} onClick={() => setMainTab('comments')}>
            <FontAwesomeIcon icon={faMessage} /> คอมเมนต์
          </button>
          <button className="admin-btn" style={mainTab === 'insights' ? { background: 'var(--brand, #2e7d52)', color: '#fff' } : {}} onClick={() => setMainTab('insights')}>
            <FontAwesomeIcon icon={faChartLine} /> ภาพรวมเพจ
          </button>
        </div>

        {mainTab === 'chat' && <ChatInboxTab />}
        {mainTab === 'comments' && <CommentsTab />}
        {mainTab === 'insights' && <InsightsTab />}

        {mainTab === 'calendar' && <div className="admin-cal-layout">
          {/* ปฏิทินรายเดือน */}
          <div className="admin-card admin-cal-card">
            <div className="admin-cal-head">
              <button className="admin-btn" onClick={prevMonth}><FontAwesomeIcon icon={faChevronLeft} /></button>
              <div style={{ textAlign: 'center' }}>
                <h4 style={{ margin: 0 }}>{TH_MONTHS[month]} {year + 543}</h4>
                {(() => {
                  const hFirst = getHijri(new Date(year, month, 1))
                  const hLast = getHijri(new Date(year, month, daysInMonth))
                  if (!hFirst || !hLast) return null
                  const label = hFirst.m === hLast.m
                    ? `${HIJRI_MONTHS[hFirst.m]} ${hFirst.y} ฮ.ศ.`
                    : `${HIJRI_MONTHS[hFirst.m]} – ${HIJRI_MONTHS[hLast.m]} ${hLast.y} ฮ.ศ.`
                  return <div className="admin-cal-hijri-header">{label}</div>
                })()}
              </div>
              <button className="admin-btn" onClick={nextMonth}><FontAwesomeIcon icon={faChevronRight} /></button>
            </div>
            <div className="admin-cal-grid">
              {TH_DAYS.map((d) => <div className="admin-cal-dow" key={d}>{d}</div>)}
              {cells.map((d, i) => {
                if (d === null) return <div key={`e${i}`} />
                const key = dateKey(year, month, d)
                const has = byDate[key] || []
                return (
                  <button
                    key={key}
                    className={`admin-cal-day ${key === selected ? 'sel' : ''} ${key === todayKey() ? 'today' : ''}`}
                    onClick={() => { setSelected(key); cancelEdit() }}
                  >
                    <span>{d}</span>
                    {(() => { const h = getHijri(new Date(year, month, d)); return h ? <span className="admin-cal-hijri">{h.d}</span> : null })()}
                    {has.length > 0 && (
                      <span className="admin-cal-dots">
                        {has.slice(0, 3).map((p, j) => <i key={j} style={{ background: STATUS_COLOR[p.status] || '#999' }} />)}
                        {has.length > 3 && <em>+{has.length - 3}</em>}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="admin-cal-legend">
              {Object.entries(STATUS).map(([k, v]) => (
                <span key={k}><i style={{ background: STATUS_COLOR[k] }} /> {v}</span>
              ))}
            </div>
          </div>

          {/* รายการโพสต์ของวันที่เลือก + ฟอร์ม */}
          <div className="admin-cal-side">
            <div className="admin-card">
              <h4>{selDate.getDate()} {TH_MONTHS[selDate.getMonth()]} {selDate.getFullYear() + 543} — {dayPosts.length} โพสต์</h4>
              {(() => { const h = getHijri(selDate); return h ? <div className="admin-cal-hijri-header" style={{ marginTop: -6, marginBottom: 8 }}>{h.d} {HIJRI_MONTHS[h.m]} {h.y} ฮ.ศ.</div> : null })()}
              {dayPosts.length === 0 && <p style={{ color: '#999', fontSize: '.9rem' }}>ยังไม่มีโพสต์ในวันนี้</p>}
              {dayPosts.map((p) => (
                <div className="admin-post" key={p.id}>
                  <div className="admin-post-top">
                    <strong>{p.time} · {p.title} {p.contentType === 'live' && '🔴 ไลฟ์'}</strong>
                    <span className="admin-post-status" style={{ background: STATUS_COLOR[p.status] }}>{STATUS[p.status]}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{ fontSize: '.72rem', padding: '2px 8px', borderRadius: 99, color: '#fff', background: APPROVAL_COLOR[p.approvalStatus || 'draft'] }}>
                      {APPROVAL_LABEL[p.approvalStatus || 'draft']}
                    </span>
                    {p.campaignId && (
                      <span style={{ fontSize: '.72rem', padding: '2px 8px', borderRadius: 99, background: '#eee' }}>
                        แคมเปญ: {campaigns.find((c) => c.id === p.campaignId)?.name || p.campaignId}
                      </span>
                    )}
                  </div>
                  {p.contentType === 'live' && (
                    <div style={{ fontSize: '.8rem', color: 'var(--ink-soft)', marginBottom: 6 }}>
                      {p.liveScheduledAt && <>เวลาไลฟ์: {p.liveScheduledAt} · </>}
                      {(p.livePlatforms || []).length > 0 && <>แพลตฟอร์ม: {p.livePlatforms.join(', ')} · </>}
                      {p.liveHost && <>ผู้ดำเนินรายการ: {p.liveHost}</>}
                    </div>
                  )}
                  {p.text && <p className="admin-post-text">{p.text}</p>}
                  {(p.mediaUrls || []).length > 0 && (
                    <div className="admin-post-media">
                      {p.mediaUrls.map((url, mi) => (
                        url.match(/\.(mp4|mov|webm)/i)
                          ? <video key={mi} src={url} className="admin-post-media-item" muted controls />
                          : <img key={mi} src={url} alt="" className="admin-post-media-item" />
                      ))}
                    </div>
                  )}
                  <div className="admin-post-platforms">
                    {(p.platforms || []).map((id) => {
                      const pl = PLATFORMS.find((x) => x.id === id)
                      return pl ? <span key={id} style={{ background: pl.color }}>{pl.label}</span> : null
                    })}
                  </div>
                  {(p.platforms || []).length > 0 && (
                    <div className="admin-post-share">
                      {(p.platforms || []).map((id) => {
                        const pl = PLATFORMS.find((x) => x.id === id)
                        if (!pl) return null
                        const key = p.id + id
                        return (
                          <button key={id} className="admin-post-share-btn" style={{ background: pl.color }} onClick={() => copyAndOpen(p, id)}>
                            <FontAwesomeIcon icon={copiedId === key ? faCheck : faCopy} /> {pl.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {p.realStatus && (
                    <div className="admin-post-platforms" style={{ marginTop: 6 }}>
                      <span style={{ background: p.realStatus === 'posted' ? '#2e7d52' : p.realStatus === 'failed' ? '#c0392b' : '#c9a84c' }}>
                        {REAL_STATUS_LABEL[p.realStatus] || p.realStatus}
                      </span>
                      {Object.entries(p.publishResults || {}).filter(([, r]) => !r.ok).map(([pf, r]) => (
                        <span key={pf} title={r.error} style={{ background: '#c0392b' }}>
                          <FontAwesomeIcon icon={faTriangleExclamation} /> {pf}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="admin-post-actions" style={{ marginBottom: 6 }}>
                    {Object.entries(APPROVAL_LABEL).map(([k, v]) => (
                      <button
                        key={k} className="admin-btn" style={(p.approvalStatus || 'draft') === k ? { background: APPROVAL_COLOR[k], color: '#fff' } : {}}
                        onClick={() => setApproval(p, k)}
                      >{v}</button>
                    ))}
                  </div>
                  <div className="admin-post-actions">
                    {p.status !== 'posted' && <button className="admin-btn" onClick={() => markPosted(p)}><FontAwesomeIcon icon={faCheck} /> โพสต์แล้ว</button>}
                    {(p.platforms || []).some((id) => SOCIAL_PLATFORMS.some((s) => s.id === id)) && (
                      // คัดลอกเนื้อหาแล้วเปิดหน้าสร้างโพสต์ของ Content Hub ให้วางต่อ (โพสต์จริงทำที่นั่น)
                      <button className="admin-btn" onClick={() => publishNow(p.id)}>
                        <FontAwesomeIcon icon={faPaperPlane} /> โพสต์จริง (ไป Content Hub)
                      </button>
                    )}
                    <button className="admin-btn" onClick={() => startEdit(p)}>แก้ไข</button>
                    <button className="admin-btn-danger" onClick={() => remove(p.id)}>ลบ</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="admin-card">
              <h4>{editId ? 'แก้ไขโพสต์' : 'เพิ่มกิจกรรม / โพสต์ใหม่'}</h4>
              <div className="admin-cal-form">
                <label>ชื่อกิจกรรม/โพสต์
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="เช่น โพสต์อัปเดตภารกิจกุรบาน" />
                </label>
                <label>ข้อความ/แคปชัน
                  <textarea rows="4" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="เนื้อหาที่จะโพสต์..." />
                </label>
                <div className="admin-cal-form-row">
                  <label>เวลาโพสต์
                    <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                  </label>
                  <label>สถานะ
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </label>
                </div>
                <div className="admin-cal-form-row">
                  <label>ชนิดคอนเทนต์
                    <select value={form.contentType} onChange={(e) => setForm({ ...form, contentType: e.target.value })}>
                      {Object.entries(CONTENT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </label>
                  <label>แคมเปญที่เกี่ยวข้อง
                    <select value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })}>
                      <option value="">-- ไม่ระบุ --</option>
                      {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                </div>
                {form.contentType === 'live' && (
                  <div className="admin-cal-form-row" style={{ flexWrap: 'wrap' }}>
                    <label>วันเวลาไลฟ์
                      <input type="datetime-local" value={form.liveScheduledAt} onChange={(e) => setForm({ ...form, liveScheduledAt: e.target.value })} />
                    </label>
                    <label>ผู้ดำเนินรายการ
                      <input value={form.liveHost} onChange={(e) => setForm({ ...form, liveHost: e.target.value })} />
                    </label>
                    <div>
                      <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 6 }}>แพลตฟอร์มไลฟ์</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {LIVE_PLATFORM_OPTIONS.map((pf) => (
                          <button
                            key={pf} type="button"
                            className={form.livePlatforms.includes(pf) ? 'admin-btn-primary' : 'admin-btn'}
                            style={{ fontSize: '.8rem', padding: '6px 14px' }}
                            onClick={() => setForm((f) => ({ ...f, livePlatforms: f.livePlatforms.includes(pf) ? f.livePlatforms.filter((x) => x !== pf) : [...f.livePlatforms, pf] }))}
                          >{pf}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 6 }}>รูป / วิดีโอ</div>
                  <label className="admin-upload-btn" style={{ opacity: uploading ? .6 : 1, pointerEvents: uploading ? 'none' : 'auto' }}>
                    <FontAwesomeIcon icon={uploading ? faSpinner : faImage} spin={uploading} />
                    {uploading ? ' กำลังอัพโหลด...' : ' เลือกรูป / วิดีโอ'}
                    <input type="file" accept="image/*,video/*" multiple hidden onChange={uploadMedia} />
                  </label>
                  {form.mediaUrls.length > 0 && (
                    <div className="admin-media-preview">
                      {form.mediaUrls.map((url, i) => (
                        <div key={i} className="admin-media-thumb">
                          {url.match(/\.(mp4|mov|webm)/i)
                            ? <video src={url} muted />
                            : <img src={url} alt="" />}
                          <button type="button" className="admin-media-remove" onClick={() => removeMedia(i)}><FontAwesomeIcon icon={faXmark} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <label>แพลตฟอร์ม</label>
                <div className="admin-cal-platforms">
                  {PLATFORMS.map((pl) => (
                    <button
                      key={pl.id}
                      type="button"
                      className={form.platforms.includes(pl.id) ? 'on' : ''}
                      style={form.platforms.includes(pl.id) ? { background: pl.color, borderColor: pl.color, color: '#fff' } : {}}
                      onClick={() => togglePlatform(pl.id)}
                    >
                      {pl.label}
                    </button>
                  ))}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row', fontWeight: 400 }}>
                  <input type="checkbox" checked={form.realPublish} onChange={(e) => setForm({ ...form, realPublish: e.target.checked })} />
                  ตั้งเวลาโพสต์จริงอัตโนมัติ (ต้องเชื่อมต่อแพลตฟอร์มไว้ก่อน — ระบบจะโพสต์จริงให้เมื่อถึงเวลา)
                </label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
                  <button className="admin-btn-primary" onClick={save}>{editId ? 'บันทึกการแก้ไข' : 'เพิ่มโพสต์'}</button>
                  {editId && <button className="admin-btn" onClick={cancelEdit}>ยกเลิก</button>}
                  {status && <span style={{ fontSize: '.85rem' }}>{status}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>}
      </div>
    </main>
  </VolunteerGuard>)
}
