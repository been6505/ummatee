import { useState } from 'react'
import { Chart, ChartTypeSwitch, PALETTE } from '../AdminCharts.jsx'
import { THB, summarize, currentBalance, startOfWeek, toISO, addDays, thaiMonthLabel, thaiDate, todayStr, isVariableExpense } from '../../lib/finance.js'
import { categoryInfo } from '../../data/moneyCategories.js'

// ภาพรวมการเงิน — ยอดคงเหลือ รายรับ-รายจ่ายเดือนนี้ และกราฟแยกหมวด/รายเดือน/รายสัปดาห์

export default function Overview({ txs, settings, plan }) {
  const [catChart, setCatChart] = useState('donut')
  const [trendChart, setTrendChart] = useState('line')

  const today = todayStr()
  const monthStart = today.slice(0, 7) + '-01'
  const month = summarize(txs, monthStart, today)
  const balance = currentBalance(txs, settings)
  const savingRate = month.income > 0 ? (month.net / month.income) * 100 : 0

  // รายจ่ายเดือนนี้แยกตามหมวด
  const byCategory = Object.entries(
    month.rows.filter((t) => t.type === 'expense').reduce((m, t) => {
      m[t.category] = (m[t.category] || 0) + (Number(t.amount) || 0)
      return m
    }, {})
  )
    .map(([key, value]) => ({ label: categoryInfo('expense', key).name, value }))
    .sort((a, b) => b.value - a.value)

  // แนวโน้ม 6 เดือนล่าสุด (รายรับ vs รายจ่าย แสดงเป็นยอดคงเหลือสุทธิ)
  const byMonth = Object.entries(
    (txs || []).reduce((m, t) => {
      const ym = (t.date || '').slice(0, 7)
      if (!ym) return m
      m[ym] = m[ym] || { income: 0, expense: 0 }
      m[ym][t.type === 'income' ? 'income' : 'expense'] += Number(t.amount) || 0
      return m
    }, {})
  )
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)

  const monthExpense = byMonth.map(([ym, v]) => ({ label: thaiMonthLabel(ym), value: Math.round(v.expense) }))

  // รายจ่ายที่ปรับลดได้ 8 สัปดาห์ล่าสุด เทียบกับงบต่อสัปดาห์
  const weekStart = startOfWeek(today)
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const s = toISO(addDays(weekStart, -7 * (7 - i)))
    const e = toISO(addDays(s, 6))
    const value = (txs || [])
      .filter((t) => isVariableExpense(t) && t.date >= s && t.date <= e)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
    // ตัดปีออกจากป้ายกำกับให้แกนอ่านง่าย (เช่น "3 ส.ค.")
    return { label: thaiDate(s).replace(/\s\d{2}$/, ''), value: Math.round(value) }
  })

  const overBudget = weekly[7].value > plan.weeklyBudget && plan.weeklyBudget > 0

  return (
    <div className="money-overview">
      <div className="admin-stats">
        <div className="admin-stat">
          <div className={`v ${balance < 0 ? 'neg' : ''}`}>{THB(balance)}</div>
          <div className="l">เงินคงเหลือปัจจุบัน</div>
        </div>
        <div className="admin-stat"><div className="v pos">{THB(month.income)}</div><div className="l">รายรับเดือนนี้</div></div>
        <div className="admin-stat"><div className="v neg">{THB(month.expense)}</div><div className="l">รายจ่ายเดือนนี้</div></div>
        <div className="admin-stat">
          <div className={`v ${month.net < 0 ? 'neg' : 'pos'}`}>{THB(month.net)}</div>
          <div className="l">คงเหลือสุทธิเดือนนี้</div>
        </div>
        <div className="admin-stat">
          <div className={`v ${savingRate < 0 ? 'neg' : ''}`}>{savingRate.toFixed(0)}%</div>
          <div className="l">อัตราเงินเหลือ/รายรับ</div>
        </div>
      </div>

      <div className={`money-banner ${overBudget ? 'warn' : 'good'}`}>
        {plan.weeklyBudget <= 0
          ? '👋 เริ่มต้นด้วยการกรอกเงินเดือนและค่าใช้จ่ายคงที่ในแท็บ "ตั้งค่า" แล้วระบบจะวางแผนงบรายสัปดาห์ให้อัตโนมัติ'
          : overBudget
            ? `⚠️ สัปดาห์นี้ใช้ไปแล้ว ${THB(weekly[7].value)} จากงบ ${THB(plan.weeklyBudget)} — เหลือใช้ได้อีก ${THB(Math.max(plan.weeklyBudget - weekly[7].value, 0))}`
            : `✅ สัปดาห์นี้ใช้ไป ${THB(weekly[7].value)} จากงบ ${THB(plan.weeklyBudget)} — ยังเหลือ ${THB(plan.weeklyBudget - weekly[7].value)}`}
      </div>

      <div className="admin-grid">
        <div className="admin-card admin-card-center">
          <div className="admin-card-head">
            <h4>รายจ่ายเดือนนี้แยกตามหมวด</h4>
            <ChartTypeSwitch value={catChart} onChange={setCatChart} types={['donut', 'hbar', 'column']} />
          </div>
          {byCategory.length === 0 ? <p className="admin-empty">ยังไม่มีรายจ่ายในเดือนนี้</p> : (
            <>
              <Chart type={catChart} data={byCategory} colors={PALETTE} unit="บาท" valueLabel={THB} />
              {catChart === 'donut' && (
                <div className="admin-legend">
                  {byCategory.map((d, i) => (
                    <span key={d.label}><i style={{ background: PALETTE[i % PALETTE.length] }} /> {d.label}: {THB(d.value)}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="admin-card">
          <div className="admin-card-head">
            <h4>รายจ่ายรายเดือน (6 เดือนล่าสุด)</h4>
            <ChartTypeSwitch value={trendChart} onChange={setTrendChart} types={['line', 'column', 'hbar']} />
          </div>
          {monthExpense.length === 0 ? <p className="admin-empty">ยังไม่มีข้อมูล</p> : (
            <Chart type={trendChart} data={monthExpense} colors={['#e8194a']} valueLabel={THB} />
          )}
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: 16 }}>
        <h4>รายจ่ายที่ปรับลดได้ 8 สัปดาห์ล่าสุด (เส้นงบ = {THB(plan.weeklyBudget)}/สัปดาห์)</h4>
        <Chart type="column" data={weekly} colors={weekly.map((w) => (plan.weeklyBudget > 0 && w.value > plan.weeklyBudget ? '#e8194a' : '#2e7d52'))} valueLabel={THB} />
      </div>
    </div>
  )
}
