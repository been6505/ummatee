# เปิดใช้การแจ้งเตือน (Push Notifications)

ฝั่งเว็บเขียนไว้ครบแล้ว **แต่ยังปิดอยู่** จนกว่าจะทำ 3 ขั้นตอนในเอกสารนี้

> ทำไมต้องมีขั้นตอนพวกนี้: การ **ส่ง** แจ้งเตือนต้องเซ็นด้วย service account
> ซึ่ง**ห้ามอยู่ในโค้ดฝั่งเว็บเด็ดขาด** (ใครก็เปิด JS ดูได้ = ส่งแจ้งเตือนปลอมหาผู้ใช้ทุกคนได้)
> และโปรเจกต์นี้อยู่แผน Spark จึง deploy Cloud Functions ไม่ได้ — ตัวส่งจึงต้องอยู่ที่อื่น

---

## สิ่งที่โค้ดทำไว้แล้ว

| ไฟล์ | หน้าที่ |
|---|---|
| `src/data/pushSupport.js` | ตรรกะล้วน (17 เทสต์) — ตัดสินว่าเบราว์เซอร์นี้เปิดแจ้งเตือนได้ไหม เพราะอะไร |
| `src/data/pushTokens.js` | ขอสิทธิ์ → ขอ token → บันทึกลง Firestore |
| `src/components/NotifyButton.jsx` | ปุ่มบนหน้า `/updates` |
| `public/firebase-messaging-sw.js` | service worker รับแจ้งเตือนตอนไม่ได้เปิดเว็บ |
| `firestore.rules` → `pushTokens` | ใครก็บันทึก token ได้ แต่ **อ่านทั้ง collection ได้เฉพาะแอดมิน** |

**ตอนนี้ปุ่มไม่ขึ้นเลย** เพราะยังไม่มี VAPID key — ตั้งใจให้เป็นแบบนั้น
ปุ่มที่กดแล้วพังคือสิ่งที่แย่กว่าไม่มีปุ่ม

---

## ขั้นที่ 1 — เอา VAPID key มาใส่

1. Firebase Console → ⚙️ **Project settings** → แท็บ **Cloud Messaging**
2. หัวข้อ **Web configuration** → **Web Push certificates** → กด **Generate key pair**
3. คัดลอก **Key pair** (ขึ้นต้นด้วย `B...`) — เป็น **public key** ใส่ในโค้ดได้ปลอดภัย

สร้างไฟล์ `.env.local` ที่รากโปรเจกต์ (ไฟล์นี้อยู่ใน `.gitignore` แล้ว):

```
VITE_FCM_VAPID_KEY=BXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

แล้ว build ใหม่ — ปุ่ม "แจ้งเตือนเมื่อมีข่าวใหม่" จะโผล่ที่ `/updates` ทันที

> ⚠️ ถ้า build บนเครื่องอื่น/CI ต้องตั้ง env ตัวนี้ที่นั่นด้วย ไม่งั้นปุ่มจะหายไปเงียบ ๆ

## ขั้นที่ 2 — deploy rules

```bash
firebase deploy --only firestore:rules
```

ถ้าไม่ทำ การบันทึก token จะถูกปฏิเสธทุกครั้ง (แต่ผู้ใช้จะเห็นข้อความ error ไม่ใช่เงียบ)

## ขั้นที่ 3 — ตัวส่ง

เลือกทางใดทางหนึ่ง

### ทาง A — Google Apps Script (ฟรี, แนะนำ)

ทีมนี้ใช้ Apps Script อยู่แล้ว 3 โปรเจกต์ (`docs/volunteer-apps-script` ฯลฯ) จึงคุ้นมืออยู่แล้ว
และ **Script Properties เก็บ service account key ได้อย่างปลอดภัย** — ไม่หลุดออกเว็บ

**เตรียม service account**

1. Firebase Console → ⚙️ Project settings → **Service accounts** → **Generate new private key**
2. ได้ไฟล์ JSON มา — เปิดดู เอาค่า `client_email` กับ `private_key`
3. ใน Apps Script → ⚙️ Project Settings → **Script Properties** เพิ่ม 2 ตัว:
   - `FCM_CLIENT_EMAIL` = ค่า `client_email`
   - `FCM_PRIVATE_KEY` = ค่า `private_key` (ทั้งก้อน รวม `-----BEGIN PRIVATE KEY-----`)

> ⚠️ **อย่าเอาไฟล์ JSON นี้ใส่ใน repo หรือส่งทางแชท** ใครได้ไปคือคุมโปรเจกต์ Firebase ได้ทั้งหมด

**โค้ด** (สร้างไฟล์ `Push.gs` ใน Apps Script)

```javascript
const PROJECT_ID = 'ummatee-app'

// ขอ access token จาก service account (OAuth2 JWT flow)
function getAccessToken_() {
  const props = PropertiesService.getScriptProperties()
  const email = props.getProperty('FCM_CLIENT_EMAIL')
  const key = props.getProperty('FCM_PRIVATE_KEY').replace(/\\n/g, '\n')
  const now = Math.floor(Date.now() / 1000)

  const claim = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const enc = (o) => Utilities.base64EncodeWebSafe(JSON.stringify(o)).replace(/=+$/, '')
  const unsigned = enc({ alg: 'RS256', typ: 'JWT' }) + '.' + enc(claim)
  const sig = Utilities.base64EncodeWebSafe(
    Utilities.computeRsaSha256Signature(unsigned, key)
  ).replace(/=+$/, '')

  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: unsigned + '.' + sig,
    },
    muteHttpExceptions: true,
  })
  return JSON.parse(res.getContentText()).access_token
}

// ดึง token ทั้งหมดจาก Firestore ผ่าน REST (ใช้ access token เดียวกัน — bypass rules ได้)
function listTokens_(accessToken) {
  const out = []
  let pageToken = ''
  do {
    const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID +
      '/databases/(default)/documents/pushTokens?pageSize=300' +
      (pageToken ? '&pageToken=' + pageToken : '')
    const res = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + accessToken },
      muteHttpExceptions: true,
    })
    const j = JSON.parse(res.getContentText())
    ;(j.documents || []).forEach((d) => out.push(d.name.split('/').pop()))
    pageToken = j.nextPageToken || ''
  } while (pageToken)
  return out
}

// ส่งแจ้งเตือนหาทุกเครื่อง
// ⚠️ ส่งทีละ token — FCM v1 ไม่มี multicast แล้ว ถ้ามีผู้ติดตามหลักพันให้แบ่งรอบ
//    (Apps Script มีเพดานเวลารัน 6 นาที และโควตา UrlFetch ต่อวัน)
function sendPush(title, body, url) {
  const accessToken = getAccessToken_()
  const tokens = listTokens_(accessToken)
  let sent = 0, dead = []

  tokens.forEach((t) => {
    const res = UrlFetchApp.fetch(
      'https://fcm.googleapis.com/v1/projects/' + PROJECT_ID + '/messages:send',
      {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + accessToken },
        // ส่งเป็น data-only ให้ service worker เป็นคนตัดสินใจแสดงผลเอง
        // ถ้าใส่ key "notification" ด้วย บางเบราว์เซอร์จะแสดงเองซ้ำอีกอัน = เด้ง 2 ที
        payload: JSON.stringify({
          message: { token: t, data: { title: title, body: body, url: url || '/updates' } },
        }),
        muteHttpExceptions: true,
      }
    )
    const code = res.getResponseCode()
    if (code === 200) sent++
    // 404 / 403 = token ตายแล้ว (ถอนแอป/ล้างข้อมูล) เก็บไว้ลบทีหลัง
    else if (code === 404 || code === 403) dead.push(t)
  })

  Logger.log('ส่งสำเร็จ %s / %s · token ตาย %s', sent, tokens.length, dead.length)
  return { sent: sent, total: tokens.length, dead: dead }
}

// เรียกใช้: แก้ข้อความแล้วกด Run
function sendLatestUpdate() {
  sendPush('มีข่าวความคืบหน้าใหม่', 'ดูรายงานล่าสุดจากทีมงานในพื้นที่', '/updates')
}
```

### ทาง B — Cloud Functions (ต้องขึ้นแผน Blaze)

ตรงไปตรงมากว่า และทำ trigger อัตโนมัติได้ (เช่น มีคนกดเผยแพร่ข่าว → ส่งแจ้งเตือนเอง)
แต่ต้องผูกบัตร ซึ่งเป็นการตัดสินใจขององค์กร ไม่ใช่ของโค้ด

---

## ข้อจำกัดที่ต้องรู้

**iPhone / iPad** — รองรับตั้งแต่ iOS 16.4 **แต่เฉพาะเมื่อผู้ใช้กด "เพิ่มไปยังหน้าจอโฮม" แล้วเท่านั้น**
เปิดในแท็บ Safari ปกติจะใช้ไม่ได้เลย โค้ดตรวจกรณีนี้ไว้แล้วและขึ้นข้อความบอกให้ติดตั้งก่อน
(นี่คือเหตุผลที่แถบชวนติดตั้งแอปสำคัญกว่าที่คิด — มันเป็น**เงื่อนไขบังคับ**ของแจ้งเตือนบน iPhone)

**คนที่กดปฏิเสธไปแล้ว** — เว็บขอซ้ำไม่ได้อีก ต้องให้ผู้ใช้ไปเปิดเองในตั้งค่าเบราว์เซอร์
โค้ดขึ้นข้อความบอกไว้แล้ว

**token ตาย** — ผู้ใช้ที่ถอนแอป/ล้างข้อมูลจะเหลือ token ค้างใน Firestore
ฟังก์ชันด้านบนคืนรายการ `dead` มาให้ ควรลบทิ้งเป็นระยะ ไม่งั้นตัวเลขผู้ติดตามจะเฟ้อขึ้นเรื่อย ๆ

**ความเป็นส่วนตัว** — `pushTokens` เก็บแค่ `lang` กับ `updatedAt` ไม่มี uid/อีเมล/ไอพี
และ `allow list` เปิดเฉพาะแอดมินจริงเท่านั้น เพราะ collection นี้คือรายชื่ออุปกรณ์ผู้ติดตามทั้งหมด
