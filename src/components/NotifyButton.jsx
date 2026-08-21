import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBell, faCheck } from '@fortawesome/free-solid-svg-icons'
import { useLang } from '../i18n.jsx'

// ปุ่ม "แจ้งเตือนเมื่อมีข่าวใหม่" บนหน้า /updates
//
// โหลด data/pushTokens.js แบบ dynamic — มันดึง firebase/messaging ซึ่งไม่ควรอยู่ในชิ้นที่โหลดพร้อมหน้า
// และคนส่วนใหญ่จะไม่กดปุ่มนี้เลย ไม่มีเหตุผลให้ทุกคนต้องโหลดโค้ดส่วนนี้ติดไปด้วย
export default function NotifyButton() {
  const { lang } = useLang()
  const [state, setState] = useState('checking') // checking | ready | on | blocked | working
  const [reason, setReason] = useState('')

  useEffect(() => {
    let alive = true
    import('../data/pushTokens.js')
      .then(({ blockedReason, currentPermission }) => {
        if (!alive) return
        const blocked = blockedReason()
        if (currentPermission() === 'granted') setState('on')
        else if (blocked) { setReason(blocked); setState('blocked') }
        else setState('ready')
      })
      .catch(() => alive && setState('blocked'))
    return () => { alive = false }
  }, [])

  // ยังไม่ได้ตั้งค่า / เบราว์เซอร์ไม่รองรับ = ไม่ต้องโชว์ปุ่มที่กดแล้วไม่เกิดอะไร
  // แต่กรณี iPhone ที่ยังไม่ได้ติดตั้ง กับกรณีเคยกดปฏิเสธ ต้องบอก เพราะผู้ใช้แก้เองได้
  if (state === 'checking') return null
  if (state === 'blocked') {
    const actionable = /หน้าจอโฮม|ตั้งค่าเบราว์เซอร์/.test(reason)
    return actionable ? <p className="upd-notify-note">{reason}</p> : null
  }

  if (state === 'on') {
    return (
      <p className="upd-notify-on"><FontAwesomeIcon icon={faCheck} /> เปิดแจ้งเตือนข่าวใหม่ไว้แล้ว</p>
    )
  }

  const click = async () => {
    setState('working')
    const { enablePush } = await import('../data/pushTokens.js')
    const r = await enablePush(lang)
    if (r.ok) { setState('on'); return }
    setReason(r.error || 'เปิดแจ้งเตือนไม่สำเร็จ')
    setState('blocked')
  }

  return (
    <button type="button" className="upd-notify" onClick={click} disabled={state === 'working'}>
      <FontAwesomeIcon icon={faBell} /> {state === 'working' ? 'กำลังเปิด…' : 'แจ้งเตือนเมื่อมีข่าวใหม่'}
    </button>
  )
}
