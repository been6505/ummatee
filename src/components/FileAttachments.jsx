import { useState } from 'react'
import { auth } from '../firebase.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { useAttachments, addAttachment, removeAttachment, detectKind, KIND_LABEL, KIND_COLOR } from '../data/attachments.js'
import { isSafeHttpUrl } from '../utils/safeUrl.js'
import { openDrivePicker, isGoogleConfigured } from '../utils/googleDrive.js'

// แผงไฟล์แนบที่ใช้ซ้ำได้ทุกหน้า — วางไว้ในหน้าไหนก็ผูกไฟล์กับงานชิ้นนั้นได้
// ใช้: <FileAttachments entityType="meeting" entityId={m.id} />
//
// ลิงก์ที่แนบมาจากแอดมิน (บัญชี volunteer แชร์กันหลายคน) จึงต้องกรอง scheme ก่อนใส่ href ทุกครั้ง
// ทั้งตอนบันทึก (addAttachment) และตอนเรนเดอร์ (กันข้อมูลเก่าที่บันทึกไว้ก่อนมีการกรอง)
export default function FileAttachments({ entityType, entityId, compact = false }) {
  const { items, loading } = useAttachments(entityType, entityId)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const add = async () => {
    const u = url.trim()
    if (!u || busy) return
    setError('')
    setBusy(true)
    try {
      await addAttachment({ entityType, entityId, url: u, title, addedBy: auth.currentUser?.email || '' })
      setUrl(''); setTitle('')
    } catch (e) {
      setError(e.message || 'เพิ่มไฟล์แนบไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (it) => {
    if (!window.confirm(`ลบลิงก์ "${it.title}" ออกจากงานนี้?\n\n(ลบแค่ลิงก์ในระบบ ไฟล์ใน Google Drive ไม่ถูกลบ)`)) return
    await removeAttachment(it.id).catch((e) => window.alert('ลบไม่สำเร็จ: ' + e.message))
  }

  // เลือกไฟล์จาก Google Drive จริงผ่าน Picker แล้วแนบทีเดียวหลายไฟล์ (ชื่อไฟล์เอามาจาก Drive ให้เลย)
  // ปุ่มนี้ซ่อนถ้ายังไม่ได้ตั้ง Google API (ดู utils/googleApiConfig.js) — ส่วนวางลิงก์เองยังใช้ได้ตลอด
  const pickFromDrive = async (imagesOnly) => {
    setError('')
    setBusy(true)
    try {
      const picked = await openDrivePicker({ imagesOnly })
      for (const f of picked) {
        await addAttachment({ entityType, entityId, url: f.url, title: f.name, addedBy: auth.currentUser?.email || '' })
      }
    } catch (e) {
      setError(e.message || 'เลือกไฟล์จาก Drive ไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const previewKind = url.trim() ? detectKind(url.trim()) : null

  return (
    <div className="attach-block">
      {!compact && <div className="attach-label">ไฟล์แนบ (Google Sheet / Doc / Slides / Drive หรือลิงก์อื่น)</div>}

      <div className="attach-add">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="วางลิงก์ไฟล์ที่นี่ (https://docs.google.com/...)"
        />
        <input
          className="attach-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="ชื่อที่จะให้แสดง (ไม่ใส่ก็ได้)"
        />
        <button type="button" className="admin-btn-primary" onClick={add} disabled={busy || !url.trim()}>
          {busy ? 'กำลังเพิ่ม...' : 'แนบไฟล์'}
        </button>
      </div>
      {isGoogleConfigured() ? (
        <div className="attach-drive-row">
          <button type="button" className="admin-btn" onClick={() => pickFromDrive(false)} disabled={busy}>
            เลือกไฟล์จาก Google Drive
          </button>
          <button type="button" className="admin-btn" onClick={() => pickFromDrive(true)} disabled={busy}>
            เลือกรูปภาพจาก Drive
          </button>
        </div>
      ) : (
        <p className="attach-hint">
          ยังไม่ได้ตั้งค่า Google API — วางลิงก์เองได้ตามปกติ ถ้าต้องการปุ่ม "เลือกไฟล์จาก Drive"
          ให้ทำตามขั้นตอนในไฟล์ <code>src/utils/googleApiConfig.js</code>
        </p>
      )}
      {previewKind && (
        <p className="attach-hint">
          ตรวจพบเป็น <strong style={{ color: KIND_COLOR[previewKind] }}>{KIND_LABEL[previewKind]}</strong>
          {' — จำไว้ว่าคนที่จะเปิดไฟล์ได้ ต้องได้รับสิทธิ์แชร์ใน Google Drive ด้วย (ระบบนี้เก็บแค่ลิงก์ ไม่ได้ให้สิทธิ์แทน)'}
        </p>
      )}
      {error && <p className="attach-hint attach-err">{error}</p>}

      {loading ? (
        <div className="sk-line" style={{ height: 14, width: '60%', marginTop: 10 }} />
      ) : items.length === 0 ? (
        <p className="attach-empty">ยังไม่มีไฟล์แนบ</p>
      ) : (
        <ul className="attach-list">
          {items.map((it) => (
            <li key={it.id} className="attach-item">
              <span className="attach-kind" style={{ background: KIND_COLOR[it.kind] || KIND_COLOR.link }}>
                {KIND_LABEL[it.kind] || KIND_LABEL.link}
              </span>
              {isSafeHttpUrl(it.url) ? (
                <a href={it.url} target="_blank" rel="noopener noreferrer" className="attach-name">
                  {it.title} <FontAwesomeIcon icon={faUpRightFromSquare} style={{ fontSize: '.7em', opacity: .6 }} />
                </a>
              ) : (
                // ลิงก์ที่ scheme ไม่ปลอดภัย (ข้อมูลเก่าก่อนมีการกรอง) — โชว์เป็นข้อความเฉยๆ ห้ามทำเป็นลิงก์กดได้
                <span className="attach-name" title={it.url}>{it.title} (ลิงก์ไม่ปลอดภัย)</span>
              )}
              <button type="button" className="attach-del" onClick={() => remove(it)} aria-label="ลบลิงก์นี้">
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
