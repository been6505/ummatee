import { useEffect, useMemo, useState } from 'react'
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { ACCOUNTS } from '../data/accounts.js'
import { Chart, ChartTypeSwitch, PALETTE } from '../components/AdminCharts.jsx'

// แดชบอร์ดเงินบริจาค (/admin/donations) — บันทึกยอดบริจาคแยกตาม 8 บัญชี ibank ลง Firestore (collection: donations)
// มีกราฟหลายแบบ ค้นหา/กรอง/เรียงได้ และเพิ่ม/ลบรายการได้

const THB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })
const todayStr = () => new Date().toISOString().slice(0, 10)
const monthLabel = (ym) => {
  const [y, m] = ym.split('-')
  const th = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  return `${th[Number(m) - 1]} ${String(Number(y) + 543).slice(-2)}`
}

export default function AdminDonations() {
  const { user, loading } = useAdminAuth()

  const [records, setRecords] = useState([])
  const [recLoading, setRecLoading] = useState(true)

  // ฟอร์มเพิ่มรายการ
  const [fAccount, setFAccount] = useState(ACCOUNTS[0].acc)
  const [fAmount, setFAmount] = useState('')
  const [fDate, setFDate] = useState(todayStr())
  const [fDonor, setFDonor] = useState('')
  const [fNote, setFNote] = useState('')
  const [status, setStatus] = useState('')

  // กราฟ
  const [accChart, setAccChart] = useState('donut')
  const [trendChart, setTrendChart] = useState('line')

  // ค้นหา/กรอง/เรียงตาราง
  const [search, setSearch] = useState('')
  const [filterAcc, setFilterAcc] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    if (!user) return // อย่าเปิด listener ก่อนล็อกอิน (donations อ่านได้เฉพาะแอดมิน) — กัน permission-denied และตารางว่างหลังล็อกอินบนหน้า
    const qy = query(collection(db, 'donations'), orderBy('date', 'desc'))
    const unsub = onSnapshot(qy, (snap) => {
      setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setRecLoading(false)
    }, () => setRecLoading(false))
    return unsub
  }, [user])

  const accName = (acc) => ACCOUNTS.find((a) => a.acc === acc)?.name || acc

  // ตาราง: ค้นหา (ผู้บริจาค/หมายเหตุ/บัญชี) + กรองบัญชี/ช่วงวันที่ + เรียง
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return records
      .filter((r) => (filterAcc === 'all' ? true : r.account === filterAcc))
      .filter((r) => (dateFrom ? r.date >= dateFrom : true))
      .filter((r) => (dateTo ? r.date <= dateTo : true))
      .filter((r) => !s || [r.donor, r.note, accName(r.account)].some((x) => (x || '').toLowerCase().includes(s)))
      .sort((a, b) => {
        let cmp = 0
        if (sortKey === 'amount') cmp = (a.amount || 0) - (b.amount || 0)
        else if (sortKey === 'account') cmp = accName(a.account).localeCompare(accName(b.account))
        else cmp = (a.date || '').localeCompare(b.date || '')
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [records, search, filterAcc, dateFrom, dateTo, sortKey, sortDir])

  if (loading) return null
  if (!user) return <AdminLogin />

  // สถิติสรุปจากรายการที่กรองแล้ว
  const total = filtered.reduce((s, r) => s + (r.amount || 0), 0)
  const thisMonth = todayStr().slice(0, 7)
  const monthTotal = records.filter((r) => (r.date || '').startsWith(thisMonth)).reduce((s, r) => s + (r.amount || 0), 0)
  const avg = filtered.length ? total / filtered.length : 0

  // ยอดรวมแยกตามบัญชี (จากรายการที่กรองช่วงวันที่/ค้นหาแล้ว)
  const byAccount = ACCOUNTS.map((a) => ({
    label: a.name,
    value: filtered.filter((r) => r.account === a.acc).reduce((s, r) => s + (r.amount || 0), 0),
  })).filter((d) => d.value > 0)

  // ยอดรวมรายเดือน (6 เดือนล่าสุดที่มีข้อมูล)
  const byMonth = Object.entries(
    filtered.reduce((m, r) => {
      const ym = (r.date || '').slice(0, 7)
      if (ym) m[ym] = (m[ym] || 0) + (r.amount || 0)
      return m
    }, {})
  ).sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([ym, v]) => ({ label: monthLabel(ym), value: v }))

  const add = async () => {
    if (!fAmount || Number(fAmount) <= 0) { setStatus('กรุณากรอกจำนวนเงิน'); return }
    setStatus('กำลังบันทึก...')
    try {
      await addDoc(collection(db, 'donations'), {
        account: fAccount,
        amount: Number(fAmount),
        date: fDate,
        donor: fDonor.trim(),
        note: fNote.trim(),
        createdAt: Date.now(),
      })
      setFAmount(''); setFDonor(''); setFNote('')
      setStatus('บันทึกสำเร็จ ✓')
      setTimeout(() => setStatus(''), 2000)
    } catch (e) {
      setStatus('เกิดข้อผิดพลาด: ' + e.message)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('ลบรายการนี้?')) return
    try { await deleteDoc(doc(db, 'donations', id)) } catch (e) { window.alert('ลบไม่สำเร็จ: ' + e.message) }
  }

  const sortBtn = (key) => () => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }
  const arrow = (key) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '')

  return (
    <main className="admin-dash admin-qurban">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1>เงินบริจาค — Dashboard</h1>
            <p>สรุปยอดบริจาคแยกตาม 8 บัญชี ibank ของมูลนิธิ</p>
          </div>
        </div>

        <div className="admin-stats">
          <div className="admin-stat"><div className="v">{THB(total)}</div><div className="l">ยอดรวม (ตามตัวกรอง)</div></div>
          <div className="admin-stat"><div className="v">{filtered.length}</div><div className="l">จำนวนรายการ</div></div>
          <div className="admin-stat"><div className="v">{THB(monthTotal)}</div><div className="l">ยอดเดือนนี้</div></div>
          <div className="admin-stat"><div className="v">{THB(avg)}</div><div className="l">เฉลี่ยต่อรายการ</div></div>
        </div>

        {/* ฟอร์มเพิ่มรายการบริจาค */}
        <div className="admin-card" style={{ marginBottom: 24 }}>
          <h4>เพิ่มรายการบริจาค</h4>
          <div className="admin-form-grid">
            <label>บัญชี
              <select value={fAccount} onChange={(e) => setFAccount(e.target.value)}>
                {ACCOUNTS.map((a) => <option key={a.acc} value={a.acc}>{a.name} ({a.acc})</option>)}
              </select>
            </label>
            <label>จำนวนเงิน (บาท)
              <input type="number" min="0" value={fAmount} onChange={(e) => setFAmount(e.target.value)} placeholder="0" />
            </label>
            <label>วันที่
              <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
            </label>
            <label>ผู้บริจาค (ถ้ามี)
              <input type="text" value={fDonor} onChange={(e) => setFDonor(e.target.value)} placeholder="ไม่ประสงค์ออกนาม" />
            </label>
            <label>หมายเหตุ
              <input type="text" value={fNote} onChange={(e) => setFNote(e.target.value)} />
            </label>
          </div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="admin-btn-primary" onClick={add}>บันทึกรายการ</button>
            {status && <span>{status}</span>}
          </div>
        </div>

        {recLoading ? <p>กำลังโหลดข้อมูล...</p> : (
          <>
            <div className="admin-grid">
              <div className="admin-card admin-card-center">
                <div className="admin-card-head">
                  <h4>ยอดบริจาคแยกตามบัญชี</h4>
                  <ChartTypeSwitch value={accChart} onChange={setAccChart} types={['donut', 'hbar', 'column']} />
                </div>
                {byAccount.length === 0 ? <p style={{ color: '#999' }}>ยังไม่มีข้อมูล</p> : (
                  <>
                    <Chart type={accChart} data={byAccount} colors={PALETTE} unit="บาท" valueLabel={THB} />
                    {accChart === 'donut' && (
                      <div className="admin-legend">
                        {byAccount.map((d, i) => (
                          <span key={d.label}><i style={{ background: PALETTE[i % PALETTE.length] }} /> {d.label}: {THB(d.value)}</span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="admin-card">
                <div className="admin-card-head">
                  <h4>แนวโน้มรายเดือน</h4>
                  <ChartTypeSwitch value={trendChart} onChange={setTrendChart} types={['line', 'column', 'hbar']} />
                </div>
                {byMonth.length === 0 ? <p style={{ color: '#999' }}>ยังไม่มีข้อมูล</p> : (
                  <Chart type={trendChart} data={byMonth} colors={['#2e7d52']} valueLabel={THB} />
                )}
              </div>
            </div>

            <div className="admin-card" style={{ marginTop: 24 }}>
              <div className="admin-card-head">
                <h4>รายการบริจาค ({filtered.length}/{records.length})</h4>
                <div className="admin-filters">
                  <input type="search" placeholder="ค้นหาผู้บริจาค/หมายเหตุ..." value={search} onChange={(e) => setSearch(e.target.value)} />
                  <select value={filterAcc} onChange={(e) => setFilterAcc(e.target.value)}>
                    <option value="all">ทุกบัญชี</option>
                    {ACCOUNTS.map((a) => <option key={a.acc} value={a.acc}>{a.name}</option>)}
                  </select>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="ตั้งแต่วันที่" />
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="ถึงวันที่" />
                  {(search || filterAcc !== 'all' || dateFrom || dateTo) && (
                    <button className="admin-btn" onClick={() => { setSearch(''); setFilterAcc('all'); setDateFrom(''); setDateTo('') }}>ล้าง</button>
                  )}
                </div>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th className="admin-th-sort" onClick={sortBtn('date')}>วันที่{arrow('date')}</th>
                      <th className="admin-th-sort" onClick={sortBtn('account')}>บัญชี{arrow('account')}</th>
                      <th className="admin-th-sort" onClick={sortBtn('amount')}>จำนวนเงิน{arrow('amount')}</th>
                      <th>ผู้บริจาค</th>
                      <th>หมายเหตุ</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id}>
                        <td>{r.date}</td>
                        <td>{accName(r.account)}</td>
                        <td>{THB(r.amount)}</td>
                        <td>{r.donor || '—'}</td>
                        <td>{r.note || '—'}</td>
                        <td><button className="admin-btn-danger" onClick={() => remove(r.id)}>ลบ</button></td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan="6" style={{ textAlign: 'center', color: '#999' }}>ยังไม่มีรายการ — เพิ่มรายการแรกจากฟอร์มด้านบน</td></tr>
                    )}
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
