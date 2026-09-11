import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import { writeAuditLog } from '../lib/auditLog.js'
import ExportButtons from '../components/ExportButtons.jsx'
import { uploadToCloudinary } from '../utils/cloudinary.js'
import { readExif, formatLatLng, getCurrentPosition } from '../utils/exifGps.js'
import ListSkeleton from '../components/ListSkeleton.jsx'
import { optImg } from '../utils/cloudinaryUrl.js'
import { withSearchTokens } from '../lib/searchIndex.js'
// ฟิลด์ที่เอาไปสร้างดัชนีคำค้น — ต้องตรงกับ SEARCH_COLLECTIONS ใน lib/searchIndex.js
const SEARCH_FIELDS = ['villageName', 'city', 'province', 'aidType']

// จุดลงพื้นที่ช่วยเหลือ + แผนที่ (/admin/aid-map) — มิเรอร์จากเวอร์ชัน Next.js (AidLocation model)
// ใช้ react-leaflet v4 (รองรับ React 18) + OpenStreetMap tiles (ฟรี ไม่ต้องมี API key)

// แก้ปัญหา leaflet default marker icon หายเวลา bundle ผ่าน Vite (path ของรูปไอคอนไม่ถูก resolve อัตโนมัติ)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const EMPTY = {
  // ── พิกัด ── (ชื่อฟิลด์ที่อยู่เรียงตามที่ Nominatim คืนมา เพื่อให้เติมอัตโนมัติจากผลค้นหาได้ตรงๆ)
  latitude: '', longitude: '',
  street: '', neighbourhood: '', city: '', province: '', region: '', postcode: '', country: '',
  villageName: '', // ชื่อเรียกจุดนี้ — ใช้เป็นชื่อหลักในตาราง/หมุดแผนที่/CSV จึงยังต้องมี
  // ── ความช่วยเหลือ ──
  aidType: '', budgetUsed: '', peopleHelped: '',
  itemsDonatedDescription: '', itemsDonatedCount: '',
  visitDate: '', notes: '', photoUrls: [],
  campaignId: '', // ผูกจุดลงพื้นที่กับแคมเปญ เพื่อให้หน้ารวมแคมเปญเห็นว่าไปช่วยที่ไหนมาบ้าง
}
const THAILAND_CENTER = [13.7563, 100.5018]

// ตัวเลือกแนะนำสำหรับ "ประเภทความช่วยเหลือ" — ใช้ datalist ไม่ใช่ select เพื่อให้พิมพ์ประเภทอื่นเองได้ด้วย
const AID_TYPES = ['อาหาร/น้ำดื่ม', 'เครื่องนุ่งห่ม', 'ยา/การแพทย์', 'การศึกษา', 'ที่พักอาศัย/ซ่อมแซม', 'เงินสงเคราะห์', 'กุรบาน', 'อิฟตาร์', 'ภัยพิบัติฉุกเฉิน']

// MapContainer ของ react-leaflet ไม่ย้ายมุมกล้องตาม prop ที่เปลี่ยน (center/zoom ใช้แค่ค่าตั้งต้น)
// ต้องสั่งผ่าน instance ของแผนที่เอง จึงต้องมี component ลูกที่เรียก useMap() แบบนี้
// - มีจุดที่เลือกไว้ (จากการกดผลค้นหา) → บินไปที่จุดนั้นแบบซูมใกล้
// - มีแต่ผลค้นหาหลายจุด → ซูมให้เห็นทุกจุดพอดี
function MapFocus({ focus, results }) {
  const map = useMap()
  useEffect(() => {
    if (focus) {
      map.flyTo([focus.lat, focus.lng], 13, { duration: 0.8 })
      return
    }
    if (results && results.length > 0) {
      const pts = results.map((r) => [Number(r.lat), Number(r.lon)])
      // จุดเดียวใช้ fitBounds ไม่ได้ (กรอบกว้างศูนย์ ทำให้ซูมสุด) ใช้ setView แทน
      if (pts.length === 1) map.setView(pts[0], 13)
      else map.fitBounds(pts, { padding: [40, 40] })
    }
  }, [focus, results, map])
  return null
}

// คลิก/แตะบนแผนที่ = ปักหมุดตรงนั้นแล้วเติมพิกัดลงฟอร์ม — ทางเลือกสุดท้ายเมื่อรูปไม่มี GPS
// และค้นชื่อสถานที่ไม่เจอ (พื้นที่ภัยพิบัติหลายที่ไม่มีชื่อใน OpenStreetMap)
function MapClickPicker({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

// วันที่สำหรับ <input type="date"> — ต้องประกอบจากเวลาท้องถิ่น ไม่ใช่ toISOString()
// (toISOString แปลงเป็น UTC ก่อน รูปที่ถ่ายเช้าตรู่ในไทย +07:00 จะเพี้ยนไปเป็นวันก่อนหน้า)
const toDateInput = (ms) => {
  const d = new Date(ms)
  if (!Number.isFinite(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// อ่านพิกัดจากฟิลด์ที่อาจเป็นตัวเลขหรือสตริง (จุดเก่า/ที่นำเข้ามาบางอันเก็บเป็นสตริง)
// คืน null เมื่อว่าง/ไม่ใช่ตัวเลข — ห้ามใช้ Number() ตรงๆ เพราะ Number('') = 0 จะได้หมุดกลางทะเลที่ (0,0)
const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : null
}

// หมุดของจุดที่บันทึกไว้ — แยกเป็นคอมโพเนนต์ memo เพราะฟอร์มกรอกข้อมูลอยู่ในหน้าเดียวกัน
// ถ้าไม่แยก การพิมพ์ทีละตัวอักษรในฟอร์มจะสั่ง re-render หมุด + ป๊อปอัปทุกอันใหม่ทั้งชุด
// (ข้อมูลในป๊อปอัปเตรียมมาให้เสร็จแล้วจาก withCoords จึงเหลือแค่วางลง DOM)
const AidMarkers = memo(function AidMarkers({ items }) {
  return (
    <>
      {items.map((l) => (
        // กันคลิก/แตะที่หมุดของจุดที่บันทึกไว้แล้ว ไม่ให้ไปปักหมุดใหม่ในฟอร์ม (ดู MapClickPicker)
        <Marker key={l.id} position={l.pos} eventHandlers={{ click: (e) => L.DomEvent.stopPropagation(e.originalEvent) }}>
          <Popup>
            <strong>{l.villageName}</strong><br />
            {l.where}<br />
            {l.aidType && <>ประเภท: {l.aidType}<br /></>}
            คนที่ช่วย: {l.peopleHelped.toLocaleString('th-TH')}<br />
            {l.itemsDonatedDescription} ({l.itemsDonatedCount})<br />
            {l.budgetUsed > 0 && <>งบ: ฿{l.budgetUsed.toLocaleString('th-TH')}<br /></>}
            {/* loading=lazy สำคัญมาก: react-leaflet สร้าง DOM ของป๊อปอัปไว้ล่วงหน้าทุกหมุด
                ถ้าไม่ใส่ เบราว์เซอร์จะโหลดรูปเต็มขนาดของทุกจุดพร้อมกันตั้งแต่เปิดหน้า */}
            {l.photo && <img src={l.photo} alt="" loading="lazy" decoding="async" style={{ width: '100%', marginTop: 6, borderRadius: 6 }} />}
          </Popup>
        </Marker>
      ))}
    </>
  )
})

// แถวในตาราง — memo ด้วยเหตุผลเดียวกับ AidMarkers (ตารางยาวกว่าหมุดเสียอีก)
const AidRows = memo(function AidRows({ list, onEdit, onRemove }) {
  if (list.length === 0) return <tr><td colSpan="8" style={{ textAlign: 'center', color: '#999' }}>ยังไม่มีข้อมูล</td></tr>
  return (
    <>
      {list.map((l) => (
        <tr key={l.id}>
          <td>{l.villageName}</td>
          <td>{[l.city, l.province, l.country].filter(Boolean).join(', ')}</td>
          <td>{l.aidType}</td>
          <td>{(l.peopleHelped || 0).toLocaleString('th-TH')}</td>
          <td>{l.itemsDonatedDescription} ({l.itemsDonatedCount || 0})</td>
          <td>{(Number(l.budgetUsed) || 0).toLocaleString('th-TH')}</td>
          <td>{(l.photoUrls || []).length || ''}</td>
          <td style={{ display: 'flex', gap: 8 }}>
            <button className="admin-btn" onClick={() => onEdit(l)}>แก้ไข</button>
            <button className="admin-btn-danger" onClick={() => onRemove(l)}>ลบ</button>
          </td>
        </tr>
      ))}
    </>
  )
})

export default function AdminAidMap() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [campaigns, setCampaigns] = useState([])

  useEffect(() => {
    // รายชื่อแคมเปญไว้ให้เลือกผูกกับจุดลงพื้นที่ — หน้ารวมแคมเปญอ่านจากฟิลด์นี้
    // อ่านครั้งเดียวพอ (ใช้แค่เติมตัวเลือกใน <select>) ไม่ต้องเปิด listener ค้างไว้ทั้งหน้า
    // และไม่ให้ทุกครั้งที่แคมเปญเปลี่ยนมาสั่ง re-render หน้านี้ทั้งหน้า
    let alive = true
    getDocs(collection(db, 'campaigns'))
      .then((snap) => { if (alive) setCampaigns(snap.docs.map((d) => ({ id: d.id, ...d.data() }))) })
      .catch(() => { if (alive) setCampaigns([]) })

    const qy = query(collection(db, 'aidLocations'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(qy, (snap) => {
      // อัปเดตเฉพาะเอกสารที่เปลี่ยนจริง — snap.docChanges() บอกมาให้แล้วว่าแถวไหนขยับ
      // ไม่ต้อง .data() ใหม่ทั้งคอลเลกชันทุกครั้งที่มีคนแก้จุดเดียว (ของเดิม map ใหม่หมดทุกรอบ)
      setList((cur) => {
        if (cur.length === 0) return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        const byId = new Map(cur.map((l) => [l.id, l]))
        for (const c of snap.docChanges()) {
          if (c.type === 'removed') byId.delete(c.doc.id)
          else byId.set(c.doc.id, { id: c.doc.id, ...c.doc.data() })
        }
        // เรียงตามลำดับของ snapshot (createdAt desc) — ถูกเสมอแม้แถวจะถูกแทรกกลาง
        return snap.docs.map((d) => byId.get(d.id)).filter(Boolean)
      })
      setLoading(false)
    }, () => setLoading(false))
    return () => { alive = false; unsub() }
  }, [])

  // เตรียมข้อมูลของหมุดให้ครบในรอบเดียว (พิกัดเป็นตัวเลข + ที่อยู่ที่ประกอบแล้ว + URL รูปย่อ)
  // ป๊อปอัปจึงไม่ต้องคำนวณ/ต่อสตริง/สร้าง URL ใหม่ทุกครั้งที่ re-render
  const withCoords = useMemo(() => {
    const out = []
    for (const l of list) {
      const lat = num(l.latitude)
      const lng = num(l.longitude)
      if (lat === null || lng === null) continue
      out.push({
        id: l.id,
        pos: [lat, lng],
        villageName: l.villageName,
        aidType: l.aidType,
        where: [l.neighbourhood, l.city, l.province, l.country].filter(Boolean).join(', '),
        peopleHelped: Number(l.peopleHelped) || 0,
        itemsDonatedDescription: l.itemsDonatedDescription,
        itemsDonatedCount: l.itemsDonatedCount || 0,
        budgetUsed: Number(l.budgetUsed) || 0,
        // ย่อรูปที่ Cloudinary — ป๊อปอัปกว้างไม่ถึง 300px ไม่ต้องโหลดไฟล์เต็มขนาดหลาย MB
        photo: (l.photoUrls || [])[0] ? optImg(l.photoUrls[0], 320) : null,
      })
    }
    return out
  }, [list])

  // รวมยอดในรอบเดียว แทนการวนลิสต์ 3 รอบ
  const totals = useMemo(() => list.reduce((t, l) => {
    t.peopleHelped += Number(l.peopleHelped) || 0
    t.itemsDonatedCount += Number(l.itemsDonatedCount) || 0
    t.budgetUsed += Number(l.budgetUsed) || 0
    return t
  }, { peopleHelped: 0, itemsDonatedCount: 0, budgetUsed: 0 }), [list])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // ── ค้นหาพิกัดจากชื่อสถานที่ (geocoding) ──
  // ใช้ Nominatim ของ OpenStreetMap: ฟรี ไม่ต้องมี API key และรองรับ CORS จึงเรียกจากเบราว์เซอร์ตรงได้
  // (ต้องเพิ่มโดเมนนี้ใน connect-src ของ CSP ใน firebase.json ไม่งั้นเบราว์เซอร์บล็อก)
  // กติกาการใช้ของ Nominatim จำกัด ~1 คำขอ/วินาที — ที่นี่ยิงเฉพาะตอนกดปุ่มค้นหา ไม่ยิงตามการพิมพ์ จึงไม่เกิน
  const [geoQuery, setGeoQuery] = useState('')
  const [geoResults, setGeoResults] = useState(null) // null = ยังไม่ค้นหา, [] = ค้นแล้วไม่เจอ
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoError, setGeoError] = useState('')
  const [picked, setPicked] = useState(null) // จุดที่เลือกจากผลค้นหา — โชว์เป็นหมุดตัวอย่างบนแผนที่ก่อนกดบันทึก

  const searchPlace = async () => {
    const q = geoQuery.trim()
    if (!q || geoBusy) return
    setGeoBusy(true)
    setGeoError('')
    setGeoResults(null)
    setPicked(null) // ค้นใหม่ → ล้างหมุดที่เลือกไว้เดิม ให้แผนที่ไปโฟกัสผลชุดใหม่แทน
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1&accept-language=th&q=${encodeURIComponent(q)}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`ค้นหาไม่สำเร็จ (${res.status})`)
      setGeoResults(await res.json())
    } catch (e) {
      setGeoError(e.message || 'ค้นหาไม่สำเร็จ')
    } finally {
      setGeoBusy(false)
    }
  }

  // เลือกผลลัพธ์ → เติมพิกัดและที่อยู่ให้ ชื่อหมู่บ้านเติมเฉพาะตอนยังว่าง
  // (แอดมินอาจพิมพ์ชื่อท้องถิ่นที่ OSM ไม่รู้จักไว้แล้ว ไม่ควรทับทิ้ง)
  const pickPlace = (r) => {
    const a = r.address || {}
    setForm((f) => ({
      ...f,
      latitude: String(r.lat),
      longitude: String(r.lon),
      // Nominatim ใช้ชื่อคีย์ไม่เหมือนกันตามชนิดของสถานที่/ประเทศ จึงต้องไล่ fallback หลายคีย์ต่อช่อง
      // county ของไทยคือ "อำเภอ" (ย่อยกว่าจังหวัด) จึงต้องลงช่องย่าน/เขต ไม่ใช่ช่องจังหวัด
      // ส่วนจังหวัดใช้ state (บางประเทศ) หรือ province (ไทยคืนคีย์นี้ตรงๆ) — ตรวจกับ API จริงแล้ว
      street: a.road || a.pedestrian || a.footway || f.street,
      neighbourhood: a.neighbourhood || a.suburb || a.quarter || a.city_district || a.district || a.county || f.neighbourhood,
      city: a.city || a.town || a.village || a.municipality || f.city,
      province: a.state || a.province || f.province,
      region: a.region || a.state_district || f.region,
      postcode: a.postcode || f.postcode,
      country: a.country || f.country,
      villageName: f.villageName.trim() || a.village || a.hamlet || a.town || a.suburb || a.city || String(r.display_name || '').split(',')[0],
    }))
    // เก็บไว้โชว์เป็นหมุดบนแผนที่ + สั่งให้แผนที่บินไปหา (ดู MapFocus)
    setPicked({ lat: Number(r.lat), lng: Number(r.lon), label: r.display_name })
    setGeoResults(null)
    setGeoQuery('')
  }

  // ค้นหาให้อัตโนมัติหลังหยุดพิมพ์ — ไม่ต้องกดปุ่มเองก็ได้ผลลัพธ์ (ปุ่มยังอยู่สำหรับกดค้นซ้ำ)
  // หน่วง 900ms ต่อการพิมพ์ 1 ชุด เพื่อไม่ให้ยิงเกินโควตาของ Nominatim (~1 คำขอ/วินาที)
  // เก็บฟังก์ชันไว้ใน ref เพราะ searchPlace สร้างใหม่ทุก render — ถ้าใส่ใน deps ตรงๆ จะยิงซ้ำไม่จบ
  const searchPlaceRef = useRef(searchPlace)
  useEffect(() => { searchPlaceRef.current = searchPlace })
  useEffect(() => {
    if (geoQuery.trim().length < 3) return // คำสั้นเกินไปค้นแล้วไม่มีความหมาย
    const t = setTimeout(() => searchPlaceRef.current(), 900)
    return () => clearTimeout(t)
  }, [geoQuery])

  // กันเคสอ่านไฟล์ RAW ขนาดใหญ่ (CR2/CR3/NEF ฯลฯ อาจใหญ่หลายสิบ MB) แล้วค้างไม่ resolve/reject เลย
  // ถ้าเกินเวลาที่กำหนด ให้ถือว่าไม่พบพิกัด แล้วไปต่อขั้นอัปโหลดเลย ไม่ปล่อยให้ปุ่มค้าง "กำลังอัปโหลด..." ตลอดไป
  const withTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ])

  // reverse geocoding: จากพิกัด (lat/lng) หาชื่อถนน/ย่าน/เมือง/จังหวัด/ประเทศ — ใช้ตัว address mapping
  // เดียวกับ pickPlace (Nominatim คืนคีย์เดียวกันไม่ว่าจะเป็น search หรือ reverse)
  const reverseGeocode = async (lat, lon) => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=th`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`reverse geocode ไม่สำเร็จ (${res.status})`)
    return res.json()
  }

  // อัปโหลดรูปหน้างานขึ้น Cloudinary (ตัวเดียวกับที่หน้าอื่นใช้) เก็บแต่ URL ลง Firestore
  // ก่อนอัปโหลด: อ่าน EXIF ของรูปที่เลือก — ถ้ามีพิกัดติดมากับรูป (กล้อง/มือถือส่วนใหญ่ฝังไว้อัตโนมัติ)
  // ให้เติมพิกัด + reverse-geocode ที่อยู่ + วันที่ถ่ายภาพให้อัตโนมัติ โดยไม่ทับพิกัดที่กรอก/เลือกไว้แล้ว
  const [uploading, setUploading] = useState(false)
  const [geoFromPhoto, setGeoFromPhoto] = useState('') // ข้อความสถานะ: กำลังอ่าน/ผลลัพธ์/ไม่พบพิกัดในรูป
  const [locBusy, setLocBusy] = useState(false)        // กำลังขอตำแหน่งจากเครื่อง (GPS มือถือ)

  // เติมพิกัดลงฟอร์ม + วางหมุดตัวอย่างบนแผนที่ — ใช้ร่วมกันทุกทางที่ได้พิกัดมา
  // (EXIF จากรูป / ตำแหน่งของเครื่อง / คลิกบนแผนที่) จะได้พฤติกรรมเหมือนกันหมด
  // keepExisting = true → ไม่ทับพิกัดที่กรอก/เลือกไว้แล้ว (ใช้กับการเติมอัตโนมัติจากรูป)
  const applyCoords = (lat, lng, label, { keepExisting = false } = {}) => {
    setForm((f) => ((keepExisting && f.latitude && f.longitude) ? f : { ...f, latitude: String(lat), longitude: String(lng) }))
    setPicked({ lat, lng, label })
  }

  // เติมที่อยู่จากพิกัด (reverse geocode) — เติมเฉพาะช่องที่ยังว่าง ไม่ทับที่แอดมินพิมพ์เอง
  // ชื่อจุด/หมู่บ้านก็เติมให้ด้วยถ้ายังว่าง เพราะเป็นช่องบังคับตอนบันทึก จะได้กดบันทึกได้เลย
  const fillAddressFromCoords = async (lat, lng) => {
    const place = await withTimeout(reverseGeocode(lat, lng).catch(() => null), 6000)
    const a = place?.address || {}
    setForm((f) => ({
      ...f,
      street: f.street || a.road || a.pedestrian || a.footway || '',
      neighbourhood: f.neighbourhood || a.neighbourhood || a.suburb || a.quarter || a.city_district || a.district || a.county || '',
      city: f.city || a.city || a.town || a.village || a.municipality || '',
      province: f.province || a.state || a.province || '',
      region: f.region || a.region || a.state_district || '',
      postcode: f.postcode || a.postcode || '',
      country: f.country || a.country || '',
      villageName: f.villageName.trim() || a.village || a.hamlet || a.town || a.suburb || a.city || '',
    }))
    if (place?.display_name) setPicked((cur) => (cur ? { ...cur, label: place.display_name } : cur))
    return place
  }

  // ขอพิกัดจากเครื่องที่กำลังกรอก (GPS มือถือ) — ใช้เป็นทางถอยอัตโนมัติเมื่อรูปไม่มี EXIF GPS
  // เพราะส่วนใหญ่แอดมินกรอกข้อมูลตอนอยู่หน้างานพอดี พิกัดเครื่องจึงใกล้เคียงจุดที่ลงพื้นที่
  // silent = true → เรียกจากขั้นตอนอัตโนมัติ ถ้าผู้ใช้ไม่อนุญาตก็เงียบไว้ ไม่ขึ้น error ทับข้อความเดิม
  const applyDeviceLocation = async ({ silent = false } = {}) => {
    setLocBusy(true)
    try {
      const pos = await getCurrentPosition()
      applyCoords(pos.lat, pos.lng, 'ตำแหน่งปัจจุบันของเครื่อง', { keepExisting: silent })
      setGeoFromPhoto(`ใช้ตำแหน่งปัจจุบันของเครื่อง: ${formatLatLng(pos.lat, pos.lng)} — กำลังค้นที่อยู่...`)
      await fillAddressFromCoords(pos.lat, pos.lng)
      setGeoFromPhoto(`ใช้ตำแหน่งปัจจุบันของเครื่อง: ${formatLatLng(pos.lat, pos.lng)} (ถ้าไม่ใช่จุดที่ต้องการ แก้พิกัดเองหรือแตะบนแผนที่ได้)`)
      return true
    } catch (e) {
      if (!silent) setGeoFromPhoto(e.message || 'หาตำแหน่งไม่สำเร็จ')
      return false
    } finally {
      setLocBusy(false)
    }
  }

  // แตะบนแผนที่เพื่อปักหมุดเอง — ทับพิกัดเดิมเสมอ เพราะเป็นการสั่งตรงจากผู้ใช้
  const pickFromMap = async (lat, lng) => {
    const la = Math.round(lat * 1e7) / 1e7
    const ln = Math.round(lng * 1e7) / 1e7
    applyCoords(la, ln, 'จุดที่ปักบนแผนที่')
    setGeoFromPhoto(`ปักหมุดบนแผนที่: ${formatLatLng(la, ln)} — กำลังค้นที่อยู่...`)
    await fillAddressFromCoords(la, ln)
    setGeoFromPhoto(`ปักหมุดบนแผนที่: ${formatLatLng(la, ln)}`)
  }

  // อ่านพิกัด/วันที่จาก EXIF ของรูปที่เลือก — แยกออกมาเพื่อให้รันขนานไปกับการอัปโหลดได้
  // ใช้ตัวอ่าน EXIF ของโปรเจกต์เอง (utils/exifGps.js) แทนไลบรารีนอก: รองรับ JPEG / HEIC-HEIF ของ iPhone /
  // RAW ของกล้อง โดยอ่านแค่หัวไฟล์ ไม่ต้องถอดรหัสรูปจึงไม่พึ่ง WebAssembly ที่ CSP ของโฮสต์บล็อกอยู่
  // อ่านทุกไฟล์พร้อมกัน แล้วใช้ใบแรกที่มีพิกัด — รูปที่ไม่มี GPS จะไม่หน่วงคิวของใบถัดไป
  const readCoordsFromPhotos = async (files) => {
    setGeoFromPhoto('กำลังอ่านพิกัดจากรูปภาพ...')
    const exifList = await Promise.all(files.map((f) => withTimeout(readExif(f), 8000)))
    const i = exifList.findIndex((x) => x && x.gps)
    if (i < 0) {
      // รูปไม่มีพิกัดติดมา — เจอบ่อยกับรูปที่ส่งผ่าน LINE/Messenger (แอปแชทลบ metadata ทิ้ง)
      // หรือรูปที่ปิดการบันทึกตำแหน่งตอนถ่าย → ถอยไปใช้ตำแหน่งของเครื่องให้อัตโนมัติแทน
      setGeoFromPhoto('ไม่พบพิกัด GPS ในรูปภาพ (รูปที่ส่งผ่านแอปแชทจะถูกลบพิกัดทิ้ง) — กำลังขอตำแหน่งจากเครื่องแทน...')
      const ok = await applyDeviceLocation({ silent: true })
      if (!ok) setGeoFromPhoto('ไม่พบพิกัด GPS ในรูปภาพ และขอตำแหน่งจากเครื่องไม่ได้ — ค้นหาชื่อสถานที่ แตะบนแผนที่ หรือกรอกพิกัดเองได้')
      return
    }
    const { gps, takenAt } = exifList[i]
    // เติมพิกัด + ขยับแผนที่ก่อนเลย ไม่ต้องรอ Nominatim ตอบ (ส่วนที่ช้าที่สุดคือขั้นนี้)
    applyCoords(gps.lat, gps.lng, 'พิกัดจากรูปภาพ', { keepExisting: true })
    setGeoFromPhoto(`อ่านพิกัดจากรูปภาพสำเร็จ: ${formatLatLng(gps.lat, gps.lng)} — กำลังค้นที่อยู่...`)
    if (takenAt) setForm((f) => ({ ...f, visitDate: f.visitDate || toDateInput(takenAt) }))
    await fillAddressFromCoords(gps.lat, gps.lng)
    setGeoFromPhoto(`อ่านพิกัดจากรูปภาพสำเร็จ: ${formatLatLng(gps.lat, gps.lng)}${takenAt ? ` (ถ่ายเมื่อ ${new Date(takenAt).toLocaleString('th-TH')})` : ''}`)
  }

  const uploadPhotos = async (e) => {
    const files = [...e.target.files]
    if (!files.length) return
    e.target.value = '' // เคลียร์ทันที (ไม่ต้องรอ finally) เพื่อให้เลือกไฟล์เดิมซ้ำได้
    setUploading(true)
    setGeoFromPhoto('')

    // เริ่มส่งไฟล์ขึ้น Cloudinary ทันที ไม่รอ EXIF — สองงานนี้ไม่ได้ต้องพึ่งผลของกันและกัน
    const uploadJob = Promise.all(files.map((f) => uploadToCloudinary(f, 'image')))
    // อ่าน EXIF เฉพาะตอนที่ยังไม่มีพิกัดในฟอร์ม (เหมือนเดิม) และไม่ให้ error ของมันไปล้มการอัปโหลด
    const exifJob = (form.latitude && form.longitude)
      ? Promise.resolve()
      : readCoordsFromPhotos(files).catch(() => setGeoFromPhoto('อ่านพิกัดจากรูปภาพไม่สำเร็จ — กรอกพิกัดเองหรือค้นหาด้านบนแทนได้'))

    try {
      const results = await uploadJob
      setForm((f) => ({ ...f, photoUrls: [...(f.photoUrls || []), ...results.map((r) => r.url)] }))
    } catch (err) {
      window.alert('อัปโหลดรูปไม่สำเร็จ: ' + err.message)
    } finally {
      setUploading(false)
    }
    await exifJob // ปล่อยให้เดินต่อจนจบ (ปุ่มปลดล็อกไปแล้ว ไม่ต้องรอที่อยู่)
  }
  const removePhoto = (i) => setForm((f) => ({ ...f, photoUrls: (f.photoUrls || []).filter((_, j) => j !== i) }))

  const save = async () => {
    if (!form.villageName.trim() || !form.latitude || !form.longitude) { window.alert('กรอกชื่อหมู่บ้าน + พิกัด (lat/lng)'); return }
    const payload = {
      // พิกัด
      latitude: Number(form.latitude), longitude: Number(form.longitude),
      street: form.street, neighbourhood: form.neighbourhood, city: form.city,
      province: form.province, region: form.region, postcode: form.postcode, country: form.country,
      villageName: form.villageName,
      // ความช่วยเหลือ
      aidType: form.aidType,
      budgetUsed: Number(form.budgetUsed) || 0,
      peopleHelped: Number(form.peopleHelped) || 0,
      itemsDonatedDescription: form.itemsDonatedDescription,
      itemsDonatedCount: Number(form.itemsDonatedCount) || 0,
      visitDate: form.visitDate || null,
      notes: form.notes,
      photoUrls: form.photoUrls || [],
      campaignId: form.campaignId || null,
    }
    if (editId) {
      await updateDoc(doc(db, 'aidLocations', editId), withSearchTokens({ ...payload, updatedAt: serverTimestamp() }, SEARCH_FIELDS))
      writeAuditLog({ action: 'update', entityType: 'aidLocation', entityId: editId, summary: `แก้ไขจุด ${form.villageName}` })
    } else {
      const ref = await addDoc(collection(db, 'aidLocations'), withSearchTokens({ ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, SEARCH_FIELDS))
      writeAuditLog({ action: 'create', entityType: 'aidLocation', entityId: ref.id, summary: `เพิ่มจุด ${form.villageName}` })
    }
    setForm(EMPTY); setEditId(null); setPicked(null); setGeoFromPhoto('') // เคลียร์หมุดตัวอย่างหลังบันทึก (จุดจริงจะขึ้นเป็นหมุดปกติจาก Firestore แทน)
  }

  // ...EMPTY ก่อน แล้วทับด้วยข้อมูลจริง — จุดที่บันทึกไว้ก่อนมีฟิลด์ใหม่จะได้ค่าเริ่มต้นแทน undefined
  // (ถ้าปล่อย undefined เข้า input ที่เป็น controlled component React จะเตือนและ input กลายเป็น uncontrolled)
  const edit = useCallback((l) => {
    setEditId(l.id); setPicked(null); setGeoResults(null); setGeoFromPhoto('')
    setForm({
      ...EMPTY, ...l,
      latitude: String(l.latitude ?? ''), longitude: String(l.longitude ?? ''),
      budgetUsed: String(l.budgetUsed ?? ''), peopleHelped: String(l.peopleHelped ?? ''),
      itemsDonatedCount: String(l.itemsDonatedCount ?? ''),
      photoUrls: l.photoUrls || [],
    })
  }, [])
  const cancel = () => { setEditId(null); setForm(EMPTY); setPicked(null); setGeoResults(null); setGeoFromPhoto('') }

  const remove = useCallback(async (l) => {
    if (!window.confirm(`ลบจุด "${l.villageName}" ถาวร?`)) return
    await deleteDoc(doc(db, 'aidLocations', l.id))
    writeAuditLog({ action: 'delete', entityType: 'aidLocation', entityId: l.id, summary: `ลบจุด ${l.villageName}` })
  }, [])

  // สร้างชุดข้อมูลครั้งเดียว ใช้ได้ทั้งดาวน์โหลด CSV และส่งเข้า Google Sheets (ดู ExportButtons.jsx)
  const buildExport = () => ({
    filename: 'aid-locations.csv',
    sheetName: 'จุดลงพื้นที่',
    headers: ['ชื่อจุด', 'lat', 'lng', 'ถนน', 'ย่าน/เขต', 'เมือง', 'จังหวัด', 'ภูมิภาค', 'รหัสไปรษณีย์', 'ประเทศ',
        'ประเภทความช่วยเหลือ', 'งบประมาณที่ใช้', 'จำนวนคนที่ช่วย', 'รายการที่บริจาค', 'จำนวนที่บริจาค', 'วันที่ลงพื้นที่', 'หมายเหตุ', 'จำนวนรูป', 'ลิงก์รูป'],
    rows: list.map((l) => [l.villageName, l.latitude, l.longitude, l.street || '', l.neighbourhood || '', l.city || '', l.province || '', l.region || '', l.postcode || '', l.country || '',
        l.aidType || '', Number(l.budgetUsed) || 0, l.peopleHelped || 0, l.itemsDonatedDescription, l.itemsDonatedCount || 0, l.visitDate || '', l.notes, (l.photoUrls || []).length, (l.photoUrls || []).join(' | ')]),
  })

  return (
    <StaffRoleGuard allowedRoles={['admin', 'staff', 'field']}>
      {() => (
        <main className="admin-dash">
          <AdminNav />
          <div className="admin-wrap">
            <div className="admin-head">
              <div><h1>แผนที่จุดลงพื้นที่ช่วยเหลือ</h1><p>บันทึกจุดที่เคยลงพื้นที่ + แสดงบนแผนที่</p></div>
              <ExportButtons build={buildExport} />
            </div>

            <div className="admin-stats">
              <div className="admin-stat"><div className="v">{list.length}</div><div className="l">จุดทั้งหมด</div></div>
              <div className="admin-stat"><div className="v">{totals.peopleHelped.toLocaleString('th-TH')}</div><div className="l">คนที่ช่วยรวม</div></div>
              <div className="admin-stat"><div className="v">{totals.itemsDonatedCount.toLocaleString('th-TH')}</div><div className="l">ของบริจาครวม</div></div>
              <div className="admin-stat"><div className="v">฿{totals.budgetUsed.toLocaleString('th-TH')}</div><div className="l">งบประมาณรวม</div></div>
            </div>

            <div className="admin-card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
              <MapContainer center={THAILAND_CENTER} zoom={6} style={{ height: 420, width: '100%' }}>
                <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <AidMarkers items={withCoords} />

                {/* ผลค้นหา (ยังไม่ได้เลือก) — วงกลมส้ม แยกให้ต่างจากหมุดจุดที่บันทึกไว้แล้วชัดเจน */}
                {!picked && (geoResults || []).map((r) => (
                  /* stopPropagation กันไม่ให้คลิกหมุดผลค้นหาไหลต่อไปถึง MapClickPicker
                     (ไม่งั้นพิกัดที่เพิ่งเลือกจากผลค้นหาจะโดนพิกัดของจุดที่คลิกทับทันที) */
                  <CircleMarker
                    key={r.place_id}
                    center={[Number(r.lat), Number(r.lon)]}
                    radius={9}
                    pathOptions={{ color: '#b45309', fillColor: '#f59e0b', fillOpacity: 0.85, weight: 2 }}
                    eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e.originalEvent); pickPlace(r) } }}
                  >
                    <Popup>
                      <strong>ผลค้นหา</strong><br />
                      {r.display_name}<br />
                      <em>คลิกหมุดนี้เพื่อใช้พิกัดนี้</em>
                    </Popup>
                  </CircleMarker>
                ))}

                {/* จุดที่เลือกแล้ว — วงกลมเขียว รอกดบันทึก */}
                {picked && (
                  <CircleMarker
                    center={[picked.lat, picked.lng]}
                    radius={11}
                    pathOptions={{ color: '#166534', fillColor: '#22c55e', fillOpacity: 0.9, weight: 3 }}
                  >
                    <Popup>
                      <strong>จุดที่เลือก (ยังไม่บันทึก)</strong><br />
                      {picked.label}<br />
                      {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
                    </Popup>
                  </CircleMarker>
                )}

                <MapFocus focus={picked} results={geoResults} />
                {/* แตะที่ว่างบนแผนที่ = ปักหมุดตรงนั้น (คลิกที่หมุดถูกกันไว้ไม่ให้ไหลมาถึงตัวนี้) */}
                <MapClickPicker onPick={pickFromMap} />
              </MapContainer>
              {/* บอกให้รู้ว่าแผนที่กดเลือกจุดได้ ไม่งั้นไม่มีใครเดาออกว่าแตะได้ (การ์ดใบนี้ padding:0 จึงใส่ระยะเอง) */}
              <p className="aid-geo-msg" style={{ margin: 0, padding: '10px 14px' }}>แตะจุดไหนบนแผนที่ก็ได้เพื่อปักหมุดตรงนั้น — พิกัดและที่อยู่ในฟอร์มด้านล่างจะถูกเติมให้อัตโนมัติ</p>
            </div>

            <div className="admin-card" style={{ marginBottom: 20 }}>
              <h4>{editId ? 'แก้ไขจุดลงพื้นที่' : 'เพิ่มจุดลงพื้นที่ใหม่'}</h4>

              {/* ── ส่วนที่ 1: พิกัด ── */}
              <div className="aid-fieldset">
                <div className="aid-fieldset-head">
                  <span className="aid-fieldset-num">1</span>
                  <div>
                    <h5>พิกัด</h5>
                    <p>ตำแหน่งที่ลงพื้นที่ — เติมอัตโนมัติได้ 4 ทาง: อัปโหลดรูปที่มี GPS, ใช้ตำแหน่งปัจจุบันของเครื่อง, ค้นหาชื่อสถานที่ หรือแตะจุดบนแผนที่ (กรอกเองก็ได้)</p>
                  </div>
                </div>

              {/* รูปภาพหน้างาน — อ่านพิกัด GPS + ที่อยู่ + วันที่จากรูปอัตโนมัติ (ถ้ารูปมี EXIF GPS ติดมา) */}
              <div className="aid-photos">
                <label className="admin-upload-btn" style={{ opacity: uploading ? .6 : 1, pointerEvents: uploading ? 'none' : 'auto' }}>
                  {uploading ? 'กำลังอัปโหลด...' : '📷 อัปโหลดรูปภาพเพื่อดึงพิกัดอัตโนมัติ'}
                  <input type="file" accept="image/*,.heic,.heif,.cr2,.cr3,.nef,.arw,.raf,.rw2,.dng,.orf,.sr2,.raw" multiple hidden onChange={uploadPhotos} />
                </label>
                <p className="aid-photos-hint">รูปที่มีพิกัด GPS ฝังอยู่ (ถ่ายจากมือถือ/กล้องส่วนใหญ่ รวมถึง HEIC ของ iPhone และ RAW ของกล้อง) จะเติมพิกัด ที่อยู่ ชื่อจุด และวันที่ให้อัตโนมัติ — ถ้ารูปไม่มีพิกัด ระบบจะขอตำแหน่งจากเครื่องนี้ให้แทนอัตโนมัติ</p>
                {geoFromPhoto && <p className="aid-geo-msg">{geoFromPhoto}</p>}
                {(form.photoUrls || []).length > 0 && (
                  <div className="aid-photo-thumbs">
                    {form.photoUrls.map((url, i) => (
                      <div key={i} className="aid-photo-thumb">
                        <img src={optImg(url, 200)} alt={`รูปหน้างาน ${i + 1}`} loading="lazy" decoding="async" />
                        <button type="button" onClick={() => removePhoto(i)} aria-label="ลบรูปนี้">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ค้นหาพิกัดจากชื่อสถานที่ — ไม่ต้องไปเปิด Google Maps หาพิกัดมาวางเอง */}
              <div className="aid-geo-search">
                <input
                  value={geoQuery}
                  onChange={(e) => setGeoQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchPlace() } }}
                  placeholder="พิมพ์ชื่อสถานที่/หมู่บ้าน/อำเภอ เช่น Rafah Gaza หรือ อ.เมือง ปัตตานี"
                />
                <button type="button" className="admin-btn-primary" onClick={searchPlace} disabled={geoBusy || !geoQuery.trim()}>
                  {geoBusy ? 'กำลังค้นหา...' : 'ค้นหาพิกัด'}
                </button>
                {/* ทางลัดที่ใช้บ่อยที่สุดตอนอยู่หน้างาน — ได้พิกัดจาก GPS ของเครื่องโดยไม่ต้องมีรูป */}
                <button type="button" className="admin-btn" onClick={() => applyDeviceLocation()} disabled={locBusy}>
                  {locBusy ? 'กำลังหาตำแหน่ง...' : '📍 ใช้ตำแหน่งปัจจุบัน'}
                </button>
              </div>
              {geoError && <p className="aid-geo-msg aid-geo-err">{geoError}</p>}
              {geoResults && geoResults.length === 0 && (
                <p className="aid-geo-msg">ไม่พบสถานที่นี้ — ลองพิมพ์ให้กว้างขึ้น (เช่น ใส่ชื่ออำเภอ/จังหวัด/ประเทศ) หรือพิมพ์เป็นภาษาอังกฤษ</p>
              )}
              {geoResults && geoResults.length > 0 && (
                <div className="aid-geo-results">
                  {geoResults.map((r) => (
                    <button type="button" key={r.place_id} className="aid-geo-result" onClick={() => pickPlace(r)}>
                      <span className="aid-geo-name">{r.display_name}</span>
                      <span className="aid-geo-coord">{Number(r.lat).toFixed(5)}, {Number(r.lon).toFixed(5)}</span>
                    </button>
                  ))}
                </div>
              )}

                <div className="admin-form-grid">
                  <label>Latitude<input type="number" step="any" value={form.latitude} onChange={set('latitude')} /></label>
                  <label>Longitude<input type="number" step="any" value={form.longitude} onChange={set('longitude')} /></label>
                  <label>ชื่อจุด/หมู่บ้าน<input value={form.villageName} onChange={set('villageName')} placeholder="ชื่อที่ใช้เรียกจุดนี้" /></label>
                  <label>ชื่อถนน<input value={form.street} onChange={set('street')} /></label>
                  <label>ย่าน/เขต<input value={form.neighbourhood} onChange={set('neighbourhood')} /></label>
                  <label>เมือง<input value={form.city} onChange={set('city')} /></label>
                  <label>จังหวัด<input value={form.province} onChange={set('province')} /></label>
                  <label>ภูมิภาค<input value={form.region} onChange={set('region')} /></label>
                  <label>รหัสไปรษณีย์<input value={form.postcode} onChange={set('postcode')} /></label>
                  <label>ประเทศ<input value={form.country} onChange={set('country')} /></label>
                </div>
              </div>

              {/* ── ส่วนที่ 2: ความช่วยเหลือ ── */}
              <div className="aid-fieldset">
                <div className="aid-fieldset-head">
                  <span className="aid-fieldset-num">2</span>
                  <div>
                    <h5>ความช่วยเหลือ</h5>
                    <p>สิ่งที่มอบให้ในพื้นที่นี้ — ใช้รวมเป็นสถิติจำนวนคนที่ช่วยและของบริจาคทั้งหมด</p>
                  </div>
                </div>
                <div className="admin-form-grid">
                  <label>ประเภทความช่วยเหลือ
                    <input value={form.aidType} onChange={set('aidType')} list="aid-type-options" placeholder="เลือกหรือพิมพ์เอง" />
                    <datalist id="aid-type-options">
                      {AID_TYPES.map((t) => <option key={t} value={t} />)}
                    </datalist>
                  </label>
                  <label>แคมเปญที่เกี่ยวข้อง
                    <select value={form.campaignId || ''} onChange={set('campaignId')}>
                      <option value="">— ไม่ผูกแคมเปญ —</option>
                      {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                  <label>งบประมาณที่ใช้ (บาท)<input type="number" min="0" step="any" value={form.budgetUsed} onChange={set('budgetUsed')} /></label>
                  <label>จำนวนคนที่ช่วย<input type="number" value={form.peopleHelped} onChange={set('peopleHelped')} /></label>
                  <label>รายการที่บริจาค<input value={form.itemsDonatedDescription} onChange={set('itemsDonatedDescription')} placeholder="เช่น ข้าวสาร 500 ถุง, ผ้าห่ม 200 ผืน" /></label>
                  <label>จำนวนที่บริจาค<input type="number" value={form.itemsDonatedCount} onChange={set('itemsDonatedCount')} /></label>
                  <label>วันที่ลงพื้นที่<input type="date" value={form.visitDate || ''} onChange={set('visitDate')} /></label>
                  <label>หมายเหตุ<input value={form.notes} onChange={set('notes')} /></label>
                </div>
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 12 }}>
                <button className="admin-btn-primary" onClick={save}>{editId ? 'บันทึกการแก้ไข' : 'เพิ่มจุด'}</button>
                {editId && <button className="admin-btn" onClick={cancel}>ยกเลิก</button>}
              </div>
            </div>

            <div className="admin-card">
              <h4>รายการจุดทั้งหมด ({list.length})</h4>
              {loading ? <ListSkeleton /> : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>ชื่อจุด</th><th>ที่อยู่</th><th>ประเภท</th><th>คนที่ช่วย</th><th>ของบริจาค</th><th>งบ (฿)</th><th>รูป</th><th></th></tr></thead>
                    <tbody>
                      <AidRows list={list} onEdit={edit} onRemove={remove} />
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      )}
    </StaffRoleGuard>
  )
}
