import { useEffect, useMemo, useState } from 'react'
import { db } from '../firebase.js'
import { collection, getDocs } from 'firebase/firestore'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { Chart, ChartTypeSwitch, PALETTE, legendColors } from '../components/AdminCharts.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHandshake, faDownload } from '@fortawesome/free-solid-svg-icons'

function ChartCard({ title, data, colors, types = ['donut', 'hbar', 'column'], showLegend = true, topN }) {
  const [type, setType] = useState(types[0])
  const [showAll, setShowAll] = useState(false)
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

function ageGroup(ageStr) {
  const age = parseInt(ageStr, 10)
  if (!age) return 'ไม่ระบุ'
  if (age < 18) return '< 18'
  if (age <= 25) return '18-25'
  if (age <= 35) return '26-35'
  if (age <= 50) return '36-50'
  return '50+'
}

const FILTER_FIELDS = [
  { key: 'gender', label: 'เพศ', get: (r) => [r.gender] },
  { key: 'province', label: 'จังหวัด', get: (r) => [r.province] },
  { key: 'age', label: 'ช่วงอายุ', get: (r) => [ageGroup(r.age)] },
  { key: 'channel', label: 'ช่องทาง', get: (r) => [r.channel] },
]

export default function AdminVolunteer() {
  const { user, loading: authLoading } = useAdminAuth()
  const authed = !!user
  const [regs, setRegs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterField, setFilterField] = useState('gender')
  const [filterValue, setFilterValue] = useState('')
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    if (!authed) return
    let cancelled = false
    setLoading(true)
    getDocs(collection(db, 'volunteerRegs'))
      .then((snap) => {
        if (cancelled) return
        setRegs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      })
      .catch(() => { if (!cancelled) setRegs([]) })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [authed])

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const fieldDef = FILTER_FIELDS.find((f) => f.key === filterField) || FILTER_FIELDS[0]

  const valueOptions = useMemo(
    () => Array.from(new Set(regs.flatMap((r) => fieldDef.get(r)).map((v) => (v || '').toString().trim()).filter(Boolean))).sort(),
    [regs, filterField]
  )

  const pickField = (key) => { setFilterField(key); setFilterValue('') }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = regs.filter((r) => {
      if (q && !`${r.ref} ${r.fname} ${r.lname} ${r.phone} ${r.email} ${r.province} ${r.channel} ${r.skills}`.toLowerCase().includes(q)) return false
      if (filterValue && !fieldDef.get(r).map((v) => (v || '').toString().trim()).includes(filterValue)) return false
      return true
    })
    return [...list].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey]
      if (sortKey === 'age') { av = parseInt(av, 10) || 0; bv = parseInt(bv, 10) || 0 }
      else { av = (av ?? '').toString(); bv = (bv ?? '').toString() }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [regs, search, filterField, filterValue, sortKey, sortDir])

  const exportCSV = () => {
    const cols = ['ลำดับ', 'Ref', 'ชื่อ', 'นามสกุล', 'First Name', 'Last Name', 'เพศ', 'อายุ', 'จังหวัด', 'เบอร์โทร', 'อีเมล', 'ช่องทาง', 'ความคาดหวัง', 'ทักษะ', 'ข้อความ', 'วันที่']
    const rows = filtered.map((r, i) => [
      i + 1, r.ref, r.fname, r.lname, r.fnameEn, r.lnameEn, r.gender, r.age,
      r.province, r.phone, r.email, r.channel, r.expect, r.skills, r.note, r.date,
    ])
    const csv = [cols, ...rows].map((r) => r.map((c) => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `volunteer-${new Date().toLocaleDateString('th-TH').replace(/\//g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (authLoading) return null
  if (!authed) return <AdminLogin />

  const genderData = countBy(regs, (r) => r.gender)
  const ageData = countBy(regs, (r) => ageGroup(r.age))
  const channelData = countBy(regs, (r) => r.channel)
  const provinceData = countBy(regs, (r) => r.province)

  return (
    <main className="admin-dash">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1><FontAwesomeIcon icon={faHandshake} /> อาสาสมัคร Ummatee</h1>
            <p>ข้อมูลผู้สมัครอาสาสมัครทั้งหมด</p>
          </div>
          <button className="admin-btn admin-btn-primary" onClick={exportCSV}><FontAwesomeIcon icon={faDownload} /> Export CSV</button>
        </div>

        <div className="admin-stats">
          <div className="admin-stat"><div className="v">{regs.length}</div><div className="l">สมัครทั้งหมด</div></div>
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
              <ChartCard title="ช่องทางการรับรู้" data={channelData} types={['donut', 'hbar', 'column']} />
              <ChartCard title="จังหวัด (Top 10)" data={provinceData} types={['hbar', 'column', 'donut']} topN={10} />
            </div>

            <div className="admin-card" style={{ marginTop: 24 }}>
              <div className="admin-table-head">
                <h4>รายชื่อผู้สมัคร ({filtered.length})</h4>
                <div className="admin-filters">
                  <input
                    className="admin-search"
                    placeholder="ค้นหาชื่อ, เบอร์, อีเมล, จังหวัด..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <div className="admin-select-icon" title="กรองโดย">
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
                    <button className="admin-clear" onClick={() => { setSearch(''); setFilterValue('') }}>ล้างตัวกรอง</button>
                  )}
                </div>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      {[
                        ['ref', 'Ref'],
                        ['fname', 'ชื่อ-นามสกุล / Name'],
                        ['gender', 'เพศ'],
                        ['age', 'อายุ'],
                        ['province', 'จังหวัด'],
                        ['phone', 'เบอร์โทร'],
                        ['email', 'อีเมล'],
                        ['channel', 'ช่องทาง'],
                        ['expect', 'ความคาดหวัง'],
                        ['skills', 'ทักษะ'],
                        ['date', 'วันที่สมัคร'],
                      ].map(([key, label]) => (
                        <th key={key} className="admin-th-sort" onClick={() => toggleSort(key)}>
                          {label} {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={12} style={{ textAlign: 'center', opacity: 0.5, padding: 32 }}>ไม่มีข้อมูล</td></tr>
                    ) : filtered.map((r, i) => (
                      <tr key={r.id}>
                        <td style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.82rem' }}>{i + 1}</td>
                        <td><span style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{r.ref || '-'}</span></td>
                        <td>{r.fname} {r.lname}{r.fnameEn && <span style={{ display: 'block', fontSize: '0.78rem', opacity: 0.55 }}>{r.fnameEn} {r.lnameEn}</span>}</td>
                        <td>{r.gender}</td>
                        <td>{r.age}</td>
                        <td>{r.province}</td>
                        <td>{r.phone}</td>
                        <td>{r.email}</td>
                        <td style={{ fontSize: '0.82rem' }}>{r.channel}</td>
                        <td style={{ maxWidth: 200, whiteSpace: 'normal', fontSize: '0.82rem' }}>{r.expect}</td>
                        <td>{r.skills}</td>
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
