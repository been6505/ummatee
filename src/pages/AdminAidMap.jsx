import { useEffect, useMemo, useState } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import { writeAuditLog } from '../lib/auditLog.js'
import { downloadCsv } from '../lib/csv.js'

// จุดลงพื้นที่ช่วยเหลือ + แผนที่ (/admin/aid-map) — มิเรอร์จากเวอร์ชัน Next.js (AidLocation model)
// ใช้ react-leaflet v4 (รองรับ React 18) + OpenStreetMap tiles (ฟรี ไม่ต้องมี API key)

// แก้ปัญหา leaflet default marker icon หายเวลา bundle ผ่าน Vite (path ของรูปไอคอนไม่ถูก resolve อัตโนมัติ)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const EMPTY = { country: '', province: '', villageName: '', latitude: '', longitude: '', peopleHelped: '', itemsDonatedDescription: '', itemsDonatedCount: '', visitDate: '', notes: '' }
const THAILAND_CENTER = [13.7563, 100.5018]

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

export default function AdminAidMap() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)

  useEffect(() => {
    const qy = query(collection(db, 'aidLocations'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(qy, (snap) => {
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const withCoords = useMemo(() => list.filter((l) => Number.isFinite(l.latitude) && Number.isFinite(l.longitude)), [list])
  const totals = useMemo(() => ({
    peopleHelped: list.reduce((s, l) => s + (Number(l.peopleHelped) || 0), 0),
    itemsDonatedCount: list.reduce((s, l) => s + (Number(l.itemsDonatedCount) || 0), 0),
  }), [list])

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
      country: a.country || f.country,
      province: a.state || a.province || a.region || a.county || f.province,
      villageName: f.villageName.trim() || a.village || a.hamlet || a.town || a.suburb || a.city || String(r.display_name || '').split(',')[0],
    }))
    // เก็บไว้โชว์เป็นหมุดบนแผนที่ + สั่งให้แผนที่บินไปหา (ดู MapFocus)
    setPicked({ lat: Number(r.lat), lng: Number(r.lon), label: r.display_name })
    setGeoResults(null)
    setGeoQuery('')
  }

  const save = async () => {
    if (!form.villageName.trim() || !form.latitude || !form.longitude) { window.alert('กรอกชื่อหมู่บ้าน + พิกัด (lat/lng)'); return }
    const payload = {
      country: form.country, province: form.province, villageName: form.villageName,
      latitude: Number(form.latitude), longitude: Number(form.longitude),
      peopleHelped: Number(form.peopleHelped) || 0,
      itemsDonatedDescription: form.itemsDonatedDescription,
      itemsDonatedCount: Number(form.itemsDonatedCount) || 0,
      visitDate: form.visitDate || null,
      notes: form.notes,
    }
    if (editId) {
      await updateDoc(doc(db, 'aidLocations', editId), { ...payload, updatedAt: serverTimestamp() })
      writeAuditLog({ action: 'update', entityType: 'aidLocation', entityId: editId, summary: `แก้ไขจุด ${form.villageName}` })
    } else {
      const ref = await addDoc(collection(db, 'aidLocations'), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      writeAuditLog({ action: 'create', entityType: 'aidLocation', entityId: ref.id, summary: `เพิ่มจุด ${form.villageName}` })
    }
    setForm(EMPTY); setEditId(null); setPicked(null) // เคลียร์หมุดตัวอย่างหลังบันทึก (จุดจริงจะขึ้นเป็นหมุดปกติจาก Firestore แทน)
  }

  const edit = (l) => { setEditId(l.id); setPicked(null); setGeoResults(null); setForm({ ...EMPTY, ...l, latitude: String(l.latitude ?? ''), longitude: String(l.longitude ?? '') }) }
  const cancel = () => { setEditId(null); setForm(EMPTY); setPicked(null); setGeoResults(null) }

  const remove = async (l) => {
    if (!window.confirm(`ลบจุด "${l.villageName}" ถาวร?`)) return
    await deleteDoc(doc(db, 'aidLocations', l.id))
    writeAuditLog({ action: 'delete', entityType: 'aidLocation', entityId: l.id, summary: `ลบจุด ${l.villageName}` })
  }

  const exportCsv = () => {
    downloadCsv('aid-locations.csv',
      ['ประเทศ', 'จังหวัด', 'หมู่บ้าน', 'lat', 'lng', 'จำนวนคนที่ช่วย', 'รายการที่บริจาค', 'จำนวนที่บริจาค', 'วันที่ลงพื้นที่', 'หมายเหตุ'],
      list.map((l) => [l.country, l.province, l.villageName, l.latitude, l.longitude, l.peopleHelped || 0, l.itemsDonatedDescription, l.itemsDonatedCount || 0, l.visitDate || '', l.notes])
    )
  }

  return (
    <StaffRoleGuard allowedRoles={['admin', 'staff', 'field']}>
      {() => (
        <main className="admin-dash">
          <AdminNav />
          <div className="admin-wrap">
            <div className="admin-head">
              <div><h1>แผนที่จุดลงพื้นที่ช่วยเหลือ</h1><p>บันทึกจุดที่เคยลงพื้นที่ + แสดงบนแผนที่</p></div>
              <button className="admin-btn" onClick={exportCsv}>ส่งออก CSV</button>
            </div>

            <div className="admin-stats">
              <div className="admin-stat"><div className="v">{list.length}</div><div className="l">จุดทั้งหมด</div></div>
              <div className="admin-stat"><div className="v">{totals.peopleHelped.toLocaleString('th-TH')}</div><div className="l">คนที่ช่วยรวม</div></div>
              <div className="admin-stat"><div className="v">{totals.itemsDonatedCount.toLocaleString('th-TH')}</div><div className="l">ของบริจาครวม</div></div>
            </div>

            <div className="admin-card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
              <MapContainer center={THAILAND_CENTER} zoom={6} style={{ height: 420, width: '100%' }}>
                <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {withCoords.map((l) => (
                  <Marker key={l.id} position={[l.latitude, l.longitude]}>
                    <Popup>
                      <strong>{l.villageName}</strong><br />
                      {l.province}, {l.country}<br />
                      คนที่ช่วย: {l.peopleHelped || 0}<br />
                      {l.itemsDonatedDescription} ({l.itemsDonatedCount || 0})
                    </Popup>
                  </Marker>
                ))}

                {/* ผลค้นหา (ยังไม่ได้เลือก) — วงกลมส้ม แยกให้ต่างจากหมุดจุดที่บันทึกไว้แล้วชัดเจน */}
                {!picked && (geoResults || []).map((r) => (
                  <CircleMarker
                    key={r.place_id}
                    center={[Number(r.lat), Number(r.lon)]}
                    radius={9}
                    pathOptions={{ color: '#b45309', fillColor: '#f59e0b', fillOpacity: 0.85, weight: 2 }}
                    eventHandlers={{ click: () => pickPlace(r) }}
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
              </MapContainer>
            </div>

            <div className="admin-card" style={{ marginBottom: 20 }}>
              <h4>{editId ? 'แก้ไขจุดลงพื้นที่' : 'เพิ่มจุดลงพื้นที่ใหม่'}</h4>

              {/* ── ส่วนที่ 1: พิกัด ── */}
              <div className="aid-fieldset">
                <div className="aid-fieldset-head">
                  <span className="aid-fieldset-num">1</span>
                  <div>
                    <h5>พิกัด</h5>
                    <p>ตำแหน่งที่ลงพื้นที่ — ค้นหาชื่อสถานที่เพื่อเติมพิกัดอัตโนมัติ หรือกรอกเองก็ได้</p>
                  </div>
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
                  <label>ประเทศ<input value={form.country} onChange={set('country')} /></label>
                  <label>จังหวัด<input value={form.province} onChange={set('province')} /></label>
                  <label>ชื่อหมู่บ้าน<input value={form.villageName} onChange={set('villageName')} /></label>
                  <label>Latitude<input type="number" step="any" value={form.latitude} onChange={set('latitude')} /></label>
                  <label>Longitude<input type="number" step="any" value={form.longitude} onChange={set('longitude')} /></label>
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
              {loading ? <p>กำลังโหลดข้อมูล...</p> : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>หมู่บ้าน</th><th>จังหวัด/ประเทศ</th><th>คนที่ช่วย</th><th>ของบริจาค</th><th></th></tr></thead>
                    <tbody>
                      {list.map((l) => (
                        <tr key={l.id}>
                          <td>{l.villageName}</td>
                          <td>{l.province}, {l.country}</td>
                          <td>{l.peopleHelped || 0}</td>
                          <td>{l.itemsDonatedDescription} ({l.itemsDonatedCount || 0})</td>
                          <td style={{ display: 'flex', gap: 8 }}>
                            <button className="admin-btn" onClick={() => edit(l)}>แก้ไข</button>
                            <button className="admin-btn-danger" onClick={() => remove(l)}>ลบ</button>
                          </td>
                        </tr>
                      ))}
                      {list.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', color: '#999' }}>ยังไม่มีข้อมูล</td></tr>}
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
