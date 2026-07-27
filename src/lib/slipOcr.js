// อ่านสลิปโอนเงินจากรูปภาพด้วย OCR (tesseract.js ทำงานฝั่งเบราว์เซอร์ ไม่ต้องส่งรูปขึ้นเซิร์ฟเวอร์)
// แล้วแกะข้อความออกมาเป็น จำนวนเงิน / วันที่ / เวลา / เลขอ้างอิง / ผู้โอน / ผู้รับ / ธนาคาร

/* ---------- เตรียมรูปก่อนส่งเข้า OCR ---------- */

const MAX_SIDE = 1600

// ย่อรูปให้ด้านยาวไม่เกิน 1600px + แปลงเป็นขาวดำและเพิ่มคอนทราสต์ ช่วยให้ OCR อ่านตัวเลขแม่นขึ้นและเร็วขึ้น
export async function preprocessImage(file) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(MAX_SIDE / Math.max(bitmap.width, bitmap.height), 1)
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()

  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    // grayscale ตามน้ำหนักความสว่างที่ตามนุษย์รับรู้
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    // ดันคอนทราสต์รอบ ๆ ค่ากลาง เพื่อให้ตัวอักษรคมขึ้นแต่ไม่ถึงกับตัดขาวดำทิ้งรายละเอียด
    const v = Math.max(0, Math.min(255, (g - 128) * 1.45 + 128))
    d[i] = d[i + 1] = d[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)

  return { canvas, width: w, height: h, dataUrl: canvas.toDataURL('image/jpeg', 0.9) }
}

/* ---------- OCR ---------- */

let workerPromise = null

// สร้าง worker ครั้งเดียวแล้วใช้ซ้ำ (ครั้งแรกต้องโหลดโมเดลภาษา ~ไม่กี่ MB จึงช้ากว่าครั้งถัดไป)
// paths: ปกติ tesseract.js โหลด worker/core/โมเดลภาษา จาก CDN — ใส่ค่านี้ถ้าต้องการโฮสต์ไฟล์เอง
// เช่น { langPath: '/tessdata', workerPath: '/tesseract/worker.min.js', corePath: '/tesseract' }
async function getWorker(langs, onProgress, paths = {}) {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js')
      return createWorker(langs, 1, {
        ...paths,
        logger: (m) => {
          if (m.status === 'recognizing text') onProgress?.({ stage: 'อ่านข้อความ', progress: m.progress })
          else onProgress?.({ stage: 'เตรียมตัวอ่าน (ครั้งแรกใช้เวลาโหลดโมเดล)', progress: m.progress })
        },
      })
    })().catch((e) => {
      workerPromise = null
      throw e
    })
  }
  return workerPromise
}

export async function terminateOcr() {
  if (!workerPromise) return
  const w = await workerPromise.catch(() => null)
  workerPromise = null
  await w?.terminate?.()
}

// อ่านสลิป 1 ใบ → { text, parsed, preview }
export async function readSlip(file, { langs = 'tha+eng', paths, onProgress } = {}) {
  onProgress?.({ stage: 'เตรียมรูปภาพ', progress: 0 })
  const pre = await preprocessImage(file)

  let text = ''
  try {
    const worker = await getWorker(langs, onProgress, paths)
    const { data } = await worker.recognize(pre.canvas)
    text = data.text || ''
  } catch (e) {
    // ถ้าโมเดลภาษาไทยโหลดไม่ได้ (เน็ตช้า/บล็อก CDN) ลองใหม่ด้วยอังกฤษอย่างเดียว — ตัวเลขยังอ่านได้
    if (langs !== 'eng') {
      await terminateOcr()
      const worker = await getWorker('eng', onProgress, paths)
      const { data } = await worker.recognize(pre.canvas)
      text = data.text || ''
    } else {
      throw e
    }
  }

  onProgress?.({ stage: 'แกะข้อมูลจากสลิป', progress: 1 })
  return { text, parsed: parseSlipText(text), preview: pre.dataUrl }
}

/* ---------- แกะข้อความสลิปเป็นข้อมูล ---------- */

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙'
const THAI = '\\u0E00-\\u0E7F'
// สระบน/ล่าง/วรรณยุกต์ — OCR มักอ่านเพี้ยนหรือใส่เกิน ตัดทิ้งได้เวลาเทียบชื่อเดือน
const THAI_MARKS = /[ัิ-ฺ็-๎]/g
// tesseract โมเดลภาษาไทยมักแทรกช่องว่างระหว่างตัวอักษรทุกตัว ("จ า ก" แทน "จาก") — ต้องยุบกลับก่อนจับ pattern
const CONDENSE = new RegExp(`([${THAI}.])[ \\t]+(?=[${THAI}.])`, 'g')

export const condenseThai = (s) => String(s || '').replace(CONDENSE, '$1')
export const stripThaiMarks = (s) => String(s || '').replace(THAI_MARKS, '')

// ทำความสะอาดข้อความจาก OCR ก่อนนำไปจับ pattern
export function normalizeText(raw) {
  let t = String(raw || '')
  t = t.replace(/[๐-๙]/g, (c) => String(THAI_DIGITS.indexOf(c)))
  t = t.replace(/​/g, '')
  t = t.replace(/[’'`]/g, '')
  t = t.replace(/[ \t]+/g, ' ')
  return condenseThai(t)
}

const BANKS = [
  { re: /(kbank|k\s?plus|kasikorn|กสิกร)/i, name: 'กสิกรไทย (KBank)' },
  { re: /(scb|siam commercial|ไทยพาณิชย์|easy)/i, name: 'ไทยพาณิชย์ (SCB)' },
  { re: /(bualuang|bangkok bank|bbl|กรุงเทพ)/i, name: 'กรุงเทพ (BBL)' },
  { re: /(krungthai|ktb|next|กรุงไทย|เป๋าตัง)/i, name: 'กรุงไทย (KTB)' },
  { re: /(krungsri|ayudhya|กรุงศรี)/i, name: 'กรุงศรีอยุธยา' },
  { re: /(ttb|thanachart|tmb|ทหารไทย|ธนชาต)/i, name: 'ทีทีบี (ttb)' },
  { re: /(gsb|ออมสิน)/i, name: 'ออมสิน (GSB)' },
  { re: /(ibank|islamic|อิสลาม)/i, name: 'อิสลามแห่งประเทศไทย (ibank)' },
  { re: /(baac|ธ\.?ก\.?ส|เกษตร)/i, name: 'ธ.ก.ส. (BAAC)' },
  { re: /(truemoney|true wallet|ทรูมันนี)/i, name: 'TrueMoney Wallet' },
  { re: /(promptpay|พร้อมเพย)/i, name: 'พร้อมเพย์ (PromptPay)' },
]

const TH_MONTH_RE = {
  'ม.ค': 1, มค: 1, jan: 1,
  'ก.พ': 2, กพ: 2, feb: 2,
  'มี.ค': 3, มีค: 3, mar: 3,
  'เม.ย': 4, เมย: 4, apr: 4,
  'พ.ค': 5, พค: 5, may: 5,
  'มิ.ย': 6, มิย: 6, jun: 6,
  'ก.ค': 7, กค: 7, jul: 7,
  'ส.ค': 8, สค: 8, aug: 8,
  'ก.ย': 9, กย: 9, sep: 9,
  'ต.ค': 10, ตค: 10, oct: 10,
  'พ.ย': 11, พย: 11, nov: 11,
  'ธ.ค': 12, ธค: 12, dec: 12,
}

const pad = (n) => String(n).padStart(2, '0')

// ปีใน พ.ศ. (2568) หรือ 2 หลัก (68) → ค.ศ.
function normalizeYear(y) {
  let n = Number(y)
  if (n < 100) n += n > 50 ? 2500 : 2000 // 68 → 2568, 26 → 2026
  if (n > 2400) n -= 543
  return n
}

// หาวันที่จากข้อความสลิป รองรับ 27/07/2568, 27 ก.ค. 68, 27 Jul 2025, 2025-07-27
export function extractDate(text) {
  const t = normalizeText(text)

  const iso = t.match(/\b(20\d{2}|25\d{2})-(\d{1,2})-(\d{1,2})\b/)
  if (iso) return `${normalizeYear(iso[1])}-${pad(iso[2])}-${pad(iso[3])}`

  const slash = t.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-]((?:25|20)?\d{2})\b/)
  if (slash) {
    const d = Number(slash[1])
    const m = Number(slash[2])
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) return `${normalizeYear(slash[3])}-${pad(m)}-${pad(d)}`
  }

  // "27 ก.ค. 68" / "15 Jan 2026" — ตัดสระ/วรรณยุกต์ที่ OCR แถมมาออกก่อนเทียบชื่อเดือน
  const named = stripThaiMarks(t).match(/(\d{1,2})\s*([ก-ฮ]\s*\.?\s*[ก-ฮ]?\s*\.?|[A-Za-z]{3,9})\s*\.?\s*((?:25|20)?\d{2})\b/)
  if (named) {
    const key = named[2].toLowerCase().replace(/[\s.]/g, '')
    const m = TH_MONTH_RE[key] || TH_MONTH_RE[key.slice(0, 3)]
    const day = Number(named[1])
    if (m && day >= 1 && day <= 31) return `${normalizeYear(named[3])}-${pad(m)}-${pad(day)}`
  }
  return ''
}

export function extractTime(text) {
  const m = normalizeText(text).match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)(?:[:.]([0-5]\d))?\s*(น\.?|am|pm)?/i)
  if (!m) return ''
  let h = Number(m[1])
  const suffix = (m[4] || '').toLowerCase()
  if (suffix === 'pm' && h < 12) h += 12
  if (suffix === 'am' && h === 12) h = 0
  return `${pad(h)}:${m[2]}`
}

// เลขอ้างอิงรายการ — ใช้กันบันทึกสลิปใบเดิมซ้ำ
export function extractRef(text) {
  const t = normalizeText(text)
  const labeled = t.match(/(?:เลขที่รายการ|รหัสอ้างอิง|เลขอ้างอิง|รายการเลขที่|ref(?:erence)?(?:\s*(?:no|code|id))?|transaction\s*(?:no|id))\s*[:：#]?\s*([A-Z0-9]{6,30})/i)
  if (labeled) return labeled[1].toUpperCase()
  const bare = t.match(/\b(?=[A-Z0-9]*\d)[A-Z0-9]{12,30}\b/)
  return bare ? bare[1] || bare[0] : ''
}

export function extractBank(text) {
  const t = normalizeText(text)
  const hit = BANKS.find((b) => b.re.test(t))
  return hit ? hit.name : ''
}

const AMOUNT_RE = /(\d{1,3}(?:[,\s]\d{3})+(?:\.\d{1,2})?|\d+\.\d{2}|\d{1,7})/g
const FEE_WORDS = /(ค่าธรรมเนียม|ธรรมเนียม|fee|charge|ค่าบริการ)/i
const AMOUNT_WORDS = /(จำนวน|จํานวน|จำนวนเงิน|ยอดเงิน|ยอดโอน|โอนเงิน|amount|total|thb|บาท)/i
const BALANCE_WORDS = /(ยอดคงเหลือ|คงเหลือ|balance|available)/i
const ACCOUNT_WORDS = /(เลขที่บัญชี|บัญชี|account|x{3,}|xxx)/i

const toNumber = (s) => Number(String(s).replace(/[,\s]/g, ''))

// หายอดเงินของสลิป: ให้คะแนนตัวเลขแต่ละตัวจากคำรอบ ๆ แล้วเลือกตัวที่น่าจะเป็น "จำนวนเงินที่โอน" ที่สุด
export function extractAmount(text) {
  const lines = normalizeText(text).split(/\r?\n/)
  const candidates = []

  lines.forEach((line, li) => {
    const isFee = FEE_WORDS.test(line)
    const isBalance = BALANCE_WORDS.test(line)
    const isAccount = ACCOUNT_WORDS.test(line)
    const hasAmountWord = AMOUNT_WORDS.test(line)
    const prevLine = lines[li - 1] || ''

    let m
    AMOUNT_RE.lastIndex = 0
    while ((m = AMOUNT_RE.exec(line))) {
      const raw = m[1]
      const value = toNumber(raw)
      if (!isFinite(value) || value <= 0 || value > 100000000) continue

      // ตัวเลขยาว ๆ ไม่มีจุดทศนิยม มักเป็นเลขบัญชี/เลขอ้างอิง ไม่ใช่จำนวนเงิน
      const hasDecimals = /\.\d{2}$/.test(raw)
      const digits = raw.replace(/\D/g, '').length
      if (!hasDecimals && digits >= 9) continue
      if (isAccount && !hasDecimals) continue

      let score = 0
      if (hasDecimals) score += 4
      if (/[,\s]\d{3}/.test(raw)) score += 2
      if (hasAmountWord) score += 3
      if (AMOUNT_WORDS.test(prevLine) && !hasAmountWord) score += 1
      if (/บาท|thb/i.test(line)) score += 2
      if (isFee) score -= 8
      if (isBalance) score -= 6
      if (isAccount) score -= 3
      // สลิปส่วนใหญ่วางยอดโอนไว้ครึ่งบนของภาพ
      if (li < lines.length / 2) score += 1

      // ตัวเลขที่จะเสนอเป็น "ยอดสำรอง" ให้ผู้ใช้เลือก ต้องดูเหมือนจำนวนเงินจริง ๆ
      // (มีทศนิยม / มีคอมมาคั่นหลักพัน / อยู่บรรทัดที่พูดถึงจำนวนเงิน) ไม่ใช่เลขวันที่หรือเวลา
      const plausible = hasDecimals || /[,\s]\d{3}/.test(raw) || hasAmountWord
      candidates.push({ value, raw, score, isFee, isBalance, plausible, line: line.trim() })
    }
  })

  if (!candidates.length) return { amount: 0, fee: 0, candidates: [] }

  const main = candidates
    .filter((c) => !c.isFee)
    .sort((a, b) => b.score - a.score || b.value - a.value)[0] || candidates[0]

  const feeHit = candidates.filter((c) => c.isFee).sort((a, b) => a.value - b.value)[0]

  return {
    amount: main ? main.value : 0,
    fee: feeHit ? feeHit.value : 0,
    // เก็บตัวเลือกอื่นไว้ให้ผู้ใช้กดสลับได้ ถ้า OCR เดาผิด
    candidates: [...new Map(
      candidates
        .filter((c) => !c.isFee && (c.plausible || c === main))
        .sort((a, b) => b.score - a.score)
        .map((c) => [c.value, c])
    ).values()].slice(0, 6),
  }
}

const NAME_CLEAN = /[^ก-๙a-zA-Z\s.]/g

// ดึงชื่อผู้โอน/ผู้รับ จากบรรทัดที่ขึ้นต้นด้วย จาก/ไปยัง/From/To
export function extractParties(text) {
  const lines = normalizeText(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const grab = (re) => {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(re)
      if (!m) continue
      const rest = lines[i].slice(m.index + m[0].length).replace(NAME_CLEAN, ' ').trim()
      if (rest.length >= 3) return rest
      const next = (lines[i + 1] || '').replace(NAME_CLEAN, ' ').trim()
      if (next.length >= 3) return next
    }
    return ''
  }
  return {
    from: grab(/^(จาก|ผู้โอน|from)\s*[:：]?/i),
    to: grab(/^(ไปยัง|ไปที่|ผู้รับ|เข้าบัญชี|to)\s*[:：]?/i),
  }
}

// แกะสลิปทั้งใบ → ข้อมูลพร้อมกรอกลงฟอร์ม
export function parseSlipText(text) {
  const { amount, fee, candidates } = extractAmount(text)
  const { from, to } = extractParties(text)
  const date = extractDate(text)
  const parsed = {
    amount,
    fee,
    amountOptions: candidates.map((c) => c.value),
    date,
    time: extractTime(text),
    ref: extractRef(text),
    bank: extractBank(text),
    from,
    to,
  }
  // ความมั่นใจคร่าว ๆ ว่าแกะได้ครบแค่ไหน — ใช้เตือนผู้ใช้ว่าควรตรวจก่อนบันทึก
  const got = [amount > 0, Boolean(date), Boolean(parsed.time), Boolean(parsed.ref), Boolean(parsed.bank)].filter(Boolean).length
  parsed.confidence = Math.round((got / 5) * 100)
  return parsed
}
