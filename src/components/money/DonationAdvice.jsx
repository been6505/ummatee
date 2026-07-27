import { THB, suggestAccounts } from '../../lib/finance.js'
import { ACCOUNTS } from '../../data/accounts.js'

// คำแนะนำการบริจาค — เศาะดะเกาะฮ์รายเดือน/สัปดาห์ ซะกาต 2.5% และบัญชีของมูลนิธิที่บริจาคได้

export default function DonationAdvice({ advice, onQuickAdd }) {
  const { monthlyTarget, weeklyTarget, dailyTarget, givenThisMonth, givenThisYear, remaining, progress, nisab, assets, zakatDue, messages, give100 } = advice
  const picks = suggestAccounts(ACCOUNTS, { zakatDue })

  const quick = [
    Math.round(dailyTarget) || 20,
    100,
    Math.round(weeklyTarget) || 200,
    Math.round(remaining) || 500,
  ].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i).sort((a, b) => a - b)

  return (
    <div className="money-donation">
      <div className="admin-stats">
        <div className="admin-stat"><div className="v">{THB(monthlyTarget)}</div><div className="l">เป้าบริจาคเดือนนี้</div></div>
        <div className="admin-stat"><div className="v">{THB(givenThisMonth)}</div><div className="l">บริจาคไปแล้วเดือนนี้</div></div>
        <div className="admin-stat"><div className="v">{THB(weeklyTarget)}</div><div className="l">เฉลี่ยต่อสัปดาห์</div></div>
        <div className="admin-stat"><div className="v">{THB(givenThisYear)}</div><div className="l">รวมทั้งปีนี้</div></div>
      </div>

      <div className="admin-card">
        <h4>🤲 ความคืบหน้าเป้าบริจาคเดือนนี้</h4>
        <div className="give-progress">
          <div className="give-bar"><span style={{ width: `${progress}%` }} /></div>
          <div className="give-progress-label">
            {THB(givenThisMonth)} / {THB(monthlyTarget)} ({progress.toFixed(0)}%)
            {remaining > 0 && <> — เหลืออีก <strong>{THB(remaining)}</strong></>}
          </div>
        </div>

        <ul className="plan-tips">
          {messages.map((m, i) => (
            <li key={i} className="tip info"><span className="tip-icon">💬</span>{m}</li>
          ))}
        </ul>

        {onQuickAdd && (
          <div className="give-quick">
            <span>บันทึกการบริจาคเร็ว:</span>
            {quick.map((v) => (
              <button key={v} className="admin-btn" onClick={() => onQuickAdd(v)}>+ {THB(v)}</button>
            ))}
          </div>
        )}
      </div>

      <div className="admin-grid">
        <div className="admin-card">
          <h4>📿 ซะกาตประจำปี</h4>
          <div className="money-breakdown">
            <div><span>ทรัพย์สินที่ถือครบปี</span><strong>{THB(assets)}</strong></div>
            <div><span>นิศอบ (ทอง 85 กรัม)</span><strong>{THB(nisab)}</strong></div>
            <div className="total">
              <span>ซะกาตที่ต้องจ่าย (2.5%)</span>
              <strong className={zakatDue > 0 ? 'neg' : 'pos'}>{zakatDue > 0 ? THB(zakatDue) : 'ยังไม่ถึงเกณฑ์'}</strong>
            </div>
          </div>
          <p className="money-hint">กรอกทรัพย์สินและราคาทองได้ที่แท็บ "ตั้งค่า" — ซะกาตจ่ายเมื่อทรัพย์สินถึงนิศอบและถือครบ 1 ปีจันทรคติ</p>
        </div>

        <div className="admin-card">
          <h4>💯 แผน "ให้ 100 ถึง 100"</h4>
          <p className="money-hint">ให้วันละ {THB(give100.perDay)} ต่อเนื่อง {give100.days} วัน = {THB(give100.total)} — เศาะดะเกาะฮ์ที่ทำต่อเนื่องแม้จำนวนน้อย ดีกว่าทำครั้งเดียวแล้วหยุด</p>
          <div className="money-breakdown">
            <div><span>ต่อวัน</span><strong>{THB(give100.perDay)}</strong></div>
            <div><span>ต่อสัปดาห์</span><strong>{THB(give100.weekly)}</strong></div>
            <div className="total">
              <span>งบสัปดาห์หน้ารับไหวไหม</span>
              <strong className={give100.fitsBudget ? 'pos' : 'neg'}>{give100.fitsBudget ? 'ไหว ✅' : 'ยังตึง — เริ่มที่วันละ 20 บาทก่อน'}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: 16 }}>
        <h4>🕌 บัญชีมูลนิธิอุมมะตีที่แนะนำ</h4>
        <div className="give-accounts">
          {picks.map((a) => (
            <div className="give-account" key={a.acc}>
              <div className="ga-icon">{a.icon}</div>
              <div className="ga-body">
                <strong>{a.name}</strong>
                <span className="ga-acc">{a.acc}</span>
                <span className="ga-reason">{a.reason}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="money-hint">โอนแล้วเก็บสลิปไว้ แล้วอัปโหลดที่แท็บ "อ่านสลิป" ระบบจะบันทึกเป็นรายจ่ายหมวดบริจาคให้อัตโนมัติ</p>
      </div>
    </div>
  )
}
