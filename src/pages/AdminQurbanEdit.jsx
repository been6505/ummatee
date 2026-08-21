import { useEffect, useState } from 'react'
import VolunteerGuard from '../components/VolunteerGuard.jsx'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import { useAllowlistedAdmin } from '../useAdminRole.js'
import { useQurbanData, saveQurbanData, DEFAULT_QURBAN } from '../data/qurbanData.js'

// หน้าแก้ไขยอดกุรบาน 2026 (/admin/missions/qurban2026/edit) — แก้ไขแล้วบันทึกลง Firestore (config/qurban2026)
// หน้า AdminQurbanDashboard และหน้า public /missions/qurban2026 จะอ่านค่านี้ไปแสดงอัตโนมัติ

export default function AdminQurbanEdit() {
  const { user, loading } = useAllowlistedAdmin()
  const { data, loading: dataLoading } = useQurbanData()
  const [form, setForm] = useState(DEFAULT_QURBAN)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!dataLoading) setForm(data)
  }, [dataLoading, data])

  if (loading) return null
  if (!user) return <AdminLogin />
  if (dataLoading) return null

  const setCategory = (key, val) => {
    setForm((f) => ({ ...f, categories: { ...f.categories, [key]: Number(val) || 0 } }))
  }
  const setSummary = (key, val) => {
    setForm((f) => ({ ...f, summary: { ...f.summary, [key]: Number(val) || 0 } }))
  }
  const setAfghanistan = (val) => {
    setForm((f) => ({ ...f, afghanistanSheep: Number(val) || 0 }))
  }
  const setCountry = (i, field, val) => {
    setForm((f) => {
      const countries = [...f.countries]
      countries[i] = { ...countries[i], [field]: field === 'v' ? (Number(val) || 0) : val }
      return { ...f, countries }
    })
  }
  const addCountry = () => {
    setForm((f) => ({ ...f, countries: [...f.countries, { n: '', v: 0 }] }))
  }
  const removeCountry = (i) => {
    setForm((f) => ({ ...f, countries: f.countries.filter((_, idx) => idx !== i) }))
  }

  const countryTotal = form.countries.reduce((s, c) => s + (Number(c.v) || 0), 0)

  const save = async () => {
    setStatus('กำลังบันทึก...')
    try {
      await saveQurbanData(form)
      setStatus('บันทึกสำเร็จ ✓')
      setTimeout(() => setStatus(''), 2500)
    } catch (e) {
      setStatus('เกิดข้อผิดพลาด: ' + e.message)
    }
  }

  return (<VolunteerGuard>
    <main className="admin-dash admin-qurban">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1>แก้ไขยอดกุรบาน 2026</h1>
            <p>แก้ไขแล้วกดบันทึก — หน้าแดชบอร์ดและหน้าเว็บสาธารณะจะอัปเดตอัตโนมัติ</p>
          </div>
          <a className="admin-btn" href="/admin/missions/qurban2026">ย้อนกลับไปแดชบอร์ด</a>
        </div>

        <div className="admin-card" style={{ marginBottom: 24 }}>
          <h4>กลุ่มภารกิจหลัก</h4>
          <div className="admin-form-grid">
            <label>Palestine (วัว)
              <input type="number" value={form.categories.palestine} onChange={(e) => setCategory('palestine', e.target.value)} />
            </label>
            <label>Syria (แกะ)
              <input type="number" value={form.categories.syria} onChange={(e) => setCategory('syria', e.target.value)} />
            </label>
            <label>Thailand (วัว)
              <input type="number" value={form.categories.thailand} onChange={(e) => setCategory('thailand', e.target.value)} />
            </label>
            <label>Worldwide (วัว)
              <input type="number" value={form.categories.worldwide} onChange={(e) => setCategory('worldwide', e.target.value)} />
            </label>
            <label>Afghanistan (แกะ)
              <input type="number" value={form.afghanistanSheep} onChange={(e) => setAfghanistan(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="admin-card" style={{ marginBottom: 24 }}>
          <h4>สถิติสรุป (การ์ดด้านบนของหน้าแดชบอร์ด)</h4>
          <div className="admin-form-grid">
            <label>ประเทศที่ได้รับ
              <input type="number" value={form.summary.countries} onChange={(e) => setSummary('countries', e.target.value)} />
            </label>
            <label>วัว (ตัว)
              <input type="number" value={form.summary.cows} onChange={(e) => setSummary('cows', e.target.value)} />
            </label>
            <label>แกะ (ตัว)
              <input type="number" value={form.summary.sheep} onChange={(e) => setSummary('sheep', e.target.value)} />
            </label>
            <label>รวมทั้งหมด (ส่วน)
              <input type="number" value={form.summary.total} onChange={(e) => setSummary('total', e.target.value)} />
            </label>
          </div>
        </div>

        <div className="admin-card">
          <h4>วัวกุรบาน นานาชาติ แยกตามประเทศ (รวม {countryTotal} ตัว)</h4>
          <div className="admin-table-wrap">
            <table className="admin-table admin-table-edit">
              <thead>
                <tr><th>ประเทศ</th><th>จำนวน (ตัว)</th><th></th></tr>
              </thead>
              <tbody>
                {form.countries.map((c, i) => (
                  <tr key={i}>
                    <td><input type="text" value={c.n} onChange={(e) => setCountry(i, 'n', e.target.value)} /></td>
                    <td><input type="number" value={c.v} onChange={(e) => setCountry(i, 'v', e.target.value)} style={{ width: 80 }} /></td>
                    <td><button className="admin-btn-danger" onClick={() => removeCountry(i)}>ลบ</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="admin-btn" style={{ marginTop: 12 }} onClick={addCountry}>+ เพิ่มประเทศ</button>
        </div>

        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="admin-btn-primary" onClick={save}>บันทึกการเปลี่ยนแปลง</button>
          {status && <span>{status}</span>}
        </div>
      </div>
    </main>
  </VolunteerGuard>)
}
