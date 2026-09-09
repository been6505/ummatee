import { useEffect, useState } from 'react'
import { useAdminChatList } from '../data/chat.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faComments } from '@fortawesome/free-solid-svg-icons'

// ปุ่มแชทลอยฝั่งแอดมิน — โชว์ทุกหน้าแอดมิน (mount ผ่าน AdminNav) กดแล้วพาไปหน้า /admin/chat
// ไม่โชว์ตอนอยู่หน้าแชทอยู่แล้ว ทั้งหน้ารายการ (/admin/chat) และหน้าสนทนารายคน (/admin/chat/<id>) — ซ้ำซ้อน
export default function AdminChatFab() {
  const { chats } = useAdminChatList()
  const unread = chats.filter((c) => c.unreadByAdmin).length

  // มีข้อความยังไม่อ่าน — สลับโชว์ "ตัวเลข" กับ "ข้อความเล็กๆ" ทุก 2.5 วิ ให้สังเกตง่ายกว่าเลขนิ่งๆ
  const [showNumber, setShowNumber] = useState(true)
  useEffect(() => {
    if (unread === 0) return
    const id = setInterval(() => setShowNumber((v) => !v), 2500)
    return () => clearInterval(id)
  }, [unread])

  if (window.location.pathname.startsWith('/admin/chat')) return null

  return (
    <button className="admin-chat-fab" onClick={() => { window.location.href = '/admin/chat' }} aria-label="แชท">
      <FontAwesomeIcon icon={faComments} />
      {unread > 0 && (
        <span className={`admin-chat-fab-badge${showNumber ? '' : ' admin-chat-fab-badge-text'}`}>
          {showNumber ? unread : 'ใหม่'}
        </span>
      )}
    </button>
  )
}
