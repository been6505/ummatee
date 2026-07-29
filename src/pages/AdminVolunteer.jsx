import { useEffect, useMemo, useState } from 'react'
import VolunteerGuard from '../components/VolunteerGuard.jsx'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import { useAllowlistedAdmin } from '../useAdminRole.js'
import { watchVolunteerRegs, retrySync } from '../data/volunteer.js'
import { Chart, ChartTypeSwitch, PALETTE, legendColors } from '../components/AdminCharts.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHandshake, faDownload, faRotate, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import ListSkeleton from '../components/ListSkeleton.jsx'

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

function splitList(str) {
  return (str || '').split(/,\s*/).map(s => s.trim()).filter(Boolean)
}

function dateLabel(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}

const FILTER_FIELDS = [
  { key: 'gender', label: 'เพศ', get: (r) => [r.gender] },
  { key: 'province', label: 'จังหวัด', get: (r) => [r.province] },
  { key: 'age', label: 'ช่วงอายุ', get: (r) => [ageGroup(r.age)] },
  { key: 'channel', label: 'ช่องทาง', get: (r) => [r.channel] },
  { key: 'skills', label: 'ตำแหน่ง', get: (r) => splitList(r.skills) },
  { key: 'missions', label: 'ภารกิจ', get: (r) => splitList(r.missions) },
  { key: 'date', label: 'วันที่สมัคร', get: (r) => [dateLabel(r.date)] },
]

export default function AdminVolunteer() {
  const { user, loading: authLoading } = useAllowlistedAdmin()
  const authed = !!user
  const [regs, setRegs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterField, setFilterField] = useState('gender')
  const [filterValue, setFilterValue] = useState('')
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [loadError, setLoadError] = useState(false)

  const [syncing, setSyncing] = useState({})

  useEffect(() => {
    if (!authed) return
    setLoading(true)
    // อ่านข้อมูลอาสาสมัครจาก Firestore แบบ real-time (คุมสิทธิ์ด้วย isFullAdmin() ใน firestore.rules) —
    // เดิมอ่านผ่าน Apps Script doGet ด้วย token ที่ฝังใน client bundle ซึ่งใครก็ดึง PII ออกไปได้
    // โดยไม่ต้องล็อกอินเว็บเลย (ดู security memory) — endpoint นั้นถูกปิดแล้วฝั่ง Apps Script
    // onSnapshot แทน getDocs ครั้งเดียว เพื่อให้เห็นผู้สมัครใหม่ทันทีโดยไม่ต้อง reload หน้า
    const unsub = watchVolunteerRegs(
      (rows) => {
        setRegs(rows.map((r) => ({
          id: r.id,
          ref: r.ref || '',
          date: r.date || '',
          fname: r.fname || '',
          lname: r.lname || '',
          fnameEn: r.fnameEn || '',
          lnameEn: r.lnameEn || '',
          gender: r.gender || '',
          age: r.age || '',
          province: r.province || '',
          phone: r.phone || '',
          email: r.email || '',
          channel: r.channel || '',
          skills: r.skills || '',
          missions: r.missions || '',
          giveProjects: r.giveProjects || '',
          giveDates: r.giveDates || '',
          expect: r.expect || '',
          note: r.note || '',
          sheetSynced: r.sheetSynced !== false,
        })))
        setLoading(false)
      },
      () => { setRegs([]); setLoadError(true); setLoading(false) }
    )
    return unsub
  }, [authed])

  const doRetrySync = async (r) => {
    setSyncing((s) => ({ ...s, [r.id]: true }))
    await retrySync(r)
    setSyncing((s) => ({ ...s, [r.id]: false }))
  }

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
    const cols = ['ลำดับ', 'Ref', 'ชื่อ', 'นามสกุล', 'First Name', 'Last Name', 'เพศ', 'อายุ', 'จังหวัด', 'เบอร์โทร', 'อีเมล', 'ช่องทาง', 'ตำแหน่ง', 'ภารกิจ', 'โครงการ', 'วันที่สะดวก', 'ความคาดหวัง', 'ข้อความ', 'วันที่']
    const rows = filtered.map((r, i) => [
      i + 1, r.ref, r.fname, r.lname, r.fnameEn, r.lnameEn, r.gender, r.age,
      r.province, r.phone, r.email, r.channel, r.skills, r.missions, r.giveProjects, r.giveDates, r.expect, r.note, r.date,
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
  const skillsData = countBy(regs, (r) => splitList(r.skills))
  const missionsData = countBy(regs, (r) => splitList(r.missions))

  return (<VolunteerGuard>
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
          <ListSkeleton />
        ) : (
          <>
            <div className="admin-grid-3">
              <ChartCard title="เพศ" data={genderData} colors={PALETTE} types={['donut', 'column', 'hbar']} />
              <ChartCard title="ช่วงอายุ" data={ageData} types={['donut', 'column', 'hbar', 'line']} />
              <ChartCard title="ช่องทางการรับรู้" data={channelData} types={['donut', 'hbar', 'column']} />
              <ChartCard title="จังหวัด (Top 10)" data={provinceData} types={['hbar', 'column', 'donut']} topN={10} />
              <ChartCard title="ตำแหน่งที่สนใจ" data={skillsData} types={['hbar', 'column', 'donut']} />
              <ChartCard title="ภารกิจที่สนใจ" data={missionsData} types={['donut', 'hbar', 'column']} />
            </div>

            {loadError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginTop: 16, color: '#dc2626', fontSize: '.9rem' }}>
                ⚠️ โหลดข้อมูลไม่ได้ — กรุณาตรวจสอบการเชื่อมต่อหรือลองใหม่อีกครั้ง
              </div>
            )}
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

              {filtered.length === 0 ? (
                <p style={{ textAlign: 'center', opacity: 0.5, padding: 32 }}>ไม่มีข้อมูล</p>
              ) : (
                <div className="vol-card-list">
                  {filtered.map((r, i) => (
                    <div key={r.id} className="vol-card">
                      <div className="vol-card-row1">
                        <div className="vol-card-num">{i + 1}</div>
                        <div className="vol-card-main">
                          <div className="vol-card-name">
                            {r.fname} {r.lname}
                            {r.fnameEn && <span className="vol-card-en">{r.fnameEn} {r.lnameEn}</span>}
                          </div>
                          <div className="vol-card-ref">
                            {r.ref || '-'}
                            {!r.sheetSynced && (
                              <button
                                type="button"
                                className="vol-sync-badge"
                                onClick={() => doRetrySync(r)}
                                disabled={!!syncing[r.id]}
                                title="ยังไม่ได้สำรองข้อมูลไป Google Sheet — กดเพื่อลองใหม่ (ข้อมูลปลอดภัยอยู่ใน Firebase แล้ว)"
                              >
                                <FontAwesomeIcon icon={syncing[r.id] ? faRotate : faTriangleExclamation} spin={!!syncing[r.id]} />
                                {syncing[r.id] ? ' กำลังซิงก์...' : ' ยังไม่สำรองไป Sheet — ลองใหม่'}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="vol-card-info">
                          <span>{r.gender} · {r.age} ปี</span>
                          <span>{r.province}</span>
                        </div>
                        <div className="vol-card-info">
                          <span>{r.phone}</span>
                          <span>{r.email}</span>
                        </div>
                        <div className="vol-card-meta">{(() => { const p = Date.parse(r.date); if (isNaN(p)) return r.date; const d = new Date(p); if (d.getFullYear() > 2400) d.setFullYear(d.getFullYear() - 543); return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) })()}</div>
                      </div>
                      {(r.skills || r.missions || r.giveProjects || r.giveDates || r.expect || r.note) && (
                        <div className="vol-card-row2">
                          {r.skills && <div><b>ตำแหน่งที่สนใจ:</b> {r.skills}</div>}
                          {r.missions && <div><b>ภารกิจ:</b> {r.missions}</div>}
                          {r.giveProjects && <div><b>โครงการ:</b> {r.giveProjects}</div>}
                          {r.giveDates && <div><b>วันที่มาร่วม:</b> {r.giveDates.split(',').map(d => { const p = Date.parse(d.trim()); return isNaN(p) ? d.trim() : new Date(p).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) }).join(', ')}</div>}
                          {r.expect && <div><b>ความคาดหวัง:</b> {r.expect}</div>}
                          {r.note && <div><b>ข้อความ:</b> {r.note}</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  </VolunteerGuard>)
}
