import { GOOGLE_CLIENT_ID, GOOGLE_API_KEY, GOOGLE_SCOPES, isGoogleConfigured } from './googleApiConfig.js'

// เชื่อมต่อ Google Drive / Docs / Picker จากเบราว์เซอร์ตรงๆ (ไม่มี server — Spark plan ไม่มี Cloud Functions)
//
// ใช้ Google Identity Services (GIS) ขอ access token แบบ implicit ในหน่วยความจำเท่านั้น
// ⚠️ ห้ามเก็บ token ลง localStorage/Firestore — token นี้เข้าถึง Drive ของผู้ใช้ได้จริง
// ถ้าหลุดไปอยู่ในที่ที่อ่านได้ (เช่นแท็บเล็ตที่แชร์กันหน้างาน) คนอื่นเอาไปใช้ต่อได้ทันที
// ให้หมดอายุไปตามรอบของ Google (~1 ชม.) แล้วขอใหม่เมื่อผู้ใช้กดปุ่มครั้งถัดไป
//
// สิทธิ์ที่ได้คือสิทธิ์ของ "คนที่กดอนุญาต" ไม่ใช่บัญชีกลางของมูลนิธิ — ใครเปิดไฟล์ไหนได้ก็เห็นเท่านั้น
// (ข้อดี: ไม่ต้องเก็บ service account key ไว้ฝั่ง client ซึ่งทำไม่ได้อย่างปลอดภัยอยู่แล้ว)

export { isGoogleConfigured }

let tokenClient = null
let accessToken = null
let tokenExpiresAt = 0

// โหลด <script> ภายนอกแบบครั้งเดียว — เก็บ promise ไว้กันโหลดซ้ำเมื่อกดปุ่มหลายครั้งรัวๆ
const scriptCache = new Map()
function loadScript(src) {
  if (scriptCache.has(src)) return scriptCache.get(src)
  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = resolve
    s.onerror = () => reject(new Error(`โหลดสคริปต์ของ Google ไม่สำเร็จ (${src}) — ตรวจการเชื่อมต่ออินเทอร์เน็ต`))
    document.head.appendChild(s)
  })
  scriptCache.set(src, p)
  return p
}

function assertConfigured() {
  if (!isGoogleConfigured()) {
    throw new Error('ยังไม่ได้ตั้งค่า Google API — ดูขั้นตอนในไฟล์ src/utils/googleApiConfig.js')
  }
}

// ขอ access token — คืน token เดิมถ้ายังไม่หมดอายุ (กันเด้งหน้าขออนุญาตทุกครั้งที่กดปุ่ม)
// เผื่อเวลาไว้ 60 วิ กันเคส token หมดอายุกลางทางระหว่างเรียก API
export async function getAccessToken() {
  assertConfigured()
  if (accessToken && Date.now() < tokenExpiresAt - 60_000) return accessToken

  await loadScript('https://accounts.google.com/gsi/client')
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        callback: () => {}, // ตั้งใหม่ทุกครั้งก่อนเรียก requestAccessToken ด้านล่าง
      })
    }
    tokenClient.callback = (resp) => {
      if (resp.error) {
        // access_denied = ผู้ใช้กดปฏิเสธเอง ไม่ใช่ระบบพัง จึงแยกข้อความให้ไม่น่ากลัว
        reject(new Error(resp.error === 'access_denied'
          ? 'คุณยังไม่ได้อนุญาตให้เข้าถึง Google Drive'
          : `ขอสิทธิ์ Google ไม่สำเร็จ (${resp.error})`))
        return
      }
      accessToken = resp.access_token
      tokenExpiresAt = Date.now() + (Number(resp.expires_in || 3600) * 1000)
      resolve(accessToken)
    }
    tokenClient.requestAccessToken()
  })
}

// ล้าง token ในหน่วยความจำ (ใช้ตอนกด "ตัดการเชื่อมต่อ") — ไม่ได้ถอนสิทธิ์ที่ฝั่ง Google
export function clearAccessToken() {
  accessToken = null
  tokenExpiresAt = 0
}

export const hasActiveToken = () => !!accessToken && Date.now() < tokenExpiresAt

// ── Google Picker: เลือกไฟล์จาก Drive จริง ──
// onPick ได้ array ของ { id, name, url, mimeType, isImage }
export async function openDrivePicker({ imagesOnly = false } = {}) {
  assertConfigured()
  const token = await getAccessToken()
  await loadScript('https://apis.google.com/js/api.js')
  await new Promise((resolve, reject) => {
    window.gapi.load('picker', { callback: resolve, onerror: () => reject(new Error('โหลด Google Picker ไม่สำเร็จ')) })
  })

  return new Promise((resolve) => {
    const view = new window.google.picker.DocsView(
      imagesOnly ? window.google.picker.ViewId.DOCS_IMAGES : window.google.picker.ViewId.DOCS
    )
    view.setIncludeFolders(true)
    const picker = new window.google.picker.PickerBuilder()
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      .addView(view)
      .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
      .setCallback((data) => {
        const action = data[window.google.picker.Response.ACTION]
        if (action === window.google.picker.Action.PICKED) {
          const docs = data[window.google.picker.Response.DOCUMENTS] || []
          resolve(docs.map((d) => ({
            id: d[window.google.picker.Document.ID],
            name: d[window.google.picker.Document.NAME],
            url: d[window.google.picker.Document.URL],
            mimeType: d[window.google.picker.Document.MIME_TYPE],
            isImage: String(d[window.google.picker.Document.MIME_TYPE] || '').startsWith('image/'),
          })))
        } else if (action === window.google.picker.Action.CANCEL) {
          resolve([]) // ผู้ใช้กดปิดเอง ไม่ใช่ error
        }
      })
      .build()
    picker.setVisible(true)
  })
}

// URL รูปจาก Drive ที่ใส่ใน <img src> ได้ตรงๆ
// ⚠️ ใช้ได้เฉพาะไฟล์ที่ตั้งแชร์แบบ "ทุกคนที่มีลิงก์" ใน Drive แล้ว — ถ้าไฟล์ยังเป็นส่วนตัวรูปจะไม่ขึ้น
// (เป็นข้อจำกัดของ Drive เอง เราส่ง access token ไปกับ <img> ไม่ได้)
export const driveImageUrl = (fileId, width = 1200) =>
  `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${width}`

// ── สร้าง Google Doc เปล่าสำหรับจดบันทึกการประชุม ──
// ใช้ Drive API files.create (scope drive.file พอ) แล้วคืนลิงก์เอกสาร
// เนื้อหาเริ่มต้นใส่ผ่าน Docs API ไม่ได้ด้วย scope นี้ จึงสร้างเป็นเอกสารเปล่าที่ตั้งชื่อไว้ให้แล้ว
export async function createGoogleDoc(name) {
  assertConfigured()
  const token = await getAccessToken()
  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: String(name || 'บันทึกการประชุม').slice(0, 200),
      mimeType: 'application/vnd.google-apps.document',
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`สร้าง Google Doc ไม่สำเร็จ (${res.status}) ${detail.slice(0, 200)}`)
  }
  const j = await res.json()
  return { id: j.id, name: j.name, url: j.webViewLink || `https://docs.google.com/document/d/${j.id}/edit` }
}
