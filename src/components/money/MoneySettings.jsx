import { useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, THB, fixedCostTotal, withDefaults, WEEKS_PER_MONTH, NISAB_GOLD_GRAMS } from '../../lib/finance.js'
import { EXPENSE_CATEGORIES } from '../../data/moneyCategories.js'

// ตั้งค่าเงินเดือน / ค่าใช้จ่ายคงที่ / เป้าออม / เป้าบริจาค / ทรัพย์สินสำหรับคำนวณซะกาต
// ค่าทั้งหมดถูกใช้เป็นฐานในการคำนวณแผนสัปดาห์หน้าและคำแนะนำการบริจาค

const newFixedCost = () => ({
  id: `f${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
  name: '',
  amount: 0,
  dueDay: 1,
  category: 'rent',
})

export default function MoneySettings({ settings, onSave }) {
  const [form, setForm] = useState(() => withDefaults(settings))
  const [status, setStatus] = useState('')

  // ซิงก์เมื่อข้อมูลจาก Firestore โหลดเสร็จ/เปลี่ยนจากอุปกรณ์อื่น
  useEffect(() => { setForm(withDefaults(settings)) }, [settings])

  const set = (k) => (e) => {
    const v = e.target.type === 'number' ? e.target.value : e.target.value
    setForm((f) => ({ ...f, [k]: v }))
  }

  const setCost = (id, changes) =>
    setForm((f) => ({ ...f, fixedCosts: f.fixedCosts.map((c) => (c.id === id ? { ...c, ...changes } : c)) }))

  const addCost = () => setForm((f) => ({ ...f, fixedCosts: [...(f.fixedCosts || []), newFixedCost()] }))

  const removeCost = (id) =>
    setForm((f) => ({ ...f, fixedCosts: f.fixedCosts.filter((c) => c.id !== id) }))

  const save = async () => {
    setStatus('กำลังบันทึก...')
    const clean = {
      salary: Number(form.salary) || 0,
      payday: Math.min(Math.max(Number(form.payday) || 1, 1), 31),
      openingBalance: Number(form.openingBalance) || 0,
      savingPercent: Math.min(Math.max(Number(form.savingPercent) || 0, 0), 100),
      donationPercent: Math.min(Math.max(Number(form.donationPercent) || 0, 0), 100),
      zakatAssets: Number(form.zakatAssets) || 0,
      goldPricePerGram: Number(form.goldPricePerGram) || 0,
      fixedCosts: (form.fixedCosts || [])
        .filter((c) => c.name.trim() || Number(c.amount) > 0)
        .map((c) => ({
          id: c.id,
          name: c.name.trim() || 'ไม่ระบุชื่อ',
          amount: Number(c.amount) || 0,
          dueDay: Math.min(Math.max(Number(c.dueDay) || 1, 1), 31),
          category: c.category || 'other-out',
        })),
    }
    try {
      await onSave(clean)
      setForm(withDefaults(clean))
      setStatus('บันทึกการตั้งค่าแล้ว ✓')
      setTimeout(() => setStatus(''), 2500)
    } catch (e) {
      setStatus('บันทึกไม่สำเร็จ: ' + e.message)
    }
  }

  const monthlyFixed = fixedCostTotal(form.fixedCosts)
  const income = Number(form.salary) || 0
  const saving = (income * (Number(form.savingPercent) || 0)) / 100
  const donation = (income * (Number(form.donationPercent) || 0)) / 100
  const spendable = income - monthlyFixed - saving - donation
  const nisab = NISAB_GOLD_GRAMS * (Number(form.goldPricePerGram) || 0)

  return (
    <div className="money-settings">
      <div className="admin-card">
        <h4>💼 เงินเดือนและเงินตั้งต้น</h4>
        <div className="admin-form-grid">
          <label>เงินเดือน (บาท/เดือน)
            <input type="number" min="0" value={form.salary} onChange={set('salary')} placeholder="0" />
          </label>
          <label>วันที่เงินเดือนออก
            <input type="number" min="1" max="31" value={form.payday} onChange={set('payday')} />
          </label>
          <label>เงินคงเหลือตั้งต้น (บาท)
            <input type="number" value={form.openingBalance} onChange={set('openingBalance')} placeholder="0" />
          </label>
        </div>
        <p className="money-hint">
          "เงินคงเหลือตั้งต้น" คือเงินที่มีอยู่ในบัญชี ณ วันที่เริ่มใช้แอปนี้ ระบบจะเอามาบวกกับรายรับ-รายจ่ายที่บันทึกไว้ เพื่อคำนวณยอดคงเหลือปัจจุบัน
        </p>
      </div>

      <div className="admin-card">
        <h4>🎯 เป้าหมายการเงินต่อเดือน</h4>
        <div className="admin-form-grid">
          <label>เก็บออม (% ของรายรับ)
            <input type="number" min="0" max="100" step="0.5" value={form.savingPercent} onChange={set('savingPercent')} />
          </label>
          <label>บริจาค/เศาะดะเกาะฮ์ (% ของรายรับ)
            <input type="number" min="0" max="100" step="0.5" value={form.donationPercent} onChange={set('donationPercent')} />
          </label>
        </div>
        <div className="money-breakdown">
          <div><span>รายรับต่อเดือน</span><strong>{THB(income)}</strong></div>
          <div><span>− ค่าใช้จ่ายคงที่</span><strong>{THB(monthlyFixed)}</strong></div>
          <div><span>− เก็บออม {form.savingPercent}%</span><strong>{THB(saving)}</strong></div>
          <div><span>− บริจาค {form.donationPercent}%</span><strong>{THB(donation)}</strong></div>
          <div className="total"><span>= เหลือใช้จ่ายได้</span><strong className={spendable < 0 ? 'neg' : 'pos'}>{THB(spendable)}</strong></div>
          <div className="total"><span>เฉลี่ยต่อสัปดาห์</span><strong className={spendable < 0 ? 'neg' : 'pos'}>{THB(spendable / WEEKS_PER_MONTH)}</strong></div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-head">
          <h4>🧾 ค่าใช้จ่ายคงที่ ({(form.fixedCosts || []).length} รายการ · รวม {THB(monthlyFixed)}/เดือน)</h4>
          <button className="admin-btn" onClick={addCost}>+ เพิ่มค่าใช้จ่ายคงที่</button>
        </div>
        <p className="money-hint">ค่าเช่าบ้าน ค่าผ่อนรถ ค่าน้ำค่าไฟ ค่าเน็ต ประกัน ฯลฯ — ระบบจะกันเงินส่วนนี้ออกจากงบใช้จ่ายรายสัปดาห์ และเตือนเมื่อถึงกำหนดจ่าย</p>

        {(form.fixedCosts || []).length === 0 ? (
          <p className="admin-empty">ยังไม่มีค่าใช้จ่ายคงที่ — กด "เพิ่มค่าใช้จ่ายคงที่" เพื่อเริ่ม</p>
        ) : (
          <div className="fixed-list">
            {form.fixedCosts.map((c) => (
              <div className="fixed-row" key={c.id}>
                <input className="fx-name" type="text" placeholder="เช่น ค่าเช่าห้อง" value={c.name} onChange={(e) => setCost(c.id, { name: e.target.value })} />
                <input className="fx-amount" type="number" min="0" placeholder="0" value={c.amount} onChange={(e) => setCost(c.id, { amount: e.target.value })} />
                <select className="fx-cat" value={c.category} onChange={(e) => setCost(c.id, { category: e.target.value })}>
                  {EXPENSE_CATEGORIES.map((x) => <option key={x.key} value={x.key}>{x.icon} {x.name}</option>)}
                </select>
                <label className="fx-due">ทุกวันที่
                  <input type="number" min="1" max="31" value={c.dueDay} onChange={(e) => setCost(c.id, { dueDay: e.target.value })} />
                </label>
                <button className="admin-btn-danger" onClick={() => removeCost(c.id)}>ลบ</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-card">
        <h4>🤲 ข้อมูลสำหรับคำนวณซะกาต</h4>
        <div className="admin-form-grid">
          <label>ทรัพย์สินที่ถือครบ 1 ปี (บาท)
            <input type="number" min="0" value={form.zakatAssets} onChange={set('zakatAssets')} placeholder="เงินสด + เงินฝาก + ทอง" />
          </label>
          <label>ราคาทองคำ (บาท/กรัม)
            <input type="number" min="0" value={form.goldPricePerGram} onChange={set('goldPricePerGram')} />
          </label>
        </div>
        <p className="money-hint">
          นิศอบ (เกณฑ์ขั้นต่ำ) = ทองคำ {NISAB_GOLD_GRAMS} กรัม ≈ <strong>{THB(nisab)}</strong> ตามราคาทองที่กรอกไว้
          — ถ้าทรัพย์สินที่ถือครบ 1 ปีจันทรคติถึงเกณฑ์นี้ ต้องจ่ายซะกาต 2.5%
          <br />ตัวเลขนี้เป็นเพียงตัวช่วยประมาณการเบื้องต้น กรณีมีทรัพย์สินหลายประเภทหรือมีหนี้สิน ควรปรึกษาผู้รู้ด้านศาสนาเพิ่มเติม
        </p>
      </div>

      <div className="money-save-bar">
        <button className="admin-btn-primary" onClick={save}>บันทึกการตั้งค่า</button>
        {status && <span>{status}</span>}
        <button className="admin-btn" onClick={() => setForm(withDefaults(DEFAULT_SETTINGS))}>รีเซ็ตฟอร์ม</button>
      </div>
    </div>
  )
}
