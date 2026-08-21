// เพิ่มในไฟล์ Code.gs ของ Iftar Apps Script (ไม่ต้องแก้ doGet/doPost เดิม)
// แก้ doPost ให้รองรับ action: 'broadcast'

// ใน doPost เพิ่มก่อน var data = JSON.parse(...)
// ----
// เพิ่มบรรทัดนี้ใน doPost หลังจาก var data = JSON.parse(e.postData.contents);
//
//   if (data.action === 'broadcast') {
//     return handleBroadcast(data);
//   }
// ----

// ⚠️ ความปลอดภัย: handleBroadcast ส่งอีเมลจากบัญชี Gmail จริงของมูลนิธิไปหาผู้รับ "ใดก็ได้"
// ด้วยเนื้อหา HTML "ใดก็ได้" — ต้องยืนยันตัวตนแอดมินก่อนทุกครั้ง ห้ามเรียกโดยไม่ตรวจ idToken
// (เดิมไม่มีการตรวจ auth เลย ใครก็ยิง POST ตรงมาที่ endpoint นี้เพื่อส่งอีเมลฟิชชิ่ง/สแปม
// จากบัญชีมูลนิธิไปหาใครก็ได้ — ดู security memory)

// ต้องตรงกับ projectId ใน src/firebase.js (Firebase ID token ที่ client ส่งมาจะมี aud/iss นี้)
var FIREBASE_PROJECT_ID = 'ummatee-app';

// Broadcast ส่งอีเมลถึงผู้รับใดก็ได้ด้วยเนื้อหาใดก็ได้ — เป็นสิทธิ์แอดมินตัวจริงเท่านั้น
// (ไม่รวมบัญชี ummatee.volunteer@gmail.com ที่แชร์กับทีมอาสาสมัครกลุ่มกว้าง)
// ต้องตรงกับ isFullAdmin() allowlist ใน firestore.rules ไม่ใช่ isAdmin()
var BROADCAST_ADMIN_EMAILS = ['akasitlove@gmail.com', 'ummatee.thailand@gmail.com'];

// ตรวจสอบ Firebase ID token ที่ client ส่งมา (ยืนยันลายเซ็นผ่าน Google tokeninfo endpoint)
// คืนอีเมลผู้ใช้ถ้า token ถูกต้องและอยู่ใน allowlist มิฉะนั้นคืน null
function verifyAdminIdToken(idToken) {
  if (!idToken) return null;
  try {
    var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), {
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return null;
    var info = JSON.parse(res.getContentText());
    if (info.aud !== FIREBASE_PROJECT_ID) return null;
    if (info.iss !== 'https://securetoken.google.com/' + FIREBASE_PROJECT_ID) return null;
    if (!info.email || info.email_verified !== 'true') return null;
    if (BROADCAST_ADMIN_EMAILS.indexOf(info.email) === -1) return null;
    return info.email;
  } catch (err) {
    return null;
  }
}

function handleBroadcast(data) {
  var adminEmail = verifyAdminIdToken(data.idToken);
  if (!adminEmail) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (!data.email || !data.subject || !data.htmlBody) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'missing fields' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    GmailApp.sendEmail(data.email, data.subject, 'กรุณาเปิดอีเมลในโปรแกรมที่รองรับ HTML', {
      htmlBody: data.htmlBody
    });
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
