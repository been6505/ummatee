import { useState } from 'react'

const ADMIN_PASS = 'ummatee2026'

const COUNTRIES = [
  { n: 'India', v: 55 },
  { n: 'Chad', v: 13 },
  { n: 'Bangladesh', v: 3 },
  { n: 'Benin', v: 2 },
  { n: 'Ethiopia', v: 2 },
  { n: 'Kenya', v: 2 },
  { n: 'Mozambique', v: 2 },
  { n: 'Nigeria', v: 2 },
  { n: 'Kashmir', v: 1 },
  { n: 'Yemen', v: 1 },
  { n: 'Indonesia', v: 1 },
  { n: 'Lebanon', v: 1 },
  { n: 'Pakistan', v: 1 },
  { n: 'Nepal', v: 1 },
  { n: 'Sudan', v: 1 },
  { n: 'Myanmar', v: 1 },
  { n: 'Mauritania', v: 1 },
  { n: 'Sierra Leone', v: 1 },
  { n: 'South Sudan', v: 1 },
  { n: 'Malawi', v: 1 },
  { n: 'Somalia', v: 1 },
  { n: 'Cameroon', v: 1 },
  { n: 'Uganda', v: 1 },
  { n: 'Niger', v: 1 },
  { n: 'Tanzania', v: 1 },
  { n: 'Rohingya', v: 1 },
  { n: 'Burkina Faso', v: 1 },
]

const TOTAL_COW = COUNTRIES.reduce((s, c) => s + c.v, 0) // 100
const COLORS = COUNTRIES.map((_, i) => `hsl(${Math.round((i * 360) / COUNTRIES.length)}, 65%, 55%)`)

const CATEGORY_DATA = [
  { label: 'Palestine 🇵🇸', value: 145, unit: 'วัว' },
  { label: 'Syria 🇸🇾', value: 12, unit: 'แกะ' },
  { label: 'Thailand 🇹🇭', value: 34, unit: 'วัว' },
  { label: 'Worldwide 🌍', value: 100, unit: 'วัว' },
]

// รวมทุกภารกิจเข้าด้วยกัน: Palestine, Syria, Thailand, นานาชาติ (แยกตามประเทศ), Afghanistan (แกะ)
const GRAND_TOTAL = [
  { label: 'Palestine 🇵🇸', value: 145 },
  { label: 'Syria 🇸🇾', value: 12 },
  { label: 'Thailand 🇹🇭', value: 34 },
  ...COUNTRIES.map((c) => ({ label: c.n, value: c.v })),
  { label: 'Afghanistan (แกะ)', value: 5 },
].sort((a, b) => b.value - a.value)

const GRAND_TOTAL_SUM = GRAND_TOTAL.reduce((s, d) => s + d.value, 0)

const SUMMARY = [
  { e: '🌍', l: 'ประเทศที่ได้รับ', v: '31', u: 'ประเทศ' },
  { e: '🐄', l: 'วัว', v: '279', u: 'ตัว' },
  { e: '🐑', l: 'แกะ', v: '17', u: 'ตัว' },
  { e: '📦', l: 'รวมทั้งหมด', v: '1,948', u: 'ส่วน' },
]

const DONUT_COLORS = ['#2e7d52', '#e8194a', '#c9a84c', '#2196f3', '#8e44ad', '#e67e22']

const R = 70
const CIRC = 2 * Math.PI * R

function DonutChart({ data, colors, unit }) {
  const total = data.reduce((s, d) => s + d.v, 0) || 1
  let offset = 0
  return (
    <svg viewBox="0 0 180 180" className="admin-donut" style={{ width: 200, height: 200 }}>
      <circle cx="90" cy="90" r={R} fill="none" stroke="#eee" strokeWidth="28" />
      {data.map((d, i) => {
        const len = (d.v / total) * CIRC
        const seg = (
          <circle
            key={d.n}
            cx="90" cy="90" r={R}
            fill="none"
            stroke={colors[i % colors.length]}
            strokeWidth="28"
            strokeDasharray={`${len} ${CIRC - len}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 90 90)"
          >
            <title>{d.n}: {d.v}</title>
          </circle>
        )
        offset += len
        return seg
      })}
      <circle cx="90" cy="90" r={R - 15} fill="#fff" />
      <text x="90" y="94" textAnchor="middle" fontSize="24" fontWeight="800" fill="#1a5c3a">{total}</text>
      <text x="90" y="112" textAnchor="middle" fontSize="11" fill="#2e7d52">{unit}</text>
    </svg>
  )
}

function BarList({ title, data, color = '#2e7d52', valueLabel = (v) => v }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="admin-card">
      <h4>{title}</h4>
      {data.map((d) => (
        <div className="admin-bar-row" key={d.label}>
          <span className="admin-bar-label">{d.label}</span>
          <div className="admin-bar-track">
            <div className="admin-bar-fill" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
          <span className="admin-bar-value">{valueLabel(d.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function AdminQurbanDashboard() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin-authed') === '1')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')

  if (!authed) {
    return (
      <main className="admin-login">
        <form
          className="admin-login-box"
          onSubmit={(e) => {
            e.preventDefault()
            if (pass === ADMIN_PASS) {
              sessionStorage.setItem('admin-authed', '1')
              setAuthed(true)
            } else {
              setError('รหัสผ่านไม่ถูกต้อง')
            }
          }}
        >
          <h2>🔒 Admin Login</h2>
          <p>หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
          <input
            type="password"
            placeholder="รหัสผ่าน"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoFocus
          />
          {error && <div className="admin-error">{error}</div>}
          <button type="submit">เข้าสู่ระบบ</button>
        </form>
      </main>
    )
  }

  const topCountries = [...COUNTRIES].sort((a, b) => b.v - a.v).slice(0, 10).map((c) => ({ label: c.n, value: c.v }))
  const allCountries = [...COUNTRIES].sort((a, b) => b.v - a.v).map((c) => ({ label: c.n, value: c.v }))
  const categoryBars = CATEGORY_DATA.map((c) => ({ label: c.label, value: c.value }))

  return (
    <main className="admin-dash">
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1>📊 Qurban 2026 — Dashboard</h1>
            <p>สรุปการแจกจ่ายกุรบานทั้งหมด 1447 / 2026</p>
          </div>
          <button
            className="admin-logout"
            onClick={() => { sessionStorage.removeItem('admin-authed'); setAuthed(false) }}
          >
            ออกจากระบบ
          </button>
        </div>

        <div className="admin-stats">
          {SUMMARY.map((s) => (
            <div className="admin-stat" key={s.l}>
              <div className="v">{s.e} {s.v}</div>
              <div className="l">{s.l} ({s.u})</div>
            </div>
          ))}
          <div className="admin-stat">
            <div className="v">🐑🐄 {GRAND_TOTAL_SUM}</div>
            <div className="l">กุรบานทั้งหมด (รวมนานาชาติ)</div>
          </div>
        </div>

        <div className="admin-grid">
          <div className="admin-card admin-card-center">
            <h4>สัดส่วนวัวกุรบาน 100 ตัว แยกตามประเทศ</h4>
            <DonutChart data={COUNTRIES} colors={COLORS} unit="วัว / cow" />
            <div className="admin-legend">
              {COUNTRIES.slice(0, 8).map((c, i) => (
                <span key={c.n}><i style={{ background: COLORS[i % COLORS.length] }} /> {c.n}: {c.v}</span>
              ))}
              <span><i style={{ background: '#999' }} /> อื่นๆ: {COUNTRIES.slice(8).reduce((s, c) => s + c.v, 0)}</span>
            </div>
          </div>

          <div className="admin-card admin-card-center">
            <h4>การแบ่งกลุ่มภารกิจ</h4>
            <DonutChart
              data={CATEGORY_DATA.map((c) => ({ n: c.label, v: c.value }))}
              colors={DONUT_COLORS}
              unit="ส่วน"
            />
            <div className="admin-legend">
              {CATEGORY_DATA.map((d, i) => (
                <span key={d.label}><i style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} /> {d.label}: {d.value} {d.unit}</span>
              ))}
            </div>
          </div>

          <BarList title="กลุ่มภารกิจ (Palestine / Syria / Thailand / Worldwide)" data={categoryBars} color="#e8194a" />
          <BarList title="ประเทศที่ได้รับมากที่สุด (Top 10)" data={topCountries} color="#2196f3" />
        </div>

        <div className="admin-card" style={{ marginTop: 24 }}>
          <h4>สัดส่วนทุกประเทศ ({allCountries.length} ประเทศ)</h4>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>ลำดับ</th><th>ประเทศ</th><th>จำนวนวัว</th><th>สัดส่วน</th></tr>
              </thead>
              <tbody>
                {allCountries.map((c, i) => (
                  <tr key={c.label}>
                    <td>{i + 1}</td>
                    <td>{c.label}</td>
                    <td>{c.value}</td>
                    <td>{((c.value / TOTAL_COW) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-card" style={{ marginTop: 24 }}>
          <h4>🐑🐄 กุรบานทั้งหมด (Palestine + Syria + Thailand + นานาชาติ) — รวม {GRAND_TOTAL_SUM} ส่วน</h4>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>ลำดับ</th><th>ประเทศ / กลุ่ม</th><th>จำนวน</th><th>สัดส่วนของทั้งหมด</th></tr>
              </thead>
              <tbody>
                {GRAND_TOTAL.map((d, i) => (
                  <tr key={d.label}>
                    <td>{i + 1}</td>
                    <td>{d.label}</td>
                    <td>{d.value}</td>
                    <td>{((d.value / GRAND_TOTAL_SUM) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
