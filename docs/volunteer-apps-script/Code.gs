// ══════════════════════════════════════════════════════════════════════
// Apps Script — แจ้งเตือน + ลงทะเบียน (Ummatee)  · ไฟล์เดียวจบ
//
// เคยแยกเป็น 7 ไฟล์ (Config/Main/AdminNotify/LineNotify/Volunteer/B2um/Iftar)
// แล้วรวมกลับมาไฟล์เดียว เพราะตอน deploy ต้องวางทีละไฟล์ในหน้าเว็บ Apps Script
// ซึ่งพลาดง่าย (วางไม่ครบ = ฟังก์ชันหาย, ลืมลบไฟล์เก่า = ชื่อซ้ำทับกัน)
// โครงข้างในยังแยกเป็นส่วนๆ ตามเดิม เลื่อนหาตามหัวข้อ ══ ได้
//
// สารบัญ
//   1. ตั้งค่า + ตัวช่วย        (SHEET_TOKEN, SCRIPT_VERSION, jsonOut, escapeHtml)
//   2. ตัวรับ request           (doGet / doPost / getHandler)
//   3. แจ้งเตือนแอดมิน          (handleAdminNotify)
//   3b. บันทึกออเดอร์ลงชีต + อีเมลหาแอดมิน + อีเมลยืนยันหาลูกค้า (handleOrderCreated)
//   4. LINE หาลูกค้า            (handleLineNotify)
//   5. สมัครอาสาสมัคร           (handleVolunteer + อีเมลยืนยัน)
//   6. B2UM                     (handleB2um)
//   7. Iftar For Gaza           (handleIftar + อีเมลยืนยัน) — action เริ่มต้นเมื่อไม่ส่ง type
// ══════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════
// ตั้งค่าและตัวช่วยที่ทุกไฟล์ใช้ร่วมกัน
//
// ⚠️ ไฟล์ .gs ทุกไฟล์ในโปรเจกต์ Apps Script เดียวกันใช้ global scope ร่วมกัน
// และถูกรวมเป็นสคริปต์เดียวตอนรัน ⇒ ลำดับไฟล์ไม่สำคัญ เรียกฟังก์ชันข้ามไฟล์ได้เลย
// เลขนำหน้าชื่อไฟล์มีไว้ให้คนอ่านเรียงตามลำดับความสำคัญเท่านั้น
// ══════════════════════════════════════════════════════════════════════

// ต้องตรงกับ GIVE_SHEET_TOKEN ใน src/utils/endpoints.js (client ส่งค่านี้มาใน data.token ทุก request)
var SHEET_TOKEN = 'umt-7Kp2xQ9mZr4Wv8Td'
var VOLUNTEER_SHEET_ID = '1HANcunEVvMQFSEY84WSS41jqmUPCm1QkfatX_xXiZj0'

// ไฟล์ชีตสำหรับ "คำสั่งซื้อ um-shop" โดยเฉพาะ (คนละไฟล์กับอาสาสมัคร/B2UM)
// บัญชีที่ตั้งเป็น "Execute as: Me" ต้องมีสิทธิ์แก้ไขไฟล์นี้ ไม่งั้น openById จะ error
// (ระบบจับ error ไว้แล้ว — อีเมลยังส่งได้ แต่จะได้ sheetLogged:false กลับมา)
var ORDERS_SHEET_ID = '1faTElS1S7j4lNpCoHzYl7RAP25c-MANV53-zy-L7-Tg'

// ขยับเลขนี้ทุกครั้งที่แก้แล้ว deploy ใหม่ — เปิด URL ของ Web App แล้วดูค่า version
// จะรู้ทันทีว่าโค้ดที่รันอยู่จริงเป็นชุดล่าสุดหรือยัง (เคยเจอปัญหาแก้แล้วแต่ deploy ไม่ขึ้น)
var SCRIPT_VERSION = '2026-07-31.7'

var ADMIN_EMAIL = 'ummatee.thailand@gmail.com'

/** ตอบกลับเป็น JSON เสมอ — ฝั่ง client เช็คว่า body ขึ้นต้นด้วย { เพื่อแยกจากหน้า error HTML ของ Google */
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}

/**
 * ตัดอักขระนอก BMP (อีโมจิ 4 ไบต์ เช่น 🛒 💰 ⚠️ 📦) ออกก่อนส่งอีเมล
 * Gmail แสดงตัวพวกนี้เป็น ?????? ในอีเมลข้อความล้วน ทั้งหัวเรื่องและเนื้อความ
 * (ภาษาไทยอยู่ใน BMP จึงไม่กระทบ) — ใช้เฉพาะทางอีเมล ส่วน LINE แสดงอีโมจิได้ปกติจึงไม่ตัด
 */
function emailSafe(s) {
  return String(s == null ? '' : s)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]+/gm, '')
    .trim()
}

/** ป้องกัน HTML/markup injection ในอีเมลจากฟิลด์ที่ผู้ใช้กรอกเอง */
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ══════════════════════════════════════════════════════════════════════
// ตัวรับ request และกระจายงาน (router) — ไม่มี logic ของงานใดงานหนึ่งในไฟล์นี้
// เพิ่มงานใหม่: สร้างไฟล์ handler แล้วมาเพิ่มบรรทัดใน HANDLERS
// ══════════════════════════════════════════════════════════════════════

// data.type → ฟังก์ชันที่รับผิดชอบ (นิยามอยู่ในไฟล์ของงานนั้นๆ)
// ไม่ประกาศเป็น object ตรงนี้เพราะฟังก์ชันในไฟล์อื่นอาจยังไม่ถูกนิยามตอนไฟล์นี้ถูกอ่าน
// ⇒ อ้างถึงตอนเรียกใช้จริงแทน (ดู doPost)
function getHandler(type) {
  if (type === 'adminNotify') return handleAdminNotify
  if (type === 'orderCreated') return handleOrderCreated
  if (type === 'orderShipped') return handleOrderShipped
  if (type === 'lineNotify') return handleLineNotify
  if (type === 'volunteer') return handleVolunteer
  if (type === 'b2um') return handleB2um
  return null
}

var HANDLER_TYPES = ['adminNotify', 'orderCreated', 'orderShipped', 'lineNotify', 'volunteer', 'b2um', '(default) iftar']

// ⚠️ ความปลอดภัย: doGet เดิม (token === SHEET_TOKEN) เปิดให้ใครก็ได้ที่รู้ token ดึง PII
// (ชื่อ/เบอร์/อีเมล/ที่อยู่) ของอาสาสมัครและผู้ลงทะเบียน Iftar ทั้งหมดออกไปได้ โดยไม่ต้องล็อกอิน
// เว็บเลย และ token นั้นก็ฝังอยู่ใน client bundle อยู่ดี — ปิดการอ่าน PII ผ่าน Apps Script ทั้งหมด
// อ่านข้อมูลผ่านหน้า /admin (Firestore + rules) เท่านั้น คงไว้แค่ count (ไม่มี PII)
function doGet(e) {
  if (e && e.parameter && e.parameter.count) {
    var ss = SpreadsheetApp.getActiveSpreadsheet()
    var sheet = ss.getSheetByName('Registrations') || ss.getActiveSheet()
    var lastRow = sheet.getLastRow()
    return jsonOut({ count: lastRow > 1 ? lastRow - 1 : 0 })
  }

  // สถานะการ deploy — ไม่มี PII และไม่ส่งอีเมลใดๆ ใช้ยืนยันว่า URL นี้รันโค้ดชุดไหนอยู่
  // (เคยเจอว่า endpoint ตอบ 405 เพราะสคริปต์ที่ deploy อยู่ไม่มี doPost เลย แต่ไม่มีอะไรบอก)
  return jsonOut({ ok: true, version: SCRIPT_VERSION, handlers: HANDLER_TYPES })
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents)

    // --- [ชั่วคราว] LINE Webhook event logger — ใช้หา ADMIN_LINE_USER_ID ครั้งเดียวตอนตั้งค่า ---
    // LINE ส่ง payload เป็น { events: [...] } ไม่มี data.token เลย เช็คก่อนโดน SHEET_TOKEN gate ด้านล่างปัดตก
    // เมื่อมีคนทัก OA จะ log userId ไว้ใน Executions ให้เอาไปตั้งเป็น Script Property — ลบ block นี้ทิ้งหลังใช้เสร็จ
    if (data.events) {
      data.events.forEach(function (ev) {
        Logger.log('LINE event type=' + ev.type + ' userId=' + (ev.source && ev.source.userId))
      })
      return jsonOut({ ok: true })
    }

    // ⚠️ ความปลอดภัย: ก่อนหน้านี้ endpoint นี้ไม่ตรวจ token เลยสักฟังก์ชัน — ใครก็ได้ที่เจอ URL นี้
    // (public constant ใน src/utils/endpoints.js) สามารถยิง POST ตรงมาสั่งส่งอีเมล/LINE ข้อความ
    // "ใดก็ได้" ถึงผู้รับ "ใดก็ได้" ผ่านบัญชี Gmail/LINE OA ของมูลนิธิ (adminNotify/lineNotify)
    // — เสี่ยงถูกใช้เป็น open relay สแปม/ฟิชชิ่งจนบัญชีโดนแบน ต้องตรวจ token ก่อนทำงานทุก action
    // (token เป็น public write-token — กันบอท/การเจอ URL มั่วๆ ไม่ใช่การยืนยันตัวตนจริงจัง
    // แต่ดีกว่าเปิดโล่งไม่มีอะไรกั้นเลย)
    if (data.token !== SHEET_TOKEN) {
      return jsonOut({ error: 'unauthorized' })
    }

    var handler = getHandler(data.type)
    if (handler) return handler(data)

    // ไม่ระบุ type = ลงทะเบียน Iftar (พฤติกรรมเดิมของ endpoint นี้ ห้ามเปลี่ยน —
    // ฟอร์ม Iftar ที่ deploy อยู่ยังยิงมาโดยไม่ส่ง type)
    return handleIftar(data)

  } catch (err) {
    return jsonOut({ error: err.message })
  }
}

// ══════════════════════════════════════════════════════════════════════
// แจ้งเตือนแอดมิน — ออเดอร์ใหม่ / ลูกค้าแจ้งชำระเงิน / สต็อกใกล้หมด (um-shop)
// ส่งอีเมลถึง ADMIN_EMAIL เสมอ + ส่ง LINE ด้วยถ้าตั้ง Script Properties ครบ
// (LINE_CHANNEL_ACCESS_TOKEN และ ADMIN_LINE_USER_ID = userId ของแอดมิน/กลุ่มที่ให้บอทแจ้ง)
// ══════════════════════════════════════════════════════════════════════
function handleAdminNotify(data) {
  var subj = data.subject || 'um-shop แจ้งเตือน'
  var msg = String(data.message || '').slice(0, 4000)
  if (!msg) return jsonOut({ error: 'missing message' })

  var mailed = false
  try {
    GmailApp.sendEmail(ADMIN_EMAIL, emailSafe(subj),
      emailSafe(msg) + '\n\nเปิดหน้าจัดการ: https://ummatee-app.web.app/admin/shop/orders')
    mailed = true
  } catch (mailErr) { Logger.log('adminNotify mail error: ' + mailErr.message) }

  var props = PropertiesService.getScriptProperties()
  var aToken = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN')
  var adminLineId = props.getProperty('ADMIN_LINE_USER_ID')
  var lined = false
  if (aToken && adminLineId) {
    try {
      var r = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + aToken },
        payload: JSON.stringify({ to: adminLineId, messages: [{ type: 'text', text: msg }] }),
        muteHttpExceptions: true,
      })
      lined = r.getResponseCode() === 200
    } catch (lineErr) { Logger.log('adminNotify line error: ' + lineErr.message) }
  }

  // บอกกลับว่าช่องไหนสำเร็จบ้าง — เดิมตอบ ok:true เสมอแม้อีเมลจะส่งไม่ออก
  return jsonOut({ ok: true, mailed: mailed, lined: lined })
}

// ══════════════════════════════════════════════════════════════════════
// 3b. บันทึกคำสั่งซื้อลง Google Sheet + ส่งอีเมลสรุปให้แอดมิน
//
// รับมาแค่ orderId แล้ว "อ่านออเดอร์จริงจาก Firestore เอง" — เหตุผลเดียวกับ handleLineNotify:
// SHEET_TOKEN เป็น token ฝั่ง client ที่ใครเปิด bundle ก็อ่านได้ ถ้ารับยอดเงิน/รายการสินค้า
// มาจากผู้เรียกตรงๆ ใครก็ปลอมออเดอร์ลงชีตและส่งอีเมลหลอกแอดมินได้
// (orders มี allow get: if true ⇒ อ่านทีละ doc ได้โดยไม่ต้องใช้ credential)
//
// ชีตเป็นสำเนาไว้ดู/ทำรายงาน — ตัวจริงอยู่ใน Firestore เสมอ
// ══════════════════════════════════════════════════════════════════════

/** อ่านค่าจาก Firestore REST value object ({stringValue|integerValue|doubleValue|...}) */
function fsVal(v) {
  if (!v) return ''
  if (v.stringValue !== undefined) return v.stringValue
  if (v.integerValue !== undefined) return Number(v.integerValue)
  if (v.doubleValue !== undefined) return Number(v.doubleValue)
  if (v.booleanValue !== undefined) return v.booleanValue
  if (v.timestampValue !== undefined) return v.timestampValue
  return ''
}

// ══════════════════════════════════════════════════════════════════════
// ตรวจยอดเงินของออเดอร์ — ทำที่นี่เพราะ firestore.rules ทำแทนไม่ได้
//
// rules ตรวจได้แค่ total == itemsTotal + shippingFee "สอดคล้องกันเอง" เทียบราคาสินค้าจริงไม่ได้
// (ภาษา rules ไม่มีลูปให้บวกผลรวมทั้งตะกร้า และ get() ได้ 10 ครั้งต่อ request ขณะที่ออเดอร์มีได้ 50 รายการ)
// src/data/orders.js คิดราคาใหม่ใน transaction อยู่แล้ว แต่เป็นโค้ดฝั่งเบราว์เซอร์ — คนที่ยิง Firestore
// SDK ตรงข้ามด่านนั้นได้ ที่นี่จึงคิดใหม่อีกรอบฝั่งเซิร์ฟเวอร์ แล้วเตือนแอดมินในอีเมล + ทำเครื่องหมายในชีต
//
// อ่าน products ผ่าน REST แบบไม่ต้องยืนยันตัวตนได้ เพราะ rules เปิด read: if true (หน้าร้านเป็นหน้า public)
// ══════════════════════════════════════════════════════════════════════
// จำราคาไว้ต่อการเรียก doPost หนึ่งครั้ง — ออเดอร์ที่มีสินค้าเดียวกันหลายไซซ์/หลายสีจะยิง REST ซ้ำ
// โดยไม่จำเป็น (ออเดอร์หนึ่งมีได้ถึง 50 รายการ) ตัวแปรระดับ global รีเซ็ตทุก execution ของ Apps Script อยู่แล้ว
var PRODUCT_PRICE_CACHE = {}

function productPrice(productId) {
  if (PRODUCT_PRICE_CACHE.hasOwnProperty(productId)) return PRODUCT_PRICE_CACHE[productId]
  var url = 'https://firestore.googleapis.com/v1/projects/ummatee-app/databases/(default)/documents/products/'
    + encodeURIComponent(String(productId))
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true })
  if (res.getResponseCode() !== 200) { PRODUCT_PRICE_CACHE[productId] = null; return null }
  var pf = (JSON.parse(res.getContentText()) || {}).fields || {}
  var price = Number(fsVal(pf.price)) || 0
  var discount = pf.discountPrice ? Number(fsVal(pf.discountPrice)) : null
  // ต้องตรงกับ effectivePrice() ใน src/data/pricing.js — ใช้ราคาส่วนลดเมื่อถูกกว่าราคาเต็มเท่านั้น
  var eff = (discount !== null && discount < price) ? discount : price
  PRODUCT_PRICE_CACHE[productId] = eff
  return eff
}

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100 }

function auditOrderTotals(itemVals, itemsTotal, shippingFee, total) {
  var issues = []
  if (!itemVals.length) { issues.push('ออเดอร์ไม่มีรายการสินค้า'); return issues }

  var sum = 0
  var realSum = 0
  var pricesUnknown = false

  itemVals.forEach(function (it) {
    var m = (it.mapValue || {}).fields || {}
    var qty = Number(fsVal(m.qty)) || 0
    var price = Number(fsVal(m.price)) || 0
    var name = fsVal(m.name) || 'สินค้า'
    if (qty <= 0) issues.push('"' + name + '" จำนวนไม่ถูกต้อง (' + qty + ')')
    if (price < 0) issues.push('"' + name + '" ราคาติดลบ')
    sum += price * qty

    // ต้องเป็น productDocId เท่านั้น — m.id คือ lineId (docId|สี|ไซซ์) ไม่ใช่ doc id ของสินค้า
    var pid = fsVal(m.productDocId)
    var real = pid ? productPrice(pid) : null
    if (real === null) { pricesUnknown = true; realSum += price * qty }
    else {
      realSum += real * qty
      if (round2(real) !== round2(price)) {
        issues.push('"' + name + '" ราคาในออเดอร์ ฿' + round2(price) + ' แต่ราคาจริง ฿' + round2(real))
      }
    }
  })

  if (round2(sum) !== round2(itemsTotal)) {
    issues.push('ผลรวมรายการได้ ฿' + round2(sum) + ' แต่ในออเดอร์บันทึก ฿' + round2(itemsTotal))
  }
  if (round2(round2(itemsTotal) + round2(shippingFee)) !== round2(total)) {
    issues.push('ยอดรวมควรเป็น ฿' + round2(round2(itemsTotal) + round2(shippingFee)) + ' แต่บันทึก ฿' + round2(total))
  }
  if (!pricesUnknown && round2(realSum) !== round2(itemsTotal)) {
    issues.push('ยอดที่คิดจากราคาจริงคือ ฿' + round2(realSum) + ' แต่ในออเดอร์บันทึก ฿' + round2(itemsTotal))
  }
  return issues
}

function handleOrderCreated(data) {
  if (!data.orderId) return jsonOut({ error: 'missing orderId' })

  var fsUrl = 'https://firestore.googleapis.com/v1/projects/ummatee-app/databases/(default)/documents/orders/'
    + encodeURIComponent(String(data.orderId))
  var fsRes = UrlFetchApp.fetch(fsUrl, { muteHttpExceptions: true })
  if (fsRes.getResponseCode() !== 200) return jsonOut({ error: 'order not found' })

  var f = (JSON.parse(fsRes.getContentText()) || {}).fields || {}
  var cust = ((f.customer || {}).mapValue || {}).fields || {}

  var orderCode = fsVal(f.orderCode)
  var total = fsVal(f.total)
  var itemsTotal = fsVal(f.itemsTotal)
  var shippingFee = fsVal(f.shippingFee)

  // items เป็น array ของ map — แปลงเป็นข้อความบรรทัดละรายการ
  var itemVals = ((f.items || {}).arrayValue || {}).values || []
  var itemLines = itemVals.map(function (it) {
    var m = (it.mapValue || {}).fields || {}
    var variant = [fsVal(m.colors), fsVal(m.sizes)].filter(function (x) { return x }).join('/')
    return '- ' + fsVal(m.name) + (variant ? ' (' + variant + ')' : '') + ' x' + fsVal(m.qty)
  })

  // ตรวจยอดเงินก่อนบันทึก/ส่งอีเมล เพื่อให้ทั้งสองที่ติดคำเตือนไปด้วยกัน
  var issues = []
  try { issues = auditOrderTotals(itemVals, itemsTotal, shippingFee, total) }
  catch (auditErr) { Logger.log('orderCreated audit error: ' + auditErr.message) }
  var warn = issues.length ? '*** ยอดเงินไม่ผ่านการตรวจ ***\n' + issues.map(function (i) { return '- ' + i }).join('\n') + '\n\n' : ''

  var sheetLogged = false
  try {
    var ss = SpreadsheetApp.openById(ORDERS_SHEET_ID)
    var sh = ss.getSheetByName('Orders') || ss.insertSheet('Orders')
    if (sh.getLastRow() === 0) {
      sh.appendRow([
        'เลขที่ออเดอร์', 'วันที่บันทึก', 'ชื่อลูกค้า', 'เบอร์โทร', 'อีเมล', 'ที่อยู่',
        'รายการสินค้า', 'ค่าสินค้า', 'ค่าจัดส่ง', 'ยอดรวม', 'สถานะ', 'ลิงก์ออเดอร์',
      ])
    }
    sh.appendRow([
      orderCode,
      new Date(),
      fsVal(cust.fullName),
      fsVal(cust.phone),
      fsVal(cust.email),
      fsVal(cust.address),
      itemLines.join('\n'),
      itemsTotal,
      shippingFee,
      total,
      fsVal(f.status) + (issues.length ? ' / ตรวจสอบยอดเงิน' : ''),
      'https://ummatee-app.web.app/admin/shop/orders/' + data.orderId,
    ])
    sheetLogged = true
  } catch (sheetErr) { Logger.log('orderCreated sheet error: ' + sheetErr.message) }

  var mailed = false
  try {
    GmailApp.sendEmail(ADMIN_EMAIL, (issues.length ? '[ตรวจสอบยอดเงิน] ' : '') + 'ออเดอร์ใหม่ ' + orderCode,
      warn
      + 'มีคำสั่งซื้อใหม่ ' + orderCode + '\n'
      + 'ลูกค้า: ' + fsVal(cust.fullName) + ' (' + fsVal(cust.phone) + ')\n'
      + (fsVal(cust.email) ? 'อีเมล: ' + fsVal(cust.email) + '\n' : '')
      + 'ที่อยู่: ' + fsVal(cust.address) + '\n\n'
      + itemLines.join('\n') + '\n\n'
      + 'ค่าสินค้า: ฿' + itemsTotal + '\n'
      + 'ค่าจัดส่ง: ฿' + shippingFee + '\n'
      + 'ยอดรวม: ฿' + total + '\n\n'
      + 'เปิดออเดอร์: https://ummatee-app.web.app/admin/shop/orders/' + data.orderId)
    mailed = true
  } catch (mailErr) { Logger.log('orderCreated mail error: ' + mailErr.message) }

  // อีเมลถึงลูกค้า — ส่งเมื่อลูกค้ากรอกอีเมลไว้ตอนสั่งซื้อเท่านั้น (ช่องนี้ไม่บังคับกรอก)
  // อีเมลมาจากตัวออเดอร์ใน Firestore ไม่ใช่จากผู้เรียก จึงเป็นค่าที่ลูกค้ากรอกเองจริง
  var customerEmail = String(fsVal(cust.email) || '').trim()
  var mailedCustomer = false
  if (customerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    try {
      sendCustomerOrderConfirmation({
        email: customerEmail,
        name: fsVal(cust.fullName),
        address: fsVal(cust.address),
        orderCode: orderCode,
        orderId: data.orderId,
        itemLines: itemLines,
        itemsTotal: itemsTotal,
        shippingFee: shippingFee,
        total: total,
      })
      mailedCustomer = true
    } catch (custErr) { Logger.log('customer mail error: ' + custErr.message) }
  }

  return jsonOut({
    ok: true, orderCode: orderCode,
    mailed: mailed, mailedCustomer: mailedCustomer, sheetLogged: sheetLogged,
    totalsOk: issues.length === 0, issues: issues,
  })
}

// ══════════════════════════════════════════════════════════════════════
// อีเมลยืนยันคำสั่งซื้อถึงลูกค้า — โครงเดียวกับอีเมลยืนยันอาสาสมัคร/Iftar
// ส่งเป็น HTML (อีโมจิแสดงผลได้ ต่างจากอีเมลข้อความล้วนที่ส่งหาแอดมิน)
// ทุกฟิลด์ที่ลูกค้ากรอกเองต้องผ่าน escapeHtml — ชื่อ/ที่อยู่ไปอยู่ใน HTML โดยตรง
// ══════════════════════════════════════════════════════════════════════
function sendCustomerOrderConfirmation(o) {
  var track = 'https://ummatee-app.web.app/um-shop/order/' + o.orderId
  var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(track)
  var itemsHtml = o.itemLines.map(function (l) {
    return '<div style="padding:4px 0;border-bottom:1px solid #f0f0f0">' + escapeHtml(l) + '</div>'
  }).join('')

  var body =
    '<div style="font-family:Tahoma,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden">' +
    '<div style="background:#1b5e36;color:#fff;padding:24px;text-align:center">' +
    '<h1 style="margin:0;font-size:22px">&#10003; ได้รับคำสั่งซื้อแล้ว</h1>' +
    '<p style="margin:6px 0 0;opacity:.9">um-shop · Ummatee Thailand</p>' +
    '</div>' +
    '<div style="padding:24px;color:#333;line-height:1.7">' +
    '<p>เรียน คุณ' + escapeHtml(o.name) + '</p>' +
    '<p>ขอบคุณที่สั่งซื้อกับ um-shop — รายได้นำไปช่วยเหลือผู้ยากไร้</p>' +

    '<div style="background:#f6f6f4;border-radius:10px;padding:16px;margin:16px 0;text-align:center">' +
    '<div style="font-size:13px;color:#888">เลขที่คำสั่งซื้อ</div>' +
    '<div style="font-size:24px;font-weight:800;color:#1b5e36;letter-spacing:1px">' + escapeHtml(o.orderCode) + '</div>' +
    '</div>' +

    '<h3 style="font-size:15px;margin:18px 0 6px;color:#1b5e36">รายการสินค้า</h3>' +
    itemsHtml +
    '<div style="margin-top:12px">' +
    '<div>ค่าสินค้า: &#3647;' + o.itemsTotal + '</div>' +
    '<div>ค่าจัดส่ง: &#3647;' + o.shippingFee + '</div>' +
    '<div style="font-size:18px;font-weight:800;color:#1b5e36;margin-top:6px">ยอดชำระทั้งหมด: &#3647;' + o.total + '</div>' +
    '</div>' +

    '<div style="background:#f5fbf7;border:1.5px solid #2e7d52;border-radius:10px;padding:16px;margin:18px 0">' +
    '<div style="font-weight:700;color:#1b5e36;margin-bottom:6px">ขั้นตอนถัดไป: โอนเงินและแจ้งชำระ</div>' +
    '<div style="font-size:14px">ธนาคารอิสลามแห่งประเทศไทย (ibank)</div>' +
    '<div style="font-size:14px">ชื่อบัญชี: สนับสนุนมูลนิธิ</div>' +
    '<div style="font-family:monospace;font-size:18px;font-weight:800;letter-spacing:1px">0011 1863 13</div>' +
    '<div style="font-size:13px;color:#666;margin-top:6px">โอนแล้วกรุณาอัพสลิปและกดแจ้งชำระเงินในหน้าติดตามคำสั่งซื้อ</div>' +
    '</div>' +

    '<div style="text-align:center;margin:22px 0">' +
    '<a href="' + track + '" style="display:inline-block;padding:13px 26px;background:#1b5e36;color:#fff;text-decoration:none;border-radius:10px;font-weight:700">ติดตาม / แจ้งชำระเงิน</a>' +
    '</div>' +

    '<div style="text-align:center;margin:18px 0">' +
    '<div style="display:inline-block;background:#fff;border:2px solid #e5e7eb;border-radius:14px;padding:12px">' +
    '<img src="' + qrUrl + '" alt="QR" width="160" height="160" style="display:block;border-radius:8px">' +
    '</div>' +
    '<div style="font-size:12px;color:#888;margin-top:6px">สแกนเพื่อเปิดหน้าติดตามคำสั่งซื้อ</div>' +
    '</div>' +

    '<p style="margin:0 0 4px"><b>จัดส่งไปที่:</b> ' + escapeHtml(o.address) + '</p>' +
    '<p style="margin:16px 0 0">Jazakallahu khairan</p>' +
    '</div>' +
    '<div style="background:#faf3e0;color:#8a6d1a;padding:14px 24px;font-size:13px;text-align:center">' +
    '&#9888;&#65039; อีเมลฉบับนี้เป็นข้อความอัตโนมัติ <b>ห้ามตอบกลับ</b> · This is an automated message, please do not reply.' +
    '</div>' +
    '</div>'

  GmailApp.sendEmail(o.email, 'ยืนยันคำสั่งซื้อ ' + o.orderCode + ' · um-shop',
    'กรุณาเปิดอีเมลในโปรแกรมที่รองรับ HTML — ติดตามคำสั่งซื้อ: ' + track,
    { htmlBody: body })
}

// ══════════════════════════════════════════════════════════════════════
// 3c. แจ้งเลขพัสดุถึงลูกค้าทางอีเมล เมื่อร้านกดจัดส่งแล้ว
//
// เดิมแจ้งทาง LINE อย่างเดียว ซึ่งได้เฉพาะลูกค้าที่ล็อกอินด้วย LINE — ลูกค้าที่กรอกอีเมล
// (ส่วนใหญ่) ไม่เคยได้รับเลขพัสดุเลย ต้องเข้ามาเช็คหน้าเว็บเอง
//
// อ่านออเดอร์จาก Firestore เองเหมือน handleOrderCreated จึงส่งเลขพัสดุปลอมไม่ได้
// ══════════════════════════════════════════════════════════════════════

// ลิงก์ติดตามของแต่ละขนส่ง — ต้องตรงกับ COURIERS ใน src/components/OrderShared.jsx
function courierInfo(key, code) {
  var c = encodeURIComponent(code)
  var map = {
    thailandpost: { label: 'ไปรษณีย์ไทย (EMS/ลงทะเบียน)', url: 'https://track.thailandpost.co.th/?trackNumber=' + c },
    kerry: { label: 'Kerry Express', url: 'https://th.kerryexpress.com/th/track/?track=' + c },
    flash: { label: 'Flash Express', url: 'https://www.flashexpress.com/tracking/?se=' + c },
    jt: { label: 'J&T Express', url: 'https://www.jtexpress.co.th/index/query/gzquery.html?bills=' + c },
    ninjavan: { label: 'Ninja Van', url: 'https://www.ninjavan.co/th-th/tracking?id=' + c },
    spx: { label: 'SPX Express (Shopee)', url: 'https://spx.co.th/th/track?sls_tracking_number=' + c },
  }
  // ไม่รู้ขนส่ง (ออเดอร์เก่าก่อนมีช่องเลือก) → 17TRACK เดาขนส่งจากรูปแบบเลขพัสดุให้
  return map[key] || { label: 'พัสดุของคุณ', url: 'https://t.17track.net/en#nums=' + c }
}

function handleOrderShipped(data) {
  if (!data.orderId) return jsonOut({ error: 'missing orderId' })

  var fsUrl = 'https://firestore.googleapis.com/v1/projects/ummatee-app/databases/(default)/documents/orders/'
    + encodeURIComponent(String(data.orderId))
  var fsRes = UrlFetchApp.fetch(fsUrl, { muteHttpExceptions: true })
  if (fsRes.getResponseCode() !== 200) return jsonOut({ error: 'order not found' })

  var f = (JSON.parse(fsRes.getContentText()) || {}).fields || {}
  var cust = ((f.customer || {}).mapValue || {}).fields || {}
  var email = String(fsVal(cust.email) || '').trim()
  var tracking = String(fsVal(f.trackingNumber) || '').trim()

  if (!tracking) return jsonOut({ ok: false, reason: 'no tracking number yet' })
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonOut({ ok: false, reason: 'no customer email' })
  }

  var ci = courierInfo(fsVal(f.courier), tracking)
  var orderCode = fsVal(f.orderCode)
  var track = 'https://ummatee-app.web.app/um-shop/order/' + data.orderId

  var body =
    '<div style="font-family:Tahoma,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden">' +
    '<div style="background:#1b5e36;color:#fff;padding:24px;text-align:center">' +
    '<h1 style="margin:0;font-size:22px">&#128230; จัดส่งพัสดุแล้ว</h1>' +
    '<p style="margin:6px 0 0;opacity:.9">um-shop · Ummatee Thailand</p>' +
    '</div>' +
    '<div style="padding:24px;color:#333;line-height:1.7">' +
    '<p>เรียน คุณ' + escapeHtml(fsVal(cust.fullName)) + '</p>' +
    '<p>คำสั่งซื้อ <b>' + escapeHtml(orderCode) + '</b> ถูกจัดส่งเรียบร้อยแล้ว</p>' +

    '<div style="background:#f5fbf7;border:1.5px solid #2e7d52;border-radius:12px;padding:18px;margin:18px 0;text-align:center">' +
    '<div style="font-size:13px;color:#666;font-weight:700">' + escapeHtml(ci.label) + '</div>' +
    '<div style="font-family:monospace;font-size:22px;font-weight:800;letter-spacing:1px;color:#1b5e36;margin:6px 0 14px">' + escapeHtml(tracking) + '</div>' +
    '<a href="' + ci.url + '" style="display:inline-block;padding:13px 26px;background:#1b5e36;color:#fff;text-decoration:none;border-radius:10px;font-weight:800">ติดตามพัสดุที่เว็บขนส่ง</a>' +
    '</div>' +

    '<p style="font-size:13px;color:#666">สถานะล่าสุดของพัสดุดูได้จากเว็บขนส่งโดยตรง · หน้าคำสั่งซื้อของคุณ: <a href="' + track + '">' + track + '</a></p>' +
    '<p style="margin:16px 0 0">ขอบคุณที่อุดหนุน um-shop — รายได้นำไปช่วยเหลือผู้ยากไร้<br>Jazakallahu khairan</p>' +
    '</div>' +
    '<div style="background:#faf3e0;color:#8a6d1a;padding:14px 24px;font-size:13px;text-align:center">' +
    '&#9888;&#65039; อีเมลฉบับนี้เป็นข้อความอัตโนมัติ <b>ห้ามตอบกลับ</b> · This is an automated message, please do not reply.' +
    '</div>' +
    '</div>'

  try {
    GmailApp.sendEmail(email, 'จัดส่งแล้ว ' + orderCode + ' · เลขพัสดุ ' + tracking,
      'เลขพัสดุ: ' + tracking + ' (' + ci.label + ')\nติดตาม: ' + ci.url,
      { htmlBody: body })
  } catch (e) {
    Logger.log('orderShipped mail error: ' + e.message)
    return jsonOut({ ok: false, reason: e.message })
  }
  return jsonOut({ ok: true, orderCode: orderCode, tracking: tracking, courier: ci.label })
}

// ══════════════════════════════════════════════════════════════════════
// แจ้งสถานะคำสั่งซื้อไปหาลูกค้าทาง LINE (um-shop)
//
// ต้องตั้ง Script Property ชื่อ LINE_CHANNEL_ACCESS_TOKEN (จาก LINE Messaging API channel
// ของ OA @745bvvgx — Provider เดียวกับ LINE Login channel) และลูกค้าต้องเป็นเพื่อนกับ OA
//
// ⚠️ ความปลอดภัย: ห้ามรับ lineUserId/ข้อความ จากผู้เรียกเด็ดขาด — SHEET_TOKEN เป็น token ฝั่ง client
// ที่ใครเปิด bundle ก็อ่านได้ ถ้ารับผู้รับ+ข้อความมาตรงๆ เท่ากับใครก็สั่งให้ LINE OA ของมูลนิธิ
// ส่งข้อความอะไรก็ได้ไปหาผู้ติดตามคนไหนก็ได้ (ปลอมเป็นมูลนิธิหลอกให้โอนเงินได้)
//
// จึงรับแค่ orderId + event แล้วมา "อ่านผู้รับจากตัวออเดอร์เอง" ผ่าน Firestore REST
// (orders มี allow get: if true อ่านทีละ doc ได้โดยไม่ต้องล็อกอิน) และประกอบข้อความจากเทมเพลตในนี้เท่านั้น
// ผลคือ: ต่อให้รู้ token ก็ส่งได้แค่ข้อความมาตรฐานไปหาลูกค้าเจ้าของออเดอร์นั้นเอง (ต้องรู้ orderId
// ซึ่งเป็น random id 20 ตัวอักษร เดาไม่ได้) ส่งหาคนอื่นหรือเขียนข้อความเองไม่ได้
// ══════════════════════════════════════════════════════════════════════
function handleLineNotify(data) {
  var lineToken = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN')
  if (!lineToken) return jsonOut({ error: 'no token configured' })
  if (!data.orderId || !data.event) return jsonOut({ error: 'missing orderId/event' })

  // อ่านออเดอร์จาก Firestore (ไม่ต้องใช้ credential เพราะ rules เปิด get ให้อ่านทีละ doc ได้)
  var fsUrl = 'https://firestore.googleapis.com/v1/projects/ummatee-app/databases/(default)/documents/orders/'
    + encodeURIComponent(String(data.orderId))
  var fsRes = UrlFetchApp.fetch(fsUrl, { muteHttpExceptions: true })
  if (fsRes.getResponseCode() !== 200) return jsonOut({ error: 'order not found' })

  var fields = (JSON.parse(fsRes.getContentText()) || {}).fields || {}
  var orderCode = (fields.orderCode || {}).stringValue || ''
  var custFields = ((fields.customer || {}).mapValue || {}).fields || {}
  var lineUserId = (custFields.lineUserId || {}).stringValue || ''
  if (!lineUserId) return jsonOut({ ok: false, reason: 'no lineUserId on order' })

  // ข้อความสร้างจากเทมเพลตในนี้เท่านั้น ผู้เรียกเติมได้แค่เลขพัสดุ/ข้อความอัปเดตสั้นๆ (คุมความยาว)
  var track = 'https://ummatee-app.web.app/um-shop/order/' + data.orderId
  var tracking = String(data.trackingNumber || '').slice(0, 40)
  var updateText = String(data.text || '').slice(0, 200)

  var templates = {
    payment_confirmed: '✅ ยืนยันการชำระเงินแล้ว\nคำสั่งซื้อ ' + orderCode + ' กำลังเตรียมการจัดส่ง\n\nติดตามสถานะ: ' + track,
    shipping: '📦 คำสั่งซื้อ ' + orderCode + ' จัดส่งแล้ว\n' + (tracking ? 'เลขพัสดุ: ' + tracking + '\n' : '') + '\nติดตามสถานะ: ' + track,
    shipping_update: '🚚 อัปเดตการจัดส่ง ' + orderCode + '\n' + updateText + '\n\nติดตามสถานะ: ' + track,
    delivered: '🎉 คำสั่งซื้อ ' + orderCode + ' จัดส่งเรียบร้อยแล้ว\nขอบคุณที่อุดหนุน um-shop — รายได้นำไปช่วยเหลือผู้ยากไร้\nJazakallahu khairan 💚',
  }

  var text = templates[data.event]
  if (!text) return jsonOut({ error: 'unknown event' })

  var resp = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + lineToken },
    payload: JSON.stringify({ to: lineUserId, messages: [{ type: 'text', text: text }] }),
    muteHttpExceptions: true,
  })
  return jsonOut({ ok: resp.getResponseCode() === 200, code: resp.getResponseCode() })
}

// ══════════════════════════════════════════════════════════════════════
// สมัครอาสาสมัคร — บันทึกลง Sheet + ส่งอีเมลยืนยันพร้อม QR
//
// หมายเหตุ: Firestore เป็นที่เก็บหลักแล้ว (ref สร้างจาก counter ฝั่ง Firestore ก่อนเรียกมาที่นี่)
// Sheet นี้เป็นแค่สำรอง/ใช้ส่งอีเมลยืนยัน — ต้องใช้ ref ที่ client ส่งมา ห้ามสร้าง ref เองอีกต่อไป
// (ไม่งั้น ref ใน Sheet กับใน Firestore จะไม่ตรงกัน)
// ══════════════════════════════════════════════════════════════════════
function handleVolunteer(data) {
  var vSS = SpreadsheetApp.openById(VOLUNTEER_SHEET_ID)
  var vSheet = vSS.getSheetByName('Volunteer') || vSS.getActiveSheet()
  if (vSheet.getLastRow() === 0) {
    vSheet.appendRow([
      'Ref', 'วันที่', 'ชื่อ', 'นามสกุล', 'Name', 'Last Name',
      'เพศ', 'อายุ', 'จังหวัด', 'เบอร์โทร', 'อีเมล',
      'ช่องทางการรับรู้', 'ความสามารถ', 'งานที่สนใจ', 'โครงการ',
      'วันที่สะดวก', 'ความคาดหวัง', 'ข้อความ'
    ])
  }
  var ref = data.ref || ('UMV-' + vSheet.getLastRow())
  vSheet.appendRow([
    ref,
    data.date || '',
    data.fname || '',
    data.lname || '',
    data.fnameEn || '',
    data.lnameEn || '',
    data.gender || '',
    data.age || '',
    data.province || '',
    data.phone || '',
    data.email || '',
    data.channel || '',
    data.skills || '',
    data.missions || '',
    data.giveProjects || '',
    data.giveDates || '',
    data.expect || '',
    data.note || '',
  ])
  sendVolunteerConfirmation(data, ref)
  return jsonOut({ ok: true, ref: ref })
}

// ======== อีเมลยืนยัน Volunteer — โครงเดียวกับ Iftar (QR code + รหัส เท่านั้น) ========
function sendVolunteerConfirmation(data, ref) {
  try {
    var name = escapeHtml((data.fname || '') + ' ' + (data.lname || ''))
    var email = data.email || ''
    if (!email) return

    var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(ref)
    var subject = 'ยืนยันการสมัครอาสาสมัคร Ummatee — ' + ref

    var body =
      '<div style="font-family:Tahoma,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden">' +
      '<div style="background:#1b5e36;color:#fff;padding:24px;text-align:center">' +
      '<h1 style="margin:0;font-size:22px">&#10003; สมัครอาสาสมัครเรียบร้อย</h1>' +
      '<p style="margin:6px 0 0;opacity:.9">Ummatee Volunteer</p>' +
      '</div>' +
      '<div style="padding:24px;color:#333;line-height:1.7">' +
      '<p>เรียน คุณ' + name + '</p>' +
      '<p>ขอบคุณที่สมัครเป็นอาสาสมัครมูลนิธิอุมมะตี</p>' +

      '<div style="text-align:center;margin:24px 0">' +
      '<div style="display:inline-block;background:#fff;border:2px solid #e5e7eb;border-radius:14px;padding:14px">' +
      '<img src="' + qrUrl + '" alt="QR Code" width="180" height="180" style="display:block;border-radius:8px">' +
      '</div>' +
      '</div>' +

      '<div style="background:#f6f6f4;border-radius:10px;padding:16px;margin:16px 0;text-align:center">' +
      '<div style="font-size:13px;color:#888">รหัสอาสาสมัครของคุณ</div>' +
      '<div style="font-size:26px;font-weight:800;color:#1b5e36;letter-spacing:1px">' + ref + '</div>' +
      '</div>' +

      '<p style="text-align:center;color:#555;font-size:13px;line-height:1.6;margin:16px 0">' +
      '&#128241; กรุณาแสดง <b>QR Code</b> หรือ รหัส <b>' + ref + '</b> เมื่อมาร่วมงาน<br>' +
      'Please show this QR code or code <b>' + ref + '</b> at the event' +
      '</p>' +

      (data.missions ? '<p style="margin:0 0 4px"><b>&#127919; ภารกิจ:</b> ' + escapeHtml(data.missions) + '</p>' : '') +
      (data.skills ? '<p style="margin:0 0 4px"><b>&#128736; ตำแหน่ง:</b> ' + escapeHtml(data.skills) + '</p>' : '') +
      (data.giveProjects ? '<p style="margin:0 0 4px"><b>&#128230; โครงการ:</b> ' + escapeHtml(data.giveProjects) + '</p>' : '') +

      '<p style="margin:16px 0 0">ทีมงานจะติดต่อกลับเร็วๆ นี้ · Jazakallahu khairan</p>' +
      '</div>' +
      '<div style="padding:0 24px 22px;text-align:center;border-top:1px solid #f0f0f0">' +
      '<p style="color:#777;font-size:13px;margin:18px 0 12px">ติดตามอุมมะตี · Follow Ummatee</p>' +
      '<a href="https://www.facebook.com/UmmateeinThailand" style="display:inline-block;margin:3px;padding:8px 13px;background:#1877f2;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">Facebook</a>' +
      '<a href="https://www.instagram.com/ummatee.thailand" style="display:inline-block;margin:3px;padding:8px 13px;background:#e1306c;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">Instagram</a>' +
      '<a href="https://www.tiktok.com/@ummatee.thailand" style="display:inline-block;margin:3px;padding:8px 13px;background:#010101;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">TikTok</a>' +
      '<a href="https://www.youtube.com/@ummateethailand" style="display:inline-block;margin:3px;padding:8px 13px;background:#ff0000;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">YouTube</a>' +
      '<a href="https://line.me/R/ti/p/@745bvvgx" style="display:inline-block;margin:3px;padding:8px 13px;background:#06c755;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">LINE</a>' +
      '<a href="https://www.threads.com/@ummatee.thailand" style="display:inline-block;margin:3px;padding:8px 13px;background:#000000;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">Threads</a>' +
      '</div>' +
      '<div style="background:#faf3e0;color:#8a6d1a;padding:14px 24px;font-size:13px;text-align:center">' +
      '&#9888;&#65039; อีเมลฉบับนี้เป็นข้อความอัตโนมัติ <b>ห้ามตอบกลับ</b> · This is an automated message, please do not reply.' +
      '</div>' +
      '</div>'

    GmailApp.sendEmail(email, subject, 'กรุณาเปิดอีเมลในโปรแกรมที่รองรับ HTML', { htmlBody: body })
  } catch (err) {
    Logger.log('Volunteer email error: ' + err.message)
  }
}

function testVolunteerSheet() {
  var vSS = SpreadsheetApp.openById(VOLUNTEER_SHEET_ID)
  var vSheet = vSS.getSheetByName('Volunteer') || vSS.getActiveSheet()
  Logger.log('Sheet name: ' + vSheet.getName())
  Logger.log('Last row: ' + vSheet.getLastRow())
  Logger.log('OK')
}

// ══════════════════════════════════════════════════════════════════════
// B2UM — ลงทะเบียนร้านค้า/ธุรกิจ (บันทึกลงชีต B2UM ไม่ส่งอีเมล)
// ══════════════════════════════════════════════════════════════════════
function handleB2um(data) {
  var vSS = SpreadsheetApp.openById(VOLUNTEER_SHEET_ID)
  var bSheet = vSS.getSheetByName('B2UM') || vSS.insertSheet('B2UM')
  if (bSheet.getLastRow() === 0) {
    bSheet.appendRow(['Ref', 'วันที่', 'ชื่อ', 'นามสกุล', 'เบอร์โทร', 'ชื่อร้านค้า/ธุรกิจ', 'ภาพ'])
  }
  var ref = 'B2UM-' + String(bSheet.getLastRow()).padStart(3, '0')
  bSheet.appendRow([
    ref,
    data.date || '',
    data.fname || '',
    data.lname || '',
    data.phone || '',
    data.shopName || '',
    data.images || '',
  ])
  return jsonOut({ ok: true, ref: ref })
}

// ══════════════════════════════════════════════════════════════════════
// Iftar For Gaza — ลงทะเบียน (เป็น action เริ่มต้นเมื่อ request ไม่ระบุ data.type)
// ฟอร์มที่ deploy อยู่ยังยิงมาโดยไม่ส่ง type ⇒ ห้ามเปลี่ยนพฤติกรรมนี้
// ══════════════════════════════════════════════════════════════════════
function handleIftar(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var sheet = ss.getSheetByName('Registrations') || ss.getActiveSheet()

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Ref', 'วันที่', 'ชื่อ', 'นามสกุล', 'เบอร์โทร', 'อีเมล', 'จำนวน', 'จังหวัด', 'ช่องทาง'])
  }

  var ref = data.ref || ('IFG-' + Date.now())
  sheet.appendRow([
    ref,
    data.date || new Date().toLocaleString('th-TH'),
    data.fname || '',
    data.lname || '',
    data.phone || '',
    data.email || '',
    data.count || 1,
    data.province || '',
    data.channel || '',
  ])

  sendIftarConfirmation(data, ref)
  return jsonOut({ ok: true, ref: ref })
}

// ======== อีเมลยืนยัน Iftar For Gaza — QR code + รหัส ========
function sendIftarConfirmation(data, ref) {
  try {
    var name = escapeHtml((data.fname || '') + ' ' + (data.lname || ''))
    var email = data.email || ''
    if (!email) return

    var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(ref)
    var subject = 'ยืนยันการลงทะเบียน Iftar For Gaza 2026 — ' + ref

    var body =
      '<div style="font-family:Tahoma,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden">' +
      '<div style="background:#1b5e36;color:#fff;padding:24px;text-align:center">' +
      '<h1 style="margin:0;font-size:22px">&#10003; ลงทะเบียนเรียบร้อย</h1>' +
      '<p style="margin:6px 0 0;opacity:.9">Iftar For Gaza 2026</p>' +
      '</div>' +
      '<div style="padding:24px;color:#333;line-height:1.7">' +
      '<p>เรียน คุณ' + name + '</p>' +
      '<p>ขอบคุณที่ลงทะเบียนเข้าร่วมงาน <b>Iftar For Gaza 2026</b> เรียบร้อยแล้ว</p>' +

      '<div style="text-align:center;margin:24px 0">' +
      '<div style="display:inline-block;background:#fff;border:2px solid #e5e7eb;border-radius:14px;padding:14px">' +
      '<img src="' + qrUrl + '" alt="QR Code" width="180" height="180" style="display:block;border-radius:8px">' +
      '</div>' +
      '</div>' +

      '<div style="background:#f6f6f4;border-radius:10px;padding:16px;margin:16px 0;text-align:center">' +
      '<div style="font-size:13px;color:#888">รหัสลงทะเบียนของคุณ</div>' +
      '<div style="font-size:26px;font-weight:800;color:#1b5e36;letter-spacing:1px">' + ref + '</div>' +
      '</div>' +

      '<p style="text-align:center;color:#555;font-size:13px;line-height:1.6;margin:16px 0">' +
      '&#128241; กรุณาแสดง <b>QR Code</b> หรือ รหัส <b>' + ref + '</b> ที่จุดลงทะเบียนหน้างาน<br>' +
      'Please show this QR code or code <b>' + ref + '</b> at the check-in counter' +
      '</p>' +

      '<p style="margin:0 0 4px"><b>&#128197; วัน-เวลา:</b> ศุกร์ 26 มิถุนายน 2569 · 15:30–20:30 น.</p>' +
      '<p style="margin:0 0 16px"><b>&#128205; สถานที่:</b> สินธร สเต็กเฮ้าส์ ศรีนครินทร์</p>' +
      '<div style="text-align:center;margin:20px 0">' +
      '<a href="https://maps.app.goo.gl/MeUdbtRPhB7mKBcb7" style="display:inline-block;padding:12px 22px;background:#4285f4;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;margin:4px">&#128205; ดูแผนที่</a>' +
      '<a href="https://ummatee-app.web.app/donation" style="display:inline-block;padding:12px 22px;background:#1b5e36;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;margin:4px">&#10084; ร่วมบริจาค</a>' +
      '</div>' +
      '<p style="margin:16px 0 0">กรุณาแสดงรหัสนี้ที่หน้างาน · Jazakallahu khairan</p>' +
      '</div>' +
      '<div style="padding:0 24px 22px;text-align:center;border-top:1px solid #f0f0f0">' +
      '<p style="color:#777;font-size:13px;margin:18px 0 12px">ติดตามอุมมะตี · Follow Ummatee</p>' +
      '<a href="https://www.facebook.com/UmmateeinThailand" style="display:inline-block;margin:3px;padding:8px 13px;background:#1877f2;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">Facebook</a>' +
      '<a href="https://www.instagram.com/ummatee.thailand" style="display:inline-block;margin:3px;padding:8px 13px;background:#e1306c;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">Instagram</a>' +
      '<a href="https://www.tiktok.com/@ummatee.thailand" style="display:inline-block;margin:3px;padding:8px 13px;background:#010101;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">TikTok</a>' +
      '<a href="https://www.youtube.com/@ummateethailand" style="display:inline-block;margin:3px;padding:8px 13px;background:#ff0000;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">YouTube</a>' +
      '<a href="https://line.me/R/ti/p/@745bvvgx" style="display:inline-block;margin:3px;padding:8px 13px;background:#06c755;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">LINE</a>' +
      '<a href="https://www.threads.com/@ummatee.thailand" style="display:inline-block;margin:3px;padding:8px 13px;background:#000000;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">Threads</a>' +
      '</div>' +
      '<div style="background:#faf3e0;color:#8a6d1a;padding:14px 24px;font-size:13px;text-align:center">' +
      '&#9888;&#65039; อีเมลฉบับนี้เป็นข้อความอัตโนมัติ <b>ห้ามตอบกลับ</b> · This is an automated message, please do not reply.' +
      '</div>' +
      '</div>'

    GmailApp.sendEmail(email, subject, 'กรุณาเปิดอีเมลในโปรแกรมที่รองรับ HTML', { htmlBody: body })
  } catch (err) {
    Logger.log('Email error: ' + err.message)
  }
}
