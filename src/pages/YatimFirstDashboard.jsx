import { useEffect, useState } from 'react'
import { DonutChart } from '../components/AdminCharts.jsx'

// แดชบอร์ดแสดงผลยอดบริจาค YATIM FIRST 2026 — สำหรับเปิดบนทีวีหน้างาน (/yatim-first)
const TARGET = 1500000
const RAISED = 732799.36

const ACCOUNT = {
  bank: 'Government Saving Bank (GSB)',
  bankTh: 'ธนาคารออมสิน',
  name: 'มูลนิธิยัตติมเพื่อสิทธิมนุษยชนและการพัฒนา',
  number: '020-4-53255-786',
}

export default function YatimFirstDashboard() {
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
    <div className="yf-dash">
      <div className="yf-card">
        <header className="yf-header">
          <div className="yf-brand">
            <img className="yf-logo" src="/logo.png" alt="" />
            <div>
              <h1>YATIM FIRST 2026</h1>
              <h2>Financial Dashboard</h2>
              <p>อัปเดตยอดเงินบริจาค</p>
            </div>
          </div>
          <div className="yf-time-box">
            <div className="yf-time-item">
              <span className="yf-ic">📅</span>
              <div>
                <div className="yf-label">Last Update</div>
                <div className="yf-value">{date}</div>
              </div>
            </div>
            <div className="yf-time-item">
              <span className="yf-ic">🕐</span>
              <div>
                <div className="yf-label">Time</div>
                <div className="yf-value">{time}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="yf-stats">
          <div className="yf-stat">
            <div className="yf-stat-ic">🎯</div>
            <div className="yf-stat-label">Target<br /><span>ยอดเป้าหมาย</span></div>
            <div className="yf-stat-value">{fmt(TARGET)} <small>THB.</small></div>
          </div>
          <div className="yf-stat">
            <div className="yf-stat-ic">💚</div>
            <div className="yf-stat-label">Total Raised<br /><span>ยอดบริจาคสะสม</span></div>
            <div className="yf-stat-value">{fmt(RAISED)} <small>THB.</small></div>
          </div>
          <div className="yf-stat">
            <div className="yf-stat-ic">👛</div>
            <div className="yf-stat-label">Remaining<br /><span>ยอดคงเหลือ</span></div>
            <div className="yf-stat-value">{fmt(remaining)}</div>
          </div>
          <div className="yf-stat">
            <div className="yf-stat-ic">📈</div>
            <div className="yf-stat-label">Progress<br /><span>ความคืบหน้า</span></div>
            <div className="yf-stat-value">{progress.toFixed(2)}%</div>
          </div>
        </div>

        <div className="yf-progress-section">
          <h3>Donation Progress</h3>
          <div className="yf-progress-bar">
            <div className="yf-progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <div className="yf-progress-labels">
            <span>0</span>
            <span>{fmt(TARGET)} THB.</span>
          </div>
        </div>

        <div className="yf-bottom">
          <div className="yf-summary">
            <h3>Donation Summary</h3>
            <div className="yf-summary-body">
              <DonutChart data={donut} colors={['#2e7d52', '#e53935']} unit="THB." size={170} />
              <div className="yf-legend">
                <div className="yf-legend-item">
                  <span className="yf-dot" style={{ background: '#2e7d52' }} />
                  <div>
                    <div className="yf-legend-label">ยอดบริจาคสะสม</div>
                    <div className="yf-legend-value">{fmt(RAISED)} THB. <b>{progress.toFixed(2)}%</b></div>
                  </div>
                </div>
                <div className="yf-legend-item">
                  <span className="yf-dot" style={{ background: '#e53935' }} />
                  <div>
                    <div className="yf-legend-label">ยอดคงเหลือ</div>
                    <div className="yf-legend-value">{fmt(remaining)} THB. <b>{(100 - progress).toFixed(2)}%</b></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="yf-account">
            <h3>Account Details</h3>
            <div className="yf-account-body">
              <div className="yf-bank-logo">ออมสิน</div>
              <div className="yf-account-info">
                <div className="yf-account-row"><span className="yf-account-ic">🏦</span> <b>BANK</b><br />{ACCOUNT.bank}</div>
                <div className="yf-account-row"><span className="yf-account-ic">👤</span> <b>ACCOUNT NAME</b><br />{ACCOUNT.name}</div>
                <div className="yf-account-row"><span className="yf-account-ic">#️⃣</span> <b>ACCOUNT NUMBER</b><br />{ACCOUNT.number}</div>
              </div>
            </div>
          </div>
        </div>

        <footer className="yf-footer">
          <span>❤️ โครงการมหกรรมอาหารวัฒนธรรมมลายูพื้นบ้าน</span>
          <span>📘 YATIM FIRST : มหกรรมอาหารวัฒนธรรมมลายูพื้นบ้าน</span>
          <span>📷 yatim.first</span>
        </footer>
      </div>
    </div>
  )
}
