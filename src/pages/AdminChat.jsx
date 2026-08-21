import { useEffect, useState } from 'react'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import VolunteerGuard from '../components/VolunteerGuard.jsx'
import { useAllowlistedAdmin } from '../useAdminRole.js'
import { useAdminChatList, useChatMessages, sendAdminReply, markChatReadByAdmin, isSafeHttpUrl } from '../data/chat.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGlobe, faComment, faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { faLine, faFacebookMessenger } from '@fortawesome/free-brands-svg-icons'

// ป้ายบอกที่มาของแชท — เอกสารเก่าก่อนรองรับหลายแพลตฟอร์มไม่มี field 'platform' ถือเป็น 'web' โดยปริยาย
const PLATFORM_BADGE = {
  web: { icon: faGlobe, label: 'เว็บไซต์', color: '#16a34a' },
  line: { icon: faLine, label: 'LINE', color: '#06c755' },
  facebook: { icon: faFacebookMessenger, label: 'Messenger', color: '#0084ff' },
}
function PlatformBadge({ platform }) {
  const p = PLATFORM_BADGE[platform] || PLATFORM_BADGE.web
  return <FontAwesomeIcon icon={p.icon || faComment} style={{ color: p.color }} title={p.label} />
}

function timeLabel(ts) {
  if (!ts?.toDate) return ''
  const d = ts.toDate()
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })
}

// เปิดหน้าใหม่แยกจากรายการ (/admin/chat/<chatId>) — ไม่ใช้ useNavigate เพราะหน้าแอดมินเป็น standalone route
// ไม่มี NavCtx.Provider ครอบ (ดู App.jsx) จึงพาไปตรงๆ ผ่าน pathname เหมือนปุ่มแชทลอย
function goToChat(id) { window.location.href = id ? `/admin/chat/${encodeURIComponent(id)}` : '/admin/chat' }

function ChatThread({ chatId, title }) {
  const { messages } = useChatMessages(chatId)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => { markChatReadByAdmin(chatId).catch(() => {}) }, [chatId])

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    setText('')
    try {
      await sendAdminReply(chatId, trimmed)
    } catch {
      setText(trimmed)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="admin-chat-main admin-chat-main-page">
      <div className="admin-chat-thread-head">
        <button className="admin-chat-back" onClick={() => goToChat(null)} aria-label="กลับไปรายการแชท">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <span>{title}</span>
      </div>
      <div className="admin-chat-body">
        {messages.map((m) => (
          // มุมมองแอดมิน: ข้อความของแอดมินเองชิดขวา ของผู้เยี่ยมชมชิดซ้าย — ตรงข้ามกับวิดเจ็ตฝั่งผู้เยี่ยมชม
          // (chat-bubble-visitor/-admin ใน chat.css ออกแบบไว้สำหรับวิดเจ็ตฝั่งผู้เยี่ยมชม ใช้ตรงๆ ที่นี่จะชิดขวาทั้งคู่) จึงใช้คลาสแยกของหน้านี้เอง
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
            <div key={m.id} className={`chat-bubble admin-msg-${m.sender === 'admin' ? 'mine' : 'theirs'}`}>
              {m.text}
            </div>
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

// รายการแชท — กดแล้วเปิดเป็นหน้าใหม่ /admin/chat/<chatId> (แยกจากรายการ ไม่ใช่แผงข้างกันอีกต่อไป)
function ChatList({ chats, chatsLoading }) {
  return (
    <div className="admin-chat-list admin-chat-list-page">
      {!chatsLoading && chats.length === 0 && <div className="admin-chat-empty">ยังไม่มีแชทเข้ามา</div>}
      {chats.map((c) => (
        <div key={c.id} className="admin-chat-item" onClick={() => goToChat(c.id)}>
          <div className="admin-chat-item-top">
            <span className="admin-chat-item-name"><PlatformBadge platform={c.platform} /> {c.visitorName || `ผู้เยี่ยมชม ${c.id.slice(0, 6)}`}</span>
            <span>{timeLabel(c.lastMessageAt)}{c.unreadByAdmin && <span className="admin-chat-dot" />}</span>
          </div>
          <div className="admin-chat-item-text">{c.lastSender === 'admin' ? 'คุณ: ' : ''}{c.lastMessageText}</div>
        </div>
      ))}
    </div>
  )
}

export default function AdminChat({ chatId }) {
  const { user, loading } = useAllowlistedAdmin()
  const { chats, loading: chatsLoading } = useAdminChatList()

  if (loading) return null
  if (!user) return <AdminLogin />

  const activeChat = chatId ? chats.find((c) => c.id === chatId) : null
  const title = activeChat ? (activeChat.visitorName || `ผู้เยี่ยมชม ${chatId.slice(0, 6)}`) : (chatId ? `ผู้เยี่ยมชม ${chatId.slice(0, 6)}` : '')

  // แชทเป็นข้อมูลส่วนตัวของผู้เยี่ยมชม — firestore.rules จำกัดไว้ที่ isFullAdmin() แล้ว
  // แต่บัญชี volunteer ยังอยู่ใน allowlist จึงเปิด URL นี้ได้และเห็นกล่องแชทว่างเปล่าโดยไม่รู้ว่าไม่มีสิทธิ์
  // (useAdminChatList กลืน permission error เป็น setLoading(false) เฉยๆ) — บอกให้ชัดดีกว่า
  return (
    <VolunteerGuard>
      <main className="admin-dash">
        <AdminNav />
        {chatId ? (
          <ChatThread key={chatId} chatId={chatId} title={title} />
        ) : (
          <ChatList chats={chats} chatsLoading={chatsLoading} />
        )}
      </main>
    </VolunteerGuard>
  )
}
