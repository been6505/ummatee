import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { useQurbanData } from '../data/qurbanData.js'

// แดชบอร์ด admin สรุปภารกิจกุรบาน 2026 (/admin/missions/qurban2026) — ข้อมูลอ่านจาก Firestore (config/qurban2026)
// แก้ไขข้อมูลได้ที่หน้า /admin/missions/qurban2026/edit

const DONUT_COLORS = ['#2e7d52', '#e8194a', '#c9a84c', '#2196f3', '#8e44ad', '#e67e22']

// รัศมีและเส้นรอบวงของโดนัทชาร์ต
const R = 70
const CIRC = 2 * Math.PI * R

// โดนัทชาร์ต SVG — แต่ละรายการเป็นเส้นโค้ง 1 ชิ้น ยาวตามสัดส่วน พร้อมตัวเลขรวมตรงกลาง
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

// กราฟแท่งแนวนอน — ความกว้างเทียบกับค่าสูงสุดในชุดข้อมูล
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
  const { user, loading } = useAdminAuth()
  const { data: q, loading: dataLoading } = useQurbanData()

  if (loading) return null
  if (!user) return <AdminLogin />
  if (dataLoading) return null

  const COUNTRIES = q.countries
  const COLORS = COUNTRIES.map((_, i) => `hsl(${Math.round((i * 360) / COUNTRIES.length)}, 65%, 55%)`)

  const CATEGORY_DATA = [
    { label: 'Palestine', value: q.categories.palestine, unit: 'วัว' },
    { label: 'Syria', value: q.categories.syria, unit: 'แกะ' },
    { label: 'Thailand', value: q.categories.thailand, unit: 'วัว' },
    { label: 'Worldwide', value: q.categories.worldwide, unit: 'วัว' },
  ]

  const GRAND_TOTAL = [
    { label: 'Palestine', value: q.categories.palestine },
    { label: 'Syria', value: q.categories.syria },
    { label: 'Thailand', value: q.categories.thailand },
    ...COUNTRIES.map((c) => ({ label: c.n, value: c.v })),
    { label: 'Afghanistan (แกะ)', value: q.afghanistanSheep },
  ].sort((a, b) => b.value - a.value)

  const GRAND_TOTAL_SUM = GRAND_TOTAL.reduce((s, d) => s + d.value, 0)

  const SUMMARY = [
    { l: 'ประเทศที่ได้รับ', v: String(q.summary.countries), u: 'ประเทศ' },
    { l: 'วัว', v: String(q.summary.cows), u: 'ตัว' },
    { l: 'แกะ', v: String(q.summary.sheep), u: 'ตัว' },
    { l: 'รวมทั้งหมด', v: q.summary.total.toLocaleString(), u: 'ส่วน' },
  ]

  const topCountries = GRAND_TOTAL.slice(0, 10)
  const allCountries = GRAND_TOTAL
  const categoryBars = CATEGORY_DATA.map((c) => ({ label: c.label, value: c.value }))

  return (
    <main className="admin-dash admin-qurban">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1>Qurban 2026 — Dashboard</h1>
            <p>สรุปการแจกจ่ายกุรบานทั้งหมด 1447 / 2026</p>
          </div>
          <a className="admin-btn" href="/admin/missions/qurban2026/edit">แก้ไขข้อมูล</a>
        </div>

        <div className="admin-stats">
          {SUMMARY.map((s) => (
            <div className="admin-stat" key={s.l}>
              <div className="v">{s.v}</div>
              <div className="l">{s.l} ({s.u})</div>
            </div>
          ))}
          <div className="admin-stat">
            <div className="v">{GRAND_TOTAL_SUM}</div>
            <div className="l">กุรบานทั้งหมด (รวมนานาชาติ)</div>
          </div>
        </div>

        <div className="admin-grid">
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

          <div className="admin-card admin-card-center">
            <h4>สัดส่วนวัวกุรบาน {COUNTRIES.reduce((s, c) => s + c.v, 0)} ตัว แยกตามประเทศ</h4>
            <DonutChart data={COUNTRIES} colors={COLORS} unit="วัว / cow" />
            <div className="admin-legend">
              {COUNTRIES.slice(0, 8).map((c, i) => (
                <span key={c.n}><i style={{ background: COLORS[i % COLORS.length] }} /> {c.n}: {c.v}</span>
              ))}
              <span><i style={{ background: '#999' }} /> อื่นๆ: {COUNTRIES.slice(8).reduce((s, c) => s + c.v, 0)}</span>
            </div>
          </div>

          <BarList title="ประเทศที่ได้รับมากที่สุด (Top 10)" data={topCountries} color="#2196f3" />
        </div>

        <div className="admin-card" style={{ marginTop: 24 }}>
          <h4>สัดส่วนทุกประเทศ/กลุ่ม ({allCountries.length} รายการ)</h4>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>ลำดับ</th><th>ประเทศ/กลุ่ม</th><th>จำนวน</th><th>สัดส่วน</th></tr>
              </thead>
              <tbody>
                {allCountries.map((c, i) => (
                  <tr key={c.label}>
                    <td>{i + 1}</td>
                    <td>{c.label}</td>
                    <td>{c.value}</td>
                    <td>{((c.value / GRAND_TOTAL_SUM) * 100).toFixed(1)}%</td>
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
