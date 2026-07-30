import { useEffect, useMemo, useState } from 'react'
import VolunteerGuard from '../components/VolunteerGuard.jsx'
import { collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import { isFullAdminEmail } from '../useAdminRole.js'
import useAdminAuth from '../useAdminAuth.js'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import { useAdminChatList, useChatMessages, sendAdminReply, markChatReadByAdmin, isSafeHttpUrl } from '../data/chat.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChevronLeft, faChevronRight, faCheck, faXmark, faCopy,
  faPlug, faLink, faArrowUpRightFromSquare, faPaperPlane, faTriangleExclamation, faCalendarDays,
  faComments, faGlobe, faComment, faArrowLeft, faChartLine, faMessage, faPenToSquare, faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { faLine, faFacebookMessenger, faInstagram } from '@fortawesome/free-brands-svg-icons'

import { withSearchTokens } from '../lib/searchIndex.js'
import { STATUS, STATUS_COLOR, STATUS_ORDER, normStatus, statusAfterDriveLink } from '../data/contentStatus.js'
// ฟิลด์ที่เอาไปสร้างดัชนีคำค้น — ต้องตรงกับ SEARCH_COLLECTIONS ใน lib/searchIndex.js
const SEARCH_FIELDS = ['title', 'text']

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

// ปิดทุกส่วนที่ผูกกับ Content Hub (เว็บแยกสำหรับเชื่อม OAuth + โพสต์จริง) ไว้ก่อน
// ครอบคลุม: ปุ่ม "เชื่อมต่อแพลตฟอร์ม / โพสต์จริง" + แผงเชื่อมบัญชี, แท็บกล่องข้อความ/คอมเมนต์/
// ภาพรวมเพจ, ตัวเลือกแพลตฟอร์ม + ติ๊กโพสต์จริงอัตโนมัติในฟอร์ม, และปุ่ม "โพสต์จริง" ในรายการโพสต์
// เปลี่ยนเป็น true เพื่อเปิดกลับทั้งหมดพร้อมกัน — โค้ดยังอยู่ครบ ไม่ได้ลบทิ้ง
// ข้อมูลเดิม (platforms/realPublish ของโพสต์ที่บันทึกไว้แล้ว) ไม่ถูกแตะ ยังอยู่ใน Firestore เหมือนเดิม
const SHOW_CONTENT_HUB = false

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

// เหลือ 2 สถานะเท่านั้น — ร่าง (ยังไม่ได้โพสต์) กับ โพสต์แล้ว
// ทอง = ยังมีงานค้าง / เขียว = เสร็จแล้ว ใช้ระบายสีวันในปฏิทินด้วย (ดู dominant ในกริด)


// ข้อมูลเก่ามีสถานะ 'scheduled' (ตั้งเวลาแล้ว) และ approvalStatus ที่เลิกใช้แล้ว
// แปลงให้เป็น 2 สถานะใหม่ตอนแสดงผล โดยไม่ต้องไล่แก้ข้อมูลเดิมใน Firestore


// ชนิดคอนเทนต์ + สถานะอนุมัติ (ข้อ 4 ของแผน admin-intranet-plan.md) — เพิ่มเป็น field ใหม่ทั้งหมด ไม่แตะ field เดิม
// ชนิดคอนเทนต์ — 'live' มีฟิลด์เพิ่ม (เวลาไลฟ์/ผู้ดำเนินรายการ) ชนิดอื่นเป็นโพสต์ธรรมดาที่ต่างกันแค่ป้าย
const CONTENT_TYPE_LABEL = { post: 'โพสต์', video: 'โพสต์ VDO', picture: 'โพสต์ Picture', live: 'ไลฟ์สด' }
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
  title: '', text: '', time: '10:00', platforms: [], status: 'draft', mediaUrls: [], mediaPublicIds: [], realPublish: false,
  campaignId: '', contentType: 'post', liveScheduledAt: '', livePlatforms: [], liveHost: '', approvalStatus: 'draft',
  sources: [], // แหล่งข้อมูลอ้างอิง: [{ label, url }] กดแล้วเปิดลิงก์ในแท็บใหม่
  driveUrl: '', // ลิงก์ไฟล์งานใน Google Drive
}

export default function AdminCalendar() {
  const { user, loading } = useAdminAuth()

  // เปิดหน้านี้พร้อม ?date=YYYY-MM-DD (เช่น กดรายการจากแดชบอร์ด Staff) ให้เด้งไปเดือน/วันนั้นเลย
  // ไม่งั้นกดจากรายการแล้วมาโผล่ที่เดือนปัจจุบัน ต้องไล่หาวันเองอีกที
  const initial = (() => {
    const q = new URLSearchParams(window.location.search).get('date')
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(q || '')
    if (!m) return null
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return Number.isNaN(d.getTime()) ? null : { y: d.getFullYear(), mo: d.getMonth(), key: q }
  })()

  const now = new Date()
  const [year, setYear] = useState(initial?.y ?? now.getFullYear())
  const [month, setMonth] = useState(initial?.mo ?? now.getMonth()) // 0-11
  const [selected, setSelected] = useState(initial?.key ?? todayKey())
  const [detailId, setDetailId] = useState(null)

  const [posts, setPosts] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [status, setStatus] = useState('')
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
  // แท็บกล่องข้อความ/คอมเมนต์/ภาพรวมเพจ อ่าน chats + socialInsightsCache ซึ่ง firestore.rules
  // จำกัดไว้ที่ isFullAdmin() — ถ้าโชว์ให้ staff เห็นจะกดแล้วเจอหน้าว่างเปล่าโดยไม่มีอะไรบอกว่าไม่มีสิทธิ์
  const canSeeInbox = isFullAdminEmail(user.email || '')

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

  // ช่องอัพโหลดรูป/วิดีโอถูกแทนที่ด้วยลิงก์ Google Drive แล้ว (ดูฟอร์มด้านล่าง)
  // แต่ยังคงแสดง mediaUrls ของโพสต์เก่าที่อัพไว้ก่อนหน้า จึงไม่ลบฟิลด์ออกจากข้อมูล

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
      // normStatus: โพสต์เก่าที่เป็น 'scheduled' ต้องกลายเป็น 'draft' ไม่งั้นชิปไม่ตรงกับค่าใดเลยแล้วดูเหมือนไม่ได้เลือกอะไร
      title: p.title, text: p.text || '', time: p.time || '10:00', platforms: p.platforms || [], status: normStatus(p.status),
      mediaUrls: p.mediaUrls || [], mediaPublicIds: p.mediaPublicIds || [], realPublish: p.realPublish || false,
      campaignId: p.campaignId || '', contentType: p.contentType || 'post', liveScheduledAt: p.liveScheduledAt || '',
      livePlatforms: p.livePlatforms || [], liveHost: p.liveHost || '', approvalStatus: p.approvalStatus || 'draft',
      sources: p.sources || [],
      driveUrl: p.driveUrl || '',
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
        driveUrl: isSafeHttpUrl((form.driveUrl || '').trim()) ? form.driveUrl.trim() : '',
        realPublish: form.realPublish,
        // เก็บเฉพาะแหล่งที่มี url จริงและเป็น http(s) — ค่านี้ไปโผล่ใน href บนการ์ด ต้องกัน javascript: ไว้
        // ชื่อว่างให้ใช้ url เป็นชื่อแทน จะได้ไม่มีลิงก์ที่กดได้แต่ไม่รู้ว่าไปไหน
        sources: (form.sources || [])
          .map((s) => ({ label: (s.label || '').trim(), url: (s.url || '').trim() }))
          .filter((s) => isSafeHttpUrl(s.url))
          .map((s) => ({ label: s.label || s.url, url: s.url })),
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
        await updateDoc(doc(db, 'contentPosts', editId), withSearchTokens(payload, SEARCH_FIELDS))
      } else {
        await addDoc(collection(db, 'contentPosts'), withSearchTokens({ ...payload, createdAt: Date.now() }, SEARCH_FIELDS))
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

  // แหล่งข้อมูล (หลายลิงก์ต่อโพสต์)
  const addSource = () => setForm((f) => ({ ...f, sources: [...(f.sources || []), { label: '', url: '' }] }))
  const setSource = (i, patch) => setForm((f) => ({
    ...f, sources: (f.sources || []).map((s, j) => (j === i ? { ...s, ...patch } : s)),
  }))
  const removeSource = (i) => setForm((f) => ({ ...f, sources: (f.sources || []).filter((_, j) => j !== i) }))

  // เปลี่ยนสถานะจากชิปบนการ์ด (ร่าง / โพสต์แล้ว)
  const setPostStatus = async (p, status) => {
    try { await updateDoc(doc(db, 'contentPosts', p.id), { status }) } catch (e) { window.alert(e.message) }
  }

  const dayPosts = byDate[selected] || []
  // โพสต์ที่กดดูรายละเอียด — เก็บเป็น id ไม่ใช่ตัว object เพื่อให้ค่าที่โชว์อัปเดตตาม onSnapshot
  const detailPost = detailId ? dayPosts.find((p) => p.id === detailId) : null
  const selDate = new Date(selected)

  return (<StaffRoleGuard allowedRoles={['admin', 'staff', 'social']}>{() => (<VolunteerGuard>
    <main className="admin-dash admin-qurban admin-full">
      <AdminNav />
      <div className="admin-wrap">
        {/* การ์ดหัวเรื่องถูกเอาออก — ชื่อหน้าซ้ำกับเมนูซ้ายที่ไฮไลต์ "ปฏิทินคอนเทนต์" อยู่แล้ว
            เหลือไว้แค่ปุ่มเชื่อมต่อแพลตฟอร์มเมื่อเปิด Content Hub */}
        {SHOW_CONTENT_HUB && (
          <div style={{ marginBottom: 16 }}>
            <button type="button" className="admin-btn-primary" onClick={() => setShowHub((v) => !v)}>
              <FontAwesomeIcon icon={faPlug} /> {showHub ? 'ปิดการเชื่อมต่อแพลตฟอร์ม' : 'เชื่อมต่อแพลตฟอร์ม / โพสต์จริง'}
            </button>
          </div>
        )}

        {SHOW_CONTENT_HUB && showHub && (
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

        {/* แถบแท็บมีปุ่มเดียว ("ปฏิทิน") เมื่อปิด Content Hub ⇒ กดก็ไม่ไปไหน จึงซ่อนไปเลย
            แล้วเอาการ์ด "โพสต์ของวันที่เลือก" ขึ้นมาอยู่ตรงนี้แทน — เป็นสิ่งที่ต้องอ่านก่อนเสมอ
            (เดิมอยู่คอลัมน์กลาง ต้องกวาดตาไปหาข้างๆ ปฏิทิน) */}
        {SHOW_CONTENT_HUB && canSeeInbox && (
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
        )}

        {/* กดการ์ดโพสต์แล้วกางรายละเอียดครบในกล่องกลางจอ — การ์ดในหน้าโชว์แค่หัวข้อเพื่อให้เตี้ย
            ที่นี่จึงเป็นที่เดียวที่เห็นแคปชัน/ลิงก์/ไฟล์งานครบ และเปลี่ยนสถานะแบบกดเดียวได้ */}
        {detailPost && (
          <div className="admin-detail-overlay" role="dialog" aria-modal="true" onClick={() => setDetailId(null)}>
            <div className="admin-card admin-detail" onClick={(e) => e.stopPropagation()}>
              <div className="admin-detail-head">
                <h4>{detailPost.time} · {detailPost.title}</h4>
                <button className="admin-post-corner-btn" onClick={() => setDetailId(null)} aria-label="ปิด" title="ปิด">
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>
              <div className="admin-detail-meta">
                <span className="admin-post-status" style={{ background: STATUS_COLOR[normStatus(detailPost.status)] }}>
                  {STATUS[normStatus(detailPost.status)]}
                </span>
                <span>{CONTENT_TYPE_LABEL[detailPost.contentType] || 'โพสต์'}</span>
                {detailPost.campaignId && <span>{campaigns.find((c) => c.id === detailPost.campaignId)?.name || 'แคมเปญที่ถูกลบแล้ว'}</span>}
              </div>
              {detailPost.text
                ? <p className="admin-post-text">{detailPost.text}</p>
                : <p className="admin-detail-empty">ไม่มีข้อความ/แคปชัน</p>}
              {isSafeHttpUrl(detailPost.driveUrl) && (
                <div className="admin-post-sources">
                  <a href={detailPost.driveUrl} target="_blank" rel="noopener noreferrer" title={detailPost.driveUrl}>
                    <FontAwesomeIcon icon={faArrowUpRightFromSquare} /> ไฟล์งานใน Google Drive
                  </a>
                </div>
              )}
              {(detailPost.sources || []).filter((x) => isSafeHttpUrl(x.url)).length > 0 && (
                <div className="admin-post-sources">
                  {detailPost.sources.filter((x) => isSafeHttpUrl(x.url)).map((x, xi) => (
                    <a key={xi} href={x.url} target="_blank" rel="noopener noreferrer" title={x.url}>
                      <FontAwesomeIcon icon={faArrowUpRightFromSquare} /> {x.label}
                    </a>
                  ))}
                </div>
              )}
              {(detailPost.mediaUrls || []).length > 0 && (
                <div className="admin-post-media">
                  {detailPost.mediaUrls.map((url, mi) => (
                    url.match(/\.(mp4|mov|webm)/i)
                      ? <video key={mi} src={url} className="admin-post-media-item" muted controls />
                      : <img key={mi} src={url} alt="" className="admin-post-media-item" />
                  ))}
                </div>
              )}
              <div className="admin-post-actions">
                {Object.entries(STATUS).map(([k, v]) => (
                  <button
                    key={k} className="admin-btn"
                    style={normStatus(detailPost.status) === k ? { background: STATUS_COLOR[k], color: '#fff', borderColor: STATUS_COLOR[k] } : {}}
                    onClick={() => setPostStatus(detailPost, k)}
                  >{normStatus(detailPost.status) === k && <FontAwesomeIcon icon={faCheck} />} {v}</button>
                ))}
                <button className="admin-btn" onClick={() => { startEdit(detailPost); setDetailId(null) }}>
                  <FontAwesomeIcon icon={faPenToSquare} /> แก้ไข
                </button>
              </div>
            </div>
          </div>
        )}

        {mainTab === 'calendar' && (
          <div className="admin-cal-today" style={{ marginBottom: 20 }}>
              <div className="admin-card">
                <h4>{selDate.getDate()} {TH_MONTHS[selDate.getMonth()]} {selDate.getFullYear() + 543} — {dayPosts.length} โพสต์</h4>
                {(() => { const h = getHijri(selDate); return h ? <div className="admin-cal-hijri-header" style={{ marginTop: -6, marginBottom: 8 }}>{h.d} {HIJRI_MONTHS[h.m]} {h.y} ฮ.ศ.</div> : null })()}
                {dayPosts.length === 0 && <p style={{ color: '#999', fontSize: '.9rem' }}>ยังไม่มีโพสต์ในวันนี้</p>}
                {/* การ์ดนี้กว้างเต็มหน้า ถ้าเรียงโพสต์ลงมาทีละใบจะเหลือที่ว่างด้านขวาเยอะ
                    จึงวางเป็นกริดหลายคอลัมน์ในแถวเดียว (auto-fill ยุบเป็นคอลัมน์เดียวเองเมื่อที่ไม่พอ) */}
                <div className="admin-day-posts">
                {dayPosts.map((p) => (
                  <div
                    className="admin-post admin-post-clickable"
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailId(p.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailId(p.id) } }}
                  >
                    <div className="admin-post-top">
                      {/* ป้ายชนิดคอนเทนต์ต่อท้ายชื่อ — เดิมโชว์เฉพาะไลฟ์ พอมี VDO/Picture แล้วต้องแยกออกจากกันได้ */}
                      <strong>
                        {p.time} · {p.title}
                        {p.contentType === 'live' && ' 🔴 ไลฟ์'}
                        {p.contentType === 'video' && ' 🎬 VDO'}
                        {p.contentType === 'picture' && ' 🖼 Picture'}
                      </strong>
                      {/* แก้ไข/ลบ อยู่มุมขวาบนของการ์ด แยกออกจากปุ่มเปลี่ยนสถานะด้านล่าง
                          เพราะเป็นคนละงานกัน — อันนี้จัดการตัวการ์ด อันนั้นเปลี่ยนสถานะเนื้อหา */}
                      <span className="admin-post-corner">
                        <span className="admin-post-status" style={{ background: STATUS_COLOR[normStatus(p.status)] }}>
                          {STATUS[normStatus(p.status)]}
                        </span>
                        <button className="admin-post-corner-btn" onClick={(e) => { e.stopPropagation(); startEdit(p) }} aria-label="แก้ไขโพสต์" title="แก้ไข">
                          <FontAwesomeIcon icon={faPenToSquare} />
                        </button>
                        <button className="admin-post-corner-btn danger" onClick={(e) => { e.stopPropagation(); remove(p.id) }} aria-label="ลบโพสต์" title="ลบ">
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
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
                    {isSafeHttpUrl(p.driveUrl) && (
                      <div className="admin-post-sources">
                        <a href={p.driveUrl} target="_blank" rel="noopener noreferrer" title={p.driveUrl}>
                          <FontAwesomeIcon icon={faArrowUpRightFromSquare} /> ไฟล์งานใน Google Drive
                        </a>
                      </div>
                    )}
                    {(p.sources || []).length > 0 && (
                      <div className="admin-post-sources">
                        {p.sources.filter((s) => isSafeHttpUrl(s.url)).map((s, si) => (
                          <a key={si} href={s.url} target="_blank" rel="noopener noreferrer" title={s.url}>
                            <FontAwesomeIcon icon={faArrowUpRightFromSquare} /> {s.label}
                          </a>
                        ))}
                      </div>
                    )}
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
                    <div className="admin-post-actions">
                      {Object.entries(STATUS).map(([k, v]) => (
                        <button
                          key={k} className="admin-btn" style={normStatus(p.status) === k ? { background: STATUS_COLOR[k], color: '#fff', borderColor: STATUS_COLOR[k] } : {}}
                          onClick={() => setPostStatus(p, k)}
                        >{normStatus(p.status) === k && <FontAwesomeIcon icon={faCheck} />} {v}</button>
                      ))}
                      {SHOW_CONTENT_HUB && (p.platforms || []).some((id) => SOCIAL_PLATFORMS.some((s) => s.id === id)) && (
                        // คัดลอกเนื้อหาแล้วเปิดหน้าสร้างโพสต์ของ Content Hub ให้วางต่อ (โพสต์จริงทำที่นั่น)
                        <button className="admin-btn" onClick={() => publishNow(p.id)}>
                          <FontAwesomeIcon icon={faPaperPlane} /> โพสต์จริง (ไป Content Hub)
                        </button>
                      )}

                    </div>
                  </div>
                ))}
                </div>
              </div>
          </div>
        )}

        {SHOW_CONTENT_HUB && canSeeInbox && mainTab === 'chat' && <ChatInboxTab />}
        {SHOW_CONTENT_HUB && canSeeInbox && mainTab === 'comments' && <CommentsTab />}
        {SHOW_CONTENT_HUB && canSeeInbox && mainTab === 'insights' && <InsightsTab />}

        {mainTab === 'calendar' && <div className="admin-cal-layout">
          {/* ปฏิทินรายเดือน */}
          <div className="admin-card admin-cal-card">
            <div className="admin-cal-head">
              <button type="button" className="admin-btn" onClick={prevMonth} aria-label="เดือนก่อนหน้า" title="เดือนก่อนหน้า"><FontAwesomeIcon icon={faChevronLeft} /></button>
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
              <button type="button" className="admin-btn" onClick={nextMonth} aria-label="เดือนถัดไป" title="เดือนถัดไป"><FontAwesomeIcon icon={faChevronRight} /></button>
            </div>
            <div className="admin-cal-grid">
              {TH_DAYS.map((d) => <div className="admin-cal-dow" key={d}>{d}</div>)}
              {cells.map((d, i) => {
                if (d === null) return <div key={`e${i}`} />
                const key = dateKey(year, month, d)
                const has = byDate[key] || []
                // สีประจำวัน: เอาสถานะที่ "ค้างที่สุด" ของวันนั้นมาแสดง (ร่าง > ส่งตรวจ > โพสต์แล้ว)
                // เพื่อให้กวาดตาดูปฏิทินแล้วเห็นวันที่ยังมีงานค้างก่อน ไม่ใช่เห็นวันที่ทำเสร็จแล้วเด่นสุด
                const dominant = has.length === 0 ? null
                  : STATUS_ORDER.find((st) => has.some((p) => normStatus(p.status) === st))
                return (
                  <button
                    key={key}
                    className={`admin-cal-day ${has.length > 0 ? 'has-posts' : ''} ${key === selected ? 'sel' : ''} ${key === todayKey() ? 'today' : ''}`}
                    style={dominant ? { '--day-color': STATUS_COLOR[dominant] } : undefined}
                    title={has.length > 0 ? `${has.length} โพสต์` : undefined}
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

          {/* ฟอร์มเพิ่ม/แก้ไขโพสต์ (การ์ดโพสต์ของวันที่เลือกย้ายขึ้นไปด้านบนแล้ว) */}
          <div className="admin-cal-side">

            <div className="admin-card">
              <h4>{editId ? 'แก้ไขโพสต์' : 'เพิ่มกิจกรรม / โพสต์ใหม่'}</h4>
              <div className="admin-cal-form">
                <div className="admin-cal-form-main">
                <label>ชื่อกิจกรรม/โพสต์
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="เช่น โพสต์อัปเดตภารกิจกุรบาน" />
                </label>
                <div className="admin-cal-form-row">
                  <label>เวลาโพสต์
                    <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                  </label>
                  {/* สถานะเหลือ 2 ค่า ใช้ชิปกดเลือกแทน dropdown — เห็นค่าที่เลือกอยู่ทันทีไม่ต้องกางเมนู */}
                  <label>สถานะ
                    <div className="admin-cal-status-chips">
                      {Object.entries(STATUS).map(([k, v]) => (
                        <button
                          key={k}
                          type="button"
                          className={form.status === k ? 'on' : ''}
                          style={form.status === k ? { background: STATUS_COLOR[k], borderColor: STATUS_COLOR[k], color: '#fff' } : {}}
                          onClick={() => setForm({ ...form, status: k })}
                        >{v}</button>
                      ))}
                    </div>
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
                {/* แหล่งข้อมูลอ้างอิง — ใส่ได้หลายลิงก์ต่อโพสต์ (เช่น ข่าวต้นทาง, โพสต์ที่อ้างถึง, ไฟล์ใน Drive)
                    เก็บเป็น array ของ { label, url } ไม่ใช่ string เดียว เพื่อให้ตั้งชื่อให้อ่านรู้เรื่องได้
                    กรอง scheme ตอนบันทึก (ดู save) กัน javascript: เพราะค่านี้ไปโผล่ใน href บนการ์ด */}
                <div>
                  <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 6 }}>แหล่งข้อมูล</div>
                  {form.sources.map((s, i) => (
                    <div className="admin-cal-source-row" key={i}>
                      <input
                        placeholder="ชื่อแหล่ง (เช่น ข่าวต้นทาง)"
                        value={s.label}
                        onChange={(e) => setSource(i, { label: e.target.value })}
                      />
                      <input
                        placeholder="https://..."
                        value={s.url}
                        onChange={(e) => setSource(i, { url: e.target.value })}
                      />
                      <button type="button" className="admin-cal-source-del" onClick={() => removeSource(i)} aria-label="ลบแหล่งข้อมูลนี้">
                        <FontAwesomeIcon icon={faXmark} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="admin-btn" onClick={addSource}>+ เพิ่มแหล่งข้อมูล</button>
                </div>

                {/* ลิงก์ไฟล์งานใน Google Drive แทนการอัพโหลดไฟล์เข้าระบบ
                    ไฟล์งานจริง (ไฟล์ดิบ/ไฟล์ตัดต่อ) อยู่ใน Drive ของทีมอยู่แล้ว การอัพซ้ำเข้ามาที่นี่
                    ทำให้มีไฟล์สองชุดที่ไม่ตรงกัน — เก็บแค่ลิงก์ชี้ไปที่ต้นทางชุดเดียว
                    กรอง scheme ตอนบันทึก (ดู save) เพราะค่านี้ไปโผล่ใน href */}
                {/* ไม่เลื่อนสถานะอัตโนมัติตอนพิมพ์แล้ว — ใช้ปุ่ม "ส่งงาน" ด้านล่างเป็นตัวสั่ง
                    ถ้าเลื่อนให้เอง ปุ่มจะหายทันทีที่ลิงก์ครบ (เงื่อนไขโชว์ปุ่มคือยังไม่ได้ส่งงาน)
                    และกลายเป็นส่งงานโดยไม่ได้ตั้งใจแค่เพราะวางลิงก์ไว้ก่อน */}
                <label>ลิงก์งานจาก Google Drive
                  <input
                    type="url"
                    value={form.driveUrl}
                    onChange={(e) => setForm({ ...form, driveUrl: e.target.value })}
                    placeholder="https://drive.google.com/..."
                  />
                </label>


                {SHOW_CONTENT_HUB && <>
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
                </>}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
                  <button className="admin-btn-primary" onClick={save}>{editId ? 'บันทึกการแก้ไข' : 'เพิ่มโพสต์'}</button>
                  {isSafeHttpUrl((form.driveUrl || '').trim()) && form.status !== 'posted' && form.status !== 'review' && (
                    // ส่งงาน = แนบไฟล์ใน Drive เรียบร้อยแล้วและขอให้ตรวจ ⇒ เลื่อนสถานะเป็น "ส่งงาน" (คีย์ review)
                    <button className="admin-btn" onClick={() => setForm((f) => ({ ...f, status: statusAfterDriveLink(f.status) }))}>
                      ส่งงาน
                    </button>
                  )}
                  {editId && <button className="admin-btn" onClick={cancelEdit}>ยกเลิก</button>}
                  {status && <span style={{ fontSize: '.85rem' }}>{status}</span>}
                </div>
                </div>
                {/* คอลัมน์ 2: กล่องแคปชัน — ยืดสูงเต็มคอลัมน์เพื่อใช้พื้นที่ที่เหลือ */}
                <label className="admin-cal-caption">ข้อความ/แคปชัน
                  <textarea rows="4" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="เนื้อหาที่จะโพสต์..." />
                </label>
              </div>
            </div>
          </div>
        </div>}
      </div>
    </main>
  </VolunteerGuard>)}</StaffRoleGuard>)
}
