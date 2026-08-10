// แผนที่ "ชื่อหน้า -> path จริง" ใช้ร่วมกันระหว่าง App.jsx (ฟังก์ชัน go) กับ Nav/Footer (ใส่ href)
//
// อยู่ไฟล์แยกเพื่อไม่ให้ Nav ต้อง import จาก App.jsx ซึ่งจะกลายเป็น circular import (App -> Nav -> App)
// ที่ทำงานได้แต่เปราะ พังง่ายเวลาลำดับการโหลดโมดูลเปลี่ยน
//
// ทำไมต้องใส่ href จริงแทน href="#":
// ลิงก์ที่เป็น "#" กดปกติได้ (เพราะมี onClick) แต่คลิกขวา "เปิดในแท็บใหม่" / คลิกกลาง /
// Ctrl+คลิก / คัดลอกลิงก์ จะได้ "/#" ที่ใช้ไม่ได้ และเอาเมาส์ชี้ก็ไม่เห็นว่าลิงก์ไปไหน
export const PAGE_TO_PATH = {
  home: '/home',
  donation: '/donation',
  iftar: '/event/iftar-for-gaza',
  give: '/event/give-for-um',
  give2: '/event/give-for-um/give2com',
  b2um: '/event/give-for-um/b2um',
  'give-receive': '/event/give-for-um/receive',
  'give2com-receive': '/event/give-for-um/receive/computer',
  'give2cook-receive': '/event/give-for-um/receive/equipment',
  give2cook: '/event/give-for-um/give2cook',
  qurban: '/missions/qurban2026',
  missions: '/missions',
  updates: '/updates',
  shop: '/um-shop',
  'shop-cart': '/um-shop/cart',
  'shop-checkout': '/um-shop/checkout',
  'shop-my-orders': '/um-shop/my-orders',
  volunteer: '/volunteer/register',
}
