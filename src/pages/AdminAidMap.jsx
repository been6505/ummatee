import { useEffect, useMemo, useState } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
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
    setForm(EMPTY); setEditId(null)
  }

  const edit = (l) => { setEditId(l.id); setForm({ ...EMPTY, ...l, latitude: String(l.latitude ?? ''), longitude: String(l.longitude ?? '') }) }
  const cancel = () => { setEditId(null); setForm(EMPTY) }

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
              </MapContainer>
            </div>

            <div className="admin-card" style={{ marginBottom: 20 }}>
              <h4>{editId ? 'แก้ไขจุดลงพื้นที่' : 'เพิ่มจุดลงพื้นที่ใหม่'}</h4>
              <div className="admin-form-grid">
                <label>ประเทศ<input value={form.country} onChange={set('country')} /></label>
                <label>จังหวัด<input value={form.province} onChange={set('province')} /></label>
                <label>ชื่อหมู่บ้าน<input value={form.villageName} onChange={set('villageName')} /></label>
                <label>Latitude<input type="number" step="any" value={form.latitude} onChange={set('latitude')} /></label>
                <label>Longitude<input type="number" step="any" value={form.longitude} onChange={set('longitude')} /></label>
                <label>จำนวนคนที่ช่วย<input type="number" value={form.peopleHelped} onChange={set('peopleHelped')} /></label>
                <label>รายการที่บริจาค<input value={form.itemsDonatedDescription} onChange={set('itemsDonatedDescription')} /></label>
                <label>จำนวนที่บริจาค<input type="number" value={form.itemsDonatedCount} onChange={set('itemsDonatedCount')} /></label>
                <label>วันที่ลงพื้นที่<input type="date" value={form.visitDate || ''} onChange={set('visitDate')} /></label>
                <label>หมายเหตุ<input value={form.notes} onChange={set('notes')} /></label>
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
