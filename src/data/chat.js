// แชทเว็บ (visitor ↔ แอดมิน) — ผู้เยี่ยมชมไม่ต้องล็อกอิน ใช้ visitorId แบบสุ่มเก็บใน localStorage
// เป็น chatId ตรงๆ (1 คน = 1 แชท) เอกสาร chats/{chatId} เก็บสรุปล่าสุด ใช้ทำ inbox list ฝั่งแอดมิน
// ข้อความจริงอยู่ subcollection chats/{chatId}/messages
import { useEffect, useState } from 'react'
import { db } from '../firebase.js'
import {
  collection, doc, addDoc, setDoc, updateDoc, onSnapshot, query, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { notifyAdminNewChatMessage } from '../utils/lineNotify.js'

const VISITOR_ID_KEY = 'ummatee_chat_visitor_id'

// product.image/product.url ในการ์ดสินค้าที่แนบมากับข้อความมาจากผู้เยี่ยมชม (ไม่ล็อกอิน) — rules บังคับ http(s)
// แล้วก็จริง แต่กันพลาดอีกชั้นก่อนใส่ลง <img src>/<a href> ตรงๆ (ChatWidget.jsx, AdminChat.jsx) กัน scheme อันตรายเช่น javascript:
export const isSafeHttpUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u)

// สร้าง/อ่าน visitor id แบบสุ่ม (คงอยู่ข้ามการเข้าเว็บครั้งถัดไปในเบราว์เซอร์เดิม)
export function getVisitorId() {
  let id = localStorage.getItem(VISITOR_ID_KEY)
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `v-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    localStorage.setItem(VISITOR_ID_KEY, id)
  }
  return id
}

// ฟังข้อความในแชทเดียว (ใช้ทั้งฝั่งผู้เยี่ยมชมและแอดมินตอนเปิดดูแชทนั้น)
export function useChatMessages(chatId) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!chatId) { setMessages([]); setLoading(false); return }
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [chatId])
  return { messages, loading }
}

// ผู้เยี่ยมชมส่งข้อความ — สร้าง/อัปเดตเอกสารสรุป chats/{chatId} พร้อมเขียนลง messages
export async function sendVisitorMessage(chatId, text) {
  const trimmed = text.trim()
  if (!trimmed) return
  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    sender: 'visitor', text: trimmed, createdAt: serverTimestamp(),
  })
  const chatRef = doc(db, 'chats', chatId)
  const summary = {
    lastMessageAt: serverTimestamp(), lastMessageText: trimmed, lastSender: 'visitor',
    unreadByAdmin: true, unreadByVisitor: false,
  }
  try {
    await updateDoc(chatRef, summary)
  } catch {
    // เอกสารยังไม่มี (แชทใหม่) — สร้างใหม่พร้อม createdAt
    await setDoc(chatRef, { ...summary, createdAt: serverTimestamp() })
  }
  notifyAdminNewChatMessage(chatId, trimmed)
}

// ผู้เยี่ยมชมส่งการ์ดสินค้า (กดปุ่ม "แชท" จากหน้ารายละเอียดสินค้า) — แนบไปกับข้อความเพื่อให้แอดมินรู้ว่าถามเรื่องสินค้าไหน
// product: { name, price, image, url } — image/url เป็น optional (สินค้าที่ไม่มีรูปก็ยังส่งได้)
export async function sendVisitorProductCard(chatId, product) {
  if (!product?.name) return
  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    sender: 'visitor', type: 'product', product, createdAt: serverTimestamp(),
  })
  const chatRef = doc(db, 'chats', chatId)
  const summary = {
    lastMessageAt: serverTimestamp(), lastMessageText: `📦 สนใจสินค้า: ${product.name}`, lastSender: 'visitor',
    unreadByAdmin: true, unreadByVisitor: false,
  }
  try {
    await updateDoc(chatRef, summary)
  } catch {
    await setDoc(chatRef, { ...summary, createdAt: serverTimestamp() })
  }
  notifyAdminNewChatMessage(chatId, `📦 สนใจสินค้า: ${product.name}`)
}

// แอดมินตอบกลับ
export async function sendAdminReply(chatId, text) {
  const trimmed = text.trim()
  if (!trimmed) return
  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    sender: 'admin', text: trimmed, createdAt: serverTimestamp(),
  })
  await updateDoc(doc(db, 'chats', chatId), {
    lastMessageAt: serverTimestamp(), lastMessageText: trimmed, lastSender: 'admin',
    unreadByAdmin: false, unreadByVisitor: true,
  })
}

// แอดมินกดเข้าไปอ่านแชท — เคลียร์ badge unread
export function markChatReadByAdmin(chatId) {
  return updateDoc(doc(db, 'chats', chatId), { unreadByAdmin: false })
}

// รายการแชททั้งหมด เรียงข้อความล่าสุดก่อน — ใช้หน้า /admin/chat
export function useAdminChatList() {
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const q = query(collection(db, 'chats'), orderBy('lastMessageAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setChats(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])
  return { chats, loading }
}
