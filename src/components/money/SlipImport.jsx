import { useCallback, useEffect, useRef, useState } from 'react'
import { readSlip, terminateOcr } from '../../lib/slipOcr.js'
import { THB2, todayStr, thaiDate } from '../../lib/finance.js'
import { categoriesFor } from '../../data/moneyCategories.js'

// อัปโหลดรูปสลิปโอนเงิน → OCR อ่านยอดเงิน/วันที่/เลขอ้างอิงให้อัตโนมัติ → ตรวจแก้ → บันทึกเป็นรายการ
// รูปไม่ถูกอัปโหลดออกไปไหน ประมวลผลในเครื่องผู้ใช้ทั้งหมด

const blank = (file) => ({
  key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
  fileName: file.name,
  file,
  status: 'queued',      // queued | reading | done | error
  stage: '',
  progress: 0,
  preview: '',
  text: '',
  parsed: null,
  error: '',
  saved: false,
  // ค่าที่จะบันทึกจริง (ผู้ใช้แก้ได้)
  form: { type: 'expense', amount: '', date: todayStr(), category: 'other-out', note: '' },
})

export default function SlipImport({ txs, onSave }) {
  const [items, setItems] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const inputRef = useRef(null)

  // ปิด worker ของ OCR ตอนออกจากหน้า เพื่อคืนหน่วยความจำ
  useEffect(() => () => { terminateOcr() }, [])

  const patch = (key, changes) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...changes } : it)))

  const runOcr = useCallback(async (item) => {
    patch(item.key, { status: 'reading', stage: 'เตรียมรูปภาพ', progress: 0 })
    try {
      const { text, parsed, preview } = await readSlip(item.file, {
        onProgress: ({ stage, progress }) => patch(item.key, { stage, progress: progress || 0 }),
      })
      patch(item.key, {
        status: 'done',
        stage: '',
        progress: 1,
        text,
        parsed,
        preview,
        form: {
          type: 'expense',
          amount: parsed.amount ? String(parsed.amount) : '',
          date: parsed.date || todayStr(),
          category: 'other-out',
          note: [parsed.bank, parsed.to && `→ ${parsed.to}`, parsed.time].filter(Boolean).join(' ').trim(),
        },
      })
    } catch (e) {
      patch(item.key, { status: 'error', error: e?.message || 'อ่านรูปไม่สำเร็จ' })
    }
  }, [])

  const addFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'))
    if (!files.length) { setStatus('รองรับเฉพาะไฟล์รูปภาพ (JPG / PNG / HEIC ที่แปลงแล้ว)'); return }
    const fresh = files.map(blank)
    setItems((prev) => [...fresh, ...prev])
    setStatus('')
    setBusy(true)
    // อ่านทีละใบ เพราะ OCR ใช้ CPU หนัก การอ่านพร้อมกันจะช้ากว่าเดิม
    for (const item of fresh) await runOcr(item)
    setBusy(false)
  }, [runOcr])

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(e.dataTransfer.files)
  }

  const updateForm = (key, changes) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, form: { ...it.form, ...changes } } : it)))

  // เตือนถ้าเลขอ้างอิงของสลิปนี้เคยบันทึกไปแล้ว
  const duplicateOf = (item) => {
    const ref = item.parsed?.ref
    if (!ref) return null
    return (txs || []).find((t) => t.slip?.ref && t.slip.ref === ref) || null
  }

  const saveOne = async (item) => {
    const amount = Number(item.form.amount)
    if (!amount || amount <= 0) { setStatus('กรุณาตรวจสอบจำนวนเงินก่อนบันทึก'); return }
    setStatus('กำลังบันทึก...')
    await onSave([{
      type: item.form.type,
      amount,
      date: item.form.date,
      category: item.form.category,
      note: item.form.note,
      source: 'slip',
      slip: {
        ref: item.parsed?.ref || '',
        bank: item.parsed?.bank || '',
        time: item.parsed?.time || '',
        from: item.parsed?.from || '',
        to: item.parsed?.to || '',
        fee: item.parsed?.fee || 0,
        fileName: item.fileName,
      },
    }])
    patch(item.key, { saved: true })
    setStatus('บันทึกแล้ว ✓')
    setTimeout(() => setStatus(''), 2000)
  }

  const saveAll = async () => {
    const ready = items.filter((it) => it.status === 'done' && !it.saved && Number(it.form.amount) > 0)
    if (!ready.length) { setStatus('ยังไม่มีสลิปที่พร้อมบันทึก'); return }
    setStatus(`กำลังบันทึก ${ready.length} รายการ...`)
    await onSave(ready.map((it) => ({
      type: it.form.type,
      amount: Number(it.form.amount),
      date: it.form.date,
      category: it.form.category,
      note: it.form.note,
      source: 'slip',
      slip: {
        ref: it.parsed?.ref || '',
        bank: it.parsed?.bank || '',
        time: it.parsed?.time || '',
        from: it.parsed?.from || '',
        to: it.parsed?.to || '',
        fee: it.parsed?.fee || 0,
        fileName: it.fileName,
      },
    })))
    setItems((prev) => prev.map((it) => (ready.includes(it) ? { ...it, saved: true } : it)))
    setStatus(`บันทึก ${ready.length} รายการแล้ว ✓`)
    setTimeout(() => setStatus(''), 2500)
  }

  const pending = items.filter((it) => it.status === 'done' && !it.saved).length

  return (
    <div className="money-slip">
      <div
        className={`slip-drop ${dragOver ? 'over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
      >
        <div className="slip-drop-icon">🧾</div>
        <h4>ลากรูปสลิปมาวางที่นี่ หรือกดเพื่อเลือกรูป</h4>
        <p>
          ระบบจะอ่าน <strong>ยอดเงิน / วันที่ / เวลา / เลขอ้างอิง / ธนาคาร</strong> จากสลิปให้อัตโนมัติ
          เลือกได้หลายใบพร้อมกัน · รูปถูกประมวลผลในเครื่องคุณเอง ไม่ถูกอัปโหลดขึ้นเซิร์ฟเวอร์
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      <div className="slip-actions">
        {pending > 0 && <button className="admin-btn-primary" onClick={saveAll} disabled={busy}>บันทึกทั้งหมด ({pending})</button>}
        {items.length > 0 && <button className="admin-btn" onClick={() => setItems([])} disabled={busy}>ล้างรายการที่อ่านไว้</button>}
        {status && <span className="slip-status">{status}</span>}
        {busy && <span className="slip-status">⏳ กำลังอ่านสลิป... ครั้งแรกจะช้าหน่อยเพราะต้องโหลดตัวอ่านภาษาไทย</span>}
      </div>

      <div className="slip-list">
        {items.map((it) => {
          const dup = it.status === 'done' ? duplicateOf(it) : null
          return (
            <div key={it.key} className={`slip-item ${it.saved ? 'saved' : ''}`}>
              <div className="slip-thumb">
                {it.preview
                  ? <img src={it.preview} alt={`สลิป ${it.fileName}`} />
                  : <div className="slip-thumb-empty">{it.status === 'error' ? '⚠️' : '⏳'}</div>}
              </div>

              <div className="slip-body">
                <div className="slip-head">
                  <strong>{it.fileName}</strong>
                  {it.status === 'done' && (
                    <span className={`slip-badge ${it.parsed.confidence >= 60 ? 'ok' : 'low'}`}>
                      อ่านได้ {it.parsed.confidence}%
                    </span>
                  )}
                  {it.saved && <span className="slip-badge ok">บันทึกแล้ว ✓</span>}
                </div>

                {it.status === 'reading' && (
                  <div className="slip-progress">
                    <div className="slip-progress-bar"><span style={{ width: `${Math.round((it.progress || 0) * 100)}%` }} /></div>
                    <small>{it.stage} {Math.round((it.progress || 0) * 100)}%</small>
                  </div>
                )}

                {it.status === 'error' && <p className="slip-error">อ่านสลิปไม่สำเร็จ: {it.error} — กรอกยอดเองได้จากฟอร์มในแท็บ "รายการ"</p>}

                {it.status === 'done' && (
                  <>
                    <div className="slip-parsed">
                      {it.parsed.bank && <span>🏦 {it.parsed.bank}</span>}
                      {it.parsed.date && <span>📅 {thaiDate(it.parsed.date)}</span>}
                      {it.parsed.time && <span>🕐 {it.parsed.time} น.</span>}
                      {it.parsed.ref && <span>#️⃣ {it.parsed.ref}</span>}
                      {it.parsed.from && <span>จาก: {it.parsed.from}</span>}
                      {it.parsed.to && <span>ถึง: {it.parsed.to}</span>}
                      {it.parsed.fee > 0 && <span>ค่าธรรมเนียม {THB2(it.parsed.fee)}</span>}
                    </div>

                    {dup && !it.saved && (
                      <p className="slip-warn">⚠️ เลขอ้างอิงนี้เคยบันทึกไว้แล้วเมื่อ {thaiDate(dup.date)} ({THB2(dup.amount)}) — ตรวจสอบก่อนบันทึกซ้ำ</p>
                    )}
                    {it.parsed.amount === 0 && (
                      <p className="slip-warn">⚠️ อ่านยอดเงินไม่เจอ — กรุณากรอกเอง</p>
                    )}

                    <div className="slip-form">
                      <label>ประเภท
                        <select
                          value={it.form.type}
                          onChange={(e) => updateForm(it.key, {
                            type: e.target.value,
                            category: e.target.value === 'income' ? 'other-in' : 'other-out',
                          })}
                        >
                          <option value="expense">รายจ่าย (เงินออก)</option>
                          <option value="income">รายรับ (เงินเข้า)</option>
                        </select>
                      </label>
                      <label>จำนวนเงิน
                        <input type="number" step="0.01" min="0" value={it.form.amount} onChange={(e) => updateForm(it.key, { amount: e.target.value })} />
                      </label>
                      <label>วันที่
                        <input type="date" value={it.form.date} onChange={(e) => updateForm(it.key, { date: e.target.value })} />
                      </label>
                      <label>หมวดหมู่
                        <select value={it.form.category} onChange={(e) => updateForm(it.key, { category: e.target.value })}>
                          {categoriesFor(it.form.type).map((c) => (
                            <option key={c.key} value={c.key}>{c.icon} {c.name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="slip-note">หมายเหตุ
                        <input type="text" value={it.form.note} onChange={(e) => updateForm(it.key, { note: e.target.value })} />
                      </label>
                    </div>

                    {it.parsed.amountOptions?.length > 1 && (
                      <div className="slip-alts">
                        <span>ตัวเลขอื่นที่เจอในสลิป:</span>
                        {it.parsed.amountOptions.map((v) => (
                          <button key={v} className={Number(it.form.amount) === v ? 'active' : ''} onClick={() => updateForm(it.key, { amount: String(v) })}>
                            {THB2(v)}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="slip-item-actions">
                      <button className="admin-btn-primary" onClick={() => saveOne(it)} disabled={it.saved}>
                        {it.saved ? 'บันทึกแล้ว' : 'บันทึกรายการนี้'}
                      </button>
                      <button className="admin-btn" onClick={() => setItems((prev) => prev.filter((x) => x.key !== it.key))}>เอาออก</button>
                      <details className="slip-raw">
                        <summary>ดูข้อความที่ OCR อ่านได้</summary>
                        <pre>{it.text || '—'}</pre>
                      </details>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
