// Cloudflare Worker — สำรองข้อมูล Firestore ลง Google Sheets ทุก 3 ชั่วโมง (ตั้งเวลาใน wrangler.toml)
// ทำงานด้วย service account ของ Google (อ่าน Firestore ผ่าน IAM ไม่ผ่าน firestore.rules + เขียนชีตที่แชร์ให้)
//
// ตั้งค่า (รายละเอียดใน docs/cloudflare-setup.md):
//   secret GCP_SA_KEY      — เนื้อไฟล์ JSON ของ service account ทั้งไฟล์
//   var    BACKUP_SHEET_ID — id ของ Google Sheet ปลายทาง (ส่วนกลางของ URL)
//   secret BACKUP_RUN_KEY  — (ไม่บังคับ) เปิดให้สั่งสำรองทันทีทาง https://<worker>/run?key=...
//
// แต่ละ collection ได้แท็บของตัวเอง เขียนทับทั้งแท็บทุกรอบ (เป็นสำเนาล่าสุด ไม่ใช่ประวัติ)
// แท็บ _backup บอกเวลาสำรองล่าสุด จำนวนเอกสาร และ collection ที่ล้ม
// เขียนแบบ valueInputOption=RAW เสมอ — ข้อความที่ผู้ใช้กรอก (ขึ้นต้นด้วย = + - @) จะไม่ถูกตีความเป็นสูตร
import { BACKUP_COLLECTIONS, META_SHEET, decodeDoc, buildTable, bangkokTime, a1, pemToDer, base64url, safeEqual } from './lib.js'

const SCOPES = 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/spreadsheets'
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets'

export async function getAccessToken(sa, fetchFn = fetch) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(JSON.stringify({
    iss: sa.client_email, scope: SCOPES, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }))
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`))
  const res = await fetchFn('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${header}.${claims}.${base64url(sig)}`,
  })
  const j = await res.json()
  if (!res.ok || !j.access_token) throw new Error(`ขอ access token ไม่สำเร็จ: ${j.error_description || j.error || res.status}`)
  return j.access_token
}

async function api(fetchFn, token, url, init = {}) {
  const res = await fetchFn(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${url.split('?')[0]}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : {}
}

export async function listCollection(fetchFn, token, projectId, col) {
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${col}`
  const docs = []
  let pageToken = ''
  do {
    const j = await api(fetchFn, token, `${base}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`)
    ;(j.documents || []).forEach((d) => docs.push(decodeDoc(d)))
    pageToken = j.nextPageToken || ''
  } while (pageToken)
  return docs
}

export async function runBackup(env, fetchFn = fetch) {
  if (!env.GCP_SA_KEY) throw new Error('ยังไม่ได้ตั้ง secret GCP_SA_KEY')
  if (!env.BACKUP_SHEET_ID) throw new Error('ยังไม่ได้ตั้ง BACKUP_SHEET_ID')
  const sa = JSON.parse(env.GCP_SA_KEY)
  const projectId = env.FIREBASE_PROJECT_ID || sa.project_id
  const sheetUrl = `${SHEETS}/${env.BACKUP_SHEET_ID}`
  const token = await getAccessToken(sa, fetchFn)

  // สร้างแท็บที่ยังไม่มี (ครั้งแรก หรือเพิ่ม collection ใหม่ในรายการ)
  const meta = await api(fetchFn, token, `${sheetUrl}?fields=sheets.properties.title`)
  const have = new Set((meta.sheets || []).map((s) => s.properties.title))
  const missing = [META_SHEET, ...BACKUP_COLLECTIONS].filter((t) => !have.has(t))
  if (missing.length) {
    await api(fetchFn, token, `${sheetUrl}:batchUpdate`, {
      method: 'POST', body: JSON.stringify({ requests: missing.map((title) => ({ addSheet: { properties: { title } } })) }),
    })
  }

  const startedAt = new Date().toISOString()
  const summary = []
  for (const col of BACKUP_COLLECTIONS) {
    try {
      const docs = await listCollection(fetchFn, token, projectId, col)
      const table = buildTable(docs)
      await api(fetchFn, token, `${sheetUrl}/values/${encodeURIComponent(a1(col))}:clear`, { method: 'POST', body: '{}' })
      await api(fetchFn, token, `${sheetUrl}/values/${encodeURIComponent(`${a1(col)}!A1`)}?valueInputOption=RAW`, {
        method: 'PUT', body: JSON.stringify({ values: table }),
      })
      summary.push([col, docs.length, 'ok', ''])
    } catch (e) {
      // collection หนึ่งล้ม (เช่น สิทธิ์ไม่พอ/ข้อมูลใหญ่เกิน) ไม่ทำให้ที่เหลือไม่ได้สำรอง — บันทึกไว้ในแท็บ _backup
      summary.push([col, '', 'error', String(e.message || e).slice(0, 500)])
    }
  }

  const metaRows = [
    ['สำรองล่าสุด (เวลาไทย)', bangkokTime(startedAt), '', ''],
    ['collection', 'จำนวนเอกสาร', 'สถานะ', 'ข้อผิดพลาด'],
    ...summary,
  ]
  await api(fetchFn, token, `${sheetUrl}/values/${encodeURIComponent(a1(META_SHEET))}:clear`, { method: 'POST', body: '{}' })
  await api(fetchFn, token, `${sheetUrl}/values/${encodeURIComponent(`${a1(META_SHEET)}!A1`)}?valueInputOption=RAW`, {
    method: 'PUT', body: JSON.stringify({ values: metaRows }),
  })

  const failed = summary.filter((r) => r[2] === 'error')
  return { ok: failed.length === 0, at: bangkokTime(startedAt), collections: summary.length, failed: failed.map((r) => ({ collection: r[0], error: r[3] })) }
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runBackup(env).then((r) => {
      if (!r.ok) console.error('backup: บาง collection สำรองไม่สำเร็จ', JSON.stringify(r.failed))
      else console.log('backup ok', r.at)
    }))
  },
  // สั่งสำรองทันที (เช่น ก่อนเปิดงาน) — ปิดไว้ถ้าไม่ได้ตั้ง BACKUP_RUN_KEY
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname !== '/run' || !env.BACKUP_RUN_KEY || !safeEqual(url.searchParams.get('key'), env.BACKUP_RUN_KEY)) {
      return new Response('Not found', { status: 404 })
    }
    try {
      const r = await runBackup(env)
      return Response.json(r, { status: r.ok ? 200 : 207 })
    } catch (e) {
      return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 })
    }
  },
}
