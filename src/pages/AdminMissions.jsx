import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { MISSIONS } from '../data/missions.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faImage, faXmark, faSpinner, faVideo } from '@fortawesome/free-solid-svg-icons'

// จัดการรูป/วิดีโอของแต่ละภารกิจ (/admin/missions) — อัปโหลดขึ้น Cloudinary แล้วเก็บ URL ใน Firestore (missionMedia/{key})
// แสดงผลทันทีที่หน้า /missions

const CLOUDINARY_CLOUD = 'dei5jktuw'
const CLOUDINARY_PRESET = 'Ummatee'

async function uploadToCloudinary(file) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', CLOUDINARY_PRESET)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error('upload failed')
  return (await res.json()).secure_url
}

const isVideo = (url) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url)

export default function AdminMissions() {
  const { user, loading } = useAdminAuth()
  const [mediaMap, setMediaMap] = useState({})
  const [uploading, setUploading] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!user) return
    const unsub = onSnapshot(collection(db, 'missionMedia'), (snap) => {
      const map = {}
      snap.docs.forEach((d) => { map[d.id] = d.data().media || [] })
      setMediaMap(map)
    })
    return unsub
  }, [user])

  if (loading) return null
  if (!user) return <AdminLogin />

  const save = async (key, media) => {
    try {
      await setDoc(doc(db, 'missionMedia', key), { media, updatedAt: Date.now() }, { merge: true })
    } catch (e) {
      setStatus('บันทึกไม่สำเร็จ: ' + e.message)
    }
  }

  const upload = async (key, e) => {
    const files = [...e.target.files]
    if (!files.length) return
    setUploading(key)
    setStatus('')
    try {
      const urls = await Promise.all(files.map(uploadToCloudinary))
      const next = [...(mediaMap[key] || []), ...urls]
      await save(key, next)
    } catch (err) {
      setStatus('อัพโหลดไม่สำเร็จ: ' + err.message)
    } finally {
      setUploading('')
      e.target.value = ''
    }
  }

  const removeAt = async (key, i) => {
    const next = (mediaMap[key] || []).filter((_, j) => j !== i)
    await save(key, next)
  }

  return (
    <main className="admin-dash admin-qurban">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1>จัดการภารกิจ</h1>
            <p>อัปโหลดรูป/วิดีโอของแต่ละโครงการ — แสดงผลที่หน้า <a href="/missions">/missions</a> ทันที</p>
          </div>
          {status && <span style={{ color: '#c0392b', fontWeight: 600 }}>{status}</span>}
        </div>

        <div className="admin-missions-list">
          {MISSIONS.map((m) => {
            const items = mediaMap[m.key] || []
            return (
              <div className="admin-card admin-mission-card" key={m.key}>
                <div className="admin-mission-head" style={{ '--accent': m.accent }}>
                  <div className="admin-mission-icon"><FontAwesomeIcon icon={m.icon} /></div>
                  <div>
                    <h4>{m.th.name}</h4>
                    <p>{m.th.desc}</p>
                  </div>
                  <span className="admin-mission-count">{items.length} ไฟล์</span>
                </div>

                {items.length > 0 && (
                  <div className="admin-media-preview" style={{ marginTop: 14 }}>
                    {items.map((url, i) => (
                      <div key={i} className="admin-media-thumb">
                        {isVideo(url) ? <video src={url} muted /> : <img src={url} alt="" />}
                        {isVideo(url) && <span className="admin-media-main"><FontAwesomeIcon icon={faVideo} /></span>}
                        <button type="button" className="admin-media-remove" onClick={() => removeAt(m.key, i)}><FontAwesomeIcon icon={faXmark} /></button>
                      </div>
                    ))}
                  </div>
                )}

                <label className="admin-upload-btn" style={{ marginTop: 14, opacity: uploading === m.key ? .6 : 1, pointerEvents: uploading === m.key ? 'none' : 'auto' }}>
                  <FontAwesomeIcon icon={uploading === m.key ? faSpinner : faImage} spin={uploading === m.key} />
                  {uploading === m.key ? ' กำลังอัพโหลด...' : ' เพิ่มรูป / วิดีโอ'}
                  <input type="file" accept="image/*,video/*" multiple hidden onChange={(e) => upload(m.key, e)} />
                </label>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
