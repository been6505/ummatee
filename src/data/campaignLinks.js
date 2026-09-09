import { useEffect, useState } from 'react'
import { db } from '../firebase.js'
import { collection, onSnapshot, query, where } from 'firebase/firestore'

// รวบรวมทุกอย่างที่ผูกอยู่กับแคมเปญหนึ่งๆ มาไว้ที่เดียว
//
// ความเชื่อมโยงพวกนี้มีอยู่ในข้อมูลอยู่แล้ว (events.campaignId, boardCards.campaignId,
// contentPosts.campaignId, campaignPartners) แต่กระจายอยู่คนละหน้า ไม่มีที่ไหนแสดงภาพรวม —
// จะรู้ว่าแคมเปญหนึ่งมีอีเวนต์อะไร ใครเป็นพันธมิตร คอนเทนต์ถึงไหน ต้องเปิด 5 หน้าแล้วจำเอาเอง
//
// ทุก query เป็น where ฟิลด์เดียวไม่มี orderBy — where + orderBy คนละฟิลด์ต้องมี composite index
// ที่ Firestore ไม่สร้างให้ แล้ว query จะพังเงียบๆ (บอร์ดเคยโดนมาแล้ว) เรียงฝั่ง client แทน

const byField = (col, field, id, cb) =>
  onSnapshot(
    query(collection(db, col), where(field, '==', id)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([])
  )

export function useCampaignLinks(campaignId) {
  const [data, setData] = useState({ events: [], posts: [], cards: [], partnerLinks: [], aidLocations: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!campaignId) { setLoading(false); return }
    setLoading(true)
    let settled = 0
    const done = () => { settled += 1; if (settled >= 5) setLoading(false) }
    const put = (key) => (rows) => { setData((d) => ({ ...d, [key]: rows })); done() }

    const unsubs = [
      byField('events', 'campaignId', campaignId, put('events')),
      byField('contentPosts', 'campaignId', campaignId, put('posts')),
      byField('boardCards', 'campaignId', campaignId, put('cards')),
      byField('campaignPartners', 'campaignId', campaignId, put('partnerLinks')),
      byField('aidLocations', 'campaignId', campaignId, put('aidLocations')),
    ]
    return () => unsubs.forEach((u) => u())
  }, [campaignId])

  return { ...data, loading }
}

export { campaignProgress } from './campaignProgress.js'
