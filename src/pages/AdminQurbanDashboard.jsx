import { useState } from 'react'
import VolunteerGuard from '../components/VolunteerGuard.jsx'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import { useAllowlistedAdmin } from '../useAdminRole.js'
import { useQurbanData } from '../data/qurbanData.js'
import { Chart, ChartTypeSwitch, DonutChart, HBarChart, PALETTE, legendColors } from '../components/AdminCharts.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCaretUp, faCaretDown } from '@fortawesome/free-solid-svg-icons'

// แดชบอร์ด admin สรุปภารกิจกุรบาน 2026 (/admin/missions/qurban2026) — ข้อมูลอ่านจาก Firestore (config/qurban2026)
// เลือกประเภทกราฟได้ ค้นหา/กรอง/เรียงตารางได้ และขยายเต็มจอ — แก้ไขข้อมูลที่ /admin/missions/qurban2026/edit

export default function AdminQurbanDashboard() {
  const { user, loading } = useAllowlistedAdmin()
  const { data: q, loading: dataLoading } = useQurbanData()

  // ประเภทกราฟของแต่ละการ์ด
  const [catChart, setCatChart] = useState('donut')
  const [countryChart, setCountryChart] = useState('donut')
  const [topChart, setTopChart] = useState('hbar')

  // ค้นหา/กรอง/เรียงตารางรวมทุกประเทศ
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('value') // value | label
  const [sortDir, setSortDir] = useState('desc')
  const [minVal, setMinVal] = useState('')

  // โหมดเต็มจอ
  const [full, setFull] = useState(false)
  const toggleFull = () => {
    setFull((f) => {
      const next = !f
      if (next) document.documentElement.requestFullscreen?.().catch(() => {})
      else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
      return next
    })
  }

  if (loading) return null
  if (!user) return <AdminLogin />
  if (dataLoading) return null

  const COUNTRIES = q.countries
  const COLORS = legendColors(COUNTRIES.length)

  const categoryData = [
    { label: 'Palestine', value: q.categories.palestine, unit: 'วัว' },
    { label: 'Syria', value: q.categories.syria, unit: 'แกะ' },
    { label: 'Thailand', value: q.categories.thailand, unit: 'วัว' },
    { label: 'Worldwide', value: q.categories.worldwide, unit: 'วัว' },
  ]

  const grandTotal = [
    { label: 'Palestine', value: q.categories.palestine },
    { label: 'Syria', value: q.categories.syria },
    { label: 'Thailand', value: q.categories.thailand },
    ...COUNTRIES.map((c) => ({ label: c.n, value: c.v })),
    { label: 'Afghanistan (แกะ)', value: q.afghanistanSheep },
  ].sort((a, b) => b.value - a.value)

  const grandSum = grandTotal.reduce((s, d) => s + d.value, 0)

  const summary = [
    { l: 'ประเทศที่ได้รับ', v: String(q.summary.countries), u: 'ประเทศ' },
    { l: 'วัว', v: String(q.summary.cows), u: 'ตัว' },
    { l: 'แกะ', v: String(q.summary.sheep), u: 'ตัว' },
    { l: 'รวมทั้งหมด', v: q.summary.total.toLocaleString(), u: 'ส่วน' },
  ]

  // ตาราง: ค้นหาตามชื่อ + กรองจำนวนขั้นต่ำ + เรียงตามคอลัมน์ที่เลือก
  const filtered = grandTotal
    .filter((c) => c.label.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((c) => (minVal === '' ? true : c.value >= Number(minVal)))
    .sort((a, b) => {
      const cmp = sortKey === 'label' ? a.label.localeCompare(b.label) : a.value - b.value
      return sortDir === 'asc' ? cmp : -cmp
    })

  const sortBtn = (key) => () => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir(key === 'label' ? 'asc' : 'desc') }
  }
  const arrow = (key) => sortKey === key ? <FontAwesomeIcon icon={sortDir === 'asc' ? faCaretUp : faCaretDown} style={{ marginLeft: 4 }} /> : null

  const countryData = COUNTRIES.map((c) => ({ label: c.n, value: c.v }))

  return (<VolunteerGuard>
    <main className={`admin-dash admin-qurban ${full ? 'admin-full' : ''}`}>
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1>Qurban 2026 — Dashboard</h1>
            <p>สรุปการแจกจ่ายกุรบานทั้งหมด 1447 / 2026</p>
          </div>
          <div className="admin-head-actions">
            <button className="admin-btn" onClick={toggleFull}>{full ? 'ออกจากเต็มจอ' : 'ขยายเต็มจอ'}</button>
            <a className="admin-btn" href="/admin/missions/qurban2026/edit">แก้ไขข้อมูล</a>
          </div>
        </div>

        <div className="admin-stats">
          {summary.map((s) => (
            <div className="admin-stat" key={s.l}>
              <div className="v">{s.v}</div>
              <div className="l">{s.l} ({s.u})</div>
            </div>
          ))}
          <div className="admin-stat">
            <div className="v">{grandSum}</div>
            <div className="l">กุรบานทั้งหมด (รวมนานาชาติ)</div>
          </div>
        </div>

        <div className="admin-grid">
          <div className="admin-card admin-card-center">
            <div className="admin-card-head">
              <h4>การแบ่งกลุ่มภารกิจ</h4>
              <ChartTypeSwitch value={catChart} onChange={setCatChart} />
            </div>
            <Chart type={catChart} data={categoryData} colors={PALETTE} unit="ส่วน" />
            {catChart === 'donut' && (
              <div className="admin-legend">
                {categoryData.map((d, i) => (
                  <span key={d.label}><i style={{ background: PALETTE[i % PALETTE.length] }} /> {d.label}: {d.value} {d.unit}</span>
                ))}
              </div>
            )}
          </div>

          <div className="admin-card admin-card-center">
            <div className="admin-card-head">
              <h4>วัวกุรบานนานาชาติ {countryData.reduce((s, c) => s + c.value, 0)} ตัว แยกตามประเทศ</h4>
              <ChartTypeSwitch value={countryChart} onChange={setCountryChart} types={['donut', 'hbar', 'column']} />
            </div>
            {countryChart === 'donut' ? (
              <>
                <DonutChart data={countryData} colors={COLORS} unit="วัว / cow" />
                <div className="admin-legend">
                  {countryData.slice(0, 8).map((c, i) => (
                    <span key={c.label}><i style={{ background: COLORS[i % COLORS.length] }} /> {c.label}: {c.value}</span>
                  ))}
                  <span><i style={{ background: '#999' }} /> อื่นๆ: {countryData.slice(8).reduce((s, c) => s + c.value, 0)}</span>
                </div>
              </>
            ) : (
              <Chart type={countryChart} data={countryData.slice(0, 12)} colors={COLORS} />
            )}
          </div>

          <div className="admin-card">
            <div className="admin-card-head">
              <h4>ประเทศที่ได้รับมากที่สุด (Top 10)</h4>
              <ChartTypeSwitch value={topChart} onChange={setTopChart} types={['hbar', 'column', 'line']} />
            </div>
            <Chart type={topChart} data={grandTotal.slice(0, 10)} colors={['#2196f3']} />
          </div>
        </div>

        <div className="admin-card" style={{ marginTop: 24 }}>
          <div className="admin-card-head">
            <h4>สัดส่วนทุกประเทศ/กลุ่ม ({filtered.length}/{grandTotal.length} รายการ)</h4>
            <div className="admin-filters">
              <input
                type="search"
                placeholder="ค้นหาประเทศ/กลุ่ม..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <input
                type="number"
                placeholder="จำนวนขั้นต่ำ"
                value={minVal}
                onChange={(e) => setMinVal(e.target.value)}
                style={{ width: 110 }}
              />
              {(search || minVal) && (
                <button className="admin-btn" onClick={() => { setSearch(''); setMinVal('') }}>ล้าง</button>
              )}
            </div>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ลำดับ</th>
                  <th className="admin-th-sort" onClick={sortBtn('label')}>ประเทศ/กลุ่ม{arrow('label')}</th>
                  <th className="admin-th-sort" onClick={sortBtn('value')}>จำนวน{arrow('value')}</th>
                  <th>สัดส่วน</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.label}>
                    <td>{i + 1}</td>
                    <td>{c.label}</td>
                    <td>{c.value}</td>
                    <td>{((c.value / grandSum) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan="4" style={{ textAlign: 'center', color: '#999' }}>ไม่พบรายการที่ค้นหา</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  </VolunteerGuard>)
}
