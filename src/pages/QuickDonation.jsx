import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MISSIONS } from '../data/missions.js'
import { ACCOUNTS } from '../data/accounts.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faCheck, faChevronDown } from '@fortawesome/free-solid-svg-icons'
import Footer from '../components/Footer.jsx'

// ───────────────────────────────────────────────
// แอปธนาคารยอดนิยมในไทย — deep link เปิดแอปตรง
// ───────────────────────────────────────────────
const BANK_APPS = [
  { key: 'kplus',    label: 'KBank',       logo: '🟢', scheme: 'kplus://',           android: 'com.kasikorn.retail.mbanking.wap', ios: '457949873' },
  { key: 'scbeasy',  label: 'SCB EASY',    logo: '🟣', scheme: 'scbeasy://',          android: 'com.scb.phone', ios: '590234917' },
  { key: 'ktb',      label: 'Krungthai',   logo: '🔵', scheme: 'ktbsimpleplus://',    android: 'com.ktb.ktbnetbank', ios: '573213519' },
  { key: 'bay',      label: 'KrungsriONL', logo: '🟡', scheme: 'krungsriapp://',       android: 'com.bay.mobilebanking', ios: '582286961' },
  { key: 'bbl',      label: 'Bualuang',    logo: '🔷', scheme: 'bualuang://',         android: 'com.bbl.mobilebanking', ios: '391928483' },
  { key: 'ttb',      label: 'ttb touch',   logo: '🩵', scheme: 'ttbtouch://',         android: 'com.ttbank.ttbtouch', ios: '1483249789' },
  { key: 'gsb',      label: 'MyMo (GSB)',  logo: '🌸', scheme: 'mymo://',             android: 'com.gsb.mymo', ios: '1070558576' },
  { key: 'ibank',    label: 'ibank',       logo: '☪️',  scheme: 'ibankapp://',         android: 'com.islamicbank.ibankonline', ios: '1133261765' },
]

// PromptPay QR payload (EMVCo): สร้าง payload สำหรับโอนเงินผ่าน PromptPay
// ใช้ account number เลขที่บัญชี ibank จริง (fallback: แสดงเลขบัญชีธรรมดา)
// หากต้องการ PromptPay QR จริง ต้องมีเลข PromptPay ของมูลนิธิ
const PROMPTPAY_ID = '0021001863' // placeholder — admin ต้องแทนค่าจริง

function openBankApp(app) {
  const ua = navigator.userAgent
  const isAndroid = /Android/i.test(ua)
  const isIOS = /iPhone|iPad|iPod/i.test(ua)

  // ลองเปิด scheme ก่อน; ถ้าแอปไม่มีให้ fallback ไป store
  const tryScheme = () => { window.location.href = app.scheme }

  if (isIOS && app.ios) {
    const start = Date.now()
    window.location.href = app.scheme
    setTimeout(() => {
      if (Date.now() - start < 2000) {
        window.location.href = `https://apps.apple.com/th/app/id${app.ios}`
      }
    }, 1500)
  } else if (isAndroid && app.android) {
    window.location.href = `intent://#Intent;package=${app.android};scheme=${app.scheme.replace('://', '')};end`
  } else {
    tryScheme()
  }
}

// ── BottomSheet เลือกแอปธนาคาร ──────────────────
function BankSheet({ amount, project, account, onClose }) {
  const accRaw = account?.raw?.replace(/\s/g, '') || ''

  return createPortal(
    <div className="qd-overlay" onClick={onClose}>
      <div className="qd-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="qd-sheet-handle" />

        <div className="qd-sheet-header">
          <div className="qd-sheet-title">เลือกแอปธนาคาร</div>
          <button type="button" className="qd-sheet-close" onClick={onClose} aria-label="ปิด"><FontAwesomeIcon icon={faXmark} /></button>
        </div>

        {/* สรุปการโอน */}
        <div className="qd-transfer-summary">
          <div className="qd-summary-row">
            <span className="qd-summary-label">โครงการ</span>
            <span className="qd-summary-val">{project?.th?.name}</span>
          </div>
          <div className="qd-summary-row">
            <span className="qd-summary-label">จำนวนเงิน</span>
            <span className="qd-summary-amount">{amount.toLocaleString()} บาท</span>
          </div>
          <div className="qd-summary-row">
            <span className="qd-summary-label">ธนาคาร</span>
            <span className="qd-summary-val">ibank · มูลนิธิอุมมะตี</span>
          </div>
          <div className="qd-summary-row">
            <span className="qd-summary-label">เลขบัญชี</span>
            <span className="qd-summary-acc" dir="ltr">{account?.acc}</span>
          </div>
        </div>

        <div className="qd-sheet-note">
          เปิดแอปธนาคารของคุณ แล้วโอนไปยังบัญชี ibank ข้างต้น
        </div>

        <div className="qd-bank-grid">
          {BANK_APPS.map((app) => (
            <button
              key={app.key}
              className="qd-bank-btn"
              onClick={() => { openBankApp(app); onClose() }}
            >
              <span className="qd-bank-logo">{app.logo}</span>
              <span className="qd-bank-label">{app.label}</span>
            </button>
          ))}
        </div>

        <div className="qd-sheet-footer">
          <div className="qd-copy-row">
            <span>คัดลอกเลขบัญชี</span>
            <CopyAccBtn raw={accRaw} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function CopyAccBtn({ raw }) {
  const [copied, setCopied] = useState(false)
  // แสดง "คัดลอกแล้ว" เฉพาะเมื่อคัดลอกสำเร็จจริง — กันหลอกผู้บริจาคว่าคัดลอกได้ทั้งที่คลิปบอร์ดยังเป็นค่าเก่า
  const copy = () => {
    const onSuccess = () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
    const fallback = () => {
      const t = document.createElement('textarea')
      t.value = raw; document.body.appendChild(t); t.select()
      let ok = false
      try { ok = document.execCommand('copy') } catch (_) { /* noop */ }
      document.body.removeChild(t)
      if (ok) onSuccess()
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(raw).then(onSuccess).catch(fallback)
    } else {
      fallback()
    }
  }
  return (
    <button className={`qd-copy-btn ${copied ? 'copied' : ''}`} onClick={copy}>
      {copied ? <><FontAwesomeIcon icon={faCheck} /> คัดลอกแล้ว</> : `คัดลอก ${raw}`}
    </button>
  )
}

// ── Main Page ────────────────────────────────────
const PRESET_AMOUNTS = [10, 50, 100, 500, 1000]

export default function QuickDonation() {
  const [selectedMission, setSelectedMission] = useState(MISSIONS[0])
  const [amount, setAmount] = useState(100)
  const [customAmount, setCustomAmount] = useState('')
  const [showSheet, setShowSheet] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)

  const finalAmount = customAmount ? parseInt(customAmount, 10) || 0 : amount
  const account = ACCOUNTS.find((a) => a.key === selectedMission.acc)

  const handlePreset = (val) => {
    setAmount(val)
    setCustomAmount('')
  }

  const handleCustom = (e) => {
    const v = e.target.value.replace(/\D/g, '')
    setCustomAmount(v)
    setAmount(v ? 0 : PRESET_AMOUNTS[2])
  }

  const handleDonate = () => {
    if (finalAmount < 1) return
    setShowSheet(true)
  }

  return (
    <main className="page">
      {/* Hero */}
      <section className="page-band">
        <div className="fc-pattern hero-pattern" />
        <div className="inner">
          <span className="badge">บริจาคด่วน · Quick Donate</span>
          <h1>บริจาค<span className="accent"> ง่าย</span> รวดเร็ว<span className="accent"> ทันใจ</span></h1>
          <p>เลือกโครงการ กำหนดจำนวนเงิน แล้วเปิดแอปธนาคารของคุณได้เลย</p>
        </div>
      </section>

      <div className="qd-stage">

        {/* ── เลือกโครงการ ── */}
        <div className="qd-card">
          <div className="qd-card-label">เลือกโครงการ</div>

          {/* Dropdown สำหรับ mobile */}
          <div className="qd-project-dropdown">
            <button
              className="qd-project-trigger"
              onClick={() => setProjectOpen((v) => !v)}
            >
              <span className="qd-proj-icon" style={{ color: selectedMission.accent }}>
                <FontAwesomeIcon icon={selectedMission.icon} />
              </span>
              <span className="qd-proj-name">{selectedMission.th.name}</span>
              <FontAwesomeIcon icon={faChevronDown} className={`qd-chevron ${projectOpen ? 'open' : ''}`} />
            </button>

            {projectOpen && (
              <div className="qd-project-menu">
                {MISSIONS.map((m) => (
                  <button
                    key={m.key}
                    className={`qd-project-item ${m.key === selectedMission.key ? 'active' : ''}`}
                    onClick={() => { setSelectedMission(m); setProjectOpen(false) }}
                    style={m.key === selectedMission.key ? { '--proj-accent': m.accent } : {}}
                  >
                    <span className="qd-proj-icon" style={{ color: m.accent }}>
                      <FontAwesomeIcon icon={m.icon} />
                    </span>
                    <div className="qd-proj-info">
                      <div className="qd-proj-name">{m.th.name}</div>
                      <div className="qd-proj-desc">{m.th.desc}</div>
                    </div>
                    {m.key === selectedMission.key && (
                      <FontAwesomeIcon icon={faCheck} className="qd-proj-check" style={{ color: m.accent }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* แสดงบัญชีที่เชื่อมกับโครงการ */}
          {account && (
            <div className="qd-account-badge">
              <img src="/ibank.png" alt="ibank" className="qd-ibank-logo" />
              <div>
                <div className="qd-account-name">{account.name}</div>
                <div className="qd-account-num" dir="ltr">{account.acc}</div>
              </div>
            </div>
          )}
        </div>

        {/* ── เลือกจำนวนเงิน ── */}
        <div className="qd-card">
          <div className="qd-card-label">จำนวนเงิน (บาท)</div>

          <div className="qd-preset-grid">
            {PRESET_AMOUNTS.map((val) => (
              <button
                key={val}
                className={`qd-preset-btn ${!customAmount && amount === val ? 'active' : ''}`}
                onClick={() => handlePreset(val)}
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
                type="number"
                inputMode="numeric"
                min="1"
                placeholder="ระบุจำนวน"
                value={customAmount}
                onChange={handleCustom}
              />
              <span className="qd-custom-unit">บาท</span>
            </div>
          </div>

          {finalAmount > 0 && (
            <div className="qd-amount-preview">
              บริจาค <strong>{finalAmount.toLocaleString()} บาท</strong> เพื่อ{selectedMission.th.name}
            </div>
          )}
        </div>

        {/* ── ปุ่มบริจาค ── */}
        <button
          className="qd-donate-btn"
          onClick={handleDonate}
          disabled={finalAmount < 1}
          style={{ '--mission-accent': selectedMission.accent }}
        >
          บริจาค {finalAmount > 0 ? `${finalAmount.toLocaleString()} บาท` : ''} →
        </button>

        <p className="qd-trust-note">
          ทุกบาทส่งถึงมือผู้รับเต็มจำนวน · ตรวจสอบได้ · มูลนิธิอุมมะตี
        </p>
      </div>

      {/* Bottom Sheet เลือกแอปธนาคาร */}
      {showSheet && (
        <BankSheet
          amount={finalAmount}
          project={selectedMission}
          account={account}
          onClose={() => setShowSheet(false)}
        />
      )}

      <Footer />
    </main>
  )
}
