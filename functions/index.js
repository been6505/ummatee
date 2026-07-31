// Cloud Functions — รวมแชทจาก LINE OA / Facebook Messenger เข้ากับแชทหน้าเว็บใน Firestore (collection เดียวกับ src/data/chat.js)
// ต้องตั้งค่า secret ก่อนใช้งานจริง (ดู docs/chat-integrations.md):
//   firebase functions:secrets:set LINE_CHANNEL_ACCESS_TOKEN
//   firebase functions:secrets:set LINE_CHANNEL_SECRET
//   firebase functions:secrets:set FB_PAGE_ACCESS_TOKEN
//   firebase functions:secrets:set FB_APP_SECRET
//   firebase functions:secrets:set FB_VERIFY_TOKEN
const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https')
const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { defineSecret } = require('firebase-functions/params')
const logger = require('firebase-functions/logger')
const crypto = require('crypto')
const admin = require('firebase-admin')

admin.initializeApp()
const db = admin.firestore()

// เทียบ signature แบบ timing-safe กัน timing attack (crypto.timingSafeEqual ต้องการ buffer ยาวเท่ากัน)
function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)
}

const LINE_CHANNEL_ACCESS_TOKEN = defineSecret('LINE_CHANNEL_ACCESS_TOKEN')
const LINE_CHANNEL_SECRET = defineSecret('LINE_CHANNEL_SECRET')
const FB_PAGE_ACCESS_TOKEN = defineSecret('FB_PAGE_ACCESS_TOKEN')
const FB_APP_SECRET = defineSecret('FB_APP_SECRET')
const FB_VERIFY_TOKEN = defineSecret('FB_VERIFY_TOKEN')

// บันทึกข้อความเข้าแชท (สร้าง/อัปเดต chats/{chatId} + เพิ่มลง messages) — ใช้ร่วมกันทุกแพลตฟอร์ม
async function ingestVisitorMessage({ chatId, platform, externalId, visitorName, text }) {
  const trimmed = (text || '').trim()
  if (!trimmed) return
  const chatRef = db.collection('chats').doc(chatId)
  await chatRef.collection('messages').add({
    sender: 'visitor', text: trimmed, createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  await chatRef.set({
    platform, externalId,
    ...(visitorName ? { visitorName } : {}),
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
    lastMessageText: trimmed,
    lastSender: 'visitor',
    unreadByAdmin: true,
    unreadByVisitor: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })
}

// ── LINE Messaging API webhook ──
exports.lineWebhook = onRequest({ secrets: [LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET] }, async (req, res) => {
  const signature = req.get('x-line-signature') || ''
  const expected = crypto.createHmac('sha256', LINE_CHANNEL_SECRET.value()).update(req.rawBody).digest('base64')
  if (!timingSafeEqualStr(signature, expected)) {
    logger.warn('lineWebhook: invalid signature')
    res.status(401).send('invalid signature')
    return
  }

  const events = req.body?.events || []
  for (const event of events) {
    if (event.type !== 'message' || event.message?.type !== 'text') continue
    const userId = event.source?.userId
    if (!userId) continue
    let visitorName
    try {
      const profileRes = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
        headers: { Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN.value()}` },
      })
      if (profileRes.ok) visitorName = (await profileRes.json())?.displayName
    } catch (e) {
      logger.warn('lineWebhook: get profile failed', e)
    }
    await ingestVisitorMessage({
      chatId: `line_${userId}`, platform: 'line', externalId: userId,
      visitorName, text: event.message.text,
    })
  }
  res.status(200).send('OK')
})

// ── Facebook Messenger webhook ──
exports.facebookWebhook = onRequest({ secrets: [FB_PAGE_ACCESS_TOKEN, FB_APP_SECRET, FB_VERIFY_TOKEN] }, async (req, res) => {
  if (req.method === 'GET') {
    // ขั้นตอนยืนยัน webhook ตอนตั้งค่าใน Meta App Dashboard
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === FB_VERIFY_TOKEN.value()) {
      res.status(200).send(req.query['hub.challenge'])
    } else {
      res.status(403).send('verification failed')
    }
    return
  }

  const signature = req.get('x-hub-signature-256') || ''
  const expected = 'sha256=' + crypto.createHmac('sha256', FB_APP_SECRET.value()).update(req.rawBody).digest('hex')
  if (!timingSafeEqualStr(signature, expected)) {
    logger.warn('facebookWebhook: invalid signature')
    res.status(401).send('invalid signature')
    return
  }

  const entries = req.body?.entry || []
  for (const entry of entries) {
    for (const event of entry.messaging || []) {
      const text = event.message?.text
      const senderId = event.sender?.id
      if (!text || !senderId || event.message?.is_echo) continue
      await ingestVisitorMessage({
        chatId: `fb_${senderId}`, platform: 'facebook', externalId: senderId, text,
      })
    }
  }
  res.status(200).send('OK')
})

// ── Instagram DM webhook ──
// IG Direct Messages ก็มาผ่าน Meta Graph API messaging webhook ตัวเดียวกับ Messenger (object: 'instagram' แทน 'page')
// ใช้ signature verification แบบเดียวกับ facebookWebhook (ใช้ META_APP_SECRET ตัวเดียวกัน เพราะแอป Meta เดียวกัน)
// ต้องตั้งค่าเพิ่มใน Meta App Dashboard: subscribe field 'messages' ของ IG object, และเชื่อม IG Business
// account เข้ากับ Facebook Page ที่มี FB_PAGE_ACCESS_TOKEN นี้อยู่แล้ว (permission ผ่าน scope
// instagram_manage_messages ที่เพิ่มใน instagramProvider ด้านล่าง — บัญชี IG ต้อง reconnect ก่อนถึงจะมี scope นี้)
exports.instagramWebhook = onRequest({ secrets: [FB_PAGE_ACCESS_TOKEN, FB_APP_SECRET, FB_VERIFY_TOKEN] }, async (req, res) => {
  if (req.method === 'GET') {
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === FB_VERIFY_TOKEN.value()) {
      res.status(200).send(req.query['hub.challenge'])
    } else {
      res.status(403).send('verification failed')
    }
    return
  }

  const signature = req.get('x-hub-signature-256') || ''
  const expected = 'sha256=' + crypto.createHmac('sha256', FB_APP_SECRET.value()).update(req.rawBody).digest('hex')
  if (!timingSafeEqualStr(signature, expected)) {
    logger.warn('instagramWebhook: invalid signature')
    res.status(401).send('invalid signature')
    return
  }

  const entries = req.body?.entry || []
  for (const entry of entries) {
    for (const event of entry.messaging || []) {
      const text = event.message?.text
      const senderId = event.sender?.id
      if (!text || !senderId || event.message?.is_echo) continue
      await ingestVisitorMessage({
        chatId: `ig_${senderId}`, platform: 'instagram', externalId: senderId, text,
      })
    }
  }
  res.status(200).send('OK')
})

// ── ส่งข้อความที่แอดมินตอบกลับ ออกไปยัง LINE/Facebook จริง ──
// (แชทฝั่งเว็บไม่ต้องทำอะไรเพิ่ม เพราะ realtime ผ่าน Firestore listener อยู่แล้ว)
exports.onAdminReply = onDocumentCreated(
  { document: 'chats/{chatId}/messages/{msgId}', secrets: [LINE_CHANNEL_ACCESS_TOKEN, FB_PAGE_ACCESS_TOKEN] },
  async (event) => {
    const msg = event.data?.data()
    if (!msg || msg.sender !== 'admin') return
    const chatSnap = await db.collection('chats').doc(event.params.chatId).get()
    const chat = chatSnap.data()
    if (!chat?.platform || chat.platform === 'web' || !chat.externalId) return

    try {
      if (chat.platform === 'line') {
        await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN.value()}`,
          },
          body: JSON.stringify({ to: chat.externalId, messages: [{ type: 'text', text: msg.text }] }),
        })
      } else if (chat.platform === 'facebook') {
        await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(FB_PAGE_ACCESS_TOKEN.value())}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient: { id: chat.externalId }, message: { text: msg.text } }),
        })
      } else if (chat.platform === 'instagram') {
        // ส่ง DM กลับผ่าน Page access token เดียวกัน (IG Business ผูกกับ FB Page) — endpoint /me/messages
        // ตัวเดียวกับ Messenger แต่ Meta แยกส่งไปแพลตฟอร์มที่ถูกต้องตาม recipient id เอง
        await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(FB_PAGE_ACCESS_TOKEN.value())}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient: { id: chat.externalId }, message: { text: msg.text } }),
        })
      }
    } catch (e) {
      logger.error(`onAdminReply: push to ${chat.platform} failed`, e)
    }
  }
)

// ══════════════════════════════════════════════════════════════════════════
// เชื่อมต่อบัญชีโซเชียล (OAuth) และโพสต์จริงลง Facebook/Instagram/Threads/YouTube/TikTok
// จากหน้า /admin/calendar เดิมฝัง iframe ของแอปแยก "Content Hub" (Next.js) ไว้ทำงานนี้ แต่หน้า
// ล็อกอินของ Google/Facebook ปฏิเสธการเรนเดอร์ใน iframe เสมอ (กันฟิชชิ่ง) เลยย้าย OAuth + publish
// logic ทั้งหมดมาไว้ที่นี่ ให้หน้า /admin/calendar เรียกตรงแบบ native
//
// ต้องตั้งค่า secret ก่อนใช้งานจริง:
//   firebase functions:secrets:set META_APP_ID              (Facebook + Instagram + Threads ใช้แอป Meta เดียวกัน)
//   firebase functions:secrets:set META_APP_SECRET
//   firebase functions:secrets:set GOOGLE_CLIENT_ID          (YouTube)
//   firebase functions:secrets:set GOOGLE_CLIENT_SECRET
//   firebase functions:secrets:set TIKTOK_CLIENT_KEY
//   firebase functions:secrets:set TIKTOK_CLIENT_SECRET
//   firebase functions:secrets:set SOCIAL_OAUTH_STATE_SECRET (สุ่มสตริงยาวๆ เอง ใช้เซ็น state กัน CSRF)
// ══════════════════════════════════════════════════════════════════════════

// ต้องตรงกับ isAdmin() ใน firestore.rules — คนอื่นห้ามเชื่อมบัญชีโซเชียล/โพสต์จริงแทนแอดมิน
const ADMIN_EMAILS = ['akasitlove@gmail.com', 'ummatee.thailand@gmail.com'] // ต้องตรงกับ isFullAdmin() ใน firestore.rules

const META_APP_ID = defineSecret('META_APP_ID')
const META_APP_SECRET = defineSecret('META_APP_SECRET')
const GOOGLE_CLIENT_ID = defineSecret('GOOGLE_CLIENT_ID')
const GOOGLE_CLIENT_SECRET = defineSecret('GOOGLE_CLIENT_SECRET')
const TIKTOK_CLIENT_KEY = defineSecret('TIKTOK_CLIENT_KEY')
const TIKTOK_CLIENT_SECRET = defineSecret('TIKTOK_CLIENT_SECRET')
const SOCIAL_OAUTH_STATE_SECRET = defineSecret('SOCIAL_OAUTH_STATE_SECRET')
// ลบไฟล์รูป/วิดีโอออกจาก Cloudinary หลังโพสต์จริงสำเร็จไปแล้วสักพัก (ดู cleanupPublishedMedia ท้ายไฟล์)
// อัปโหลดฝั่ง client ใช้ unsigned preset ได้ (src/utils/cloudinary.js) แต่ "ลบ" ต้องเซ็น request ด้วย
// api_key+api_secret เสมอ (Cloudinary ไม่มี unsigned delete) เลยต้องทำฝั่งนี้เท่านั้น
const CLOUDINARY_CLOUD = 'dei5jktuw' // ตรงกับ src/utils/cloudinary.js — ไม่ใช่ secret เป็นชื่อ cloud สาธารณะ
const CLOUDINARY_API_KEY = defineSecret('CLOUDINARY_API_KEY')
const CLOUDINARY_API_SECRET = defineSecret('CLOUDINARY_API_SECRET')

const SITE_URL = 'https://ummatee-app.web.app'
// โดเมนของ Cloud Functions เอง — socialOAuthUrl ต้องประกอบ redirect_uri ให้ตรงเป๊ะกับที่
// socialOAuthCallback อ่านจาก req.get('host') ตอนแลก code (แพลตฟอร์มเทียบ redirect_uri แบบตรงตัว
// ทั้งขาไปและขากลับ ต่างกันตัวเดียวก็ถูกปฏิเสธ) — เดิม onRequest อ่าน host จาก request ได้เอง
// แต่ onCall ไม่มี host ให้อ่าน จึงต้องระบุไว้ตรงนี้ และต้องแก้ถ้าย้าย region
const FUNCTIONS_BASE_URL = 'https://us-central1-ummatee-app.cloudfunctions.net'
const PLATFORMS = ['facebook', 'instagram', 'threads', 'youtube', 'tiktok']

// ── OAuth "state" แบบเซ็นเอง (ไม่พึ่งคุกกี้ เพราะ Cloud Functions อยู่คนละ origin กับ ummatee-app.web.app
// จะฝากคุกกี้ cross-site แล้วอ่านกลับตอน redirect กลับมาไม่ได้แน่นอนในเบราว์เซอร์สมัยใหม่) ──
// state = base64url(platform.uid.iat.nonce) + "." + HMAC-SHA256 เซ็นด้วย SOCIAL_OAUTH_STATE_SECRET
// อายุ 10 นาที กันโดนแคปเจอร์แล้วเอากลับมาใช้ซ้ำนานๆ ทีหลัง
function signOAuthState(platform, uid) {
  const payload = `${platform}.${uid}.${Date.now()}.${crypto.randomBytes(8).toString('hex')}`
  const b64 = Buffer.from(payload).toString('base64url')
  const sig = crypto.createHmac('sha256', SOCIAL_OAUTH_STATE_SECRET.value()).update(b64).digest('base64url')
  return `${b64}.${sig}`
}

function verifyOAuthState(state, expectedPlatform) {
  const [b64, sig] = String(state || '').split('.')
  if (!b64 || !sig) return null
  const expectedSig = crypto.createHmac('sha256', SOCIAL_OAUTH_STATE_SECRET.value()).update(b64).digest('base64url')
  if (!timingSafeEqualStr(sig, expectedSig)) return null
  const [platform, uid, iat] = Buffer.from(b64, 'base64url').toString('utf8').split('.')
  if (platform !== expectedPlatform) return null
  if (!iat || Date.now() - Number(iat) > 10 * 60 * 1000) return null
  return { uid }
}

// ตรวจว่าเป็นแอดมินจริง — ทุกทางเข้าใช้ตัวนี้ตัวเดียว เพราะ onCall ให้ token ที่ verify แล้วมาใน
// request.auth อยู่แล้ว (ไม่มีที่ไหนรับ ID token ดิบทาง query string อีกต่อไป)
function requireAdminCallable(request) {
  const email = request.auth?.token?.email
  if (!request.auth || !email || !ADMIN_EMAILS.includes(email)) {
    throw new HttpsError('permission-denied', 'ต้องเป็นแอดมินเท่านั้น')
  }
}

// ══════════════════════════ ผู้ให้บริการ OAuth ต่อแพลตฟอร์ม ══════════════════════════
// รูปแบบพอร์ตมาจาก content-hub/lib/oauth/*.ts (Next.js เดิม) แปลงเป็น JS ล้วน ไม่มี TypeScript

function metaAppId() { return META_APP_ID.value() }
function metaAppSecret() { return META_APP_SECRET.value() }

// ── Facebook Page ──
const FB_GRAPH = 'https://graph.facebook.com/v21.0'
const facebookProvider = {
  // read_insights เพิ่มเข้ามาสำหรับ Page Insights (socialGetPageInsights) — บัญชีที่เชื่อมต่อไว้ก่อนหน้านี้
  // ต้องเชื่อมต่อใหม่ (reconnect) ก่อน ถึงจะได้ scope นี้ ของเดิมจะขาด permission ตอนเรียก insights
  scopes: ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement', 'read_insights'].join(','),
  getAuthUrl(redirectUri, state) {
    const params = new URLSearchParams({
      client_id: metaAppId(), redirect_uri: redirectUri, scope: this.scopes, response_type: 'code', state,
    })
    return `https://www.facebook.com/v21.0/dialog/oauth?${params}`
  },
  async exchangeCode(code, redirectUri) {
    const params = new URLSearchParams({ client_id: metaAppId(), redirect_uri: redirectUri, client_secret: metaAppSecret(), code })
    const res = await fetch(`${FB_GRAPH}/oauth/access_token?${params}`)
    if (!res.ok) throw new Error(`Facebook token exchange failed: ${await res.text()}`)
    const shortLived = await res.json()

    const longParams = new URLSearchParams({
      grant_type: 'fb_exchange_token', client_id: metaAppId(), client_secret: metaAppSecret(), fb_exchange_token: shortLived.access_token,
    })
    const longRes = await fetch(`${FB_GRAPH}/oauth/access_token?${longParams}`)
    if (!longRes.ok) throw new Error(`Facebook long-lived exchange failed: ${await longRes.text()}`)
    const userToken = (await longRes.json()).access_token

    const pagesRes = await fetch(`${FB_GRAPH}/me/accounts?fields=id,name,access_token,picture&access_token=${userToken}`)
    if (!pagesRes.ok) throw new Error(`Failed to list Facebook Pages (${pagesRes.status}).`)
    const page = (await pagesRes.json()).data?.[0]
    if (!page) throw new Error('ไม่พบ Facebook Page ของบัญชีนี้ — ต้องสร้าง Page ก่อน')

    return {
      accessToken: page.access_token, // Page token ไม่หมดอายุ
      refreshToken: null,
      expiresAt: null,
      externalId: page.id,
      displayName: page.name,
      handle: '',
      avatarUrl: page.picture?.data?.url || null,
    }
  },
}

async function publishFacebookPost(pageAccessToken, pageId, input) {
  let endpoint
  const params = new URLSearchParams({ access_token: pageAccessToken })
  if (input.videoUrl) {
    endpoint = `${FB_GRAPH}/${pageId}/videos`
    params.set('file_url', input.videoUrl)
    if (input.text) params.set('description', input.text)
  } else if (input.imageUrl) {
    endpoint = `${FB_GRAPH}/${pageId}/photos`
    params.set('url', input.imageUrl)
    if (input.text) params.set('caption', input.text)
  } else {
    endpoint = `${FB_GRAPH}/${pageId}/feed`
    params.set('message', input.text)
  }
  const res = await fetch(endpoint, { method: 'POST', body: params })
  if (!res.ok) throw new Error(`Facebook post failed: ${await res.text()}`)
  const result = await res.json()
  const id = result.post_id ?? result.id
  let permalink
  try {
    const p = await fetch(`${FB_GRAPH}/${id}?fields=permalink_url&access_token=${pageAccessToken}`)
    if (p.ok) permalink = (await p.json()).permalink_url
  } catch { /* permalink เป็น best-effort */ }
  return { id, permalink }
}

// ── Instagram (Business login) ──
const IG_GRAPH = 'https://graph.instagram.com'
const instagramProvider = {
  // instagram_manage_messages (สำหรับ instagramWebhook DM inbox) และ instagram_manage_insights
  // (สำหรับ socialGetPageInsights) เพิ่มใหม่ — บัญชี IG ที่เชื่อมต่อไว้ก่อนหน้านี้ต้อง reconnect ก่อนถึงจะมีสอง scope นี้
  scopes: ['instagram_business_basic', 'instagram_business_content_publish', 'instagram_manage_messages', 'instagram_manage_insights'].join(','),
  getAuthUrl(redirectUri, state) {
    const params = new URLSearchParams({ client_id: metaAppId(), redirect_uri: redirectUri, scope: this.scopes, response_type: 'code', state })
    return `https://www.instagram.com/oauth/authorize?${params}`
  },
  async exchangeCode(code, redirectUri) {
    const res = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: metaAppId(), client_secret: metaAppSecret(), grant_type: 'authorization_code',
        redirect_uri: redirectUri, code: code.replace(/#_$/, ''),
      }),
    })
    if (!res.ok) throw new Error(`Instagram token exchange failed: ${await res.text()}`)
    const shortLived = await res.json()

    const longParams = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: metaAppSecret(), access_token: shortLived.access_token })
    const longRes = await fetch(`${IG_GRAPH}/access_token?${longParams}`)
    if (!longRes.ok) throw new Error(`Instagram long-lived exchange failed: ${await longRes.text()}`)
    const longLived = await longRes.json()

    const profRes = await fetch(`${IG_GRAPH}/me?fields=id,username,profile_picture_url&access_token=${longLived.access_token}`)
    if (!profRes.ok) throw new Error(`Failed to fetch Instagram profile (${profRes.status}).`)
    const profile = await profRes.json()

    return {
      accessToken: longLived.access_token,
      refreshToken: longLived.access_token, // ไม่มี refresh token แยก — token ตัวเองใช้ refresh ตัวเองได้
      expiresAt: new Date(Date.now() + longLived.expires_in * 1000).toISOString(),
      externalId: profile.id,
      displayName: profile.username ? `@${profile.username}` : 'Instagram',
      handle: profile.username ? `@${profile.username}` : '',
      avatarUrl: profile.profile_picture_url || null,
    }
  },
}

async function refreshInstagramToken(token) {
  const params = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token })
  const res = await fetch(`${IG_GRAPH}/refresh_access_token?${params}`)
  if (!res.ok) throw new Error(`Instagram token refresh failed: ${await res.text()}`)
  const data = await res.json()
  return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString() }
}

async function publishInstagramPost(accessToken, igUserId, input) {
  if (!input.imageUrl && !input.videoUrl) throw new Error('Instagram ต้องมีรูปหรือวิดีโอ — โพสต์ข้อความล้วนไม่ได้')
  const containerParams = new URLSearchParams({ access_token: accessToken })
  if (input.videoUrl) {
    containerParams.set('media_type', 'REELS')
    containerParams.set('video_url', input.videoUrl)
  } else {
    containerParams.set('image_url', input.imageUrl)
  }
  if (input.text) containerParams.set('caption', input.text)

  const createRes = await fetch(`${IG_GRAPH}/${igUserId}/media`, { method: 'POST', body: containerParams })
  if (!createRes.ok) throw new Error(`Instagram container creation failed: ${await createRes.text()}`)
  const container = await createRes.json()

  if (input.videoUrl) {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 3000))
      const s = await fetch(`${IG_GRAPH}/${container.id}?fields=status_code&access_token=${accessToken}`)
      const status = s.ok ? (await s.json()).status_code : null
      if (status === 'FINISHED') break
      if (status === 'ERROR') throw new Error('Instagram video processing failed.')
    }
  }

  const pubRes = await fetch(`${IG_GRAPH}/${igUserId}/media_publish`, {
    method: 'POST', body: new URLSearchParams({ creation_id: container.id, access_token: accessToken }),
  })
  if (!pubRes.ok) throw new Error(`Instagram publish failed: ${await pubRes.text()}`)
  const published = await pubRes.json()
  let permalink
  try {
    const p = await fetch(`${IG_GRAPH}/${published.id}?fields=permalink&access_token=${accessToken}`)
    if (p.ok) permalink = (await p.json()).permalink
  } catch { /* best-effort */ }
  return { id: published.id, permalink }
}

// ── Threads ──
const THREADS_GRAPH = 'https://graph.threads.net'
const threadsProvider = {
  // threads_manage_insights เพิ่มใหม่สำหรับ socialGetPageInsights — บัญชีเดิมต้อง reconnect ก่อนถึงจะมี scope นี้
  scopes: ['threads_basic', 'threads_content_publish', 'threads_manage_insights'].join(','),
  getAuthUrl(redirectUri, state) {
    const params = new URLSearchParams({ client_id: metaAppId(), redirect_uri: redirectUri, scope: this.scopes, response_type: 'code', state })
    return `https://threads.net/oauth/authorize?${params}`
  },
  async exchangeCode(code, redirectUri) {
    const res = await fetch(`${THREADS_GRAPH}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: metaAppId(), client_secret: metaAppSecret(), grant_type: 'authorization_code',
        redirect_uri: redirectUri, code: code.replace(/#_$/, ''),
      }),
    })
    if (!res.ok) throw new Error(`Threads token exchange failed: ${await res.text()}`)
    const shortLived = await res.json()

    const longParams = new URLSearchParams({ grant_type: 'th_exchange_token', client_secret: metaAppSecret(), access_token: shortLived.access_token })
    const longRes = await fetch(`${THREADS_GRAPH}/access_token?${longParams}`)
    if (!longRes.ok) throw new Error(`Threads long-lived exchange failed: ${await longRes.text()}`)
    const longLived = await longRes.json()

    const profRes = await fetch(`${THREADS_GRAPH}/v1.0/me?fields=id,username,threads_profile_picture_url&access_token=${longLived.access_token}`)
    if (!profRes.ok) throw new Error(`Failed to fetch Threads profile (${profRes.status}).`)
    const profile = await profRes.json()

    return {
      accessToken: longLived.access_token,
      refreshToken: longLived.access_token,
      expiresAt: new Date(Date.now() + longLived.expires_in * 1000).toISOString(),
      externalId: profile.id,
      displayName: profile.username ? `@${profile.username}` : 'Threads',
      handle: profile.username ? `@${profile.username}` : '',
      avatarUrl: profile.threads_profile_picture_url || null,
    }
  },
}

async function refreshThreadsToken(token) {
  const params = new URLSearchParams({ grant_type: 'th_refresh_token', access_token: token })
  const res = await fetch(`${THREADS_GRAPH}/refresh_access_token?${params}`)
  if (!res.ok) throw new Error(`Threads token refresh failed: ${await res.text()}`)
  const data = await res.json()
  return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString() }
}

async function publishThreadsPost(accessToken, userId, input) {
  const containerParams = new URLSearchParams({ access_token: accessToken })
  if (input.videoUrl) {
    containerParams.set('media_type', 'VIDEO')
    containerParams.set('video_url', input.videoUrl)
  } else if (input.imageUrl) {
    containerParams.set('media_type', 'IMAGE')
    containerParams.set('image_url', input.imageUrl)
  } else {
    containerParams.set('media_type', 'TEXT')
  }
  if (input.text) containerParams.set('text', input.text)

  const createRes = await fetch(`${THREADS_GRAPH}/v1.0/${userId}/threads`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: containerParams,
  })
  if (!createRes.ok) throw new Error(`Threads container creation failed: ${await createRes.text()}`)
  const container = await createRes.json()

  if (input.videoUrl) await new Promise((r) => setTimeout(r, 5000))

  const pubRes = await fetch(`${THREADS_GRAPH}/v1.0/${userId}/threads_publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: container.id, access_token: accessToken }),
  })
  if (!pubRes.ok) throw new Error(`Threads publish failed: ${await pubRes.text()}`)
  const published = await pubRes.json()
  let permalink
  try {
    const p = await fetch(`${THREADS_GRAPH}/v1.0/${published.id}?fields=permalink&access_token=${accessToken}`)
    if (p.ok) permalink = (await p.json()).permalink
  } catch { /* best-effort */ }
  return { id: published.id, permalink }
}

// ── YouTube (Google) ──
const youtubeProvider = {
  // yt-analytics.readonly เพิ่มใหม่สำหรับ socialGetPageInsights (เรียก YouTube Analytics API v2 คนละ host
  // กับ Data API ที่ใช้ตอนอัปโหลด — ดู fetchYouTubeInsights ด้านล่าง) บัญชีเดิมต้อง reconnect ก่อนถึงจะมี scope นี้
  scopes: [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
  ].join(' '),
  getAuthUrl(redirectUri, state) {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID.value(), redirect_uri: redirectUri, response_type: 'code',
      scope: this.scopes, access_type: 'offline', prompt: 'consent', state,
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  },
  async exchangeCode(code, redirectUri) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: GOOGLE_CLIENT_ID.value(), client_secret: GOOGLE_CLIENT_SECRET.value(),
        redirect_uri: redirectUri, grant_type: 'authorization_code',
      }),
    })
    if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`)
    const tokens = await res.json()

    const chRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (!chRes.ok) throw new Error(`Failed to fetch YouTube channel (${chRes.status}).`)
    const channel = (await chRes.json()).items?.[0]
    if (!channel) throw new Error('ไม่พบช่อง YouTube ของบัญชี Google นี้')

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      externalId: channel.id,
      displayName: channel.snippet?.title || 'YouTube',
      handle: channel.id,
      avatarUrl: channel.snippet?.thumbnails?.default?.url || null,
    }
  },
}

async function refreshYouTubeToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken, client_id: GOOGLE_CLIENT_ID.value(), client_secret: GOOGLE_CLIENT_SECRET.value(), grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`)
  const tokens = await res.json()
  return { accessToken: tokens.access_token, expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString() }
}

async function uploadYouTubeVideo(accessToken, input) {
  const videoRes = await fetch(input.videoUrl)
  if (!videoRes.ok) throw new Error('ดาวน์โหลดไฟล์วิดีโอมาอัปโหลดขึ้น YouTube ไม่สำเร็จ')
  const contentType = videoRes.headers.get('content-type') || 'video/mp4'
  const buffer = Buffer.from(await videoRes.arrayBuffer())

  const initRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json',
      'X-Upload-Content-Type': contentType, 'X-Upload-Content-Length': String(buffer.byteLength),
    },
    body: JSON.stringify({
      snippet: { title: input.title, description: input.description },
      status: { privacyStatus: input.privacyStatus || 'public' },
    }),
  })
  if (!initRes.ok) throw new Error(`YouTube upload could not be initiated: ${await initRes.text()}`)
  const uploadUrl = initRes.headers.get('location')
  if (!uploadUrl) throw new Error('YouTube ไม่ส่ง upload URL กลับมา')

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT', headers: { 'Content-Type': contentType, 'Content-Length': String(buffer.byteLength) }, body: buffer,
  })
  if (!uploadRes.ok) throw new Error(`YouTube upload failed: ${await uploadRes.text()}`)
  const video = await uploadRes.json()
  return { videoId: video.id }
}

// ── TikTok ──
const TIKTOK_API = 'https://open.tiktokapis.com/v2'
const tiktokProvider = {
  scopes: ['user.info.basic', 'video.upload'].join(','),
  getAuthUrl(redirectUri, state) {
    const params = new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY.value(), scope: this.scopes, response_type: 'code', redirect_uri: redirectUri, state,
    })
    return `https://www.tiktok.com/v2/auth/authorize/?${params}`
  },
  async exchangeCode(code, redirectUri) {
    const res = await fetch(`${TIKTOK_API}/oauth/token/`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY.value(), client_secret: TIKTOK_CLIENT_SECRET.value(),
        code, grant_type: 'authorization_code', redirect_uri: redirectUri,
      }),
    })
    if (!res.ok) throw new Error(`TikTok token exchange failed: ${await res.text()}`)
    const tokens = await res.json()
    if (tokens.error) throw new Error(`TikTok token exchange failed: ${tokens.error_description || tokens.error}`)

    const userRes = await fetch(`${TIKTOK_API}/user/info/?fields=open_id,display_name,avatar_url`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (!userRes.ok) throw new Error(`Failed to fetch TikTok profile (${userRes.status}).`)
    const user = (await userRes.json()).data?.user
    if (!user) throw new Error('TikTok ไม่ส่งข้อมูลผู้ใช้กลับมา')

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      externalId: tokens.open_id || user.open_id,
      displayName: user.display_name || 'TikTok',
      handle: user.display_name ? `@${user.display_name}` : '',
      avatarUrl: user.avatar_url || null,
    }
  },
}

async function refreshTikTokToken(refreshToken) {
  const res = await fetch(`${TIKTOK_API}/oauth/token/`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY.value(), client_secret: TIKTOK_CLIENT_SECRET.value(),
      grant_type: 'refresh_token', refresh_token: refreshToken,
    }),
  })
  if (!res.ok) throw new Error(`TikTok token refresh failed: ${await res.text()}`)
  const tokens = await res.json()
  if (tokens.error) throw new Error(`TikTok token refresh failed: ${tokens.error_description || tokens.error}`)
  return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString() }
}

// อัปโหลดวิดีโอเข้ากล่องขาเข้า (inbox/draft) ของ TikTok — เจ้าของบัญชีต้องกดโพสต์ต่อในแอป TikTok เอง
// (ครีเอเตอร์ต้องยืนยันคำบรรยาย/การตั้งค่าความเป็นส่วนตัวเองตามนโยบาย TikTok, จำกัดไฟล์ ≤ 64MB)
async function publishTikTokVideo(accessToken, input) {
  const videoRes = await fetch(input.videoUrl)
  if (!videoRes.ok) throw new Error('ดาวน์โหลดวิดีโอมาอัปโหลดขึ้น TikTok ไม่สำเร็จ')
  const buffer = Buffer.from(await videoRes.arrayBuffer())
  const size = buffer.byteLength
  if (size > 64 * 1024 * 1024) throw new Error('วิดีโอใหญ่เกิน 64MB (ข้อจำกัดของการเชื่อมต่อนี้)')

  const initRes = await fetch(`${TIKTOK_API}/post/publish/inbox/video/init/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: size, total_chunk_count: 1 } }),
  })
  if (!initRes.ok) throw new Error(`TikTok upload init failed: ${await initRes.text()}`)
  const init = await initRes.json()
  if (init.error && init.error.code !== 'ok') throw new Error(`TikTok upload init failed: ${init.error.message || init.error.code}`)
  const publishId = init.data.publish_id
  const uploadUrl = init.data.upload_url

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size), 'Content-Range': `bytes 0-${size - 1}/${size}` },
    body: buffer,
  })
  if (!putRes.ok) throw new Error(`TikTok video upload failed: ${await putRes.text()}`)

  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const statusRes = await fetch(`${TIKTOK_API}/post/publish/status/fetch/`, {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ publish_id: publishId }),
    })
    if (!statusRes.ok) continue
    const status = await statusRes.json()
    const s = status.data?.status
    if (s === 'SEND_TO_USER_INBOX' || s === 'PUBLISH_COMPLETE') return { id: publishId }
    if (s === 'FAILED') throw new Error(`TikTok upload failed: ${status.data?.fail_reason || 'unknown reason'}`)
  }
  return { id: publishId } // ยังประมวลผลอยู่ — TikTok ทำต่อแบบ async
}

const OAUTH_PROVIDERS = { facebook: facebookProvider, instagram: instagramProvider, threads: threadsProvider, youtube: youtubeProvider, tiktok: tiktokProvider }

// ══════════════════════════ HTTPS: เริ่ม/รับกลับ OAuth ══════════════════════════

// คืน URL หน้าล็อกอินของแพลตฟอร์ม ให้ฝั่งเว็บพาไปเอง (window.location.href = authUrl)
//
// เดิมเป็น onRequest ที่รับ ?idToken=... แล้ว redirect ต่อ — ปัญหาคือ Firebase ID token ไปโผล่ใน
// query string ซึ่งถูกเก็บไว้หลายที่ที่เราคุมไม่ได้: ประวัติเบราว์เซอร์, access log ของ Google,
// และ Referer header ที่ถูกส่งต่อไปยังแพลตฟอร์มปลายทางตอน redirect
// เปลี่ยนมาเป็น onCall — token เดินทางใน body ของ POST ตามโปรโตคอล callable ไม่โผล่ใน URL เลย
//
// URL ที่คืนไปมีแค่ client_id + redirect_uri + state ที่เซ็น HMAC ไว้ ไม่มีความลับอยู่ในนั้น
exports.socialOAuthUrl = onCall(
  { secrets: [META_APP_ID, META_APP_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, SOCIAL_OAUTH_STATE_SECRET] },
  async (request) => {
    requireAdminCallable(request)
    const platform = String(request.data?.platform || '')
    const provider = OAUTH_PROVIDERS[platform]
    if (!provider) throw new HttpsError('invalid-argument', 'platform ไม่ถูกต้อง')

    // ต้องเป็นโดเมนเดียวกับที่ socialOAuthCallback ถูก deploy ไว้ เพราะ redirect_uri ต้องตรงเป๊ะ
    // กับที่ลงทะเบียนไว้ในแอปของแต่ละแพลตฟอร์ม ไม่งั้นแพลตฟอร์มจะปฏิเสธตั้งแต่ขั้นแรก
    const redirectUri = `${FUNCTIONS_BASE_URL}/socialOAuthCallback?platform=${platform}`
    const state = signOAuthState(platform, request.auth.uid)
    return { authUrl: provider.getAuthUrl(redirectUri, state) }
  }
)

// GET /socialOAuthCallback?platform=facebook&code=...&state=...
exports.socialOAuthCallback = onRequest(
  { secrets: [META_APP_ID, META_APP_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, SOCIAL_OAUTH_STATE_SECRET] },
  async (req, res) => {
    const platform = String(req.query.platform || '')
    const code = req.query.code
    const state = req.query.state
    const oauthError = req.query.error
    const provider = OAUTH_PROVIDERS[platform]
    if (!provider) { res.redirect(`${SITE_URL}/admin/calendar?social_error=unknown-platform`); return }

    const verified = verifyOAuthState(state, platform)
    if (!verified) { res.redirect(`${SITE_URL}/admin/calendar?social_error=${platform}-state-mismatch`); return }
    if (oauthError || !code) { res.redirect(`${SITE_URL}/admin/calendar?social_error=${platform}-denied`); return }

    try {
      const redirectUri = `https://${req.get('host')}/socialOAuthCallback?platform=${platform}`
      const result = await provider.exchangeCode(String(code), redirectUri)

      await db.collection('socialAccounts').doc(platform).set({
        platform,
        displayName: result.displayName,
        handle: result.handle,
        externalId: result.externalId,
        avatarUrl: result.avatarUrl || null,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken || null,
        tokenExpiresAt: result.expiresAt || null,
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        connectedByUid: verified.uid,
      })

      res.redirect(`${SITE_URL}/admin/calendar?social_connected=${platform}`)
    } catch (err) {
      logger.error(`socialOAuthCallback: ${platform} failed`, err)
      res.redirect(`${SITE_URL}/admin/calendar?social_error=${platform}-failed&social_message=${encodeURIComponent(err.message || '')}`)
    }
  }
)

// ══════════════════════════ Callable: สถานะ/ยกเลิกเชื่อมต่อ ══════════════════════════

// คืนสถานะเชื่อมต่อของทุกแพลตฟอร์ม "ไม่มี token หลุดออกไปฝั่ง client เด็ดขาด"
exports.socialAccountsStatus = onCall(async (request) => {
  requireAdminCallable(request)
  const snap = await db.collection('socialAccounts').get()
  const byPlatform = {}
  snap.forEach((d) => { byPlatform[d.id] = d.data() })

  const result = {}
  for (const platform of PLATFORMS) {
    const acc = byPlatform[platform]
    result[platform] = acc
      ? { connected: true, displayName: acc.displayName, handle: acc.handle, avatarUrl: acc.avatarUrl || null }
      : { connected: false }
  }
  return result
})

exports.socialDisconnect = onCall(async (request) => {
  requireAdminCallable(request)
  const platform = request.data?.platform
  if (!PLATFORMS.includes(platform)) throw new HttpsError('invalid-argument', 'platform ไม่ถูกต้อง')
  await db.collection('socialAccounts').doc(platform).delete()
  return { ok: true }
})

// ══════════════════════════ โพสต์จริง ══════════════════════════

async function getFreshAccessToken(platform, account) {
  const expiresAt = account.tokenExpiresAt ? new Date(account.tokenExpiresAt).getTime() : 0
  const soon = Date.now() + 60_000
  if (account.accessToken && (!account.tokenExpiresAt || expiresAt > soon)) return account.accessToken

  const ref = db.collection('socialAccounts').doc(platform)
  if (platform === 'youtube') {
    if (!account.refreshToken) throw new Error('YouTube ต้องเชื่อมต่อบัญชีใหม่')
    const r = await refreshYouTubeToken(account.refreshToken)
    await ref.update({ accessToken: r.accessToken, tokenExpiresAt: r.expiresAt })
    return r.accessToken
  }
  if (platform === 'tiktok') {
    if (!account.refreshToken) throw new Error('TikTok ต้องเชื่อมต่อบัญชีใหม่')
    const r = await refreshTikTokToken(account.refreshToken)
    await ref.update({ accessToken: r.accessToken, refreshToken: r.refreshToken, tokenExpiresAt: r.expiresAt })
    return r.accessToken
  }
  if (platform === 'instagram') {
    if (!account.accessToken) throw new Error('Instagram ต้องเชื่อมต่อบัญชีใหม่')
    const r = await refreshInstagramToken(account.accessToken)
    await ref.update({ accessToken: r.accessToken, refreshToken: r.accessToken, tokenExpiresAt: r.expiresAt })
    return r.accessToken
  }
  if (platform === 'threads') {
    if (!account.accessToken) throw new Error('Threads ต้องเชื่อมต่อบัญชีใหม่')
    const r = await refreshThreadsToken(account.accessToken)
    await ref.update({ accessToken: r.accessToken, refreshToken: r.accessToken, tokenExpiresAt: r.expiresAt })
    return r.accessToken
  }
  // facebook: page token ไม่หมดอายุ
  return account.accessToken
}

// โพสต์ไปทีละแพลตฟอร์ม — คืนผลสำเร็จ/ล้มเหลวแยกต่อแพลตฟอร์ม ไม่ throw ทิ้งกลางทาง
async function publishToPlatform(platform, post) {
  const accSnap = await db.collection('socialAccounts').doc(platform).get()
  if (!accSnap.exists) return { ok: false, error: 'ยังไม่ได้เชื่อมต่อบัญชี' }
  const account = accSnap.data()
  const caption = [post.title, post.text].filter(Boolean).join('\n\n')
  const mediaUrls = post.mediaUrls || []
  const imageUrl = mediaUrls.find((u) => !/\.(mp4|mov|webm)/i.test(u))
  const videoUrl = mediaUrls.find((u) => /\.(mp4|mov|webm)/i.test(u))

  try {
    const accessToken = await getFreshAccessToken(platform, account)

    if (platform === 'facebook') {
      const { id, permalink } = await publishFacebookPost(accessToken, account.externalId, { text: caption, imageUrl, videoUrl })
      return { ok: true, externalId: id, externalUrl: permalink || null, publishedAt: new Date().toISOString() }
    }
    if (platform === 'instagram') {
      const { id, permalink } = await publishInstagramPost(accessToken, account.externalId, { text: caption, imageUrl, videoUrl })
      return { ok: true, externalId: id, externalUrl: permalink || null, publishedAt: new Date().toISOString() }
    }
    if (platform === 'threads') {
      const { id, permalink } = await publishThreadsPost(accessToken, account.externalId, { text: caption, imageUrl, videoUrl })
      return { ok: true, externalId: id, externalUrl: permalink || null, publishedAt: new Date().toISOString() }
    }
    if (platform === 'youtube') {
      if (!videoUrl) return { ok: false, error: 'YouTube ต้องมีไฟล์วิดีโอ' }
      const { videoId } = await uploadYouTubeVideo(accessToken, { title: (post.title || caption).slice(0, 100) || 'Untitled', description: caption, videoUrl })
      return { ok: true, externalId: videoId, externalUrl: `https://youtube.com/watch?v=${videoId}`, publishedAt: new Date().toISOString() }
    }
    if (platform === 'tiktok') {
      if (!videoUrl) return { ok: false, error: 'TikTok ต้องมีไฟล์วิดีโอ' }
      const { id } = await publishTikTokVideo(accessToken, { title: caption, videoUrl })
      return { ok: true, externalId: id, publishedAt: new Date().toISOString() }
    }
    return { ok: false, error: 'ไม่รองรับแพลตฟอร์มนี้' }
  } catch (err) {
    logger.error(`publishToPlatform: ${platform} failed`, err)
    return { ok: false, error: err.message || 'โพสต์ไม่สำเร็จ' }
  }
}

async function publishPostNow(postId) {
  const ref = db.collection('contentPosts').doc(postId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('ไม่พบโพสต์นี้')
  const post = snap.data()
  const targets = (post.platforms || []).filter((p) => PLATFORMS.includes(p))
  if (targets.length === 0) return { publishResults: {} }

  await ref.update({ realStatus: 'publishing' })
  const results = { ...(post.publishResults || {}) }
  for (const platform of targets) {
    results[platform] = await publishToPlatform(platform, post)
  }
  const anyOk = Object.values(results).some((r) => r.ok)
  const allOk = targets.every((p) => results[p]?.ok)
  await ref.update({
    publishResults: results,
    realStatus: allOk ? 'posted' : anyOk ? 'partial' : 'failed',
    realPublishedAt: anyOk ? admin.firestore.FieldValue.serverTimestamp() : null,
  })
  return { publishResults: results }
}

// เรียกจากปุ่ม "โพสต์จริงตอนนี้" ในหน้า /admin/calendar
exports.socialPublishNow = onCall(
  { secrets: [META_APP_ID, META_APP_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET] },
  async (request) => {
    requireAdminCallable(request)
    const postId = request.data?.postId
    if (!postId || typeof postId !== 'string') throw new HttpsError('invalid-argument', 'postId ไม่ถูกต้อง')
    try {
      return await publishPostNow(postId)
    } catch (e) {
      throw new HttpsError('internal', e.message || 'โพสต์ไม่สำเร็จ')
    }
  }
)

// ทุก 15 นาที — หาโพสต์ที่ตั้งเวลาโพสต์จริง (realPublish: true) ถึงเวลาแล้วแต่ยังไม่โพสต์ (realStatus ยังไม่ posted/publishing)
exports.socialPublishScheduled = onSchedule(
  { schedule: 'every 15 minutes', secrets: [META_APP_ID, META_APP_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET] },
  async () => {
    const nowKey = new Date()
    const todayDate = `${nowKey.getFullYear()}-${String(nowKey.getMonth() + 1).padStart(2, '0')}-${String(nowKey.getDate()).padStart(2, '0')}`
    const nowTime = `${String(nowKey.getHours()).padStart(2, '0')}:${String(nowKey.getMinutes()).padStart(2, '0')}`

    // contentPosts เก็บ date/time เป็นสตริงแยก (ตามที่ AdminCalendar.jsx ใช้อยู่แล้ว) ไม่ใช่ Timestamp เดียว
    // ดึงเฉพาะโพสต์ที่ตั้งใจโพสต์จริงและยังไม่ถึงสถานะปลายทาง แล้วกรองวัน-เวลาในโค้ด (คอลเลกชันเล็ก ไม่ต้อง index ซับซ้อน)
    const snap = await db.collection('contentPosts').where('realPublish', '==', true).get()
    for (const docSnap of snap.docs) {
      const post = docSnap.data()
      if (['posted', 'partial', 'publishing'].includes(post.realStatus)) continue
      const due = post.date < todayDate || (post.date === todayDate && (post.time || '00:00') <= nowTime)
      if (!due) continue
      try {
        await publishPostNow(docSnap.id)
      } catch (e) {
        logger.error(`socialPublishScheduled: post ${docSnap.id} failed`, e)
      }
    }
  }
)

// ══════════════════════════════════════════════════════════════════════════
// คอมเมนต์ของโพสต์ที่โพสต์จริงแล้ว + ภาพรวมเพจ (Page/Account Insights)
// ทั้งสองส่วนนี้ใช้ access token ต่อบัญชีที่เก็บใน socialAccounts (ผ่าน getFreshAccessToken เดิม)
// ไม่ใช่ app secret ตรงๆ — ยกเว้นเส้นทาง refresh token ของ YouTube ที่ต้องใช้ GOOGLE_CLIENT_ID/SECRET
// (ดู getFreshAccessToken ด้านบน) จึงต้องผูก secrets เฉพาะสองตัวนั้นเท่านั้นให้ onCall สองตัวนี้
// ══════════════════════════════════════════════════════════════════════════

// ── ดึงคอมเมนต์ของโพสต์เดียว ต่อแพลตฟอร์ม จาก publishResults ที่บันทึกไว้ตอนโพสต์จริงสำเร็จ ──
async function fetchCommentsForPlatform(platform, externalId, accessToken) {
  if (platform === 'facebook') {
    const res = await fetch(`${FB_GRAPH}/${externalId}/comments?fields=id,message,from,created_time,like_count&access_token=${encodeURIComponent(accessToken)}`)
    if (!res.ok) throw new Error(`Facebook comments fetch failed: ${await res.text()}`)
    const data = (await res.json()).data || []
    return data.map((c) => ({
      platform, author: c.from?.name || 'ไม่ทราบชื่อ', text: c.message || '', createdAt: c.created_time || null, likeCount: c.like_count || 0,
    }))
  }
  if (platform === 'instagram') {
    const res = await fetch(`${IG_GRAPH}/${externalId}/comments?fields=id,text,username,timestamp,like_count&access_token=${encodeURIComponent(accessToken)}`)
    if (!res.ok) throw new Error(`Instagram comments fetch failed: ${await res.text()}`)
    const data = (await res.json()).data || []
    return data.map((c) => ({
      platform, author: c.username || 'ไม่ทราบชื่อ', text: c.text || '', createdAt: c.timestamp || null, likeCount: c.like_count || 0,
    }))
  }
  if (platform === 'threads') {
    const res = await fetch(`${THREADS_GRAPH}/v1.0/${externalId}/replies?fields=id,text,username,timestamp&access_token=${encodeURIComponent(accessToken)}`)
    if (!res.ok) throw new Error(`Threads replies fetch failed: ${await res.text()}`)
    const data = (await res.json()).data || []
    return data.map((c) => ({
      platform, author: c.username || 'ไม่ทราบชื่อ', text: c.text || '', createdAt: c.timestamp || null, likeCount: 0,
    }))
  }
  if (platform === 'youtube') {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${encodeURIComponent(externalId)}&maxResults=100`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error(`YouTube commentThreads fetch failed: ${await res.text()}`)
    const items = (await res.json()).items || []
    return items.map((it) => {
      const top = it.snippet?.topLevelComment?.snippet
      return {
        platform, author: top?.authorDisplayName || 'ไม่ทราบชื่อ', text: top?.textDisplay || '', createdAt: top?.publishedAt || null, likeCount: top?.likeCount || 0,
      }
    })
  }
  // tiktok / x: ไม่มี public API สำหรับคอมเมนต์ที่เข้าถึงได้ (out of scope ตามที่ระบุไว้)
  return []
}

// เรียกจากแท็บ "คอมเมนต์" ในหน้า /admin/calendar — โหลด publishResults ของโพสต์ แล้วดึงคอมเมนต์จริงทีละแพลตฟอร์ม
// ไม่ throw ทิ้งกลางทางถ้าแพลตฟอร์มใดพัง — คืน error แยกต่อแพลตฟอร์มใน errors{} แทน
exports.socialGetComments = onCall({ secrets: [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET] }, async (request) => {
  requireAdminCallable(request)
  const postId = request.data?.postId
  if (!postId || typeof postId !== 'string') throw new HttpsError('invalid-argument', 'postId ไม่ถูกต้อง')

  const postSnap = await db.collection('contentPosts').doc(postId).get()
  if (!postSnap.exists) throw new HttpsError('not-found', 'ไม่พบโพสต์นี้')
  const post = postSnap.data()
  const publishResults = post.publishResults || {}

  const comments = []
  const errors = {}
  for (const [platform, result] of Object.entries(publishResults)) {
    if (!result?.ok || !result.externalId) continue
    if (!['facebook', 'instagram', 'threads', 'youtube'].includes(platform)) continue
    try {
      const accSnap = await db.collection('socialAccounts').doc(platform).get()
      if (!accSnap.exists) { errors[platform] = 'ยังไม่ได้เชื่อมต่อบัญชี'; continue }
      const accessToken = await getFreshAccessToken(platform, accSnap.data())
      const list = await fetchCommentsForPlatform(platform, result.externalId, accessToken)
      comments.push(...list)
    } catch (e) {
      logger.error(`socialGetComments: ${platform} failed`, e)
      errors[platform] = e.message || 'ดึงคอมเมนต์ไม่สำเร็จ'
    }
  }
  comments.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  return { comments, errors }
})

// ══════════════════════════ ภาพรวมเพจ (Page/Account Insights) ══════════════════════════

const INSIGHTS_CACHE_MS = 60 * 60 * 1000 // 1 ชั่วโมง — กัน rate limit ของ Graph/YouTube Analytics API ตอนรีเฟรชหน้าบ่อยๆ

async function fetchFacebookInsights(accessToken, pageId) {
  const metrics = 'page_impressions,page_engaged_users'
  const res = await fetch(`${FB_GRAPH}/${pageId}/insights?metric=${metrics}&period=day&access_token=${encodeURIComponent(accessToken)}`)
  if (!res.ok) throw new Error(`Facebook Page Insights failed: ${await res.text()}`)
  const data = (await res.json()).data || []
  const out = {}
  for (const m of data) out[m.name] = m.values?.[m.values.length - 1]?.value ?? null
  return out
}

async function fetchInstagramInsights(accessToken, igUserId) {
  // metric ที่ใช้ได้กับ instagram_manage_insights ระดับบัญชี (ไม่ใช่ระดับโพสต์) — reach/accounts_engaged เป็นตัวหลักในเวอร์ชันปัจจุบันของ Graph API
  const metrics = 'reach,accounts_engaged'
  const res = await fetch(`${IG_GRAPH}/${igUserId}/insights?metric=${metrics}&period=day&metric_type=total_value&access_token=${encodeURIComponent(accessToken)}`)
  if (!res.ok) throw new Error(`Instagram Insights failed: ${await res.text()}`)
  const data = (await res.json()).data || []
  const out = {}
  for (const m of data) out[m.name] = m.total_value?.value ?? m.values?.[m.values.length - 1]?.value ?? null
  return out
}

async function fetchThreadsInsights(accessToken, threadsUserId) {
  // Threads Insights API รองรับ metric จำกัดมาก — บาง metric (เช่น views) อาจไม่พร้อมใช้งานทุกบัญชี
  // จัดการแบบ graceful: ถ้า field ไหนไม่มาก็ปล่อยเป็น null แทนที่จะทำทั้ง request ล้ม
  const metrics = 'views,followers_count'
  const res = await fetch(`${THREADS_GRAPH}/v1.0/${threadsUserId}/threads_insights?metric=${metrics}&access_token=${encodeURIComponent(accessToken)}`)
  if (!res.ok) throw new Error(`Threads Insights failed: ${await res.text()}`)
  const data = (await res.json()).data || []
  const out = {}
  for (const m of data) out[m.name] = m.values?.[m.values.length - 1]?.value ?? m.total_value?.value ?? null
  return out
}

// YouTube Analytics API v2 — host ต่างจาก Data API ที่ใช้ตอนอัปโหลดวิดีโอ (youtubeanalytics.googleapis.com ไม่ใช่ www.googleapis.com)
async function fetchYouTubeInsights(accessToken, channelId) {
  const today = new Date()
  const start = new Date(today.getTime() - 27 * 24 * 60 * 60 * 1000) // 28 วันล่าสุด
  const fmt = (d) => d.toISOString().slice(0, 10)
  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate: fmt(start),
    endDate: fmt(today),
    metrics: 'views,estimatedMinutesWatched,subscribersGained',
  })
  const res = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`YouTube Analytics failed: ${await res.text()}`)
  const report = await res.json()
  const row = report.rows?.[0] || []
  const headers = (report.columnHeaders || []).map((h) => h.name)
  const out = {}
  headers.forEach((name, i) => { if (name !== 'channel') out[name] = row[i] ?? null })
  return out
}

async function fetchPlatformInsights(platform, accessToken, externalId) {
  if (platform === 'facebook') return fetchFacebookInsights(accessToken, externalId)
  if (platform === 'instagram') return fetchInstagramInsights(accessToken, externalId)
  if (platform === 'threads') return fetchThreadsInsights(accessToken, externalId)
  if (platform === 'youtube') return fetchYouTubeInsights(accessToken, externalId)
  return null // tiktok / x: ไม่มี API ที่เข้าถึงได้ (out of scope)
}

// เรียกจากแท็บ "ภาพรวมเพจ" ในหน้า /admin/calendar — cache ผลไว้ที่ socialInsightsCache/{platform} นาน 1 ชม.
// เพื่อไม่ให้โหลดหน้าถี่ๆ ยิง Graph/YouTube Analytics API จนโดน rate limit
exports.socialGetPageInsights = onCall({ secrets: [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET] }, async (request) => {
  requireAdminCallable(request)
  const forceRefresh = !!request.data?.forceRefresh

  const accountsSnap = await db.collection('socialAccounts').get()
  const result = {}
  for (const docSnap of accountsSnap.docs) {
    const platform = docSnap.id
    if (!['facebook', 'instagram', 'threads', 'youtube'].includes(platform)) continue
    const account = docSnap.data()

    const cacheRef = db.collection('socialInsightsCache').doc(platform)
    if (!forceRefresh) {
      const cacheSnap = await cacheRef.get()
      if (cacheSnap.exists) {
        const cached = cacheSnap.data()
        const fetchedAtMs = cached.fetchedAt?.toMillis ? cached.fetchedAt.toMillis() : 0
        if (Date.now() - fetchedAtMs < INSIGHTS_CACHE_MS) {
          result[platform] = { metrics: cached.metrics, fetchedAt: cached.fetchedAt, fromCache: true }
          continue
        }
      }
    }

    try {
      const accessToken = await getFreshAccessToken(platform, account)
      const metrics = await fetchPlatformInsights(platform, accessToken, account.externalId)
      await cacheRef.set({ metrics, fetchedAt: admin.firestore.FieldValue.serverTimestamp() })
      result[platform] = { metrics, fetchedAt: new Date().toISOString(), fromCache: false }
    } catch (e) {
      logger.error(`socialGetPageInsights: ${platform} failed`, e)
      result[platform] = { error: e.message || 'ดึงข้อมูลไม่สำเร็จ' }
    }
  }
  return result
})

// ══════════════════════════════════════════════════════════════════════════
// ลบไฟล์รูป/วิดีโอออกจาก Cloudinary หลังโพสต์จริงสำเร็จไปแล้ว 7 วัน (ประหยัด storage/bandwidth
// ระยะยาว — bandwidth โดนเบิร์นซ้ำทุกครั้งที่แพลตฟอร์มโหลดไฟล์ตอนโพสต์ไปแล้ว ไม่จำเป็นต้องเก็บไฟล์
// ต้นทางไว้ต่อ แต่เผื่อ buffer 7 วันไว้เผื่อโพสต์ล้มเหลวบางแพลตฟอร์มแล้วอยากลองโพสต์ซ้ำด้วยมือ)
//
// ต้องตั้งค่า secret เพิ่ม:
//   firebase functions:secrets:set CLOUDINARY_API_KEY
//   firebase functions:secrets:set CLOUDINARY_API_SECRET
// (เอาค่าจาก Cloudinary Console → Settings → API Keys ของ cloud "dei5jktuw")
// ══════════════════════════════════════════════════════════════════════════

const CLEANUP_AFTER_MS = 7 * 24 * 60 * 60 * 1000 // 7 วัน

async function destroyCloudinaryAsset(publicId, resourceType) {
  const timestamp = Math.floor(Date.now() / 1000)
  const toSign = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET.value()}`
  const signature = crypto.createHash('sha1').update(toSign).digest('hex')
  const params = new URLSearchParams({
    public_id: publicId, timestamp: String(timestamp), api_key: CLOUDINARY_API_KEY.value(), signature,
  })
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType || 'image'}/destroy`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params,
  })
  if (!res.ok) throw new Error(`Cloudinary destroy failed: ${await res.text()}`)
  const data = await res.json()
  if (data.result !== 'ok' && data.result !== 'not found') throw new Error(`Cloudinary destroy failed: ${data.result}`)
}

// ทุกวัน — หาโพสต์ที่โพสต์จริงสำเร็จ (realStatus posted/partial) เกิน 7 วันแล้ว และยังไม่เคยเคลียร์ไฟล์
// (mediaCleanedAt ยังไม่ถูกตั้ง) แล้วลบไฟล์ต้นทางออกจาก Cloudinary ทีละไฟล์ตาม mediaPublicIds
exports.cleanupPublishedMedia = onSchedule(
  { schedule: 'every 24 hours', secrets: [CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET] },
  async () => {
    const snap = await db.collection('contentPosts').where('realStatus', 'in', ['posted', 'partial']).get()
    for (const docSnap of snap.docs) {
      const post = docSnap.data()
      if (post.mediaCleanedAt) continue
      if (!post.mediaPublicIds?.length) continue
      const publishedAtMs = post.realPublishedAt?.toMillis ? post.realPublishedAt.toMillis() : 0
      if (!publishedAtMs || Date.now() - publishedAtMs < CLEANUP_AFTER_MS) continue

      try {
        for (const m of post.mediaPublicIds) {
          if (!m?.publicId) continue
          await destroyCloudinaryAsset(m.publicId, m.resourceType)
        }
        await docSnap.ref.update({ mediaCleanedAt: admin.firestore.FieldValue.serverTimestamp() })
      } catch (e) {
        logger.error(`cleanupPublishedMedia: post ${docSnap.id} failed`, e)
      }
    }
  }
)

// ══════════════════════════ ตรวจยอดเงินของออเดอร์ฝั่งเซิร์ฟเวอร์ ══════════════════════════

// firestore.rules ตรวจได้แค่ว่า total == itemsTotal + shippingFee "สอดคล้องกันเอง" เทียบกับราคาสินค้าจริง
// ไม่ได้ เพราะภาษา rules ไม่มีลูป (บวกผลรวมทั้งตะกร้าไม่ได้) และ get() ได้สูงสุด 10 ครั้งต่อ 1 request
// ขณะที่ออเดอร์หนึ่งมีได้ถึง 50 รายการ
//
// src/data/orders.js คิดราคาใหม่จาก Firestore ใน transaction อยู่แล้ว แต่นั่นคือโค้ดฝั่งเบราว์เซอร์ —
// คนที่ยิง Firestore SDK ตรงๆ ไม่ผ่านหน้าเว็บ ก็ข้ามด่านนั้นแล้วสร้างออเดอร์ยอด ฿0 ได้
//
// ตัวนี้จึงคิดยอดใหม่อีกรอบด้วย Admin SDK หลังออเดอร์ถูกสร้าง แล้ว "ติดธง" ไว้ถ้าไม่ตรง
// เจตนาไม่ยกเลิกอัตโนมัติ: ออเดอร์ที่มาจากหน้าเว็บจริงจะตรงเสมอ (คิดราคาใน transaction เดียวกัน)
// ยอดไม่ตรงจึงแปลว่าผิดปกติ ให้คนตัดสินใจดีกว่า — และการยกเลิกอัตโนมัติจะกลายเป็นช่องให้ยิงเล่นจนออเดอร์จริงหาย
exports.verifyOrderTotal = onDocumentCreated('orders/{orderId}', async (event) => {
  const order = event.data?.data()
  if (!order || !Array.isArray(order.items) || order.items.length === 0) return

  const ids = [...new Set(order.items.map((it) => it.id).filter(Boolean))]
  if (ids.length !== order.items.length) {
    // รายการเดียวกันซ้ำหลายบรรทัดก็คิดรวมได้ปกติ — ที่กันคือกรณีไม่มี id ให้ไปหาสินค้าเลย
    if (order.items.some((it) => !it.id)) {
      await flagOrder(event.data.ref, 'มีรายการที่ไม่มีรหัสสินค้า')
      return
    }
  }

  const snaps = await db.getAll(...ids.map((id) => db.collection('products').doc(id)))
  const priceById = {}
  for (const snap of snaps) {
    if (!snap.exists) { await flagOrder(event.data.ref, `ไม่พบสินค้า ${snap.id}`); return }
    const p = snap.data()
    // ต้องตรงกับ effectivePrice() ใน src/data/pricing.js — ราคาส่วนลดถ้าถูกกว่าราคาเต็ม ไม่งั้นราคาเต็ม
    priceById[snap.id] = (p.discountPrice != null && p.discountPrice < p.price) ? p.discountPrice : (p.price || 0)
  }

  const expected = order.items.reduce((sum, it) => sum + priceById[it.id] * (Number(it.qty) || 0), 0)
  const expectedTotal = Math.round(expected * 100) / 100
  const claimed = Math.round(Number(order.itemsTotal) * 100) / 100

  if (expectedTotal !== claimed) {
    logger.warn(`verifyOrderTotal: ${order.orderCode} ยอดไม่ตรง — แจ้งมา ${claimed} ควรเป็น ${expectedTotal}`)
    await flagOrder(event.data.ref, `ยอดสินค้าไม่ตรงกับราคาจริง (แจ้งมา ฿${claimed} ควรเป็น ฿${expectedTotal})`)
  }
})

// ติดธงไว้บนออเดอร์ให้หน้าแอดมินขึ้นคำเตือนก่อนกดยืนยันการชำระเงิน
async function flagOrder(ref, reason) {
  await ref.update({
    priceMismatch: true,
    priceMismatchReason: reason,
    priceMismatchAt: admin.firestore.FieldValue.serverTimestamp(),
  })
}
