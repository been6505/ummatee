import { useEffect, useMemo, useState } from 'react'
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, where, setDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import Overview from '../components/money/Overview.jsx'
import SlipImport from '../components/money/SlipImport.jsx'
import TxPanel from '../components/money/TxPanel.jsx'
import WeeklyPlan from '../components/money/WeeklyPlan.jsx'
import DonationAdvice from '../components/money/DonationAdvice.jsx'
import MoneySettings from '../components/money/MoneySettings.jsx'
import { buildWeeklyPlan, donationAdvice, withDefaults, todayStr } from '../lib/finance.js'

// แอปบันทึกรายรับ-รายจ่ายส่วนตัว (/admin/money)
// อ่านยอดจากรูปสลิปโอนเงินด้วย OCR · สรุปรายรับรายจ่าย · วางแผนงบสัปดาห์หน้า · เก็บเงินเดือน/ค่าคงที่ · แนะนำการบริจาค
// ข้อมูลแยกตามผู้ใช้ที่ล็อกอิน (uid) — collection: moneyTx, moneySettings

const TABS = [
  { key: 'overview', label: '📊 ภาพรวม' },
  { key: 'slip', label: '🧾 อ่านสลิป' },
  { key: 'tx', label: '📝 รายการ' },
  { key: 'plan', label: '📅 แผนสัปดาห์หน้า' },
  { key: 'give', label: '🤲 บริจาค' },
  { key: 'settings', label: '⚙️ ตั้งค่า' },
]

export default function AdminMoney() {
  const { user, loading } = useAdminAuth()
  const uid = user?.uid

  const [txs, setTxs] = useState([])
  const [settings, setSettings] = useState(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [tab, setTab] = useState(() => (window.location.hash || '').replace('#', '') || 'overview')
  const [error, setError] = useState('')

  // จำแท็บล่าสุดไว้ใน hash ของ URL เพื่อให้รีเฟรชแล้วกลับมาที่เดิม
  useEffect(() => {
    if (window.location.hash !== `#${tab}`) window.history.replaceState({}, '', `#${tab}`)
  }, [tab])

  // รายการรายรับ-รายจ่ายของผู้ใช้คนนี้ (เรียงฝั่ง client เพื่อไม่ต้องสร้าง composite index)
  useEffect(() => {
    if (!uid) return
    const qy = query(collection(db, 'moneyTx'), where('uid', '==', uid))
    const unsub = onSnapshot(qy, (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((t) => t.date)
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0))
      setTxs(rows)
      setDataLoading(false)
    }, (e) => { setError(e.message); setDataLoading(false) })
    return unsub
  }, [uid])

  // การตั้งค่าเงินเดือน/ค่าคงที่ (1 เอกสารต่อผู้ใช้ 1 คน)
  useEffect(() => {
    if (!uid) return
    const unsub = onSnapshot(doc(db, 'moneySettings', uid), (snap) => {
      setSettings(snap.exists() ? snap.data() : {})
    }, (e) => setError(e.message))
    return unsub
  }, [uid])

  const conf = useMemo(() => withDefaults(settings), [settings])
  const plan = useMemo(() => buildWeeklyPlan({ txs, settings: conf, refDate: todayStr() }), [txs, conf])
  const advice = useMemo(() => donationAdvice({ txs, settings: conf, plan }), [txs, conf, plan])

  const addTxs = async (records) => {
    await Promise.all(records.map((r) => addDoc(collection(db, 'moneyTx'), {
      uid,
      type: r.type === 'income' ? 'income' : 'expense',
      amount: Number(r.amount) || 0,
      date: r.date || todayStr(),
      category: r.category || 'other-out',
      note: r.note || '',
      source: r.source || 'manual',
      ...(r.slip ? { slip: r.slip } : {}),
      createdAt: Date.now(),
    })))
  }

  const removeTx = async (id) => {
    if (!window.confirm('ลบรายการนี้?')) return
    try { await deleteDoc(doc(db, 'moneyTx', id)) } catch (e) { window.alert('ลบไม่สำเร็จ: ' + e.message) }
  }

  const saveSettings = async (next) => {
    await setDoc(doc(db, 'moneySettings', uid), { ...next, uid, updatedAt: Date.now() }, { merge: true })
  }

  // ปุ่มบริจาคเร็วจากแท็บบริจาค → บันทึกเป็นรายจ่ายหมวดบริจาคทันที
  const quickDonate = async (amount) => {
    await addTxs([{ type: 'expense', amount, date: todayStr(), category: 'sadaqah', note: 'บริจาค/เศาะดะเกาะฮ์', source: 'manual' }])
    window.alert(`บันทึกการบริจาค ฿${Number(amount).toLocaleString('th-TH')} แล้ว — ญะซากัลลอฮุค็อยรอน 🤲`)
  }

  if (loading) return null
  if (!user) return <AdminLogin />

  return (
    <main className="admin-dash admin-money">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1>รายรับ-รายจ่าย</h1>
            <p>อ่านยอดจากสลิปโอนเงิน · สรุปรายรับรายจ่าย · วางแผนงบสัปดาห์หน้า · แนะนำการบริจาค</p>
          </div>
        </div>

        {error && <p className="slip-error">โหลดข้อมูลไม่สำเร็จ: {error}</p>}

        <div className="money-tabs">
          {TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {dataLoading ? <p>กำลังโหลดข้อมูล...</p> : (
          <>
            {tab === 'overview' && <Overview txs={txs} settings={conf} plan={plan} />}
            {tab === 'slip' && <SlipImport txs={txs} onSave={addTxs} />}
            {tab === 'tx' && <TxPanel txs={txs} onAdd={addTxs} onRemove={removeTx} />}
            {tab === 'plan' && <WeeklyPlan plan={plan} />}
            {tab === 'give' && <DonationAdvice advice={advice} onQuickAdd={quickDonate} />}
            {tab === 'settings' && <MoneySettings settings={conf} onSave={saveSettings} />}
          </>
        )}
      </div>
    </main>
  )
}
