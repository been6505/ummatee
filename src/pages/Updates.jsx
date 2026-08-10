import { useState } from 'react'
import FadeUp from '../components/FadeUp.jsx'
import Footer from '../components/Footer.jsx'
import NotifyButton from '../components/NotifyButton.jsx'
import { usePublicUpdates } from '../data/updates.js'
import {
  UPDATE_CATEGORIES, CATEGORY_LABEL, CATEGORY_COLOR, normCategory, cleanPhotos,
} from '../data/publicUpdates.js'
import { optImg } from '../utils/cloudinaryUrl.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLocationDot, faCalendarDay, faNewspaper, faXmark } from '@fortawesome/free-solid-svg-icons'

// หน้า "ความคืบหน้าการช่วยเหลือ" (/updates) — ที่เดียวที่เปิดแล้วเห็นว่า "ล่าสุดเกิดอะไรขึ้น"
//
// ก่อนหน้านี้ข่าวกระจายอยู่ตามหน้าโครงการ ไม่มีที่รวม คนที่อยากติดตามต้องไล่เปิดทีละหน้าเอง
// ซึ่งไม่มีใครทำ — และเป็นเหตุผลหลักที่ "ติดตามข่าวการช่วยเหลือ" ยังไม่เกิดขึ้นจริง

const dateLabel = (d) => {
  if (!d) return ''
  // แยกสตริงเอง ไม่ใช้ new Date(d) — มันตีความเป็น UTC พอเป็นเวลาไทย (+07) จะเพี้ยนไปวันก่อนหน้า
  const [y, m, day] = d.split('-').map(Number)
  const TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  return `${day} ${TH[m - 1] || ''} ${y + 543}`
}

function Photos({ list, onOpen }) {
  const photos = cleanPhotos(list) // กรอง URL ตอนแสดงผลด้วย — rules ตรวจทีละสมาชิกในลิสต์ไม่ได้
  if (photos.length === 0) return null
  return (
    <div className={`upd-photos upd-photos-${Math.min(photos.length, 3)}`}>
      {photos.map((u, i) => (
        <button key={i} type="button" className="upd-photo" onClick={() => onOpen(u)} aria-label={`ดูรูปที่ ${i + 1}`}>
          <img src={optImg(u, 600)} alt="" loading="lazy" />
        </button>
      ))}
    </div>
  )
}

export default function Updates() {
  const { items, loading, error } = usePublicUpdates()
  const [cat, setCat] = useState('all')
  const [lightbox, setLightbox] = useState(null)

  const rows = cat === 'all' ? items : items.filter((u) => normCategory(u.category) === cat)
  // แสดงเฉพาะหมวดที่มีข่าวจริง — ปุ่มกรองที่กดแล้วว่างเปล่าทุกครั้งไม่ได้ช่วยอะไร
  const cats = UPDATE_CATEGORIES.filter((c) => items.some((u) => normCategory(u.category) === c.key))

  return (
    <>
      <main className="upd-page">
        <section className="upd-hero">
          <FadeUp>
            <span className="upd-eyebrow">UPDATES · ความคืบหน้า</span>
            <h1>ความคืบหน้าการช่วยเหลือ</h1>
            <p>ทุกความช่วยเหลือที่ส่งถึงมือผู้รับ — รายงานจากทีมงานในพื้นที่จริง</p>
            <NotifyButton />
          </FadeUp>
        </section>

        <div className="upd-wrap">
          {cats.length > 1 && (
            <div className="upd-filters">
              <button className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>ทั้งหมด</button>
              {cats.map((c) => (
                <button
                  key={c.key}
                  className={cat === c.key ? 'on' : ''}
                  onClick={() => setCat(c.key)}
                  style={cat === c.key ? { background: c.color, borderColor: c.color, color: '#fff' } : {}}
                >{c.label}</button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="upd-list">
              {[0, 1, 2].map((i) => <div key={i} className="upd-card upd-card-sk" />)}
            </div>
          ) : error ? (
            /* โหลดไม่สำเร็จ ต้องบอกว่าโหลดไม่สำเร็จ ห้ามขึ้นว่า "ยังไม่มีข่าว" ซึ่งคนละเรื่องกัน */
            <div className="upd-empty">
              <FontAwesomeIcon icon={faNewspaper} />
              <p>โหลดข่าวไม่สำเร็จ</p>
              <span>กรุณาลองรีเฟรชหน้าอีกครั้ง</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="upd-empty">
              <FontAwesomeIcon icon={faNewspaper} />
              <p>{items.length === 0 ? 'ยังไม่มีข่าวความคืบหน้า' : 'ยังไม่มีข่าวในหมวดนี้'}</p>
              <span>ติดตามได้เร็ว ๆ นี้ — ทีมงานอัปเดตอย่างต่อเนื่อง</span>
            </div>
          ) : (
            <div className="upd-list">
              {rows.map((u) => {
                const k = normCategory(u.category)
                return (
                  <FadeUp key={u.id}>
                    <article className="upd-card">
                      <div className="upd-card-top">
                        <span className="upd-cat" style={{ background: CATEGORY_COLOR[k] }}>{CATEGORY_LABEL[k]}</span>
                        {u.date && <span className="upd-meta"><FontAwesomeIcon icon={faCalendarDay} /> {dateLabel(u.date)}</span>}
                        {u.place && <span className="upd-meta"><FontAwesomeIcon icon={faLocationDot} /> {u.place}</span>}
                      </div>
                      <h2>{u.title}</h2>
                      <Photos list={u.photos} onOpen={setLightbox} />
                      {/* white-space:pre-line ใน CSS — เนื้อหาเก็บการขึ้นบรรทัดที่คนเขียนตั้งใจไว้ */}
                      <p className="upd-body">{u.body}</p>
                      {u.authorName && <span className="upd-by">— {u.authorName}</span>}
                    </article>
                  </FadeUp>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {lightbox && (
        <div className="upd-lightbox" onClick={() => setLightbox(null)} role="dialog" aria-label="รูปขยาย">
          <button className="upd-lightbox-close" aria-label="ปิด"><FontAwesomeIcon icon={faXmark} /></button>
          <img src={optImg(lightbox, 1400)} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <Footer />
    </>
  )
}
