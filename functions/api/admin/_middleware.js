// ทุกคำขอใต้ /api/admin/* ต้องผ่าน Cloudflare Access (ล็อกอิน Google) และอีเมลต้องอยู่ใน ADMIN_EMAILS
// ตรวจ JWT เองด้วย ไม่พึ่ง Access อย่างเดียว — โดเมน *.pages.dev เข้าถึงได้โดยไม่ผ่าน Access ถ้าไม่ได้ตั้งแยก
//
// ทดสอบในเครื่อง (wrangler pages dev): ตั้ง DEV_ADMIN_EMAIL แล้วใช้ได้เฉพาะ host localhost/127.0.0.1 เท่านั้น
import { fail, cookie, verifyAccessJwt, adminEmails } from '../../_lib/naza.js'

export async function onRequest(context) {
  const { request, env } = context
  const host = new URL(request.url).hostname
  let email = ''
  if (env.DEV_ADMIN_EMAIL && (host === 'localhost' || host === '127.0.0.1')) {
    email = String(env.DEV_ADMIN_EMAIL).toLowerCase()
  } else {
    const token = request.headers.get('Cf-Access-Jwt-Assertion') || cookie(request, 'CF_Authorization')
    try {
      email = await verifyAccessJwt(token, { team: env.ACCESS_TEAM, aud: env.ACCESS_AUD })
    } catch (e) {
      return fail(401, 'ต้องล็อกอินผ่าน Cloudflare Access', { reason: String(e.message || e) })
    }
  }
  if (!adminEmails(env).includes(email)) return fail(403, `บัญชี ${email} ไม่มีสิทธิ์จัดการระบบนี้`)
  context.data.email = email
  return context.next()
}
