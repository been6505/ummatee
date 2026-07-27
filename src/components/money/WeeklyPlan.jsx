import { THB, thaiDate } from '../../lib/finance.js'
import { categoryLabel } from '../../data/moneyCategories.js'

// แผนการเงินสัปดาห์หน้า — งบต่อวัน บิลที่ต้องจ่าย เงินเดือนที่จะเข้า และคำแนะนำจากพฤติกรรมจริง

const LEVEL_ICON = { good: '✅', warn: '⚠️', danger: '🚨', info: 'ℹ️' }

export default function WeeklyPlan({ plan }) {
  const { days, weeklyBudget, dailyBudget, fixedDue, salaryIn, weeklySaving, weeklyDonation, balanceNow, projectedEnd, avgWeeklySpend, historyWeeks, lastWeekSpend, tips } = plan

  return (
    <div className="money-plan">
      <div className="admin-card plan-hero">
        <div>
          <h4>📅 แผนการเงินสัปดาห์หน้า</h4>
          <p className="plan-range">{thaiDate(plan.start)} — {thaiDate(plan.end)}</p>
        </div>
        <div className="plan-hero-budget">
          <div className="v">{THB(dailyBudget)}</div>
          <div className="l">งบใช้จ่ายต่อวัน</div>
        </div>
      </div>

      <div className="admin-stats">
        <div className="admin-stat"><div className="v">{THB(weeklyBudget)}</div><div className="l">งบใช้จ่ายทั้งสัปดาห์</div></div>
        <div className="admin-stat"><div className="v">{THB(salaryIn)}</div><div className="l">รายรับที่จะเข้า</div></div>
        <div className="admin-stat"><div className="v">{THB(fixedDue)}</div><div className="l">บิลที่ครบกำหนด</div></div>
        <div className="admin-stat"><div className="v">{THB(weeklySaving)}</div><div className="l">ต้องกันไว้ออม</div></div>
        <div className="admin-stat"><div className="v">{THB(weeklyDonation)}</div><div className="l">ต้องกันไว้บริจาค</div></div>
      </div>

      <div className="admin-grid">
        <div className="admin-card">
          <h4>💰 กระแสเงินสด</h4>
          <div className="money-breakdown">
            <div><span>เงินคงเหลือวันนี้</span><strong>{THB(balanceNow)}</strong></div>
            <div><span>+ รายรับสัปดาห์หน้า</span><strong className="pos">{THB(salaryIn)}</strong></div>
            <div><span>− บิลค่าคงที่</span><strong className="neg">{THB(fixedDue)}</strong></div>
            <div><span>− งบใช้จ่าย</span><strong className="neg">{THB(weeklyBudget)}</strong></div>
            <div><span>− ออม + บริจาค</span><strong className="neg">{THB(weeklySaving + weeklyDonation)}</strong></div>
            <div className="total">
              <span>คาดว่าจะเหลือปลายสัปดาห์</span>
              <strong className={projectedEnd < 0 ? 'neg' : 'pos'}>{THB(projectedEnd)}</strong>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <h4>📊 เทียบกับพฤติกรรมจริง</h4>
          <div className="money-breakdown">
            <div><span>งบที่ตั้งไว้/สัปดาห์</span><strong>{THB(weeklyBudget)}</strong></div>
            <div><span>ใช้จริงเฉลี่ย {historyWeeks > 0 ? `(${historyWeeks} สัปดาห์)` : ''}</span><strong>{historyWeeks > 0 ? THB(avgWeeklySpend) : '—'}</strong></div>
            <div><span>สัปดาห์ที่แล้วใช้ไป</span><strong>{THB(lastWeekSpend)}</strong></div>
            <div className="total">
              <span>ต้องปรับ</span>
              <strong className={avgWeeklySpend > weeklyBudget ? 'neg' : 'pos'}>
                {historyWeeks > 0
                  ? (avgWeeklySpend > weeklyBudget ? `ลดลง ${THB(avgWeeklySpend - weeklyBudget)}` : `เหลือเพิ่ม ${THB(weeklyBudget - avgWeeklySpend)}`)
                  : 'ยังไม่มีข้อมูล'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: 16 }}>
        <h4>🗓️ ตารางใช้จ่ายรายวัน</h4>
        <div className="plan-days">
          {days.map((d) => (
            <div key={d.date} className={`plan-day ${d.isPayday ? 'payday' : ''} ${d.fixedTotal > 0 ? 'has-bill' : ''}`}>
              <div className="pd-name">{d.dayName}</div>
              <div className="pd-date">{thaiDate(d.date)}</div>
              <div className="pd-budget">{THB(d.allowance)}</div>
              {d.isPayday && <div className="pd-tag pay">💵 เงินเดือนเข้า</div>}
              {d.fixedItems.map((f, i) => (
                <div className="pd-tag bill" key={`${f.name}-${i}`} title={categoryLabel('expense', f.category)}>
                  🧾 {f.name} {THB(f.amount)}
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="money-hint">งบต่อวันคือยอดที่ใช้ได้กับค่ากิน ค่าเดินทาง และของใช้ทั่วไป — ไม่รวมบิลค่าคงที่ที่กันไว้ต่างหากแล้ว</p>
      </div>

      <div className="admin-card" style={{ marginTop: 16 }}>
        <h4>💡 คำแนะนำสำหรับสัปดาห์หน้า</h4>
        <ul className="plan-tips">
          {tips.map((t, i) => (
            <li key={i} className={`tip ${t.level}`}><span className="tip-icon">{LEVEL_ICON[t.level]}</span>{t.text}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
