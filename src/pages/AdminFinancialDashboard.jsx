import { useEffect, useState } from 'react'
import VolunteerGuard from '../components/VolunteerGuard.jsx'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import { useAllowlistedAdmin } from '../useAdminRole.js'
import { useFinancialData, saveFinancialData, DEFAULT_FINANCIAL } from '../data/financialData.js'
import { DonutChart } from '../components/AdminCharts.jsx'
import { ACCOUNTS } from '../data/accounts.js'
import ScreenCaptureOCR from '../components/ScreenCaptureOCR.jsx'

// ชื่อธนาคารคงที่สำหรับทุกบัญชีของมูลนิธิ (ibank)
const BANK_NAME = 'ธนาคารอิสลามแห่งประเทศไทย (ibank)'

// หน้าแก้ไขข้อมูลแดชบอร์ดการเงิน (/admin/financial-dashboard)
// แก้จำนวนผู้ยากไร้ / ค่าใช้จ่ายต่อคน / ยอดบริจาคสะสม / ข้อมูลบัญชี — บันทึกลง Firestore (config/financialDashboard)
// หน้าแดชบอร์ดสาธารณะ /challenge จะอ่านค่านี้ไปแสดงอัตโนมัติ

export default function AdminFinancialDashboard() {
  const { user, loading } = useAllowlistedAdmin()
  const { data, loading: dataLoading } = useFinancialData()
  const [form, setForm] = useState(DEFAULT_FINANCIAL)
  const [status, setStatus] = useState('')
  const [prevAmount, setPrevAmount] = useState(0)

  useEffect(() => {
    if (!dataLoading) setForm(data)
  }, [dataLoading, data])

  if (loading) return null
  if (!user) return <AdminLogin />
  if (dataLoading) return null

  const setNum = (key, val) => setForm((f) => ({ ...f, [key]: Number(val) || 0 }))
  // เลือกบัญชีจากรายการ ACCOUNTS (data/accounts.js) ที่หน้า Donation ใช้ร่วมกัน
  const selectAccount = (acc) => {
    const a = ACCOUNTS.find((x) => x.acc === acc)
    if (!a) return
    setForm((f) => ({ ...f, account: { bank: BANK_NAME, name: a.name, number: a.acc } }))
  }

  const target = (Number(form.poor) || 0) * (Number(form.perPerson) || 0)
  const canHelp = form.perPerson > 0 ? Math.min(Math.floor((Number(form.raised) || 0) / form.perPerson), Number(form.poor) || 0) : 0
  const raised = Number(form.raised) || 0
  const progress = target > 0 ? (raised / target) * 100 : 0
  const remaining = Math.max(target - raised, 0)
  const helpRemaining = Math.max((Number(form.poor) || 0) - canHelp, 0)
  const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const donationDonut = [
    { label: 'ยอดบริจาคสะสม', value: raised },
    { label: 'ยอดคงเหลือ', value: remaining },
  ]
  const helpDonut = [
    { label: 'ช่วยเหลือได้แล้ว', value: canHelp },
    { label: 'รอความช่วยเหลือ', value: helpRemaining },
  ]

  // บันทึกลง Firestore — ใช้ร่วมกันทั้งปุ่ม "บันทึก" และ auto-save จาก OCR Realtime
  // ส่ง raisedOverride เมื่อต้องการบันทึกยอดใหม่ทันที (ไม่ต้องรอ state form.raised อัปเดต)
  const persist = async (raisedOverride) => {
    setStatus('กำลังบันทึก...')
    try {
      await saveFinancialData({
        poor: Number(form.poor) || 0,
        perPerson: Number(form.perPerson) || 0,
        raised: Number(raisedOverride ?? form.raised) || 0,
        account: form.account,
      })
      setStatus('บันทึกสำเร็จ ✓')
      setTimeout(() => setStatus(''), 2500)
    } catch (e) {
      setStatus('เกิดข้อผิดพลาด: ' + e.message)
    }
  }

  const save = () => persist()

  return (<VolunteerGuard>
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
          <h4>กราฟพรีวิว (อัปเดตตามค่าที่กรอก)</h4>
          <div className="fin-charts">
            <div className="fin-chart">
              <div className="fin-chart-title">ยอดบริจาค (THB)</div>
              <DonutChart data={donationDonut} colors={['#2E7D52', '#C9A84C']} unit="THB." size={180} />
              <div className="fin-chart-legend">
                <span><i style={{ background: '#2E7D52' }} /> บริจาคแล้ว {fmt(raised)} ({progress.toFixed(2)}%)</span>
                <span><i style={{ background: '#C9A84C' }} /> คงเหลือ {fmt(remaining)}</span>
              </div>
            </div>
            <div className="fin-chart">
              <div className="fin-chart-title">การช่วยเหลือ (คน)</div>
              <DonutChart data={helpDonut} colors={['#2E7D52', '#C9A84C']} unit="คน" size={180} />
              <div className="fin-chart-legend">
                <span><i style={{ background: '#2E7D52' }} /> ช่วยแล้ว {canHelp.toLocaleString()} คน</span>
                <span><i style={{ background: '#C9A84C' }} /> รอช่วย {helpRemaining.toLocaleString()} คน</span>
              </div>
            </div>
          </div>
        </div>


        <div className="admin-card" style={{ marginBottom: 24 }}>
          <h4>💰 ยอดเงินเก่า (สำหรับหักลบ)</h4>
          <p style={{ fontSize: 13, opacity: 0.7, margin: '0 0 12px' }}>
            ใส่ยอดเงินเก่าไว้ — เมื่อ OCR อ่านยอดใหม่จากจอ ระบบจะคำนวณ <b>ยอดใหม่ − ยอดเก่า</b> แล้วใส่เป็นยอดบริจาคให้อัตโนมัติ
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ flex: 1, minWidth: 200 }}>ยอดเงินเก่า (บาท)
              <input type="number" min="0" value={prevAmount} onChange={(e) => setPrevAmount(Number(e.target.value) || 0)} />
            </label>
            <div style={{ fontSize: 14, opacity: 0.7, paddingTop: 20 }}>
              ยอดปัจจุบัน: <b>{fmt(raised)}</b> บาท
              {prevAmount > 0 && <> · เก่า: <b>{fmt(prevAmount)}</b> บาท</>}
            </div>
          </div>
          {prevAmount > 0 && (
            <div style={{ marginTop: 8, fontSize: 13, color: '#2E7D52' }}>
              ✓ เมื่อ OCR อ่านยอดใหม่ ระบบจะคำนวณ: ยอดจากจอ − {fmt(prevAmount)} = ยอดบริจาค
            </div>
          )}
        </div>

        <ScreenCaptureOCR
          onExtracted={(amt) => {
            const final = prevAmount > 0 ? Math.max(amt - prevAmount, 0) : amt
            setNum('raised', final)
          }}
          onAutoSave={async (amt) => {
            const final = prevAmount > 0 ? Math.max(amt - prevAmount, 0) : amt
            setNum('raised', final)
            await persist(final)
          }}
        />

        <div className="admin-card" style={{ marginBottom: 24 }}>
          <h4>ข้อมูลการช่วยเหลือ</h4>
          <div className="admin-form-grid">
            <label>จำนวนผู้ยากไร้ (คน)
              <input type="number" min="0" value={form.poor} onChange={(e) => setNum('poor', e.target.value)} />
            </label>
            <label>ช่วยเหลือต่อคน (บาท)
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
            <label>เลือกบัญชี (จากรายการบัญชีมูลนิธิ)
              <select value={form.account.number} onChange={(e) => selectAccount(e.target.value)}>
                {!ACCOUNTS.some((a) => a.acc === form.account.number) && (
                  <option value={form.account.number}>{form.account.number} — (กำหนดเอง)</option>
                )}
                {ACCOUNTS.map((a) => (
                  <option key={a.acc} value={a.acc}>{a.icon} {a.name} — {a.acc}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="admin-account-preview">
            <div><b>ธนาคาร:</b> {form.account.bank}</div>
            <div><b>ชื่อบัญชี:</b> {form.account.name}</div>
            <div><b>เลขบัญชี:</b> {form.account.number}</div>
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="admin-btn-primary" onClick={save}>บันทึกการเปลี่ยนแปลง</button>
          {status && <span>{status}</span>}
        </div>
      </div>
    </main>
  </VolunteerGuard>)
}
