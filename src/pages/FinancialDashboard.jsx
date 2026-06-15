import { useEffect, useState } from 'react'
import { DonutChart } from '../components/AdminCharts.jsx'
import CopyIcon from '../components/CopyIcon.jsx'
import { useFinancialData } from '../data/financialData.js'

// แดชบอร์ดแสดงผลยอดบริจาค (Financial Dashboard) — สำหรับเปิดบนทีวีหน้างาน (/challenge)
// ข้อมูลอ่านจาก Firestore (config/financialDashboard) แก้ไขได้ที่ /admin/financial-dashboard

// กล่องข้อมูลบัญชี — แตะเพื่อคัดลอกเฉพาะเลขบัญชี (ตัดช่องว่างออกก่อนคัดลอก)
function AccountInfo({ account }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    const clean = account.number.replace(/\s/g, '')
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(clean).catch(() => fallbackCopy(clean))
    } else {
      fallbackCopy(clean)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  const fallbackCopy = (text) => {
    const el = document.createElement('textarea')
    el.value = text; el.style.position = 'fixed'; el.style.opacity = '0'
    document.body.appendChild(el); el.select()
    try { document.execCommand('copy') } catch (e) { /* noop */ }
    document.body.removeChild(el)
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

export default function FinancialDashboard() {
  const { data, loading } = useFinancialData()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const { poor, perPerson, raised, account } = data
  const TARGET = poor * perPerson
  const RAISED = raised

  const remaining = Math.max(TARGET - RAISED, 0)
  const progress = TARGET > 0 ? (RAISED / TARGET) * 100 : 0
  const canHelp = Math.min(Math.floor(RAISED / (perPerson || 1)), poor)

  const date = now.toLocaleDateString('th-TH', { day: '2-digit', month: 'numeric', year: 'numeric' })
  const time = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

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

  const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtInt = (n) => n.toLocaleString('en-US')

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
          <div className="uc-time-box">
            <div className="uc-time-item">
              <span className="uc-ic"></span>
              <div>
                <div className="uc-label">Last Update</div>
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
        </header>

        <div className="uc-stats">
          <div className="uc-stat">
            <div className="uc-stat-label">Goal<br /><span>ผู้ยากไร้</span></div>
            <div className="uc-stat-value">{fmtInt(poor)} <small>คน</small></div>
          </div>
          <div className="uc-stat">
            <div className="uc-stat-label">Helped<br /><span>ช่วยเหลือได้</span></div>
            <div className="uc-stat-value">{fmtInt(canHelp)} <small>คน</small></div>
          </div>
          <div className="uc-stat">
            <div className="uc-stat-label">Target<br /><span>ยอดเป้าหมาย</span></div>
            <div className="uc-stat-value">{fmt(TARGET)} <small>THB.</small></div>
          </div>
          <div className="uc-stat">
            <div className="uc-stat-label">Total Raised<br /><span>ยอดบริจาคสะสม</span></div>
            <div className="uc-stat-value">{fmt(RAISED)} <small>THB.</small></div>
          </div>
          <div className="uc-stat">
            <div className="uc-stat-label">Remaining<br /><span>ยอดคงเหลือ</span></div>
            <div className="uc-stat-value">{fmt(remaining)}</div>
          </div>
          <div className="uc-stat">
            <div className="uc-stat-label">Progress<br /><span>ความคืบหน้า</span></div>
            <div className="uc-stat-value">{progress.toFixed(2)}%</div>
          </div>
        </div>

        <div className="uc-progress-section">
          <h3>Donation Progress</h3>
          <div className="uc-progress-bar">
            <div className="uc-progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <div className="uc-progress-labels">
            <span>0</span>
            <span>{fmt(TARGET)} THB.</span>
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
