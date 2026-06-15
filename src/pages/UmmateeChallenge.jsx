import { useEffect, useState } from 'react'
import { DonutChart } from '../components/AdminCharts.jsx'

// แดชบอร์ดแสดงผลยอดบริจาค Ummatee Challenge 2026 — สำหรับเปิดบนทีวีหน้างาน (/challenge)
const TARGET = 1500000
const RAISED = 732799.36

const ACCOUNT = {
  bank: 'ธนาคารอิสลามแห่งประเทศไทย (ibank)',
  name: 'มูลนิธิอุมมะตี · Ummatee Foundation',
  number: '0011 1863 48',
}

export default function UmmateeChallenge() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const remaining = Math.max(TARGET - RAISED, 0)
  const progress = (RAISED / TARGET) * 100

  const date = now.toLocaleDateString('th-TH', { day: '2-digit', month: 'numeric', year: 'numeric' })
  const time = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const donut = [
    { label: 'ยอดบริจาคสะสม', value: RAISED },
    { label: 'ยอดคงเหลือ', value: remaining },
  ]

  const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="uc-dash">
      <div className="uc-card">
        <header className="uc-header">
          <div className="uc-brand">
            <img className="uc-logo" src="/logo.png" alt="" />
            <div>
              <h1>UMMATEE CHALLENGE 2026</h1>
              <h2>ให้ 100 ถึง 100</h2>
              <p>อัปเดตยอดเงินบริจาค · Financial Dashboard</p>
            </div>
          </div>
          <div className="uc-time-box">
            <div className="uc-time-item">
              <span className="uc-ic">📅</span>
              <div>
                <div className="uc-label">Last Update</div>
                <div className="uc-value">{date}</div>
              </div>
            </div>
            <div className="uc-time-item">
              <span className="uc-ic">🕐</span>
              <div>
                <div className="uc-label">Time</div>
                <div className="uc-value">{time}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="uc-stats">
          <div className="uc-stat">
            <div className="uc-stat-ic">🎯</div>
            <div className="uc-stat-label">Target<br /><span>ยอดเป้าหมาย</span></div>
            <div className="uc-stat-value">{fmt(TARGET)} <small>THB.</small></div>
          </div>
          <div className="uc-stat">
            <div className="uc-stat-ic">💚</div>
            <div className="uc-stat-label">Total Raised<br /><span>ยอดบริจาคสะสม</span></div>
            <div className="uc-stat-value">{fmt(RAISED)} <small>THB.</small></div>
          </div>
          <div className="uc-stat">
            <div className="uc-stat-ic">👛</div>
            <div className="uc-stat-label">Remaining<br /><span>ยอดคงเหลือ</span></div>
            <div className="uc-stat-value">{fmt(remaining)}</div>
          </div>
          <div className="uc-stat">
            <div className="uc-stat-ic">📈</div>
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

          <div className="uc-account">
            <h3>Account Details</h3>
            <div className="uc-summary-body">
              <div className="uc-bank-logo">
                <img src="/Logo-ibank.svg.png" alt="ibank" />
              </div>
              <div className="uc-account-info">
                <div className="uc-account-row"><span className="uc-account-ic">🏦</span> <b>BANK</b><br />{ACCOUNT.bank}</div>
                <div className="uc-account-row"><span className="uc-account-ic">👤</span> <b>ACCOUNT NAME</b><br />{ACCOUNT.name}</div>
                <div className="uc-account-row"><span className="uc-account-ic">#️⃣</span> <b>ACCOUNT NUMBER</b><br />{ACCOUNT.number}</div>
              </div>
            </div>
          </div>
        </div>

        <footer className="uc-footer">
          <span>💚 มูลนิธิอุมมะตี · Ummatee Foundation</span>
          <span>📘 facebook.com/ummatee.foundation</span>
          <span>📷 ummatee.foundation</span>
        </footer>
      </div>
    </div>
  )
}
