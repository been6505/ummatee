import { useEffect, useRef, useState } from 'react'
import { getVisitorId, useChatMessages, sendVisitorMessage, sendVisitorProductCard, isSafeHttpUrl } from '../data/chat.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faComments, faXmark, faPaperPlane } from '@fortawesome/free-solid-svg-icons'

// วิดเจ็ตแชทลอยมุมล่างขวา — ให้ผู้เยี่ยมชมคุยกับแอดมินได้โดยไม่ต้องล็อกอิน
// ใช้ visitorId สุ่มเก็บใน localStorage เป็นตัวระบุแชท (1 เบราว์เซอร์ = 1 แชท)
export default function ChatWidget({ hidden, fabHidden }) {
  const [open, setOpen] = useState(false)
  const [visitorId, setVisitorId] = useState(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef(null)

  useEffect(() => { if (open && !visitorId) setVisitorId(getVisitorId()) }, [open, visitorId])

  // เปิดแชทจากปุ่มอื่นในหน้าได้ (เช่นปุ่ม "แชท" ที่แถบล่างหน้ารายละเอียดสินค้า) ผ่าน custom event
  // แทนที่จะพึ่งปุ่มลอย fab ตัวเดียว — ดู ShopProductDetail.jsx
  // ถ้าแนบข้อมูลสินค้ามาด้วย (event.detail.product) ส่งการ์ดสินค้านั้นเข้าแชททันทีที่เปิด (ครั้งเดียวต่อการกด ไม่สแปมซ้ำตอนเปิด/ปิดแชทเฉยๆ)
  useEffect(() => {
    const openChatHandler = (e) => {
      setOpen(true)
      const product = e?.detail?.product
      if (product) {
        const vid = getVisitorId()
        setVisitorId(vid)
        sendVisitorProductCard(vid, product).catch(() => {})
      }
    }
    window.addEventListener('ummatee-open-chat', openChatHandler)
    return () => window.removeEventListener('ummatee-open-chat', openChatHandler)
  }, [])

  const { messages } = useChatMessages(open ? visitorId : null)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, open])

  if (hidden) return null

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    setText('')
    try {
      await sendVisitorMessage(visitorId, trimmed)
    } catch {
      setText(trimmed) // ส่งไม่สำเร็จ (เช่นเน็ตหลุด) — คืนข้อความกลับให้พิมพ์ใหม่/ลองใหม่ได้
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {!open && !fabHidden && (
        <button className="chat-fab" onClick={() => setOpen(true)} aria-label="แชทกับแอดมิน">
          <FontAwesomeIcon icon={faComments} />
        </button>
      )}
      {open && (
        <div className="chat-panel">
          <div className="chat-panel-head">
            <span>แชทกับแอดมิน</span>
            <button onClick={() => setOpen(false)} aria-label="ปิดแชท"><FontAwesomeIcon icon={faXmark} /></button>
          </div>
          <div className="chat-panel-body" ref={listRef}>
            {messages.length === 0 && (
              <div className="chat-empty">สวัสดีครับ/ค่ะ 👋 มีอะไรให้ช่วยไหม พิมพ์ข้อความได้เลย</div>
            )}
            {messages.map((m) => (
              m.type === 'product' && m.product ? (
                <div key={m.id} className={`chat-bubble chat-bubble-${m.sender} chat-product-card`}>
                  {isSafeHttpUrl(m.product.image) && <img src={m.product.image} alt={m.product.name} />}
                  <div className="chat-product-info">
                    <div className="chat-product-name">{m.product.name}</div>
                    {m.product.price != null && <div className="chat-product-price">฿{Number(m.product.price).toLocaleString('th-TH')}</div>}
                  </div>
                </div>
              ) : (
                <div key={m.id} className={`chat-bubble chat-bubble-${m.sender}`}>{m.text}</div>
              )
            ))}
          </div>
          <form className="chat-panel-input" onSubmit={submit}>
            <input
              type="text" value={text} onChange={(e) => setText(e.target.value)}
              placeholder="พิมพ์ข้อความ..." maxLength={2000}
            />
            <button type="submit" disabled={!text.trim() || sending} aria-label="ส่งข้อความ">
              <FontAwesomeIcon icon={faPaperPlane} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
