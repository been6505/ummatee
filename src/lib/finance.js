// ฟังก์ชันคำนวณการเงินทั้งหมดของแอปบันทึกรายรับ-รายจ่าย (/admin/money)
// เป็นฟังก์ชันบริสุทธิ์ล้วน ๆ ไม่ยุ่งกับ Firestore หรือ React เพื่อให้ทดสอบ/นำไปใช้ซ้ำได้ง่าย

import { isFixedCategory, categoryInfo } from '../data/moneyCategories.js'

// จำนวนสัปดาห์เฉลี่ยต่อเดือน (365.25 / 12 / 7) — ใช้เกลี่ยยอดรายเดือนเป็นรายสัปดาห์
export const WEEKS_PER_MONTH = 4.348

export const THB = (n) =>
  '฿' + Math.round(Number(n) || 0).toLocaleString('th-TH')

// แสดงทศนิยม 2 ตำแหน่งเมื่อจำเป็น (ใช้กับยอดที่อ่านจากสลิป)
export const THB2 = (n) => {
  const v = Number(n) || 0
  return '฿' + v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/* ---------- วันที่ (ใช้สตริง YYYY-MM-DD เป็นหลัก เลี่ยงปัญหา timezone) ---------- */

export const toISO = (d) => {
  const dt = d instanceof Date ? d : new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export const todayStr = () => toISO(new Date())

export const parseISO = (s) => {
  const [y, m, d] = String(s || '').split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export const addDays = (dateOrStr, n) => {
  const d = dateOrStr instanceof Date ? new Date(dateOrStr) : parseISO(dateOrStr)
  d.setDate(d.getDate() + n)
  return d
}

// สัปดาห์เริ่มวันจันทร์ (ตามที่คนไทยใช้กันทั่วไปในการวางแผนรายสัปดาห์)
export const startOfWeek = (dateOrStr) => {
  const d = dateOrStr instanceof Date ? new Date(dateOrStr) : parseISO(dateOrStr)
  const shift = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - shift)
  d.setHours(0, 0, 0, 0)
  return d
}

export const daysInMonth = (year, monthIdx) => new Date(year, monthIdx + 1, 0).getDate()

const TH_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

export const thaiDate = (s) => {
  const d = parseISO(s)
  return `${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear() + 543).slice(-2)}`
}

export const thaiDayName = (s) => TH_DAYS[parseISO(s).getDay()]

export const thaiMonthLabel = (ym) => {
  const [y, m] = String(ym).split('-')
  return `${TH_MONTHS_SHORT[Number(m) - 1]} ${String(Number(y) + 543).slice(-2)}`
}

/* ---------- ค่าตั้งต้นของการตั้งค่า ---------- */

export const DEFAULT_SETTINGS = {
  salary: 0,              // เงินเดือน (บาท/เดือน)
  payday: 25,             // วันที่เงินเดือนออก (1-31)
  openingBalance: 0,      // เงินตั้งต้นในบัญชี ก่อนเริ่มบันทึกรายการ
  savingPercent: 10,      // เป้าหมายเก็บออม (% ของรายรับ)
  donationPercent: 2.5,   // เป้าหมายบริจาค/เศาะดะเกาะฮ์ (% ของรายรับ)
  zakatAssets: 0,         // ทรัพย์สินที่ถือครบรอบปี (เงินสด/เงินฝาก/ทอง) สำหรับคำนวณซะกาต
  goldPricePerGram: 3000, // ราคาทองคำ (บาท/กรัม) ใช้คำนวณนิศอบ
  fixedCosts: [],         // [{ id, name, amount, dueDay, category }]
}

export const withDefaults = (s) => ({ ...DEFAULT_SETTINGS, ...(s || {}) })

/* ---------- สรุปรายรับ-รายจ่าย ---------- */

const num = (v) => Number(v) || 0
const inRange = (t, from, to) => (!from || t.date >= from) && (!to || t.date <= to)

// สรุปยอดในช่วงวันที่ที่กำหนด (from/to เป็น YYYY-MM-DD, ใส่หรือไม่ใส่ก็ได้)
export function summarize(txs, from, to) {
  const rows = (txs || []).filter((t) => inRange(t, from, to))
  const income = rows.filter((t) => t.type === 'income').reduce((s, t) => s + num(t.amount), 0)
  const expense = rows.filter((t) => t.type === 'expense').reduce((s, t) => s + num(t.amount), 0)

  const byCategory = {}
  rows.forEach((t) => {
    const k = `${t.type}:${t.category || 'other'}`
    byCategory[k] = (byCategory[k] || 0) + num(t.amount)
  })

  return { rows, income, expense, net: income - expense, byCategory, count: rows.length }
}

// ยอดคงเหลือปัจจุบัน = เงินตั้งต้น + รายรับทั้งหมด − รายจ่ายทั้งหมด
export function currentBalance(txs, settings) {
  const s = withDefaults(settings)
  const all = summarize(txs)
  return num(s.openingBalance) + all.net
}

export const fixedCostTotal = (fixedCosts) =>
  (fixedCosts || []).reduce((s, f) => s + num(f.amount), 0)

// ค่าใช้จ่ายที่ "ยืดหยุ่นได้" = รายจ่ายที่ไม่ได้อยู่ในหมวดค่าคงที่ (กิน/เดินทาง/ช้อปปิ้ง ฯลฯ)
export const isVariableExpense = (t) => t.type === 'expense' && !isFixedCategory(t.category)

// ค่าเฉลี่ยรายจ่ายยืดหยุ่นต่อสัปดาห์ ย้อนหลัง N สัปดาห์ (ไม่นับสัปดาห์ปัจจุบันที่ยังไม่จบ)
export function averageWeeklyVariable(txs, refDate = todayStr(), weeks = 8) {
  const thisWeekStart = startOfWeek(refDate)
  const from = toISO(addDays(thisWeekStart, -7 * weeks))
  const to = toISO(addDays(thisWeekStart, -1))
  const rows = (txs || []).filter((t) => isVariableExpense(t) && inRange(t, from, to))
  if (!rows.length) return { avg: 0, weeks: 0, total: 0 }

  // นับเฉพาะสัปดาห์ที่มีการบันทึกจริง เพื่อไม่ให้ค่าเฉลี่ยเพี้ยนตอนเพิ่งเริ่มใช้แอป
  const seen = new Set(rows.map((t) => toISO(startOfWeek(t.date))))
  const total = rows.reduce((s, t) => s + num(t.amount), 0)
  return { avg: total / seen.size, weeks: seen.size, total }
}

// รายรับอื่นนอกเหนือเงินเดือน เฉลี่ยต่อเดือน (ย้อนหลัง 3 เดือน)
export function averageExtraIncome(txs, refDate = todayStr(), months = 3) {
  const d = parseISO(refDate)
  const from = toISO(new Date(d.getFullYear(), d.getMonth() - months, 1))
  const to = toISO(new Date(d.getFullYear(), d.getMonth(), 0))
  const rows = (txs || []).filter((t) => t.type === 'income' && t.category !== 'salary' && inRange(t, from, to))
  if (!rows.length) return 0
  return rows.reduce((s, t) => s + num(t.amount), 0) / months
}

/* ---------- ค่าใช้จ่ายคงที่ที่ครบกำหนดในช่วงวัน ---------- */

// แปลง "วันที่ครบกำหนดของเดือน" เป็นวันจริงในเดือนนั้น (เช่น 31 ในเดือน ก.พ. → 28/29)
export function dueDateInMonth(dueDay, year, monthIdx) {
  const day = Math.min(Math.max(Number(dueDay) || 1, 1), daysInMonth(year, monthIdx))
  return toISO(new Date(year, monthIdx, day))
}

// รายการค่าคงที่/เงินเดือน ที่ตกอยู่ในช่วง [from, to]
export function dueBetween(dueDay, from, to) {
  const start = parseISO(from)
  const end = parseISO(to)
  const hits = []
  // เดินทีละเดือนตั้งแต่เดือนของ from ถึงเดือนของ to (ช่วงสัปดาห์คร่อมได้มากสุด 2 เดือน)
  for (let y = start.getFullYear(), m = start.getMonth(); y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth()); ) {
    const iso = dueDateInMonth(dueDay, y, m)
    if (iso >= from && iso <= to) hits.push(iso)
    m += 1
    if (m > 11) { m = 0; y += 1 }
  }
  return hits
}

/* ---------- แผนการเงินสัปดาห์ถัดไป ---------- */

// สร้างแผนใช้จ่ายของสัปดาห์ถัดไป (จันทร์–อาทิตย์) จากเงินเดือน ค่าคงที่ และพฤติกรรมการใช้จ่ายย้อนหลัง
export function buildWeeklyPlan({ txs = [], settings, refDate = todayStr() } = {}) {
  const s = withDefaults(settings)
  const start = toISO(addDays(startOfWeek(refDate), 7))
  const end = toISO(addDays(start, 6))

  // 1) รายรับที่คาดว่าจะเข้าในสัปดาห์นี้ (เงินเดือนถ้าวันจ่ายตรงกับสัปดาห์นี้)
  const paydays = num(s.salary) > 0 ? dueBetween(s.payday, start, end) : []
  const salaryIn = paydays.length * num(s.salary)

  // 2) ค่าคงที่ที่ครบกำหนดในสัปดาห์นี้
  const fixedDueItems = []
  ;(s.fixedCosts || []).forEach((f) => {
    dueBetween(f.dueDay, start, end).forEach((date) => {
      fixedDueItems.push({ date, name: f.name, amount: num(f.amount), category: f.category })
    })
  })
  const fixedDue = fixedDueItems.reduce((sum, f) => sum + f.amount, 0)

  // 3) งบต่อสัปดาห์ตามหลักการ: (รายรับเดือน − ค่าคงที่เดือน − ออม − บริจาค) เกลี่ยเป็นรายสัปดาห์
  const extraIncome = averageExtraIncome(txs, refDate)
  const monthlyIncome = num(s.salary) + extraIncome
  const monthlyFixed = fixedCostTotal(s.fixedCosts)
  const monthlySaving = (monthlyIncome * num(s.savingPercent)) / 100
  const monthlyDonation = (monthlyIncome * num(s.donationPercent)) / 100
  const monthlySpendable = monthlyIncome - monthlyFixed - monthlySaving - monthlyDonation

  const weeklyBudget = Math.max(monthlySpendable / WEEKS_PER_MONTH, 0)
  const dailyBudget = weeklyBudget / 7
  const weeklySaving = monthlySaving / WEEKS_PER_MONTH
  const weeklyDonation = monthlyDonation / WEEKS_PER_MONTH

  // 4) เทียบกับพฤติกรรมจริงย้อนหลัง
  const history = averageWeeklyVariable(txs, refDate)
  const lastWeekStart = toISO(addDays(startOfWeek(refDate), -7))
  const lastWeek = (txs || [])
    .filter((t) => isVariableExpense(t) && inRange(t, lastWeekStart, toISO(addDays(startOfWeek(refDate), -1))))
    .reduce((sum, t) => sum + num(t.amount), 0)

  // 5) กระแสเงินสด: ยอดคงเหลือวันนี้ → คาดการณ์ปลายสัปดาห์หน้า
  const balanceNow = currentBalance(txs, s)
  const daysUntilPlan = Math.max(Math.round((parseISO(start) - parseISO(refDate)) / 86400000), 0)
  const burnBeforePlan = dailyBudget * daysUntilPlan
  const projectedEnd = balanceNow - burnBeforePlan + salaryIn - fixedDue - weeklyBudget - weeklySaving - weeklyDonation

  // 6) ตารางรายวัน 7 วัน
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = toISO(addDays(start, i))
    const items = fixedDueItems.filter((f) => f.date === date)
    return {
      date,
      dayName: thaiDayName(date),
      label: thaiDate(date),
      isPayday: paydays.includes(date),
      fixedItems: items,
      fixedTotal: items.reduce((sum, f) => sum + f.amount, 0),
      allowance: dailyBudget,
    }
  })

  return {
    start,
    end,
    days,
    paydays,
    salaryIn,
    extraIncome,
    monthlyIncome,
    monthlyFixed,
    monthlySaving,
    monthlyDonation,
    monthlySpendable,
    fixedDueItems,
    fixedDue,
    weeklyBudget,
    dailyBudget,
    weeklySaving,
    weeklyDonation,
    avgWeeklySpend: history.avg,
    historyWeeks: history.weeks,
    lastWeekSpend: lastWeek,
    balanceNow,
    projectedEnd,
    tips: buildTips({ s, weeklyBudget, dailyBudget, history, lastWeek, monthlySpendable, monthlyIncome, monthlyFixed, fixedDue, salaryIn, balanceNow, projectedEnd, txs, refDate }),
  }
}

// คำแนะนำเป็นข้อความภาษาไทย จากตัวเลขที่คำนวณได้ (level: good | warn | danger | info)
function buildTips(ctx) {
  const { s, weeklyBudget, dailyBudget, history, lastWeek, monthlySpendable, monthlyIncome, monthlyFixed, fixedDue, salaryIn, projectedEnd, txs, refDate } = ctx
  const tips = []

  if (monthlyIncome <= 0) {
    tips.push({ level: 'info', text: 'ยังไม่ได้ตั้งค่าเงินเดือน — ไปที่แท็บ "ตั้งค่า" เพื่อกรอกเงินเดือนและค่าใช้จ่ายคงที่ แล้วระบบจะคำนวณงบรายสัปดาห์ให้อัตโนมัติ' })
    return tips
  }

  const fixedRatio = (monthlyFixed / monthlyIncome) * 100
  if (fixedRatio > 50) {
    tips.push({ level: 'danger', text: `ค่าใช้จ่ายคงที่กินรายรับถึง ${fixedRatio.toFixed(0)}% (แนะนำไม่เกิน 50%) — ลองทบทวนค่าเช่า/ค่าผ่อน หรือหารายรับเพิ่ม` })
  } else if (fixedRatio > 0) {
    tips.push({ level: 'good', text: `ค่าใช้จ่ายคงที่อยู่ที่ ${fixedRatio.toFixed(0)}% ของรายรับ ถือว่าอยู่ในเกณฑ์ที่จัดการได้` })
  }

  if (monthlySpendable <= 0) {
    tips.push({ level: 'danger', text: 'รายรับหักค่าคงที่ เป้าออม และเป้าบริจาคแล้วติดลบ — ลดเป้าออม/บริจาคชั่วคราว หรือตัดค่าใช้จ่ายคงที่ลงก่อน' })
  }

  if (history.weeks > 0) {
    const diff = history.avg - weeklyBudget
    if (diff > 0) {
      tips.push({ level: 'warn', text: `${history.weeks} สัปดาห์ที่ผ่านมาใช้จ่ายเฉลี่ย ${THB(history.avg)}/สัปดาห์ เกินงบ ${THB(diff)} — ต้องลดวันละประมาณ ${THB(diff / 7)} จึงจะอยู่ในแผน` })
    } else {
      tips.push({ level: 'good', text: `ใช้จ่ายเฉลี่ย ${THB(history.avg)}/สัปดาห์ ต่ำกว่างบ ${THB(-diff)} — ถ้ารักษาระดับนี้ได้ เดือนหน้าจะมีเงินเหลือเพิ่มราว ${THB(-diff * WEEKS_PER_MONTH)}` })
    }
  } else {
    tips.push({ level: 'info', text: 'ยังไม่มีประวัติการใช้จ่ายมากพอ — บันทึกรายการต่อเนื่องอีก 1-2 สัปดาห์ ระบบจะเปรียบเทียบพฤติกรรมจริงกับงบให้' })
  }

  if (lastWeek > 0 && lastWeek > weeklyBudget * 1.2) {
    tips.push({ level: 'warn', text: `สัปดาห์ที่แล้วใช้ไป ${THB(lastWeek)} สูงกว่างบ ${((lastWeek / Math.max(weeklyBudget, 1) - 1) * 100).toFixed(0)}% — สัปดาห์หน้าตั้งเพดานวันละ ${THB(dailyBudget)} และเช็กยอดทุกคืน` })
  }

  if (fixedDue > 0) {
    tips.push({ level: 'info', text: `สัปดาห์หน้ามีบิลครบกำหนดรวม ${THB(fixedDue)} — กันเงินส่วนนี้ไว้ก่อน อย่าเอาไปรวมกับงบใช้จ่ายประจำวัน` })
  }
  if (salaryIn > 0) {
    tips.push({ level: 'good', text: `เงินเดือน ${THB(salaryIn)} จะเข้าในสัปดาห์หน้า — แนะนำโอนเข้าบัญชีออมและกันเงินบริจาคทันทีในวันที่เงินเข้า ก่อนเริ่มใช้จ่าย` })
  }

  if (projectedEnd < 0) {
    tips.push({ level: 'danger', text: `คาดว่าปลายสัปดาห์หน้าเงินจะติดลบ ${THB(-projectedEnd)} — เลื่อนรายจ่ายที่ไม่จำเป็นออกไปก่อน หรือหาเงินเข้าเพิ่ม` })
  } else if (projectedEnd < weeklyBudget) {
    tips.push({ level: 'warn', text: `คาดว่าปลายสัปดาห์หน้าจะเหลือ ${THB(projectedEnd)} ซึ่งน้อยกว่างบ 1 สัปดาห์ — ควรมีเงินสำรองอย่างน้อย ${THB(weeklyBudget)} ไว้เผื่อฉุกเฉิน` })
  }

  // หมวดที่ใช้เงินมากที่สุดในเดือนนี้
  const monthStart = refDate.slice(0, 7) + '-01'
  const monthRows = (txs || []).filter((t) => isVariableExpense(t) && t.date >= monthStart && t.date <= refDate)
  if (monthRows.length >= 3) {
    const byCat = {}
    monthRows.forEach((t) => { byCat[t.category] = (byCat[t.category] || 0) + (Number(t.amount) || 0) })
    const [topCat, topVal] = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]
    const totalVar = monthRows.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
    const pct = (topVal / totalVar) * 100
    if (pct >= 35) {
      tips.push({ level: 'warn', text: `เดือนนี้หมวด "${categoryInfo('expense', topCat).name}" กินไป ${pct.toFixed(0)}% ของรายจ่ายที่ปรับลดได้ (${THB(topVal)}) — ลดหมวดนี้ลง 20% จะประหยัดได้ราว ${THB(topVal * 0.2)} ต่อเดือน` })
    }
  }

  const emergencyTarget = (monthlyFixed + monthlySpendable) * 3
  if (emergencyTarget > 0 && ctx.balanceNow < emergencyTarget) {
    tips.push({ level: 'info', text: `เป้าเงินสำรองฉุกเฉิน 3 เดือน = ${THB(emergencyTarget)} ตอนนี้มี ${THB(ctx.balanceNow)} — เก็บเพิ่มเดือนละ ${THB(Math.max((emergencyTarget - ctx.balanceNow) / 12, 0))} จะครบใน 1 ปี` })
  }

  if (s.savingPercent < 10) {
    tips.push({ level: 'info', text: `ตอนนี้ตั้งเป้าออมไว้ ${s.savingPercent}% — ถ้าไหวลองขยับเป็น 10% จะได้เพิ่มเดือนละ ${THB((monthlyIncome * (10 - s.savingPercent)) / 100)}` })
  }

  return tips
}

/* ---------- คำแนะนำการบริจาค / ซะกาต ---------- */

// นิศอบ (เกณฑ์ขั้นต่ำที่ต้องจ่ายซะกาต) = ทองคำ 85 กรัม
export const NISAB_GOLD_GRAMS = 85
export const ZAKAT_RATE = 0.025

// คำนวณคำแนะนำการบริจาค: เศาะดะเกาะฮ์รายสัปดาห์/เดือน + ซะกาตประจำปี + ความสามารถในการจ่ายจริง
export function donationAdvice({ txs = [], settings, plan, refDate = todayStr() } = {}) {
  const s = withDefaults(settings)
  const p = plan || buildWeeklyPlan({ txs, settings: s, refDate })

  const monthlyTarget = p.monthlyDonation
  const weeklyTarget = p.weeklyDonation
  const dailyTarget = monthlyTarget / 30

  // ยอดที่บริจาคไปแล้วเดือนนี้ (หมวด "บริจาค/ซะกาต")
  const monthStart = refDate.slice(0, 7) + '-01'
  const givenThisMonth = (txs || [])
    .filter((t) => t.type === 'expense' && t.category === 'sadaqah' && t.date >= monthStart && t.date <= refDate)
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const givenThisYear = (txs || [])
    .filter((t) => t.type === 'expense' && t.category === 'sadaqah' && (t.date || '').slice(0, 4) === refDate.slice(0, 4))
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)

  const remaining = Math.max(monthlyTarget - givenThisMonth, 0)
  const progress = monthlyTarget > 0 ? Math.min((givenThisMonth / monthlyTarget) * 100, 100) : 0

  // ซะกาต: ทรัพย์สินที่ถือครบ 1 ปีจันทรคติ ถ้าถึงนิศอบต้องจ่าย 2.5%
  const nisab = NISAB_GOLD_GRAMS * (Number(s.goldPricePerGram) || 0)
  const assets = Number(s.zakatAssets) || 0
  const zakatDue = assets >= nisab && nisab > 0 ? assets * ZAKAT_RATE : 0

  // บริจาคได้จริงแค่ไหน โดยไม่กระทบงบใช้จ่าย
  const affordableWeekly = Math.max(Math.min(weeklyTarget, p.weeklyBudget + weeklyTarget), 0)
  const canAfford = p.projectedEnd >= weeklyTarget

  const messages = []
  if (monthlyTarget > 0) {
    messages.push(`เป้าบริจาคเดือนนี้ ${THB(monthlyTarget)} (${s.donationPercent}% ของรายรับ) — บริจาคไปแล้ว ${THB(givenThisMonth)}${remaining > 0 ? ` เหลืออีก ${THB(remaining)}` : ' ครบเป้าแล้ว มาชาอัลลอฮ์ 🤲'}`)
    messages.push(`เฉลี่ยแล้วประมาณ ${THB(weeklyTarget)} ต่อสัปดาห์ หรือวันละ ${THB(dailyTarget)} — ทยอยให้ทีละน้อยแต่สม่ำเสมอ ดีกว่าให้ก้อนใหญ่ครั้งเดียวแล้วหยุด`)
  } else {
    messages.push('ยังไม่ได้ตั้งเป้าบริจาค — แนะนำเริ่มที่ 2.5% ของรายรับ แล้วค่อย ๆ เพิ่มเมื่อพร้อม')
  }
  if (!canAfford && weeklyTarget > 0) {
    messages.push(`สัปดาห์หน้าเงินอาจตึง — บริจาคเท่าที่ไหวก่อน (เช่น ${THB(Math.max(p.projectedEnd * 0.1, 20))}) แล้วค่อยเติมให้ครบเมื่อเงินเดือนเข้า`)
  }
  if (zakatDue > 0) {
    messages.push(`ทรัพย์สินที่กรอกไว้ ${THB(assets)} ถึงเกณฑ์นิศอบ (${THB(nisab)}) แล้ว — ซะกาตที่ต้องจ่าย 2.5% = ${THB(zakatDue)} ต่อปี (จ่ายเมื่อถือครบ 1 ปีจันทรคติ)`)
  } else if (assets > 0 && nisab > 0) {
    messages.push(`ทรัพย์สิน ${THB(assets)} ยังไม่ถึงนิศอบ (${THB(nisab)}) จึงยังไม่ต้องจ่ายซะกาต — แต่เศาะดะเกาะฮ์ (บริจาคทั่วไป) ให้ได้ตลอดไม่มีขั้นต่ำ`)
  }

  // แผน "ให้ 100 ถึง 100" — ให้วันละ 100 บาท ต่อเนื่อง 100 วัน
  const give100 = {
    perDay: 100,
    days: 100,
    total: 10000,
    weekly: 700,
    fitsBudget: p.weeklyBudget >= 700,
  }

  return {
    monthlyTarget,
    weeklyTarget,
    dailyTarget,
    givenThisMonth,
    givenThisYear,
    remaining,
    progress,
    nisab,
    assets,
    zakatDue,
    canAfford,
    affordableWeekly,
    messages,
    give100,
  }
}

// เลือกบัญชีบริจาคของมูลนิธิที่เหมาะกับสถานการณ์ (ซะกาตต้องเข้าบัญชีซะกาตโดยเฉพาะ)
export function suggestAccounts(accounts, { zakatDue }) {
  const list = accounts || []
  const zakat = list.find((a) => a.en === 'Zakat')
  const picks = []
  if (zakatDue > 0 && zakat) picks.push({ ...zakat, reason: 'สำหรับจ่ายซะกาตโดยเฉพาะ (แยกจากเศาะดะเกาะฮ์ทั่วไป)' })
  const general = list.filter((a) => a.en !== 'Zakat').slice(0, 3)
  general.forEach((a) => picks.push({ ...a, reason: 'เศาะดะเกาะฮ์ทั่วไป — บริจาคเท่าไหร่ก็ได้ ไม่มีขั้นต่ำ' }))
  return picks
}
