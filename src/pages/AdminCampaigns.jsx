import { useEffect, useMemo, useState } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, where, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import { writeAuditLog } from '../lib/auditLog.js'
import { withSearchTokens } from '../lib/searchIndex.js'

import FileAttachments from '../components/FileAttachments.jsx'
import ExportButtons from '../components/ExportButtons.jsx'
import ListSkeleton from '../components/ListSkeleton.jsx'
// ฟิลด์ที่เอาไปสร้างดัชนีคำค้น — ต้องตรงกับ SEARCH_COLLECTIONS ใน lib/searchIndex.js
const SEARCH_FIELDS = ['name']

// แคมเปญบริจาค (/admin/campaigns) — ข้อ 2 ของแผน admin-intranet-plan.md
// currentAmount เป็นตัวเลขที่แอดมินอัปเดตเอง (ยังไม่ auto-sync จาก donations เพราะ donations ยังไม่มี field เชื่อม campaign)
const STATUS_LABEL = { planning: 'วางแผน', active: 'กำลังดำเนินการ', completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก' }
const STATUS_COLOR = { planning: '#999', active: '#2e7d52', completed: '#1565c0', cancelled: '#c0392b' }
const CHANNEL_OPTIONS = ['Facebook', 'LINE OA', 'หน้าเว็บ', 'Instagram', 'TikTok', 'ออฟไลน์']

const EMPTY = {
  name: '', description: '', goalAmount: '', currentAmount: '', startDate: '', endDate: '',
  channels: [], ownerName: '', status: 'planning',
}

export default function AdminCampaigns() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState('')
  const [counts, setCounts] = useState({}) // { [campaignId]: { posts, cards } }
  const [partners, setPartners] = useState([])
  const [links, setLinks] = useState({}) // { [campaignId]: [campaignPartners docs] }
  const [linkPanelId, setLinkPanelId] = useState(null)
  const [linkAddPartnerId, setLinkAddPartnerId] = useState('')

  useEffect(() => {
    const qy = query(collection(db, 'campaigns'), orderBy('name'))
    const unsub = onSnapshot(qy, (snap) => {
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'partnerOrganizations'), (snap) => {
      setPartners(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => (p.partnerType || 'organization') === 'store'))
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'campaignPartners'), (snap) => {
      const m = {}
      snap.docs.forEach((d) => {
        const data = { id: d.id, ...d.data() }
        ;(m[data.campaignId] = m[data.campaignId] || []).push(data)
      })
      setLinks(m)
    })
    return unsub
  }, [])

  // นับจำนวน contentPosts/boardCards ที่ผูกกับแต่ละแคมเปญ — query แยกทีละแคมเปญ (where campaignId ==)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const next = {}
      for (const c of list) {
        const [postsSnap, cardsSnap] = await Promise.all([
          getDocs(query(collection(db, 'contentPosts'), where('campaignId', '==', c.id))).catch(() => ({ size: 0 })),
          getDocs(query(collection(db, 'boardCards'), where('campaignId', '==', c.id))).catch(() => ({ size: 0 })),
        ])
        next[c.id] = { posts: postsSnap.size || 0, cards: cardsSnap.size || 0 }
      }
      if (!cancelled) setCounts(next)
    })()
    return () => { cancelled = true }
  }, [list])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return list
    return list.filter((c) => [c.name, c.ownerName, c.status].some((x) => (x || '').toLowerCase().includes(s)))
  }, [list, search])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const toggleChannel = (ch) => setForm((f) => ({
    ...f, channels: f.channels.includes(ch) ? f.channels.filter((x) => x !== ch) : [...f.channels, ch],
  }))

  const save = async () => {
    if (!form.name.trim()) { window.alert('กรอกชื่อแคมเปญ'); return }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      goalAmount: Number(form.goalAmount) || 0,
      currentAmount: Number(form.currentAmount) || 0,
      startDate: form.startDate || '',
      endDate: form.endDate || '',
      channels: form.channels,
      ownerName: form.ownerName.trim(),
      status: form.status,
      updatedAt: serverTimestamp(),
    }
    if (editId) {
      await updateDoc(doc(db, 'campaigns', editId), withSearchTokens(payload, SEARCH_FIELDS))
      writeAuditLog({ action: 'update', entityType: 'campaign', entityId: editId, summary: `แก้ไขแคมเปญ ${payload.name}` })
    } else {
      const ref = await addDoc(collection(db, 'campaigns'), withSearchTokens({ ...payload, createdAt: serverTimestamp() }, SEARCH_FIELDS))
      writeAuditLog({ action: 'create', entityType: 'campaign', entityId: ref.id, summary: `เพิ่มแคมเปญ ${payload.name}` })
    }
    setForm(EMPTY); setEditId(null)
  }

  const edit = (c) => {
    setEditId(c.id)
    setForm({
      name: c.name || '', description: c.description || '', goalAmount: c.goalAmount || '', currentAmount: c.currentAmount || '',
      startDate: c.startDate || '', endDate: c.endDate || '', channels: c.channels || [], ownerName: c.ownerName || '', status: c.status || 'planning',
    })
  }
  const cancel = () => { setEditId(null); setForm(EMPTY) }

  const remove = async (c) => {
    if (!window.confirm(`ลบแคมเปญ "${c.name}" ถาวร?`)) return
    await deleteDoc(doc(db, 'campaigns', c.id))
    writeAuditLog({ action: 'delete', entityType: 'campaign', entityId: c.id, summary: `ลบแคมเปญ ${c.name}` })
  }

  // สร้างชุดข้อมูลครั้งเดียว ใช้ได้ทั้งดาวน์โหลด CSV และส่งเข้า Google Sheets (ดู ExportButtons.jsx)
  const buildExport = () => ({
    filename: 'campaigns.csv',
    sheetName: 'แคมเปญบริจาค',
    headers: ['ชื่อ', 'เป้าหมาย', 'ยอดปัจจุบัน', '%', 'เริ่ม', 'สิ้นสุด', 'ช่องทาง', 'ผู้รับผิดชอบ', 'สถานะ'],
    rows: filtered.map((c) => [
        c.name, c.goalAmount, c.currentAmount,
        c.goalAmount ? Math.round((c.currentAmount / c.goalAmount) * 100) + '%' : '-',
        c.startDate, c.endDate, (c.channels || []).join('; '), c.ownerName, STATUS_LABEL[c.status] || c.status,
      ]),
  })

  const linkPartner = async (campaignId) => {
    if (!linkAddPartnerId) return
    const partner = partners.find((p) => p.id === linkAddPartnerId)
    const ref = await addDoc(collection(db, 'campaignPartners'), {
      campaignId, partnerId: linkAddPartnerId, role: '', status: 'invited', createdAt: serverTimestamp(),
    })
    writeAuditLog({ action: 'create', entityType: 'campaignPartner', entityId: ref.id, summary: `ผูกร้าน ${partner?.name || linkAddPartnerId} กับแคมเปญ` })
    setLinkAddPartnerId('')
  }
  const unlinkPartner = async (link) => {
    if (!window.confirm('ยกเลิกการผูกร้านค้านี้กับแคมเปญ?')) return
    await deleteDoc(doc(db, 'campaignPartners', link.id))
    writeAuditLog({ action: 'delete', entityType: 'campaignPartner', entityId: link.id, summary: 'ยกเลิกผูกร้านค้ากับแคมเปญ' })
  }
  const setLinkStatus = async (link, status) => {
    await updateDoc(doc(db, 'campaignPartners', link.id), { status })
    writeAuditLog({ action: 'update', entityType: 'campaignPartner', entityId: link.id, summary: `เปลี่ยนสถานะร้านร่วมเป็น ${status}` })
  }

  return (
    <StaffRoleGuard allowedRoles={['admin', 'staff', 'field']}>
      {() => (
        <main className="admin-dash">
          <AdminNav />
          <div className="admin-wrap">
            <div className="admin-head">
              <div><h1>แคมเปญบริจาค</h1><p>วางแผนแคมเปญ เป้าหมาย งบ ช่วงเวลา และร้านค้าที่ร่วมสนับสนุน</p></div>
              <ExportButtons build={buildExport} />
            </div>

            <div className="admin-card" style={{ marginBottom: 20 }}>
              <h4>{editId ? 'แก้ไขแคมเปญ' : 'เพิ่มแคมเปญใหม่'}</h4>
              <div className="admin-form-grid">
                <label>ชื่อแคมเปญ<input value={form.name} onChange={set('name')} /></label>
                <label>ผู้รับผิดชอบ<input value={form.ownerName} onChange={set('ownerName')} /></label>
                <label>เป้าเงิน (บาท)<input type="number" value={form.goalAmount} onChange={set('goalAmount')} /></label>
                <label>ยอดปัจจุบัน (บาท)<input type="number" value={form.currentAmount} onChange={set('currentAmount')} /></label>
                <label>เริ่ม<input type="date" value={form.startDate} onChange={set('startDate')} /></label>
                <label>สิ้นสุด<input type="date" value={form.endDate} onChange={set('endDate')} /></label>
                <label>สถานะ
                  <select value={form.status} onChange={set('status')}>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label>รายละเอียด<input value={form.description} onChange={set('description')} /></label>
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 6 }}>ช่องทางที่ใช้</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {CHANNEL_OPTIONS.map((ch) => (
                    <button
                      key={ch} type="button"
                      className={form.channels.includes(ch) ? 'admin-btn-primary' : 'admin-btn'}
                      style={{ fontSize: '.8rem', padding: '6px 14px' }}
                      onClick={() => toggleChannel(ch)}
                    >{ch}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 12 }}>
                <button className="admin-btn-primary" onClick={save}>{editId ? 'บันทึกการแก้ไข' : 'เพิ่มแคมเปญ'}</button>
                {editId && <button className="admin-btn" onClick={cancel}>ยกเลิก</button>}
              </div>
              {/* แนบไฟล์ได้เฉพาะตอนแก้ของที่บันทึกแล้ว — ของใหม่ยังไม่มี id ให้ผูกไฟล์ */}
              {editId && (
                <div style={{ marginTop: 4 }}>
                  <FileAttachments entityType="campaign" entityId={editId} />
                </div>
              )}
            </div>

            {/* หัวข้อ + ช่องค้นหา อยู่บนการ์ดขาวเหมือนเนื้อหาที่เหลือ — เดิมลอยอยู่บนพื้นเขียวของหน้า อ่านยาก */}
            <div className="admin-card" style={{ marginBottom: 16 }}>
              <div className="admin-card-head" style={{ marginBottom: 0 }}>
                <h4>รายชื่อแคมเปญ ({filtered.length})</h4>
                <input type="search" placeholder="ค้นหา..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>

            {loading ? <ListSkeleton /> : (
              <div style={{ display: 'grid', gap: 16 }}>
                {filtered.map((c) => {
                  const pct = c.goalAmount ? Math.min(100, Math.round((c.currentAmount / c.goalAmount) * 100)) : 0
                  const cnt = counts[c.id] || { posts: 0, cards: 0 }
                  const campaignLinks = links[c.id] || []
                  return (
                    <div className="admin-card" key={c.id}>
                      <div className="admin-card-head">
                        <div>
                          <h4 style={{ marginBottom: 2 }}>{c.name}</h4>
                          <span style={{ fontSize: '.78rem', padding: '2px 10px', borderRadius: 99, color: '#fff', background: STATUS_COLOR[c.status] || '#999' }}>
                            {STATUS_LABEL[c.status] || c.status}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="admin-btn" onClick={() => setLinkPanelId(linkPanelId === c.id ? null : c.id)}>ร้านค้าร่วม ({campaignLinks.length})</button>
                          <button className="admin-btn" onClick={() => edit(c)}>แก้ไข</button>
                          <button className="admin-btn-danger" onClick={() => remove(c)}>ลบ</button>
                        </div>
                      </div>
                      {c.description && <p style={{ color: 'var(--ink-soft)', fontSize: '.88rem' }}>{c.description}</p>}
                      <div style={{ margin: '10px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', marginBottom: 4 }}>
                          <span>฿{Number(c.currentAmount || 0).toLocaleString('th-TH')} / ฿{Number(c.goalAmount || 0).toLocaleString('th-TH')}</span>
                          <span>{pct}%</span>
                        </div>
                        <div style={{ height: 10, borderRadius: 99, background: '#eee', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--green-mid, #2e7d52)', borderRadius: 99 }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: '.82rem', color: 'var(--ink-soft)', flexWrap: 'wrap' }}>
                        <span>ผู้รับผิดชอบ: {c.ownerName || '—'}</span>
                        <span>ช่วงเวลา: {c.startDate || '—'} – {c.endDate || '—'}</span>
                        <span>ช่องทาง: {(c.channels || []).join(', ') || '—'}</span>
                        <span>โพสต์ที่ผูก: {cnt.posts}</span>
                        <span>การ์ดบอร์ดที่ผูก: {cnt.cards}</span>
                      </div>

                      {linkPanelId === c.id && (
                        <div style={{ marginTop: 14, borderTop: '1px solid #eee', paddingTop: 12 }}>
                          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                            <select value={linkAddPartnerId} onChange={(e) => setLinkAddPartnerId(e.target.value)}>
                              <option value="">-- เลือกร้านค้า --</option>
                              {partners.filter((p) => !campaignLinks.some((l) => l.partnerId === p.id)).map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                            <button className="admin-btn-primary" onClick={() => linkPartner(c.id)}>+ ผูกร้านค้า</button>
                          </div>
                          {campaignLinks.length === 0 && <p style={{ color: '#999', fontSize: '.85rem' }}>ยังไม่มีร้านค้าร่วมแคมเปญนี้</p>}
                          {campaignLinks.map((l) => {
                            const p = partners.find((x) => x.id === l.partnerId)
                            return (
                              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: '.85rem' }}>
                                <span style={{ flex: 1 }}>{p?.name || l.partnerId}</span>
                                <select value={l.status} onChange={(e) => setLinkStatus(l, e.target.value)}>
                                  <option value="invited">เชิญแล้ว</option>
                                  <option value="confirmed">ยืนยันแล้ว</option>
                                  <option value="declined">ปฏิเสธ</option>
                                </select>
                                <button className="admin-btn-danger" style={{ fontSize: '.75rem', padding: '4px 10px' }} onClick={() => unlinkPartner(l)}>ยกเลิก</button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
                {filtered.length === 0 && <div className="admin-card" style={{ textAlign: 'center', color: '#999' }}>ยังไม่มีแคมเปญ</div>}
              </div>
            )}
          </div>
        </main>
      )}
    </StaffRoleGuard>
  )
}
