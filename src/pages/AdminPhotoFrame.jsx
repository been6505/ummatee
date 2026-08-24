import { useEffect, useRef, useState } from 'react'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import VolunteerGuard from '../components/VolunteerGuard.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { uploadToCloudinary } from '../utils/cloudinary.js'
import { readExif, formatLatLng, mapsLink, getCurrentPosition } from '../utils/exifGps.js'
import { composeSquareJpeg, convertToJpeg, decodeImage, decodeImageDetailed, downloadBlob, framedFileName, formatBytes } from '../utils/framePhoto.js'
import { useFramedPhotos, saveFramedPhoto, deleteFramedPhoto, framedPhotosToCsv } from '../data/framedPhotos.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faImages, faLayerGroup, faLocationDot, faSpinner, faXmark, faDownload, faCloudArrowUp, faTrash, faCheck, faFileCsv, faCrosshairs, faTriangleExclamation, faImage, faDatabase } from '@fortawesome/free-solid-svg-icons'

// ใส่กรอบรูป + เก็บพิกัด (/admin/photo-frame)
// 1) เลือกกรอบ cover PNG (โปร่งใส) → เป็นเลเยอร์บน
// 2) เลือกรูปถ่ายกี่รูปก็ได้      → เป็นเลเยอร์ล่าง ครอปเป็นจัตุรัส 1:1
//    รับได้ทั้ง JPEG/PNG, HEIC จาก iPhone และ RAW จากกล้อง (DNG/CR2/CR3/NEF/ARW/RW2)
// 3) ประกอบในเบราว์เซอร์แล้วส่งออกเป็น JPG — พร้อมอ่านพิกัด GPS จาก EXIF ของไฟล์ต้นฉบับ
// 4) กดบันทึก → อัปโหลด JPG ขึ้น Cloudinary แล้วเก็บ URL + พิกัดลง Firestore (framedPhotos)
//
// หมายเหตุ: ต้องอ่าน EXIF จาก "ไฟล์ต้นฉบับ" ก่อนประกอบภาพเสมอ เพราะ canvas ทิ้ง metadata ทั้งหมด
// ไฟล์ JPG ที่ได้จึงไม่มีพิกัดติดไปด้วย (ตั้งใจ — พิกัดเก็บในฐานข้อมูลแทน ไม่หลุดไปกับรูปที่เอาไปโพสต์)

const SIZES = [1080, 1440, 2048]
const COVER_KEY = 'umPhotoFrameCover' // จำกรอบล่าสุดไว้ใช้ครั้งหน้า (เก็บ URL บน Cloudinary)

const GPS_SOURCE_LABEL = { exif: 'จากไฟล์รูป (EXIF)', device: 'ตำแหน่งเครื่องนี้', manual: 'กรอกเอง' }

// ฟอร์แมตไฟล์ที่หน้านี้รับ — RAW/HEIC ไม่เข้าเงื่อนไข accept="image/*" ของบางระบบ ต้องระบุนามสกุลเพิ่ม
const ACCEPT_PHOTOS = 'image/*,.heic,.heif,.avif,.dng,.cr2,.cr3,.nef,.arw,.rw2,.orf,.raf,.tif,.tiff'
const FORMAT_LABEL = { jpeg: 'JPEG', isobmff: 'HEIC', tiff: 'RAW', png: 'PNG', other: 'ไฟล์รูป' }
// วิธีที่ถอดรหัสรูปมาได้ — บอกผู้ใช้เมื่อไม่ได้ใช้ภาพต้นฉบับตรงๆ
const VIA_LABEL = {
  libheif: 'ถอดรหัส HEIC ในเบราว์เซอร์',
  'raw-preview': 'ใช้ภาพ preview ที่กล้องฝังในไฟล์ RAW',
  embedded: 'ใช้ภาพ JPEG ที่ฝังอยู่ในไฟล์',
}

let seq = 0
const nextId = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`

export default function AdminPhotoFrame() {
  const { user, loading } = useAdminAuth()

  const [cover, setCover] = useState(null)       // { img, url, name, w, h }
  const [coverBusy, setCoverBusy] = useState(false)
  const [items, setItems] = useState([])         // รูปต้นฉบับ { id, name, bytes, img, via, srcW, srcH, format, takenAt, takenAtText }
  const [geo, setGeo] = useState({})             // { [id]: { lat, lng, altitude, source } | null }
  const [results, setResults] = useState({})     // { [id]: { blob, url, bytes } | { error } }
  const [savedIds, setSavedIds] = useState({})   // { [id]: docId }

  const [convertOnly, setConvertOnly] = useState(false) // true = แปลงเป็น JPEG อย่างเดียว ไม่ครอปจัตุรัส ไม่ใส่กรอบ
  const [size, setSize] = useState(1080)
  const [fit, setFit] = useState('cover')
  const [quality, setQuality] = useState(0.92)
  const [bg, setBg] = useState('#ffffff')

  const [composing, setComposing] = useState(false)
  const [reading, setReading] = useState('') // '' = ว่าง, ไม่ว่าง = ข้อความคืบหน้า เช่น '3/12'
  const [saving, setSaving] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const { photos: saved, loading: savedLoading, error: savedError } = useFramedPhotos(!!user)

  // เก็บ object URL ล่าสุดไว้เคลียร์ตอน unmount (กันหน่วยความจำรั่วเมื่อประกอบภาพหลายรอบ)
  const resultsRef = useRef(results)
  resultsRef.current = results
  useEffect(() => () => {
    Object.values(resultsRef.current).forEach((r) => r?.url && URL.revokeObjectURL(r.url))
  }, [])

  // โหลดกรอบที่ใช้ล่าสุดกลับมาอัตโนมัติ — ดึงเป็น blob ก่อน (ไม่ผูก <img> ข้ามโดเมนตรงๆ) กัน canvas ติด taint
  useEffect(() => {
    const remembered = localStorage.getItem(COVER_KEY)
    if (!remembered) return
    let cancelled = false
    ;(async () => {
      try {
        const blob = await (await fetch(remembered)).blob()
        const img = await decodeImage(blob)
        if (cancelled) return
        setCover({ img, url: URL.createObjectURL(blob), name: 'กรอบที่ใช้ล่าสุด', w: img.width, h: img.height, remembered: true })
      } catch {
        localStorage.removeItem(COVER_KEY) // ลิงก์เสีย/โหลดไม่ได้ — ลืมไปเลย ให้ผู้ใช้เลือกใหม่
      }
    })()
    return () => { cancelled = true }
  }, [])

  // ประกอบภาพใหม่ทุกครั้งที่รูป/กรอบ/การตั้งค่าเปลี่ยน
  useEffect(() => {
    if (!items.length) { setResults({}); return }
    let cancelled = false
    setComposing(true)
    ;(async () => {
      const next = {}
      for (const it of items) {
        if (cancelled) break
        try {
          const blob = convertOnly
            ? await convertToJpeg(it.img, quality, bg)
            : await composeSquareJpeg({ photo: it.img, cover: cover?.img, size, quality, fit, background: bg })
          next[it.id] = { blob, url: URL.createObjectURL(blob), bytes: blob.size }
        } catch (e) {
          next[it.id] = { error: e.message || 'ประกอบภาพไม่สำเร็จ' }
        }
      }
      if (cancelled) { Object.values(next).forEach((r) => r?.url && URL.revokeObjectURL(r.url)); return }
      setResults((prev) => {
        Object.values(prev).forEach((r) => r?.url && URL.revokeObjectURL(r.url))
        return next
      })
      setComposing(false)
    })()
    return () => { cancelled = true }
  }, [items, cover, size, quality, fit, bg, convertOnly])

  if (loading) return null
  if (!user) return <AdminLogin />

  // ── เลือกกรอบ cover PNG ──
  const pickCover = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErr(''); setMsg(''); setCoverBusy(true)
    try {
      const img = await decodeImage(file)
      setCover((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url)
        return { img, url: URL.createObjectURL(file), name: file.name, w: img.width, h: img.height }
      })
      // จำไว้ใช้ครั้งหน้า — ล้มเหลวก็ไม่เป็นไร กรอบในหน้านี้ใช้ได้อยู่แล้ว
      uploadToCloudinary(file, 'image')
        .then(({ url }) => localStorage.setItem(COVER_KEY, url))
        .catch(() => {})
    } catch (e) {
      setErr('เปิดไฟล์กรอบไม่ได้: ' + e.message)
    } finally {
      setCoverBusy(false)
    }
  }

  const clearCover = () => {
    setCover((prev) => { if (prev?.url) URL.revokeObjectURL(prev.url); return null })
    localStorage.removeItem(COVER_KEY)
  }

  // ── เพิ่มรูปถ่าย (อ่าน EXIF ก่อน แล้วค่อยถอดรหัสภาพ) ──
  const addPhotos = async (e) => {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (!files.length) return
    setErr(''); setMsg(''); setReading(`0/${files.length}`)
    const added = []
    const addedGeo = {}
    // ถอดรหัสทีละไฟล์ (HEIC/RAW ใช้เวลาไฟล์ละหลายร้อย ms ถึงหลายวินาที) แล้วรายงานความคืบหน้าไปด้วย
    for (const [idx, file] of files.entries()) {
      setReading(`${idx + 1}/${files.length}`)
      try {
        const exif = await readExif(file)
        const dec = await decodeImageDetailed(file)
        const id = nextId()
        added.push({
          id, name: file.name, bytes: file.size, img: dec.img, via: dec.via,
          srcW: dec.width, srcH: dec.height, format: exif.format === 'other' ? dec.format : exif.format,
          takenAt: exif.takenAt, takenAtText: exif.takenAtText,
        })
        addedGeo[id] = exif.gps ? { ...exif.gps, source: 'exif' } : null
      } catch (e) {
        setErr(`เปิดไฟล์ "${file.name}" ไม่ได้: ${e.message}`)
      }
    }
    if (added.length) {
      setItems((prev) => [...prev, ...added])
      setGeo((prev) => ({ ...prev, ...addedGeo }))
      const withGps = Object.values(addedGeo).filter(Boolean).length
      setMsg(`เพิ่ม ${added.length} รูป — อ่านพิกัด GPS จากไฟล์ได้ ${withGps} รูป${withGps < added.length ? ` (อีก ${added.length - withGps} รูปไม่มีพิกัดในไฟล์)` : ''}`)
    }
    setReading('')
  }

  const removeItem = (id) => {
    setItems((prev) => prev.filter((x) => x.id !== id))
    setGeo(({ [id]: _drop, ...rest }) => rest)
    setSavedIds(({ [id]: _d, ...rest }) => rest)
  }

  const clearAll = () => {
    setItems([]); setGeo({}); setSavedIds({}); setMsg(''); setErr('')
  }

  // ── พิกัด ──
  const setItemGeo = (id, next) => setGeo((prev) => ({ ...prev, [id]: next }))

  const useDeviceLocation = async (id) => {
    try {
      const pos = await getCurrentPosition()
      if (id === 'all') {
        setGeo((prev) => Object.fromEntries(items.map((it) => [it.id, prev[it.id] || { ...pos, source: 'device' }])))
        setMsg('เติมพิกัดปัจจุบันให้รูปที่ยังไม่มีพิกัดแล้ว')
      } else {
        setItemGeo(id, { ...pos, source: 'device' })
      }
      setErr('')
    } catch (e) {
      setErr(e.message)
    }
  }

  // รับได้ทั้ง "13.7367, 100.5231" (คัดลอกจาก Google Maps) และเว้นวรรคเฉยๆ
  const setManualLatLng = (id, text) => {
    const m = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/)
    if (!m) { setItemGeo(id, null); return }
    const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) { setItemGeo(id, null); return }
    setItemGeo(id, { lat, lng, altitude: null, source: 'manual' })
  }

  // ── ดาวน์โหลด ──
  const downloadOne = (it) => {
    const r = results[it.id]
    if (r?.blob) downloadBlob(r.blob, framedFileName(it.name, convertOnly ? 'converted' : 'framed'))
  }

  const downloadAll = async () => {
    for (const it of items) {
      const r = results[it.id]
      if (!r?.blob) continue
      downloadBlob(r.blob, framedFileName(it.name, convertOnly ? 'converted' : 'framed'))
      await new Promise((res) => setTimeout(res, 350)) // เว้นจังหวะ ไม่งั้นเบราว์เซอร์บล็อกดาวน์โหลดรัวๆ
    }
  }

  // ── บันทึกขึ้น Cloudinary + Firestore ──
  const saveAll = async () => {
    const pending = items.filter((it) => results[it.id]?.blob && !savedIds[it.id])
    if (!pending.length) { setMsg('ไม่มีรูปใหม่ให้บันทึก'); return }
    setErr(''); setMsg('')
    let ok = 0
    for (let i = 0; i < pending.length; i++) {
      const it = pending[i]
      setSaving(`กำลังบันทึก ${i + 1}/${pending.length} — ${it.name}`)
      try {
        const fileName = framedFileName(it.name)
        const file = new File([results[it.id].blob], fileName, { type: 'image/jpeg' })
        const { url } = await uploadToCloudinary(file, 'image')
        const g = geo[it.id]
        const docId = await saveFramedPhoto({
          url,
          fileName,
          sourceFileName: it.name,
          lat: g?.lat ?? null,
          lng: g?.lng ?? null,
          altitude: g?.altitude ?? null,
          hasGps: !!g,
          gpsSource: g?.source || null,
          takenAt: it.takenAt ?? null,
          takenAtText: it.takenAtText || null,
          sourceFormat: it.format || null,
          sourcePixels: it.srcW && it.srcH ? `${it.srcW}x${it.srcH}` : null,
          decodedVia: it.via || null,
          size,
          fit,
          quality,
          bytes: results[it.id].bytes,
          hasCover: !!cover,
          by: user.email,
        })
        setSavedIds((prev) => ({ ...prev, [it.id]: docId }))
        ok++
      } catch (e) {
        setErr(`บันทึก "${it.name}" ไม่สำเร็จ: ${e.message}`)
        break
      }
    }
    setSaving('')
    if (ok) setMsg(`บันทึกลงฐานข้อมูลแล้ว ${ok} รูป`)
  }

  const removeSaved = async (row) => {
    if (!window.confirm(`ลบ "${row.fileName}" ออกจากฐานข้อมูล?\n(ไฟล์บน Cloudinary จะยังอยู่)`)) return
    try { await deleteFramedPhoto(row.id) } catch (e) { setErr('ลบไม่สำเร็จ: ' + e.message) }
  }

  const exportCsv = () => {
    const blob = new Blob([framedPhotosToCsv(saved)], { type: 'text/csv;charset=utf-8' })
    downloadBlob(blob, `framed-photos-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const readyCount = items.filter((it) => results[it.id]?.blob).length
  const gpsCount = items.filter((it) => geo[it.id]).length
  const unsavedCount = items.filter((it) => results[it.id]?.blob && !savedIds[it.id]).length
  const coverSquare = !cover || Math.abs(cover.w - cover.h) <= Math.max(2, cover.w * 0.01)

  return (<VolunteerGuard>
    <main className="admin-dash">
      <AdminNav />
      <div className="admin-wrap">

        <div className="admin-card" style={{ marginBottom: 18 }}>
          <div className="admin-card-head">
            <h4><FontAwesomeIcon icon={faLayerGroup} /> ใส่กรอบรูป + เก็บพิกัด GPS</h4>
          </div>
          <p style={{ fontSize: '.88rem', color: 'var(--ink-soft)', lineHeight: 1.65, margin: 0 }}>
            อัปโหลด <strong>กรอบ PNG</strong> (เลเยอร์บน) และ <strong>รูปถ่าย</strong> (เลเยอร์ล่าง) ระบบจะครอปรูปเป็นจัตุรัส
            แล้ววางกรอบทับ ส่งออกเป็นไฟล์ <strong>JPG อัตราส่วน 1:1</strong> — พร้อมอ่านพิกัด GPS ที่กล้องฝังมากับไฟล์
            แล้วบันทึกลงฐานข้อมูลให้ในขั้นตอนเดียว
          </p>
        </div>

        {(msg || err || saving) && (
          <div style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 10, fontSize: '.88rem', fontWeight: 600,
            background: err ? '#fef2f2' : '#ecfdf5', color: err ? '#dc2626' : '#047857',
          }}>
            {saving ? <><FontAwesomeIcon icon={faSpinner} spin /> {saving}</> : (err || msg)}
          </div>
        )}

        {/* ── 0. โหมด ── */}
        <div className="admin-card" style={{ marginBottom: 18 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '.9rem', fontWeight: 700, cursor: 'pointer' }}>
            <input type="checkbox" checked={convertOnly} onChange={(e) => setConvertOnly(e.target.checked)} style={{ width: 18, height: 18 }} />
            แปลงเป็น JPEG อย่างเดียว (ไม่ครอปจัตุรัส ไม่ใส่กรอบ — คงขนาด/สัดส่วนต้นฉบับไว้)
          </label>
          <p style={{ fontSize: '.82rem', color: 'var(--ink-soft)', margin: '8px 0 0' }}>
            เปิดโหมดนี้เมื่อแค่อยากได้ไฟล์ JPEG จาก HEIC (iPhone) หรือ RAW จากกล้อง โดยไม่ต้องใส่กรอบหรือครอปรูป
          </p>
        </div>

        {/* ── 1. กรอบ cover PNG ── */}
        {!convertOnly && <div className="admin-card" style={{ marginBottom: 18 }}>
          <div className="admin-card-head"><h4><FontAwesomeIcon icon={faImage} /> 1. กรอบ (cover PNG) — เลเยอร์บน</h4></div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <label className="admin-upload-btn" style={{ opacity: coverBusy ? .6 : 1, pointerEvents: coverBusy ? 'none' : 'auto' }}>
              <FontAwesomeIcon icon={coverBusy ? faSpinner : faImage} spin={coverBusy} />
              {cover ? ' เปลี่ยนกรอบ' : ' เลือกไฟล์กรอบ (.png)'}
              <input type="file" accept="image/png,image/webp,image/*" hidden onChange={pickCover} />
            </label>
            {cover && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div className="pf-cover-preview"><img src={cover.url} alt="กรอบ" /></div>
                <div style={{ fontSize: '.82rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{cover.name}</div>
                  <div>{cover.w} × {cover.h} px{cover.remembered ? ' · กรอบที่ใช้ล่าสุด' : ''}</div>
                  <button type="button" className="admin-btn" style={{ marginTop: 6, padding: '4px 12px', fontSize: '.78rem' }} onClick={clearCover}>
                    <FontAwesomeIcon icon={faXmark} /> เอากรอบออก
                  </button>
                </div>
              </div>
            )}
          </div>
          {!coverSquare && (
            <div style={{ marginTop: 12, fontSize: '.82rem', color: '#b45309', background: '#fffbeb', padding: '8px 12px', borderRadius: 8 }}>
              <FontAwesomeIcon icon={faTriangleExclamation} /> กรอบนี้ไม่ใช่จัตุรัส ({cover.w}×{cover.h}) — จะถูกยืดให้เต็มผืน 1:1 ภาพกรอบอาจผิดสัดส่วน แนะนำให้ทำไฟล์กรอบเป็นจัตุรัส
            </div>
          )}
          {!cover && (
            <div style={{ marginTop: 12, fontSize: '.82rem', color: 'var(--ink-soft)' }}>
              ยังไม่ได้เลือกกรอบ — ตอนนี้จะได้รูปจัตุรัสเปล่าๆ ไม่มีกรอบทับ
            </div>
          )}
        </div>}

        {/* ── 2. รูปถ่าย + การตั้งค่า ── */}
        <div className="admin-card" style={{ marginBottom: 18 }}>
          <div className="admin-card-head">
            <h4><FontAwesomeIcon icon={faImages} /> {convertOnly ? '1. รูปถ่าย (JPEG / HEIC / RAW)' : '2. รูปถ่าย — เลเยอร์ล่าง (JPEG / HEIC / RAW)'}</h4>
            {items.length > 0 && (
              <button type="button" className="admin-btn" onClick={clearAll}><FontAwesomeIcon icon={faTrash} /> ล้างทั้งหมด</button>
            )}
          </div>

          <label className="admin-upload-btn" style={{ opacity: reading ? .6 : 1, pointerEvents: reading ? 'none' : 'auto' }}>
            <FontAwesomeIcon icon={reading ? faSpinner : faImages} spin={!!reading} />
            {reading ? ` กำลังอ่านไฟล์ ${reading}...` : ' เลือกรูป (เลือกได้หลายรูป)'}
            <input type="file" accept={ACCEPT_PHOTOS} multiple hidden onChange={addPhotos} />
          </label>

          <div style={{ fontSize: '.8rem', color: 'var(--ink-soft)', marginTop: 8, lineHeight: 1.6 }}>
            รับ JPEG/PNG, HEIC จาก iPhone และ RAW จากกล้อง (DNG/CR2/CR3/NEF/ARW/RW2) —
            HEIC บน Safari เปิดได้ทันที ส่วนเบราว์เซอร์อื่นจะโหลดตัวถอดรหัสเพิ่มครั้งแรกครั้งเดียว
            ไฟล์ RAW จะใช้ภาพความละเอียดสูงที่กล้องฝังมาในไฟล์
          </div>

          <div className="admin-form-grid admin-form-grid-3col" style={{ marginTop: 16 }}>
            {!convertOnly && <label>ขนาดไฟล์ผลลัพธ์ (1:1)
              <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
                {SIZES.map((s) => <option key={s} value={s}>{s} × {s} px</option>)}
              </select>
            </label>}
            {!convertOnly && <label>การจัดวางรูปในกรอบจัตุรัส
              <select value={fit} onChange={(e) => setFit(e.target.value)}>
                <option value="cover">ครอปกลางให้เต็ม (แนะนำ)</option>
                <option value="contain">ย่อทั้งรูป เติมพื้นหลัง</option>
              </select>
            </label>}
            <label>คุณภาพ JPG — {Math.round(quality * 100)}%
              <input type="range" min="0.6" max="1" step="0.02" value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
            </label>
          </div>
          {(convertOnly || fit === 'contain') && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)' }}>
              สีพื้นหลัง
              <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} style={{ width: 44, height: 30, padding: 0, border: '1px solid #ddd', borderRadius: 6, background: '#fff' }} />
            </label>
          )}
        </div>

        {/* ── 3. ผลลัพธ์ ── */}
        {items.length > 0 && (
          <div className="admin-card" style={{ marginBottom: 18 }}>
            <div className="admin-card-head">
              <h4>
                <FontAwesomeIcon icon={composing ? faSpinner : faCheck} spin={composing} />
                {composing ? ' กำลังประกอบภาพ...' : ` ${convertOnly ? '2' : '3'}. ผลลัพธ์ ${readyCount}/${items.length} รูป`}
              </h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!convertOnly && <button type="button" className="admin-btn" onClick={() => useDeviceLocation('all')} title="เติมพิกัดปัจจุบันให้รูปที่ยังไม่มีพิกัด">
                  <FontAwesomeIcon icon={faCrosshairs} /> เติมพิกัดปัจจุบัน
                </button>}
                <button type="button" className="admin-btn" onClick={downloadAll} disabled={!readyCount}>
                  <FontAwesomeIcon icon={faDownload} /> ดาวน์โหลด JPG ทั้งหมด
                </button>
                {!convertOnly && <button type="button" className="admin-btn-primary" onClick={saveAll} disabled={!unsavedCount || !!saving}>
                  <FontAwesomeIcon icon={saving ? faSpinner : faCloudArrowUp} spin={!!saving} /> บันทึกลงฐานข้อมูล ({unsavedCount})
                </button>}
              </div>
            </div>

            {!convertOnly && <div style={{ fontSize: '.82rem', color: 'var(--ink-soft)', marginBottom: 14 }}>
              <FontAwesomeIcon icon={faLocationDot} /> อ่านพิกัดจากไฟล์ได้ {gpsCount}/{items.length} รูป
              {gpsCount < items.length && ' — รูปที่ผ่านแอปแชท/โซเชียลมักถูกลบพิกัดออก กดปุ่มพิกัดปัจจุบันหรือวางพิกัดจาก Google Maps ได้'}
            </div>}

            <div className="pf-grid">
              {items.map((it) => {
                const r = results[it.id]
                const g = geo[it.id]
                return (
                  <div key={it.id} className="pf-item">
                    <div className="pf-thumb">
                      {r?.url ? <img src={r.url} alt={it.name} /> : <div className="pf-thumb-wait"><FontAwesomeIcon icon={r?.error ? faTriangleExclamation : faSpinner} spin={!r?.error} /></div>}
                      {savedIds[it.id] && <span className="pf-badge-saved"><FontAwesomeIcon icon={faCheck} /> บันทึกแล้ว</span>}
                      <button type="button" className="admin-media-remove" onClick={() => removeItem(it.id)} title="เอาออก"><FontAwesomeIcon icon={faXmark} /></button>
                    </div>

                    <div className="pf-name" title={it.name}>{it.name}</div>
                    <div className="pf-meta">
                      {r?.error ? <span style={{ color: '#dc2626' }}>{r.error}</span>
                        : convertOnly
                          ? <>JPG {it.srcW}×{it.srcH} · {formatBytes(r?.bytes)} <span style={{ opacity: .6 }}>(ต้นฉบับ {formatBytes(it.bytes)})</span></>
                          : <>JPG {size}×{size} · {formatBytes(r?.bytes)} <span style={{ opacity: .6 }}>(ต้นฉบับ {formatBytes(it.bytes)})</span></>}
                    </div>
                    <div className="pf-meta">
                      ต้นฉบับ {FORMAT_LABEL[it.format] || 'ไฟล์รูป'}{it.srcW ? ` · ${it.srcW}×${it.srcH}` : ''}
                      {VIA_LABEL[it.via] && <span className="pf-via"> · {VIA_LABEL[it.via]}</span>}
                    </div>
                    {!convertOnly && it.srcW && Math.min(it.srcW, it.srcH) < size && (
                      <div className="pf-warn">
                        <FontAwesomeIcon icon={faTriangleExclamation} /> ต้นฉบับที่ถอดได้เล็กกว่าขนาดส่งออก {size} px — ภาพจะไม่คม ลดขนาดส่งออกหรือใช้ไฟล์ที่ใหญ่กว่านี้
                      </div>
                    )}
                    {it.takenAtText && <div className="pf-meta">ถ่ายเมื่อ {it.takenAtText}</div>}

                    {!convertOnly && <div className={`pf-gps${g ? ' has' : ''}`}>
                      <FontAwesomeIcon icon={faLocationDot} />
                      {g ? (
                        <span>
                          <a href={mapsLink(g.lat, g.lng)} target="_blank" rel="noreferrer">{formatLatLng(g.lat, g.lng)}</a>
                          <em>{GPS_SOURCE_LABEL[g.source] || ''}{g.altitude != null ? ` · สูง ${g.altitude} ม.` : ''}</em>
                        </span>
                      ) : <span>ไม่มีพิกัดในไฟล์</span>}
                    </div>}

                    <div className="pf-actions">
                      {!convertOnly && <input
                        type="text" className="pf-latlng" placeholder="วางพิกัด เช่น 13.7367, 100.5231"
                        defaultValue={g ? `${g.lat}, ${g.lng}` : ''}
                        onChange={(e) => setManualLatLng(it.id, e.target.value)}
                      />}
                      {!convertOnly && <button type="button" className="admin-btn admin-icon-btn" style={{ width: 34, height: 34, fontSize: '.9rem' }} onClick={() => useDeviceLocation(it.id)} title="ใช้ตำแหน่งปัจจุบัน">
                        <FontAwesomeIcon icon={faCrosshairs} />
                      </button>}
                      <button type="button" className="admin-btn admin-icon-btn" style={{ width: 34, height: 34, fontSize: '.9rem' }} onClick={() => downloadOne(it)} disabled={!r?.blob} title="ดาวน์โหลด JPG">
                        <FontAwesomeIcon icon={faDownload} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── 4. รายการที่บันทึกไว้ ── */}
        <div className="admin-card">
          <div className="admin-card-head">
            <h4><FontAwesomeIcon icon={faDatabase} /> รูปที่บันทึกไว้ในฐานข้อมูล {saved.length ? `(${saved.length})` : ''}</h4>
            <button type="button" className="admin-btn" onClick={exportCsv} disabled={!saved.length}>
              <FontAwesomeIcon icon={faFileCsv} /> ส่งออก CSV
            </button>
          </div>

          {savedError && <div style={{ color: '#dc2626', fontSize: '.85rem', marginBottom: 12 }}>โหลดรายการไม่ได้: {savedError}</div>}

          {savedLoading ? <div style={{ color: 'var(--ink-soft)', fontSize: '.88rem' }}>กำลังโหลด…</div>
            : !saved.length ? <div style={{ color: 'var(--ink-soft)', fontSize: '.88rem' }}>ยังไม่มีรูปที่บันทึกไว้</div>
            : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>รูป</th><th>ชื่อไฟล์</th><th>พิกัด</th><th>ที่มาพิกัด</th><th>บันทึกเมื่อ</th><th></th></tr>
                  </thead>
                  <tbody>
                    {saved.map((row) => (
                      <tr key={row.id}>
                        <td><a href={row.url} target="_blank" rel="noreferrer"><img src={row.url} alt="" className="pf-row-thumb" /></a></td>
                        <td style={{ fontSize: '.82rem' }}>{row.fileName}<div style={{ color: 'var(--ink-soft)', fontSize: '.75rem' }}>{row.size}×{row.size} · {formatBytes(row.bytes)}</div></td>
                        <td style={{ fontSize: '.82rem', fontFamily: 'monospace' }}>
                          {row.hasGps ? <a href={mapsLink(row.lat, row.lng)} target="_blank" rel="noreferrer">{formatLatLng(row.lat, row.lng)}</a> : <span style={{ color: 'var(--ink-soft)' }}>—</span>}
                        </td>
                        <td style={{ fontSize: '.78rem', color: 'var(--ink-soft)' }}>{GPS_SOURCE_LABEL[row.gpsSource] || '—'}</td>
                        <td style={{ fontSize: '.78rem', color: 'var(--ink-soft)' }}>{new Date(row.createdAt).toLocaleString('th-TH')}</td>
                        <td><button type="button" className="admin-btn-danger" style={{ padding: '6px 12px', fontSize: '.78rem' }} onClick={() => removeSaved(row)}><FontAwesomeIcon icon={faTrash} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>

      </div>
    </main>
  </VolunteerGuard>)
}
