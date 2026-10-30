// GET /api/admin/me — ใครกำลังล็อกอิน (หน้าแอดมินใช้ตรวจว่าผ่าน Access แล้วหรือยัง)
import { json } from '../../_lib/naza.js'

export const onRequestGet = ({ data }) => json({ email: data.email })
