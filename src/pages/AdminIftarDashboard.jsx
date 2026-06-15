import { useEffect, useMemo, useState } from 'react'
import { db } from '../firebase.js'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { Chart, ChartTypeSwitch, PALETTE, legendColors } from '../components/AdminCharts.jsx'

// แดชบอร์ด admin ของงาน Iftar For Gaza (/admin/event/iftar2026)
// ดึงรายชื่อผู้ลงทะเบียนจาก Google Sheet เป็นหลัก (fallback เป็น Firestore) แล้วสรุปเป็นกราฟ + ตาราง

// Apps Script Web App เดียวกับที่หน้าลงทะเบียนใช้ส่งข้อมูล (doGet คืนรายการจาก Sheet)
const SHEET_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzIqLLYl8qjwXXZRiZIefPPKyCK_SKZZi-0kCJDyz9vxbvHL9vQC5cHJ5ybZ3-NiXcCyA/exec'
// token ต้องตรงกับที่ตั้งไว้ใน doGet ของ Apps Script — ถ้าไม่ส่งหรือผิด จะได้ {"error":"unauthorized"}
const SHEET_TOKEN = 'umt-7Kp2xQ9mZr4Wv8Td'

// การ์ดกราฟที่เลือกประเภทได้ (โดนัท/แท่งนอน/แท่งตั้ง/เส้น) — ใช้ชุดกราฟกลางจาก AdminCharts
function ChartCard({ title, data, colors, types = ['donut', 'hbar', 'column'], showLegend = true, topN }) {
  const [type, setType] = useState(types[0])
  const [showAll, setShowAll] = useState(false)
  // ถ้ากำหนด topN และข้อมูลมากกว่านั้น ให้ตัดเหลือ topN จนกว่าจะกด "ดูทั้งหมด"
  const canCollapse = topN != null && data.length > topN
  const shown = canCollapse && !showAll ? data.slice(0, topN) : data
  const cols = colors || legendColors(shown.length)
  return (
    <div className="admin-card admin-card-center">
      <div className="admin-card-head">
        <h4>{title}</h4>
        <ChartTypeSwitch value={type} onChange={setType} types={types} />
      </div>
      {data.length === 0 ? (
        <p className="admin-empty">ไม่มีข้อมูล</p>
      ) : (
        <>
          <Chart type={type} data={shown} colors={cols} />
          {showLegend && type === 'donut' && (
            <div className="admin-legend">
              {shown.map((d, i) => (
                <span key={d.label}><i style={{ background: cols[i % cols.length] }} /> {d.label}: {d.value}</span>
              ))}
            </div>
          )}
          {canCollapse && (
            <button className="admin-clear" style={{ marginTop: 12 }} onClick={() => setShowAll((v) => !v)}>
              {showAll ? `แสดงเฉพาะ Top ${topN}` : `ดูทั้งหมด (${data.length})`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

// นับจำนวนตามค่าที่ fn คืน (รองรับหลายค่าต่อ 1 รายการ เช่น channel ที่คั่นด้วยจุลภาค) เรียงมาก→น้อย
function countBy(list, fn) {
  const map = {}
  list.forEach((item) => {
    const keys = fn(item)
    ;(Array.isArray(keys) ? keys : [keys]).forEach((k) => {
      const key = (k || '').toString().trim() || '—'
      map[key] = (map[key] || 0) + 1
    })
  })
  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

// จัดอายุเป็นช่วง ๆ สำหรับกราฟ
function ageGroup(ageStr) {
  const age = parseInt(ageStr, 10)
  if (!age) return 'ไม่ระบุ'
  if (age < 18) return '< 18'
  if (age <= 25) return '18-25'
  if (age <= 35) return '26-35'
  if (age <= 50) return '36-50'
  return '50+'
}


// มิติที่ใช้กรองตาราง — รวมเพศ/อาชีพ/จังหวัด/ช่วงอายุ/ช่องทางที่รู้จัก/สิ่งที่คาดหวัง
// get() คืน array ของค่า (รองรับฟิลด์หลายค่าอย่าง channel/expect ที่คั่นด้วยจุลภาค)
const FILTER_FIELDS = [
  { key: 'gender', label: 'เพศ', get: (r) => [r.gender] },
  { key: 'job', label: 'อาชีพ', get: (r) => [r.job] },
  { key: 'province', label: 'จังหวัด', get: (r) => [r.province] },
  { key: 'age', label: 'ช่วงอายุ', get: (r) => [ageGroup(r.age)] },
  { key: 'channel', label: 'รู้จักงาน', get: (r) => (r.channel || '').split(',').map((s) => s.trim()).filter(Boolean) },
  { key: 'expect', label: 'สิ่งที่คาดหวัง', get: (r) => (r.expect || '').split(',').map((s) => s.trim()).filter(Boolean) },
]

export default function AdminIftarDashboard() {
  const { user, loading: authLoading } = useAdminAuth()
  const authed = !!user
  const [regs, setRegs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // โหลดข้อมูลหลังล็อกอิน: ลอง Google Sheet ก่อน ถ้าพลาดค่อยใช้ Firestore
  useEffect(() => {
    if (!authed) return
    let cancelled = false
    setLoading(true)

    const loadFromFirestore = () =>
      getDocs(query(collection(db, 'iftarRegs'), orderBy('date', 'desc')))
        .then((snap) => {
          if (cancelled) return
          setRegs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        })
        .catch(() =>
          getDocs(collection(db, 'iftarRegs')).then((snap) => {
            if (cancelled) return
            setRegs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
          })
        )

    // ดึงจาก Google Sheet ก่อน (ข้อมูลหลัก) ถ้าไม่ได้ค่อย fallback ไป Firestore
    fetch(`${SHEET_ENDPOINT}?token=${SHEET_TOKEN}`)
      .then((res) => res.json())
      .then((out) => {
        if (cancelled) return
        if (!Array.isArray(out.rows)) throw new Error('bad response')
        setRegs(out.rows.map((r, i) => ({ id: r.ref || i, ...r })).reverse())
      })
      .catch(() => loadFromFirestore())
      .finally(() => !cancelled && setLoading(false))

    return () => { cancelled = true }
  }, [authed])

  // ตัวกรองและการเรียงลำดับของตารางรายชื่อ
  const [filterField, setFilterField] = useState('gender') // มิติที่เลือกกรอง (จัดเรียงโดย)
  const [filterValue, setFilterValue] = useState('') // ค่าที่เลือกในมิตินั้น
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')

  // คลิกหัวตาราง: คอลัมน์เดิม = สลับ asc/desc, คอลัมน์ใหม่ = เริ่มที่ asc
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const fieldDef = FILTER_FIELDS.find((f) => f.key === filterField) || FILTER_FIELDS[0]

  // ค่าตัวเลือกของมิติที่เลือก (distinct, เรียง) — เปลี่ยนมิติแล้วต้องรีเซ็ตค่าที่เลือก
  const valueOptions = useMemo(
    () => Array.from(new Set(regs.flatMap((r) => fieldDef.get(r)).map((v) => (v || '').toString().trim()).filter(Boolean))).sort(),
    [regs, filterField]
  )

  const pickField = (key) => { setFilterField(key); setFilterValue('') }

  // กรองด้วยคำค้น + มิติที่เลือก แล้วเรียงตามคอลัมน์ที่เลือก (อายุเรียงแบบตัวเลข)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = regs.filter((r) => {
      if (q && !`${r.fname} ${r.lname} ${r.phone} ${r.email} ${r.province} ${r.job} ${r.ref}`.toLowerCase().includes(q)) return false
      if (filterValue && !fieldDef.get(r).map((v) => (v || '').toString().trim()).includes(filterValue)) return false
      return true
    })
    list = [...list].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey]
      if (sortKey === 'age') { av = parseInt(av, 10) || 0; bv = parseInt(bv, 10) || 0 }
      else { av = (av ?? '').toString(); bv = (bv ?? '').toString() }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [regs, search, filterField, filterValue, sortKey, sortDir])

  // สรุปข้อมูลเป็นชุดสำหรับกราฟแต่ละตัว
  const genderData = useMemo(() => countBy(regs, (r) => r.gender), [regs])
  const ageData = useMemo(() => countBy(regs, (r) => ageGroup(r.age)), [regs])
  const channelData = useMemo(() => countBy(regs, (r) => (r.channel || '').split(',').map((s) => s.trim()).filter(Boolean)), [regs])
  const provinceData = useMemo(() => countBy(regs, (r) => r.province), [regs])
  const expectData = useMemo(() => countBy(regs, (r) => (r.expect || '').split(',').map((s) => s.trim()).filter(Boolean)), [regs])
  const jobData = useMemo(() => countBy(regs, (r) => r.job), [regs])

  // ยังไม่ล็อกอิน → แสดงฟอร์มล็อกอิน
  if (authLoading) return null
  if (!authed) return <AdminLogin />

  return (
    <main className="admin-dash">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1>📊 Iftar For Gaza — Dashboard</h1>
            <p>ข้อมูลผู้ลงทะเบียนเข้าร่วมงานทั้งหมด</p>
          </div>
        </div>

        <div className="admin-stats">
          <div className="admin-stat"><div className="v">{regs.length}</div><div className="l">ผู้ลงทะเบียนทั้งหมด</div></div>
          <div className="admin-stat"><div className="v">{genderData.find((g) => g.label === 'ชาย')?.value || 0}</div><div className="l">ชาย</div></div>
          <div className="admin-stat"><div className="v">{genderData.find((g) => g.label === 'หญิง')?.value || 0}</div><div className="l">หญิง</div></div>
          <div className="admin-stat"><div className="v">{provinceData.length}</div><div className="l">จำนวนจังหวัด</div></div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: 40 }}>กำลังโหลดข้อมูล...</p>
        ) : (
          <>
            <div className="admin-grid-3">
              <ChartCard title="เพศ" data={genderData} colors={PALETTE} types={['donut', 'column', 'hbar']} />
              <ChartCard title="ช่วงอายุ" data={ageData} types={['donut', 'column', 'hbar', 'line']} />
              <ChartCard title="รู้จักงานจากช่องทาง" data={channelData} types={['donut', 'hbar', 'column']} />
              <ChartCard title="สิ่งที่คาดหวังจากงาน" data={expectData} types={['donut', 'hbar', 'column']} />
              <ChartCard title="จังหวัดที่พำนัก" data={provinceData} types={['hbar', 'column', 'donut', 'line']} topN={10} />
              <ChartCard title="อาชีพ" data={jobData} types={['hbar', 'column', 'donut']} topN={10} />
            </div>

            <div className="admin-card" style={{ marginTop: 24 }}>
              <div className="admin-table-head">
                <h4>รายชื่อผู้ลงทะเบียน ({filtered.length})</h4>
                <div className="admin-filters">
                  <input
                    className="admin-search"
                    placeholder="ค้นหาชื่อ, เบอร์, อีเมล, จังหวัด..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <div className="admin-select-icon" title="จัดเรียงโดย">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                    <select className="admin-select" value={filterField} onChange={(e) => pickField(e.target.value)}>
                      {FILTER_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </div>
                  <select className="admin-select" value={filterValue} onChange={(e) => setFilterValue(e.target.value)}>
                    <option value="">ทั้งหมด ({fieldDef.label})</option>
                    {valueOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  {(search || filterValue) && (
                    <button className="admin-clear" onClick={() => { setSearch(''); setFilterValue('') }}>
                      ล้างตัวกรอง
                    </button>
                  )}
                </div>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      {[
                        ['ref', 'Ref'], ['fname', 'ชื่อ-นามสกุล'], ['gender', 'เพศ'], ['age', 'อายุ'], ['phone', 'เบอร์โทร'],
                        ['email', 'อีเมล'], ['job', 'อาชีพ'], ['province', 'จังหวัด'], ['channel', 'ช่องทาง'], ['date', 'วันที่ลงทะเบียน'],
                      ].map(([key, label]) => (
                        <th key={key} className="admin-th-sort" onClick={() => toggleSort(key)}>
                          {label} {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id}>
                        <td>{r.ref || '-'}</td>
                        <td>{r.fname} {r.lname}</td>
                        <td>{r.gender}</td>
                        <td>{r.age}</td>
                        <td>{r.phone}</td>
                        <td>{r.email}</td>
                        <td>{r.job}</td>
                        <td>{r.province}</td>
                        <td>{r.channel}</td>
                        <td>{r.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
