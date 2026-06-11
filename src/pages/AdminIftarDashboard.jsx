import { useEffect, useMemo, useState } from 'react'
import { db } from '../firebase.js'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'

const ADMIN_PASS = 'ummatee2026'

// Apps Script Web App เดียวกับที่หน้าลงทะเบียนใช้ส่งข้อมูล (doGet คืนรายการจาก Sheet)
const SHEET_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzIqLLYl8qjwXXZRiZIefPPKyCK_SKZZi-0kCJDyz9vxbvHL9vQC5cHJ5ybZ3-NiXcCyA/exec'

function BarList({ title, data, color = '#2e7d52' }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="admin-card">
      <h4>{title}</h4>
      {data.length === 0 && <p className="admin-empty">ไม่มีข้อมูล</p>}
      {data.map((d) => (
        <div className="admin-bar-row" key={d.label}>
          <span className="admin-bar-label">{d.label}</span>
          <div className="admin-bar-track">
            <div className="admin-bar-fill" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
          <span className="admin-bar-value">{d.value}</span>
        </div>
      ))}
    </div>
  )
}

const R = 60
const CIRC = 2 * Math.PI * R

function DonutChart({ data, colors }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  let offset = 0
  return (
    <svg viewBox="0 0 160 160" className="admin-donut">
      <circle cx="80" cy="80" r={R} fill="none" stroke="#eee" strokeWidth="26" />
      {data.map((d, i) => {
        const len = (d.value / total) * CIRC
        const seg = (
          <circle
            key={d.label}
            cx="80" cy="80" r={R}
            fill="none"
            stroke={colors[i % colors.length]}
            strokeWidth="26"
            strokeDasharray={`${len} ${CIRC - len}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 80 80)"
          >
            <title>{d.label}: {d.value}</title>
          </circle>
        )
        offset += len
        return seg
      })}
      <circle cx="80" cy="80" r={R - 13} fill="#fff" />
      <text x="80" y="84" textAnchor="middle" fontSize="22" fontWeight="800" fill="#1a5c3a">{total}</text>
    </svg>
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

const DONUT_COLORS = ['#2e7d52', '#e8194a', '#c9a84c', '#2196f3', '#8e44ad', '#e67e22']

export default function AdminIftarDashboard() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin-authed') === '1')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [regs, setRegs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

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
    fetch(SHEET_ENDPOINT)
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return regs
    return regs.filter((r) =>
      `${r.fname} ${r.lname} ${r.phone} ${r.email} ${r.province} ${r.job} ${r.ref}`.toLowerCase().includes(q)
    )
  }, [regs, search])

  const genderData = useMemo(() => countBy(regs, (r) => r.gender), [regs])
  const ageData = useMemo(() => countBy(regs, (r) => ageGroup(r.age)), [regs])
  const channelData = useMemo(() => countBy(regs, (r) => (r.channel || '').split(',').map((s) => s.trim()).filter(Boolean)), [regs])
  const provinceData = useMemo(() => countBy(regs, (r) => r.province).slice(0, 10), [regs])
  const expectData = useMemo(() => countBy(regs, (r) => (r.expect || '').split(',').map((s) => s.trim()).filter(Boolean)), [regs])
  const jobData = useMemo(() => countBy(regs, (r) => r.job).slice(0, 10), [regs])

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

  return (
    <main className="admin-dash">
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1>📊 Iftar For Gaza — Dashboard</h1>
            <p>ข้อมูลผู้ลงทะเบียนเข้าร่วมงานทั้งหมด</p>
          </div>
          <button
            className="admin-logout"
            onClick={() => { sessionStorage.removeItem('admin-authed'); setAuthed(false) }}
          >
            ออกจากระบบ
          </button>
        </div>

        <div className="admin-stats">
          <div className="admin-stat"><div className="v">{regs.length}</div><div className="l">ผู้ลงทะเบียนทั้งหมด</div></div>
          <div className="admin-stat"><div className="v">{genderData.find((g) => g.label === 'ชาย')?.value || 0}</div><div className="l">ชาย</div></div>
          <div className="admin-stat"><div className="v">{genderData.find((g) => g.label === 'หญิง')?.value || 0}</div><div className="l">หญิง</div></div>
          <div className="admin-stat"><div className="v">{provinceData.length}</div><div className="l">จังหวัด (top)</div></div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: 40 }}>กำลังโหลดข้อมูล...</p>
        ) : (
          <>
            <div className="admin-grid">
              <div className="admin-card admin-card-center">
                <h4>เพศ</h4>
                <DonutChart data={genderData} colors={DONUT_COLORS} />
                <div className="admin-legend">
                  {genderData.map((d, i) => (
                    <span key={d.label}><i style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} /> {d.label}: {d.value}</span>
                  ))}
                </div>
              </div>
              <BarList title="ช่วงอายุ" data={ageData} color="#2196f3" />
              <BarList title="รู้จักงานจากช่องทาง" data={channelData} color="#e8194a" />
              <BarList title="สิ่งที่คาดหวังจากงาน" data={expectData} color="#c9a84c" />
              <BarList title="จังหวัดที่พำนัก (Top 10)" data={provinceData} color="#8e44ad" />
              <BarList title="อาชีพ (Top 10)" data={jobData} color="#2e7d52" />
            </div>

            <div className="admin-card" style={{ marginTop: 24 }}>
              <div className="admin-table-head">
                <h4>รายชื่อผู้ลงทะเบียน ({filtered.length})</h4>
                <input
                  className="admin-search"
                  placeholder="ค้นหาชื่อ, เบอร์, อีเมล, จังหวัด..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Ref</th><th>ชื่อ-นามสกุล</th><th>เพศ</th><th>อายุ</th><th>เบอร์โทร</th>
                      <th>อีเมล</th><th>อาชีพ</th><th>จังหวัด</th><th>ช่องทาง</th><th>วันที่ลงทะเบียน</th>
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
