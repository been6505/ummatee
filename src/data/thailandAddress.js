import { useEffect, useState } from 'react'

// ฐานข้อมูลที่อยู่ไทย (จังหวัด/อำเภอ-เขต/ตำบล-แขวง/รหัสไปรษณีย์) จากแพ็กเกจสำเร็จรูป thai-address-database
// (ทีม Sellsuki ดูแล ใช้กันแพร่หลาย — ไม่พิมพ์เองเพราะข้อมูลระดับตำบลทั่วประเทศมี ~7,400 รายการ เสี่ยงผิด/ตกหล่นถ้าทำเอง)
//
// ⚠️ ต้อง import แบบ dynamic เท่านั้น — ข้อมูลชุดนี้กินพื้นที่ราว 140kB (gzip ~45kB) และเดิม import
// ตรงๆ จาก ShopCheckout ทำให้หน้าชำระเงินต้องรอโหลด + แตกข้อมูลทั้งประเทศก่อนถึงจะวาดหน้าได้
// ทั้งที่ลูกค้ายังไม่ได้กรอกอะไรเลย — และเป็นหน้าที่ช้าแล้วเสียลูกค้าโดยตรงที่สุดในเว็บ
//
// ตอนนี้หน้าเช็คเอาท์ขึ้นทันที แล้วช่องจังหวัดค่อยเติมตัวเลือกเมื่อข้อมูลมาถึง (ปกติไม่ถึงวินาที
// ระหว่างที่ลูกค้ายังกรอกชื่อ/เบอร์อยู่ด้านบน)

// กรุงเทพฯ ใช้คำว่า "เขต"/"แขวง" จังหวัดอื่นใช้ "อำเภอ"/"ตำบล" — เอาไว้ให้ฝั่ง UI เลือก label ให้ตรง
// ไม่พึ่งฐานข้อมูล จึงเรียกได้ทันทีตั้งแต่ยังโหลดไม่เสร็จ (ตอน validate ฟอร์มก็ใช้ตัวนี้)
export const isBangkok = (province) => province === 'กรุงเทพมหานคร'

const byTh = (a, b) => a.localeCompare(b, 'th')

let cache = null     // ข้อมูลที่แตกแล้ว — โหลดครั้งเดียวต่อการเปิดเว็บ
let inflight = null  // กันโหลดซ้อนถ้ามีหลาย component เรียกพร้อมกัน

function loadThaiAddress() {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = import('thai-address-database')
      .then(({ searchAddressByProvince }) => {
        // searchAddressByProvince ทำมาสำหรับค้นหา ไม่ใช่ดึงทั้งหมด — ใช้ regex '.' จับคู่ทุก province
        // ที่ไม่ว่าง แล้วให้ maxResult สูงพอที่จะได้ครบทุกแถว
        const all = searchAddressByProvince('.', 999999)
        cache = { all, provinces: [...new Set(all.map((r) => r.province))].sort(byTh) }
        return cache
      })
      .catch((e) => { inflight = null; throw e })  // เคลียร์ทิ้งให้ลองใหม่ได้ ถ้าเน็ตหลุดตอนโหลด
  }
  return inflight
}

// ตัวช่วยสำหรับฟอร์มที่อยู่ — คืนตัวเลือกว่างไว้ก่อนจนกว่าข้อมูลจะมาถึง
export function useThaiAddress() {
  const [data, setData] = useState(cache)

  useEffect(() => {
    if (cache) return
    let alive = true
    loadThaiAddress().then((d) => { if (alive) setData(d) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const all = data?.all || []
  return {
    ready: !!data,
    provinces: data?.provinces || [],
    getAmphoes: (province) => province
      ? [...new Set(all.filter((r) => r.province === province).map((r) => r.amphoe))].sort(byTh)
      : [],
    getDistricts: (province, amphoe) => (province && amphoe)
      ? [...new Set(all.filter((r) => r.province === province && r.amphoe === amphoe).map((r) => r.district))].sort(byTh)
      : [],
    getZipcode: (province, amphoe, district) => {
      const row = all.find((r) => r.province === province && r.amphoe === amphoe && r.district === district)
      return row ? String(row.zipcode) : ''
    },
  }
}
