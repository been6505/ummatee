// หน้าบริจาค 7 บัญชี ผ่าน Payment Gateway (/quick-donations) — เวอร์ชันทดลอง ยังไม่อยู่ใน nav
// วิธีจ่าย: 1) PromptPay QR — สร้าง QR แบบ dynamic (ฝังยอดเงิน) ตามมาตรฐาน EMVCo ใช้ได้ทันที
//          2) บัตรเครดิต/เดบิต ผ่าน Opn Payments (Omise) — ต้องใส่ public key + charge endpoint ก่อนเปิดใช้
import { useEffect, useMemo, useState } from 'react'
import { ACCOUNTS } from '../data/accounts.js'
import { QRCodeSVG } from 'qrcode.react'
import Footer from '../components/Footer.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQrcode, faCreditCard, faCheck, faCircleInfo, faDownload } from '@fortawesome/free-solid-svg-icons'

// ── ตั้งค่า Gateway — แก้ที่นี่จุดเดียวเมื่อพร้อมเปิดใช้จริง ─────────────────
const GATEWAY = {
  // เลข PromptPay ของมูลนิธิ: เบอร์มือถือ 10 หลัก หรือเลขนิติบุคคล/ผู้เสียภาษี 13 หลัก
  promptpayId: '', // ⚠️ ว่าง = ยังไม่เปิด PromptPay (ใส่แล้วสแกนจ่ายได้เลย ไม่ต้องมี merchant account)
  // Opn Payments (Omise) — สมัครที่ dashboard.omise.co แล้วนำ public key มาใส่
  omisePublicKey: '', // เช่น 'pkey_live_xxxx' (ค่า public ใส่ใน client ได้)
  // endpoint ฝั่ง server (Cloud Function) ที่รับ token ไป charge ด้วย secret key
  chargeEndpoint: '', // เช่น 'https://asia-southeast1-ummatee-app.cloudfunctions.net/charge'
}

// ── PromptPay QR: สร้าง EMVCo payload ────────────────────────────────────────
// อ้างอิงมาตรฐาน Thai QR Payment (EMVCo Merchant-Presented Mode)
function crc16(str) {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}
const tlv = (id, value) => id + String(value.length).padStart(2, '0') + value

function promptpayPayload(id, amount) {
  const digits = id.replace(/\D/g, '')
  // เบอร์มือถือ → tag 01 รูปแบบ 0066xxxxxxxxx / เลข 13 หลัก (บัตร ปชช./นิติบุคคล) → tag 02
  const target = digits.length >= 13
    ? tlv('02', digits)
    : tlv('01', '0066' + digits.replace(/^0/, ''))
  const merchant = tlv('29', tlv('00', 'A000000677010111') + target)
  let payload =
    tlv('00', '01') +
    tlv('01', amount > 0 ? '12' : '11') + // 12 = dynamic (มียอด), 11 = static
    merchant +
    tlv('53', '764') + // สกุลเงิน THB
    (amount > 0 ? tlv('54', amount.toFixed(2)) : '') +
    tlv('58', 'TH')
  payload += '6304'
  return payload + crc16(payload)
}

// ── โหลด Omise.js เมื่อผู้ใช้เลือกจ่ายด้วยบัตรเท่านั้น ─────────────────────────
function loadOmise() {
  return new Promise((resolve, reject) => {
    if (window.Omise) return resolve(window.Omise)
    const s = document.createElement('script')
    s.src = 'https://cdn.omise.co/omise.js'
    s.onload = () => resolve(window.Omise)
    s.onerror = () => reject(new Error('โหลด Omise.js ไม่สำเร็จ'))
    document.head.appendChild(s)
  })
}

const PRESETS = [50, 100, 300, 500, 1000, 3000]

export default function QuickDonations() {
  const [account, setAccount] = useState(ACCOUNTS[0])
  const [amount, setAmount] = useState(100)
  const [custom, setCustom] = useState('')
  const [method, setMethod] = useState('promptpay') // 'promptpay' | 'card'
  const [card, setCard] = useState({ name: '', number: '', exp: '', cvc: '' })
  const [paying, setPaying] = useState(false)
  const [payMsg, setPayMsg] = useState(null) // { ok, text }

  const finalAmount = custom ? parseInt(custom, 10) || 0 : amount
  const qrPayload = useMemo(
    () => (GATEWAY.promptpayId && finalAmount > 0 ? promptpayPayload(GATEWAY.promptpayId, finalAmount) : ''),
    [finalAmount],
  )

  useEffect(() => { setPayMsg(null) }, [account, finalAmount, method])

  const cardReady = GATEWAY.omisePublicKey && GATEWAY.chargeEndpoint

  // จ่ายด้วยบัตร: tokenize ฝั่ง client (เลขบัตรไม่ผ่าน server เรา) → ส่ง token ไป charge ที่ endpoint
  const payCard = async () => {
    if (!cardReady || paying || finalAmount < 20) return
    setPaying(true)
    setPayMsg(null)
    try {
      const [mm, yy] = card.exp.split('/').map((s) => s.trim())
      const Omise = await loadOmise()
      Omise.setPublicKey(GATEWAY.omisePublicKey)
      const token = await new Promise((resolve, reject) => {
        Omise.createToken('card', {
          name: card.name,
          number: card.number.replace(/\s/g, ''),
          expiration_month: Number(mm),
          expiration_year: 2000 + Number(yy),
          security_code: card.cvc,
        }, (status, res) => (status === 200 ? resolve(res.id) : reject(new Error(res.message || 'บัตรไม่ถูกต้อง'))))
      })
      const res = await fetch(GATEWAY.chargeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, amount: finalAmount * 100, currency: 'thb', account: account.key }),
      })
      if (!res.ok) throw new Error(`server error ${res.status}`)
      const out = await res.json()
      if (!out.success) throw new Error(out.message || 'ชำระเงินไม่สำเร็จ')
      setPayMsg({ ok: true, text: `ขอบคุณสำหรับการบริจาค ${finalAmount.toLocaleString()} บาท 🤲` })
      setCard({ name: '', number: '', exp: '', cvc: '' })
    } catch (e) {
      setPayMsg({ ok: false, text: e.message })
    } finally {
      setPaying(false)
    }
  }

  const setCardField = (k, format) => (e) => {
    let v = e.target.value
    if (format === 'number') v = v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')
    if (format === 'exp') v = v.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(?=\d)/, '$1/')
    if (format === 'cvc') v = v.replace(/\D/g, '').slice(0, 4)
    setCard((c) => ({ ...c, [k]: v }))
  }

  const downloadQR = () => {
    const svg = document.querySelector('.qds-qr svg')
    if (!svg) return
    const xml = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    img.onload = () => {
      const cv = document.createElement('canvas')
      cv.width = cv.height = 640
      const ctx = cv.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, 640, 640)
      ctx.drawImage(img, 40, 40, 560, 560)
      const a = document.createElement('a')
      a.download = `ummatee-promptpay-${account.key}-${finalAmount}.png`
      a.href = cv.toDataURL('image/png')
      a.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)))
  }

  const inputStyle = { width: '100%', padding: '11px 13px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: '.95rem', fontFamily: 'inherit' }

  return (
    <main className="page">
      {/* Hero */}
      <section className="page-band">
        <div className="fc-pattern hero-pattern" />
        <div className="inner">
          <span className="badge">บริจาคออนไลน์ · Quick Donations</span>
          <h1>บริจาค <span className="accent">7 กองทุน</span> จ่ายออนไลน์ได้ทันที</h1>
          <p>เลือกกองทุน กำหนดยอด แล้วสแกน PromptPay หรือตัดบัตรได้เลย</p>
        </div>
      </section>

      <div className="qd-stage">

        {/* ── เลือกกองทุน (7 บัญชี) ── */}
        <div className="qd-card">
          <div className="qd-card-label">เลือกกองทุนที่ต้องการบริจาค</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {ACCOUNTS.map((a) => {
              const active = a.key === account.key
              return (
                <button
                  key={a.key}
                  onClick={() => setAccount(a)}
                  style={{
                    padding: '14px 10px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                    border: active ? '2px solid var(--green, #1b5e36)' : '1.5px solid #e5e7eb',
                    background: active ? '#f0faf4' : '#fff',
                    fontWeight: active ? 800 : 600, fontSize: '.88rem', color: '#1f2937',
                    transition: 'all .15s',
                  }}
                >
                  <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>{a.icon}</div>
                  {a.name}
                  <div style={{ fontSize: '.72rem', color: '#9ca3af', fontWeight: 500, marginTop: 3 }}>{a.en}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── จำนวนเงิน ── */}
        <div className="qd-card">
          <div className="qd-card-label">จำนวนเงิน (บาท)</div>
          <div className="qd-preset-grid">
            {PRESETS.map((val) => (
              <button
                key={val}
                className={`qd-preset-btn ${!custom && amount === val ? 'active' : ''}`}
                onClick={() => { setAmount(val); setCustom('') }}
              >
                {val.toLocaleString()}
              </button>
            ))}
          </div>
          <div className="qd-custom-row">
            <label className="qd-custom-label">หรือกรอกจำนวนเอง</label>
            <div className="qd-custom-input-wrap">
              <input
                className="qd-custom-input"
                type="number" inputMode="numeric" min="1" placeholder="ระบุจำนวน"
                value={custom}
                onChange={(e) => { setCustom(e.target.value.replace(/\D/g, '')); }}
              />
              <span className="qd-custom-unit">บาท</span>
            </div>
          </div>
        </div>

        {/* ── วิธีชำระเงิน ── */}
        <div className="qd-card">
          <div className="qd-card-label">วิธีชำระเงิน</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            <button
              onClick={() => setMethod('promptpay')}
              style={{
                flex: 1, padding: '12px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: '.92rem',
                border: method === 'promptpay' ? '2px solid #003d6a' : '1.5px solid #e5e7eb',
                background: method === 'promptpay' ? '#eef6fc' : '#fff', color: '#1f2937',
              }}
            >
              <FontAwesomeIcon icon={faQrcode} /> PromptPay QR
            </button>
            <button
              onClick={() => setMethod('card')}
              style={{
                flex: 1, padding: '12px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: '.92rem',
                border: method === 'card' ? '2px solid #003d6a' : '1.5px solid #e5e7eb',
                background: method === 'card' ? '#eef6fc' : '#fff', color: '#1f2937',
              }}
            >
              <FontAwesomeIcon icon={faCreditCard} /> บัตรเครดิต/เดบิต
            </button>
          </div>

          {/* PromptPay QR */}
          {method === 'promptpay' && (
            GATEWAY.promptpayId ? (
              finalAmount > 0 ? (
                <div style={{ textAlign: 'center' }}>
                  <div className="qds-qr" style={{ display: 'inline-block', padding: 18, background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 16 }}>
                    <div style={{ fontWeight: 800, color: '#003d6a', marginBottom: 10, fontSize: '.9rem' }}>THAI QR PAYMENT · PromptPay</div>
                    <QRCodeSVG value={qrPayload} size={220} level="M" />
                    <div style={{ marginTop: 10, fontSize: '.95rem' }}>
                      {account.icon} {account.name} · <strong>{finalAmount.toLocaleString()} บาท</strong>
                    </div>
                  </div>
                  <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={downloadQR} style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '.88rem' }}>
                      <FontAwesomeIcon icon={faDownload} /> บันทึกรูป QR
                    </button>
                  </div>
                  <p style={{ color: '#6b7280', fontSize: '.83rem', marginTop: 12 }}>
                    เปิดแอปธนาคารใดก็ได้ → สแกน QR → ยอดเงินจะถูกกรอกให้อัตโนมัติ
                  </p>
                </div>
              ) : (
                <p style={{ textAlign: 'center', color: '#9ca3af', padding: '20px 0' }}>กรอกจำนวนเงินก่อนเพื่อสร้าง QR</p>
              )
            ) : (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 16px', fontSize: '.88rem', color: '#92400e' }}>
                <FontAwesomeIcon icon={faCircleInfo} /> ยังไม่ได้ตั้งค่าเลข PromptPay ของมูลนิธิ — ใส่ที่ <code>GATEWAY.promptpayId</code> ใน QuickDonations.jsx แล้ว QR จะใช้งานได้ทันที
              </div>
            )
          )}

          {/* บัตรเครดิต */}
          {method === 'card' && (
            cardReady ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <input style={inputStyle} placeholder="ชื่อบนบัตร" value={card.name} onChange={setCardField('name')} autoComplete="cc-name" />
                <input style={inputStyle} placeholder="หมายเลขบัตร" value={card.number} onChange={setCardField('number', 'number')} inputMode="numeric" autoComplete="cc-number" />
                <div style={{ display: 'flex', gap: 12 }}>
                  <input style={{ ...inputStyle, flex: 1 }} placeholder="MM/YY" value={card.exp} onChange={setCardField('exp', 'exp')} inputMode="numeric" autoComplete="cc-exp" />
                  <input style={{ ...inputStyle, flex: 1 }} placeholder="CVC" value={card.cvc} onChange={setCardField('cvc', 'cvc')} inputMode="numeric" autoComplete="cc-csc" />
                </div>
                <button
                  onClick={payCard}
                  disabled={paying || finalAmount < 20 || !card.name || card.number.replace(/\s/g, '').length < 15 || card.exp.length < 5 || card.cvc.length < 3}
                  className="qd-donate-btn"
                  style={{ marginTop: 4 }}
                >
                  {paying ? 'กำลังดำเนินการ...' : `บริจาค ${finalAmount.toLocaleString()} บาท`}
                </button>
                <p style={{ color: '#9ca3af', fontSize: '.78rem', textAlign: 'center', margin: 0 }}>
                  ข้อมูลบัตรเข้ารหัสส่งตรงถึง Opn Payments — ไม่ผ่านเซิร์ฟเวอร์ของมูลนิธิ · ขั้นต่ำ 20 บาท
                </p>
              </div>
            ) : (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 16px', fontSize: '.88rem', color: '#92400e', lineHeight: 1.7 }}>
                <FontAwesomeIcon icon={faCircleInfo} /> ช่องทางบัตรยังไม่เปิดใช้งาน — ต้องตั้งค่าใน <code>GATEWAY</code>:
                <br />1. สมัคร Opn Payments (omise.co) แล้วใส่ <code>omisePublicKey</code>
                <br />2. สร้าง Cloud Function สำหรับ charge (ใช้ secret key ฝั่ง server) แล้วใส่ <code>chargeEndpoint</code>
              </div>
            )
          )}

          {payMsg && (
            <div style={{
              marginTop: 14, padding: '12px 16px', borderRadius: 12, fontWeight: 600, fontSize: '.9rem',
              background: payMsg.ok ? '#dcfce7' : '#fef2f2', color: payMsg.ok ? '#15803d' : '#dc2626',
            }}>
              {payMsg.ok && <FontAwesomeIcon icon={faCheck} />} {payMsg.text}
            </div>
          )}
        </div>

        <p className="qd-trust-note">
          ทุกบาทส่งถึงมือผู้รับเต็มจำนวน · ตรวจสอบได้ · มูลนิธิอุมมะตี
        </p>
      </div>

      <Footer />
    </main>
  )
}
