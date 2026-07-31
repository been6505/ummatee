import { useState } from 'react'
import { auth } from '../firebase.js'
import { useComments, addComment, removeComment, commentAuthorLabel, MAX_COMMENT_LEN } from '../data/comments.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faPaperPlane } from '@fortawesome/free-solid-svg-icons'

// กล่องคุยงานต่อชิ้นงาน — ใช้ซ้ำได้ทุกที่ที่มี (entityType, entityId)
const timeLabel = (ts) => {
  if (!ts?.toDate) return 'กำลังส่ง…' // serverTimestamp ยังไม่ลงจริงในรอบแรกที่ Firestore ตอบกลับ
  const d = ts.toDate()
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function CommentThread({ entityType, entityId, title = 'คุยเรื่องงานนี้' }) {
  const { comments, loading } = useComments(entityType, entityId)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const me = auth.currentUser?.uid

  const send = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try {
      await addComment(entityType, entityId, body)
      setText('')
    } catch (e) {
      window.alert('ส่งไม่สำเร็จ: ' + e.message)
    } finally { setSending(false) }
  }

  return (
    <div className="cmt">
      <div className="cmt-head">{title}{comments.length > 0 && <span className="cmt-count">{comments.length}</span>}</div>

      {loading ? (
        <div className="cmt-empty">กำลังโหลด…</div>
      ) : comments.length === 0 ? (
        <div className="cmt-empty">ยังไม่มีใครคอมเมนต์ — เขียนบันทึกไว้ให้คนที่มารับงานต่อได้เลย</div>
      ) : (
        <ul className="cmt-list">
          {comments.map((c) => (
            <li key={c.id}>
              <div className="cmt-meta">
                <strong>{commentAuthorLabel(c)}</strong>
                <span>{timeLabel(c.createdAt)}</span>
                {/* ลบได้เฉพาะของตัวเอง — ตรงกับ firestore.rules ไม่ใช่แค่ซ่อนปุ่ม */}
                {c.authorUid === me && (
                  <button onClick={() => removeComment(c.id)} aria-label="ลบคอมเมนต์" title="ลบ">
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                )}
              </div>
              {/* ข้อความผู้ใช้พิมพ์เอง — ใส่เป็น text node ไม่ใช่ HTML และคง newline ด้วย CSS */}
              <div className="cmt-text">{c.text}</div>
            </li>
          ))}
        </ul>
      )}

      <div className="cmt-input">
        <textarea
          rows={2}
          value={text}
          maxLength={MAX_COMMENT_LEN}
          onChange={(e) => setText(e.target.value)}
          // Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่ — คอมเมนต์งานส่วนใหญ่สั้นบรรทัดเดียว
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="พิมพ์คอมเมนต์… (Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
        />
        <button className="admin-btn-primary" onClick={send} disabled={!text.trim() || sending}>
          <FontAwesomeIcon icon={faPaperPlane} /> {sending ? 'กำลังส่ง…' : 'ส่ง'}
        </button>
      </div>
    </div>
  )
}
