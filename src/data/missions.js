// คอนฟิกภารกิจ (missions) ของอุมมะตี — 7 โครงการหลัก ผูกกับบัญชีบริจาคใน accounts.js
// รูป/วิดีโอของแต่ละภารกิจเก็บใน Firestore (collection: missionMedia, doc id = key)
// แอดมินอัปโหลดเองได้ที่ /admin/missions — ไม่ต้องแก้โค้ดทุกสัปดาห์
import { faHandsHolding, faFlag, faBowlFood, faUtensils, faEarthAmericas, faBookQuran, faHandHoldingHeart, faCow } from '@fortawesome/free-solid-svg-icons'

// key   = id ใช้กับ Firestore (missionMedia/{key})
// acc   = key บัญชีใน ACCOUNTS (accounts.js) สำหรับปุ่มบริจาคโครงการ
// accent = สีประจำโครงการ
export const MISSIONS = [
  {
    key: 'support', icon: faHandsHolding, acc: 'foundation', accent: '#1B5E36',
    th: { name: 'สนับสนุนการทำงาน', desc: 'ภาพและวิดีโอเบื้องหลังการทำงานของทีมอุมมะตี ทุกขั้นตอนเพื่อความโปร่งใส' },
    en: { name: 'Support Our Work', desc: 'Behind-the-scenes photos and videos of the Ummatee team — every step, for full transparency' },
    ar: { name: 'دعم العمل', desc: 'صور وفيديوهات من كواليس عمل فريق أمّتي — كل خطوة من أجل الشفافية' },
  },
  {
    key: 'gaza', icon: faFlag, acc: 'palestine', accent: '#C9302C',
    th: { name: 'กาซ่า', desc: 'ส่งมอบอาหารและน้ำดื่มประจำสัปดาห์ และวันสำคัญแก่พี่น้องในกาซ่า' },
    en: { name: 'Gaza', desc: 'Weekly food and drinking water delivery, plus special-occasion distributions to our brothers and sisters in Gaza' },
    ar: { name: 'غزة', desc: 'توزيع أسبوعي للطعام ومياه الشرب، إضافة إلى توزيعات في المناسبات لإخواننا في غزة' },
  },
  {
    key: 'syria', icon: faUtensils, acc: 'syria', accent: '#15803d',
    th: { name: 'ซีเรีย', desc: 'ส่งมอบอาหารประจำสัปดาห์แก่ครอบครัวผู้ยากไร้ในซีเรีย' },
    en: { name: 'Syria', desc: 'Weekly food delivery to needy families in Syria' },
    ar: { name: 'سوريا', desc: 'توزيع أسبوعي للطعام للأسر المحتاجة في سوريا' },
  },
  {
    key: 'thailand', icon: faBowlFood, acc: 'thailand', accent: '#2563eb',
    th: { name: 'ไทย', desc: 'ส่งมอบอาหารประจำสัปดาห์ผ่านเครือข่ายพันธมิตรทั่วประเทศไทย' },
    en: { name: 'Thailand', desc: 'Weekly food delivery through our partner network across Thailand' },
    ar: { name: 'تايلاند', desc: 'توزيع أسبوعي للطعام عبر شبكة شركائنا في جميع أنحاء تايلاند' },
  },
  {
    key: 'intl', icon: faEarthAmericas, acc: 'intl', accent: '#0891b2',
    th: { name: 'นานาชาติ', desc: 'ส่งมอบอาหารและความช่วยเหลือแก่ผู้ยากไร้ในต่างประเทศ' },
    en: { name: 'International', desc: 'Delivering food and aid to those in need around the world' },
    ar: { name: 'دولي', desc: 'إيصال الطعام والمساعدات للمحتاجين حول العالم' },
  },
  {
    key: 'waqf', icon: faBookQuran, acc: 'waqf', accent: '#7c3aed',
    th: { name: 'วากัฟ', desc: 'มอบอัลกุรอานเป็นวะกัฟ เพื่อผลบุญที่ต่อเนื่องไม่ขาดสาย' },
    en: { name: 'Waqf', desc: 'Endowing copies of the Holy Quran as waqf — a continuous source of reward' },
    ar: { name: 'وقف', desc: 'إيقاف نسخ من القرآن الكريم — صدقة جارية لا تنقطع' },
  },
  {
    key: 'zakat', icon: faHandHoldingHeart, acc: 'zakat', accent: '#c9a84c',
    th: { name: 'ซะกาต', desc: 'มอบซะกาตให้แก่เจ้าหน้าที่และผู้ปฏิบัติงานในกาซ่า ตามหลักชะรีอะฮ์' },
    en: { name: 'Zakat', desc: 'Distributing zakat to staff and field workers in Gaza, in accordance with Shariah' },
    ar: { name: 'زكاة', desc: 'توزيع الزكاة على العاملين والميدانيين في غزة وفق أحكام الشريعة' },
  },
]

// การ์ดพิเศษ: กุรบาน — ลิงก์ไปหน้ารายละเอียดกุรบานที่มีอยู่แล้ว (ไม่ใช่แกลเลอรีมีเดีย)
export const QURBAN_CARD = {
  key: 'qurban', icon: faCow, accent: '#6d28d9', page: 'qurban',
  th: { name: 'กุรบาน', desc: 'ส่งต่อเนื้อกุรบานถึงพี่น้องผู้ยากไร้ใน 31 ประเทศทั่วโลก', cta: 'ดูรายละเอียดกุรบาน' },
  en: { name: 'Qurban', desc: 'Delivering qurban meat to the needy in 31 countries worldwide', cta: 'View Qurban details' },
  ar: { name: 'الأضاحي', desc: 'إيصال لحوم الأضاحي للمحتاجين في 31 دولة حول العالم', cta: 'عرض تفاصيل الأضاحي' },
}
