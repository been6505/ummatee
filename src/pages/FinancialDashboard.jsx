import { useEffect, useState } from 'react'
import { DonutChart } from '../components/AdminCharts.jsx'
import CopyIcon from '../components/CopyIcon.jsx'
import { useFinancialData } from '../data/financialData.js'

// แดชบอร์ดแสดงผลยอดบริจาค (Financial Dashboard) — สำหรับเปิดบนทีวีหน้างาน (/challenge)
// ข้อมูลอ่านจาก Firestore (config/financialDashboard) แก้ไขได้ที่ /admin/financial-dashboard

// กล่องข้อมูลบัญชี — แตะเพื่อคัดลอกเฉพาะเลขบัญชี (ตัดช่องว่างออกก่อนคัดลอก)
function AccountInfo({ account }) {
  const [copied, setCopied] = useState(false)
  // แสดง "คัดลอกแล้ว" เฉพาะเมื่อคัดลอกสำเร็จจริง — จอนี้เปิดหน้างานให้คนบริจาคสด ถ้าคัดลอกไม่จริงต้องไม่โชว์ว่าสำเร็จ
  const copy = () => {
    const clean = account.number.replace(/\s/g, '')
    const onSuccess = () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(clean).then(onSuccess).catch(() => { if (fallbackCopy(clean)) onSuccess() })
    } else if (fallbackCopy(clean)) {
      onSuccess()
    }
  }
  const fallbackCopy = (text) => {
    const el = document.createElement('textarea')
    el.value = text; el.style.position = 'fixed'; el.style.opacity = '0'
    document.body.appendChild(el); el.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch (e) { /* noop */ }
    document.body.removeChild(el)
    return ok
  }
  return (
    <button type="button" className="uc-account-info" onClick={copy} title="คลิกเพื่อคัดลอกเลขบัญชี">
      <div className="uc-account-row uc-account-bank">{account.bank}</div>
      <div className="uc-account-row uc-account-name">{account.name}</div>
      <div className="uc-account-row uc-account-number">
        {account.number}
        <span className={`uc-account-copy ${copied ? 'copied' : ''}`}>{copied ? '✓ คัดลอกแล้ว' : <CopyIcon />}</span>
      </div>
    </button>
  )
}

const PROJECTS = [
  { icon: '🌙', label: 'เลี้ยงละศีลอดวันละ 5,000 คน' },
  { icon: '🥛', label: 'มอบอาหาร, น้ำดื่ม ทุกวันตลอดปี' },
  { icon: '🏠', label: 'ร่วมอุปถัมภ์ 50 ครอบครัว ตลอดปี' },
  { icon: '🚑', label: 'มอบรถพยาบาลช่วยด่วน 1 คัน' },
]

// นาฬิกาเดินทุกวินาที — แยกเป็น component ของตัวเอง เพื่อให้เฉพาะตัวเลขเวลา re-render
// ตัวแดชบอร์ดหลัก (กราฟ/ยอดเงิน) จะวาดใหม่ก็ต่อเมื่อข้อมูล Firestore เปลี่ยนเท่านั้น (จอเปิด 24 ชม.)
function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const date = now.toLocaleDateString('th-TH', { day: '2-digit', month: 'numeric', year: 'numeric' })
  const time = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return (
    <div className="uc-time-box">
      <div className="uc-time-item">
        <span className="uc-ic"></span>
        <div>
          <div className="uc-label">Date</div>
          <div className="uc-value">{date}</div>
        </div>
      </div>
      <div className="uc-time-item">
        <span className="uc-ic"></span>
        <div>
          <div className="uc-label">Time</div>
          <div className="uc-value">{time}</div>
        </div>
      </div>
    </div>
  )
}

export default function FinancialDashboard() {
  const { data, loading } = useFinancialData()
  const [activeProject, setActiveProject] = useState(0)

  const { poor, perPerson, raised, account } = data
  const TARGET = poor * perPerson
  const RAISED = raised

  const remaining = Math.max(TARGET - RAISED, 0)
  // clamp 0–100: กันเปอร์เซ็นต์เกิน 100 (ระดมทุนเกินเป้า) ไม่ให้ legend "ยอดคงเหลือ" โชว์ค่าติดลบ
  const progress = TARGET > 0 ? Math.min((RAISED / TARGET) * 100, 100) : 0
  const canHelp = Math.min(Math.floor(RAISED / (perPerson || 1)), poor)

  const donut = [
    { label: 'ยอดบริจาคสะสม', value: RAISED },
    { label: 'ยอดคงเหลือ', value: remaining },
  ]

  const helpRemaining = Math.max(poor - canHelp, 0)
  const helpDonut = [
    { label: 'สามารถช่วยเหลือได้', value: canHelp },
    { label: 'รอความช่วยเหลือ', value: helpRemaining },
  ]
  const helpProgress = poor > 0 ? (canHelp / poor) * 100 : 0

  // ป้องกันหน้าพังถ้าค่าไม่ใช่ตัวเลข (ชั้นสุดท้ายเสริมจาก sanitize ใน financialData.js)
  const fmt = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtInt = (n) => (Number(n) || 0).toLocaleString('en-US')

  if (loading) return null

  return (
    <div className="uc-dash">
      <div className="uc-card">
        <header className="uc-header">
          <div className="uc-brand">
            <img className="uc-logo" src="/logo.png" alt="" />
            <div>
              <h1>อัปเดตยอดเงินบริจาค <br/> Financial Dashboard</h1>
              <h2>IFTAR FOR GAZA 2026</h2>
            </div>
          </div>
          <Clock />
        </header>

        {/* PROJECTS cards hidden for now */}
        {false && (
        <div className="uc-projects">
          {PROJECTS.map((p, i) => (
            <button
              key={i}
              className={`uc-project-btn${activeProject === i ? ' active' : ''}`}
              onClick={() => setActiveProject(i)}
            >
              <span className="uc-project-icon">{p.icon}</span>
              <span className="uc-project-label">{p.label}</span>
            </button>
          ))}
        </div>
        )}

        <div className="uc-stats uc-stats-light">
          <div className="uc-stat">
            <div className="uc-stat-label">Goal<br /><span>ผู้ยากไร้</span></div>
            <div className="uc-stat-value">{fmtInt(poor)} <small>คน</small></div>
          </div>
          <div className="uc-stat">
            <div className="uc-stat-label">Total Raised<br /><span>ยอดบริจาคสะสม</span></div>
            <div className="uc-stat-value">{fmt(RAISED)} <small>THB.</small></div>
          </div>
          <div className="uc-stat">
            <div className="uc-stat-label">Helped<br /><span>ช่วยเหลือได้</span></div>
            <div className="uc-stat-value">{fmtInt(canHelp)} <small>คน</small></div>
          </div>
          {false && (<>
          <div className="uc-stat">
            <div className="uc-stat-label">Target<br /><span>ยอดเป้าหมาย</span></div>
            <div className="uc-stat-value">{fmt(TARGET)} <small>THB.</small></div>
          </div>
          <div className="uc-stat">
            <div className="uc-stat-label">Remaining<br /><span>ยอดคงเหลือ</span></div>
            <div className="uc-stat-value">{fmt(remaining)}</div>
          </div>
          <div className="uc-stat">
            <div className="uc-stat-label">Progress<br /><span>ความคืบหน้า</span></div>
            <div className="uc-stat-value">{progress.toFixed(2)}%</div>
          </div>
          </>)}
        </div>

        <div className="uc-progress-section">
          <h3>ช่วยเหลือผู้ยากไร้</h3>
          <div className="uc-progress-bar">
            <div className="uc-progress-fill" style={{ width: `${Math.min(helpProgress, 100)}%` }} />
          </div>
          <div className="uc-progress-labels">
            <span>ช่วยเหลือได้ {fmtInt(canHelp)} คน ({helpProgress.toFixed(2)}%)</span>
            <span>ทั้งหมด {fmtInt(poor)} คน</span>
          </div>
        </div>

        <div className="uc-bottom">
          <div className="uc-summary">
            <h3>Donation Summary</h3>
            <div className="uc-summary-body">
              <DonutChart data={donut} colors={['#2E7D52', '#C9A84C']} unit="THB." size={170} />
              <div className="uc-legend">
                <div className="uc-legend-item">
                  <span className="uc-dot" style={{ background: '#2E7D52' }} />
                  <div>
                    <div className="uc-legend-label">ยอดบริจาคสะสม</div>
                    <div className="uc-legend-value">{fmt(RAISED)} THB. <b>{progress.toFixed(2)}%</b></div>
                  </div>
                </div>
                <div className="uc-legend-item">
                  <span className="uc-dot" style={{ background: '#C9A84C' }} />
                  <div>
                    <div className="uc-legend-label">ยอดคงเหลือ</div>
                    <div className="uc-legend-value">{fmt(remaining)} THB. <b>{(100 - progress).toFixed(2)}%</b></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="uc-summary">
            <h3>Help Summary</h3>
            <div className="uc-summary-body">
              <DonutChart data={helpDonut} colors={['#2E7D52', '#C9A84C']} unit="คน" size={170} />
              <div className="uc-legend">
                <div className="uc-legend-item">
                  <span className="uc-dot" style={{ background: '#2E7D52' }} />
                  <div>
                    <div className="uc-legend-label">ช่วยเหลือได้แล้ว</div>
                    <div className="uc-legend-value">{fmtInt(canHelp)} คน <b>{helpProgress.toFixed(2)}%</b></div>
                  </div>
                </div>
                <div className="uc-legend-item">
                  <span className="uc-dot" style={{ background: '#C9A84C' }} />
                  <div>
                    <div className="uc-legend-label">รอความช่วยเหลือ</div>
                    <div className="uc-legend-value">{fmtInt(helpRemaining)} คน <b>{(100 - helpProgress).toFixed(2)}%</b></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="uc-account">
            <h3>Account Details</h3>
            <div className="uc-account-body">
              <div className="uc-bank-logo">
                <img src="/ibank.png" alt="ibank" />
              </div>
              <AccountInfo account={account} />
            </div>
          </div>
        </div>

        <footer className="uc-footer">
          <span> มูลนิธิอุมมะตี · Ummatee Foundation</span>
          <span> facebook.com/UmmateeinThailand</span>
        </footer>
      </div>
    </div>
  )
}
