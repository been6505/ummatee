import { useEffect, useState } from 'react'
import { ACCOUNTS } from '../data/accounts.js'

function CopyBtn({ text, label }) {
  const [copied, setCopied] = useState(false)
  // แสดง "คัดลอกแล้ว" เฉพาะเมื่อคัดลอกสำเร็จจริง — กันหลอกผู้บริจาคว่าคัดลอกได้ทั้งที่คลิปบอร์ดยังเป็นค่าเก่า
  const copy = () => {
    const clean = text.replace(/\s/g, '')
    const onSuccess = () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    const fallback = () => {
      const el = document.createElement('textarea')
      el.value = clean; el.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(el); el.select()
      let ok = false
      try { ok = document.execCommand('copy') } catch (_) { /* noop */ }
      document.body.removeChild(el)
      if (ok) onSuccess()
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(clean).then(onSuccess).catch(fallback)
    } else {
      fallback()
    }
  }
  return (
    <button className="fd-acc" onClick={copy}>
      <div className="fd-acc-name">{label}</div>
      <div className="fd-acc-num">{text}</div>
      <div className="fd-acc-copy">{copied ? '✓ คัดลอกแล้ว' : 'คัดลอก'}</div>
    </button>
  )
}

// ป็อปอัพบริจาค — ไม่มีปุ่มลอยของตัวเองอีกต่อไป (รวมเข้า FloatingActionHub.jsx แล้ว) เปิดผ่าน custom event เท่านั้น
export default function FloatingDonate({ hidden }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const openDonate = () => setOpen(true)
    window.addEventListener('ummatee-open-donate', openDonate)
    return () => window.removeEventListener('ummatee-open-donate', openDonate)
  }, [])

  if (hidden) return null
  if (!open) return null

  return (
    <>
      <div className="fd-overlay" onClick={() => setOpen(false)} />
      <div className="fd-popup">
        <button className="fd-close" onClick={() => setOpen(false)}>×</button>
        <h3>ร่วมบริจาค</h3>
        <p>ธนาคารอิสลามแห่งประเทศไทย (ibank)</p>
        <div className="fd-list">
          {ACCOUNTS.map((a) => (
            <CopyBtn key={a.acc} text={a.acc} label={`${a.icon} ${a.name}`} />
          ))}
        </div>
        <a href="/donation" className="fd-more" onClick={() => setOpen(false)}>ดูรายละเอียดเพิ่มเติม →</a>
      </div>
    </>
  )
}
