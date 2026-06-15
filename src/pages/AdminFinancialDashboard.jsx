import { useEffect, useState } from 'react'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { useFinancialData, saveFinancialData, DEFAULT_FINANCIAL } from '../data/financialData.js'

// หน้าแก้ไขข้อมูลแดชบอร์ดการเงิน (/admin/financial-dashboard)
// แก้จำนวนผู้ยากไร้ / ค่าใช้จ่ายต่อคน / ยอดบริจาคสะสม / ข้อมูลบัญชี — บันทึกลง Firestore (config/financialDashboard)
// หน้าแดชบอร์ดสาธารณะ /challenge จะอ่านค่านี้ไปแสดงอัตโนมัติ

export default function AdminFinancialDashboard() {
  const { user, loading } = useAdminAuth()
  const { data, loading: dataLoading } = useFinancialData()
  const [form, setForm] = useState(DEFAULT_FINANCIAL)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!dataLoading) setForm(data)
  }, [dataLoading, data])

  if (loading) return null
  if (!user) return <AdminLogin />
  if (dataLoading) return null

  const setNum = (key, val) => setForm((f) => ({ ...f, [key]: Number(val) || 0 }))
  const setAccount = (key, val) => setForm((f) => ({ ...f, account: { ...f.account, [key]: val } }))

  const target = (Number(form.poor) || 0) * (Number(form.perPerson) || 0)
  const canHelp = form.perPerson > 0 ? Math.min(Math.floor((Number(form.raised) || 0) / form.perPerson), Number(form.poor) || 0) : 0
  const progress = target > 0 ? ((Number(form.raised) || 0) / target) * 100 : 0
  const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const save = async () => {
    setStatus('กำลังบันทึก...')
    try {
      await saveFinancialData({
        poor: Number(form.poor) || 0,
        perPerson: Number(form.perPerson) || 0,
        raised: Number(form.raised) || 0,
        account: form.account,
      })
      setStatus('บันทึกสำเร็จ ✓')
      setTimeout(() => setStatus(''), 2500)
    } catch (e) {
      setStatus('เกิดข้อผิดพลาด: ' + e.message)
    }
  }

  return (
    <main className="admin-dash">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1>แก้ไขแดชบอร์ดการเงิน</h1>
            <p>แก้ไขแล้วกดบันทึก — หน้าแดชบอร์ด <a href="/challenge" target="_blank" rel="noopener noreferrer">/challenge</a> จะอัปเดตอัตโนมัติ</p>
          </div>
          <a className="admin-btn" href="/challenge" target="_blank" rel="noopener noreferrer">เปิดแดชบอร์ด</a>
        </div>

        <div className="admin-card" style={{ marginBottom: 24 }}>
          <h4>ข้อมูลการช่วยเหลือ</h4>
          <div className="admin-form-grid">
            <label>จำนวนผู้ยากไร้ (คน)
              <input type="number" min="0" value={form.poor} onChange={(e) => setNum('poor', e.target.value)} />
            </label>
            <label>ค่าใช้จ่ายช่วยเหลือต่อคน (บาท)
              <input type="number" min="0" value={form.perPerson} onChange={(e) => setNum('perPerson', e.target.value)} />
            </label>
            <label>ยอดบริจาคสะสม (บาท)
              <input type="number" min="0" value={form.raised} onChange={(e) => setNum('raised', e.target.value)} />
            </label>
          </div>
          <div className="admin-stats" style={{ marginTop: 16 }}>
            <div className="admin-stat"><b>{fmt(target)}</b><div className="l">ยอดเป้าหมาย (คน × ต่อคน)</div></div>
            <div className="admin-stat"><b>{canHelp.toLocaleString()}</b><div className="l">ช่วยเหลือได้แล้ว (คน)</div></div>
            <div className="admin-stat"><b>{progress.toFixed(2)}%</b><div className="l">ความคืบหน้า</div></div>
          </div>
        </div>

        <div className="admin-card">
          <h4>ข้อมูลบัญชีรับบริจาค</h4>
          <div className="admin-form-grid">
            <label>ธนาคาร
              <input type="text" value={form.account.bank} onChange={(e) => setAccount('bank', e.target.value)} />
            </label>
            <label>ชื่อบัญชี / คำอธิบาย
              <input type="text" value={form.account.name} onChange={(e) => setAccount('name', e.target.value)} />
            </label>
            <label>เลขบัญชี
              <input type="text" value={form.account.number} onChange={(e) => setAccount('number', e.target.value)} />
            </label>
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="admin-btn-primary" onClick={save}>บันทึกการเปลี่ยนแปลง</button>
          {status && <span>{status}</span>}
        </div>
      </div>
    </main>
  )
}
