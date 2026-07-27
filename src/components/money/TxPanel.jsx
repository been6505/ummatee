import { useMemo, useState } from 'react'
import { THB2, thaiDate, todayStr } from '../../lib/finance.js'
import { categoriesFor, categoryLabel } from '../../data/moneyCategories.js'

// ฟอร์มเพิ่มรายการด้วยมือ + ตารางรายการทั้งหมด (ค้นหา / กรอง / เรียง / ลบ)

const emptyForm = () => ({ type: 'expense', amount: '', date: todayStr(), category: 'food', note: '' })

export default function TxPanel({ txs, onAdd, onRemove }) {
  const [form, setForm] = useState(emptyForm)
  const [status, setStatus] = useState('')

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterCat, setFilterCat] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const changeType = (e) => {
    const type = e.target.value
    setForm((f) => ({ ...f, type, category: categoriesFor(type)[0].key }))
  }

  const add = async () => {
    const amount = Number(form.amount)
    if (!amount || amount <= 0) { setStatus('กรุณากรอกจำนวนเงิน'); return }
    setStatus('กำลังบันทึก...')
    try {
      await onAdd([{ ...form, amount, note: form.note.trim(), source: 'manual' }])
      setForm((f) => ({ ...emptyForm(), type: f.type, category: f.category, date: f.date }))
      setStatus('บันทึกแล้ว ✓')
      setTimeout(() => setStatus(''), 2000)
    } catch (e) {
      setStatus('บันทึกไม่สำเร็จ: ' + e.message)
    }
  }

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return (txs || [])
      .filter((t) => (filterType === 'all' ? true : t.type === filterType))
      .filter((t) => (filterCat === 'all' ? true : t.category === filterCat))
      .filter((t) => (from ? t.date >= from : true))
      .filter((t) => (to ? t.date <= to : true))
      .filter((t) => !s || [t.note, t.slip?.ref, t.slip?.bank, t.slip?.to, categoryLabel(t.type, t.category)]
        .some((x) => (x || '').toLowerCase().includes(s)))
      .sort((a, b) => {
        let cmp = 0
        if (sortKey === 'amount') cmp = (a.amount || 0) - (b.amount || 0)
        else if (sortKey === 'category') cmp = categoryLabel(a.type, a.category).localeCompare(categoryLabel(b.type, b.category))
        else cmp = (a.date || '').localeCompare(b.date || '')
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [txs, search, filterType, filterCat, from, to, sortKey, sortDir])

  const sortBtn = (key) => () => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }
  const arrow = (key) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '')

  const sumIn = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0)
  const sumOut = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0)
  const allCats = [...categoriesFor('income'), ...categoriesFor('expense')]

  return (
    <div className="money-tx">
      <div className="admin-card">
        <h4>➕ เพิ่มรายการด้วยมือ</h4>
        <div className="admin-form-grid">
          <label>ประเภท
            <select value={form.type} onChange={changeType}>
              <option value="expense">รายจ่าย</option>
              <option value="income">รายรับ</option>
            </select>
          </label>
          <label>จำนวนเงิน (บาท)
            <input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0" />
          </label>
          <label>วันที่
            <input type="date" value={form.date} onChange={set('date')} />
          </label>
          <label>หมวดหมู่
            <select value={form.category} onChange={set('category')}>
              {categoriesFor(form.type).map((c) => <option key={c.key} value={c.key}>{c.icon} {c.name}</option>)}
            </select>
          </label>
          <label>หมายเหตุ
            <input type="text" value={form.note} onChange={set('note')} placeholder="เช่น ข้าวมันไก่" />
          </label>
        </div>
        <div className="money-save-bar">
          <button className="admin-btn-primary" onClick={add}>บันทึกรายการ</button>
          {status && <span>{status}</span>}
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-head">
          <h4>รายการทั้งหมด ({filtered.length}/{(txs || []).length}) · เข้า {THB2(sumIn)} · ออก {THB2(sumOut)}</h4>
          <div className="admin-filters">
            <input type="search" placeholder="ค้นหาหมายเหตุ/เลขอ้างอิง..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">ทุกประเภท</option>
              <option value="income">รายรับ</option>
              <option value="expense">รายจ่าย</option>
            </select>
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
              <option value="all">ทุกหมวด</option>
              {allCats.map((c) => <option key={c.key} value={c.key}>{c.icon} {c.name}</option>)}
            </select>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="ตั้งแต่วันที่" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="ถึงวันที่" />
            {(search || filterType !== 'all' || filterCat !== 'all' || from || to) && (
              <button className="admin-btn" onClick={() => { setSearch(''); setFilterType('all'); setFilterCat('all'); setFrom(''); setTo('') }}>ล้าง</button>
            )}
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="admin-th-sort" onClick={sortBtn('date')}>วันที่{arrow('date')}</th>
                <th className="admin-th-sort" onClick={sortBtn('category')}>หมวดหมู่{arrow('category')}</th>
                <th className="admin-th-sort" onClick={sortBtn('amount')}>จำนวนเงิน{arrow('amount')}</th>
                <th>หมายเหตุ</th>
                <th>ที่มา</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td>{thaiDate(t.date)}</td>
                  <td>{categoryLabel(t.type, t.category)}</td>
                  <td className={t.type === 'income' ? 'tx-in' : 'tx-out'}>
                    {t.type === 'income' ? '+' : '−'}{THB2(t.amount)}
                  </td>
                  <td>{t.note || '—'}</td>
                  <td>
                    {t.source === 'slip'
                      ? <span title={`${t.slip?.bank || ''} ${t.slip?.ref || ''}`}>🧾 สลิป</span>
                      : <span>✍️ กรอกเอง</span>}
                  </td>
                  <td><button className="admin-btn-danger" onClick={() => onRemove(t.id)}>ลบ</button></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="6" style={{ textAlign: 'center', color: '#999' }}>ยังไม่มีรายการ — เพิ่มด้วยฟอร์มด้านบน หรืออัปโหลดสลิปที่แท็บ "อ่านสลิป"</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
