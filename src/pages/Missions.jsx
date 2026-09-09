import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'
import FadeUp from '../components/FadeUp.jsx'
import Footer from '../components/Footer.jsx'
import { useLang } from '../i18n.jsx'
import { useNavigate } from '../navContext'
import { MISSIONS, QURBAN_CARD } from '../data/missions.js'
import useParallax from '../hooks/useParallax.js'
import { ACCOUNTS } from '../data/accounts'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy, faCheck, faArrowRight, faPlay, faChevronLeft, faChevronRight, faClock } from '@fortawesome/free-solid-svg-icons'

// หน้า "ภารกิจ" (/missions) — รวมทุกโครงการของอุมมะตี พร้อมรูป/วิดีโอ และบัญชีบริจาคของแต่ละโครงการ
// รูป/วิดีโอดึงสดจาก Firestore (missionMedia) — แอดมินอัปเดตเองได้
const T = {
  th: { eyebrow: 'ภารกิจของเรา · Our Missions', h1: 'ภารกิจ', lead: 'ทุกโครงการของมูลนิธิอุมมะตี — ส่งต่อความช่วยเหลือถึงมือผู้รับเต็มจำนวน ', donate: 'บริจาคโครงการนี้', copied: 'คัดลอกแล้ว', acc: 'เลขบัญชี', noMedia: 'เร็ว ๆ นี้ — กำลังอัปเดตภาพและวิดีโอ' },
  en: { eyebrow: 'Our Missions', h1: 'Missions', lead: "Every Ummatee project — aid delivered in full to recipients, with real photos and videos of our work", donate: 'Donate to this project', copied: 'Copied', acc: 'Account', noMedia: 'Coming soon — photos and videos being updated' },
  ar: { eyebrow: 'مهماتنا · Our Missions', h1: 'المهمات', lead: 'كل مشاريع مؤسسة أمّتي — المساعدات تصل كاملة للمستحقين، مع صور وفيديوهات حقيقية من عملنا', donate: 'تبرّع لهذا المشروع', copied: 'تم النسخ', acc: 'الحساب', noMedia: 'قريباً — يتم تحديث الصور والفيديوهات' },
}

const isVideo = (url) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url)

// คืน Promise<boolean> ว่าคัดลอกสำเร็จจริงหรือไม่ — ผู้เรียกต้องเช็คก่อนแสดงว่า "คัดลอกแล้ว"
function copyToClipboard(text) {
  const clean = String(text).replace(/\s/g, '')
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(clean).then(() => true).catch(() => fallbackCopy(clean))
  }
  return Promise.resolve(fallbackCopy(clean))
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea')
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
  document.body.appendChild(ta); ta.select()
  let ok = false
  try { ok = document.execCommand('copy') } catch (e) { /* noop */ }
  document.body.removeChild(ta)
  return ok
}

function MissionCarousel({ items, name, accent }) {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const total = items.length
  const prev = () => setIdx((i) => (i - 1 + total) % total)
  const next = () => setIdx((i) => (i + 1) % total)

  useEffect(() => {
    if (total <= 1 || paused) return
    const t = setInterval(() => setIdx((i) => (i + 1) % total), 3500)
    return () => clearInterval(t)
  }, [total, paused])
  const safeIdx = idx < total ? idx : 0  // กัน idx ค้างเกินขอบเขตเมื่อแอดมินลบรูป
  const cur = items[safeIdx]
  return (
    <div className="mission-carousel">
      <div className="mission-carousel-stage" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)} onTouchEnd={() => setTimeout(() => setPaused(false), 2000)}>
        {isVideo(cur)
          ? <video key={safeIdx} src={cur} controls preload="metadata" playsInline className="mission-carousel-media" onPlay={() => setPaused(true)} onPause={() => setPaused(false)} />
          : <img key={safeIdx} src={cur} alt={name} loading="lazy" className="mission-carousel-media" />}
        {isVideo(cur) && <span className="mission-media-play"><FontAwesomeIcon icon={faPlay} /></span>}
        {total > 1 && (
          <>
            <button className="mission-carousel-btn mission-carousel-prev" onClick={prev} aria-label="ก่อนหน้า"><FontAwesomeIcon icon={faChevronLeft} /></button>
            <button className="mission-carousel-btn mission-carousel-next" onClick={next} aria-label="ถัดไป"><FontAwesomeIcon icon={faChevronRight} /></button>
          </>
        )}
      </div>
      {total > 1 && (
        <div className="mission-carousel-dots">
          {items.map((_, i) => (
            <button key={i} className={`mission-dot${i === safeIdx ? ' active' : ''}`} style={{ '--accent': accent }} onClick={() => setIdx(i)} aria-label={`ภาพ ${i + 1}`} />
          ))}
        </div>
      )}
    </div>
  )
}

function MissionCard({ m, media, lang, t }) {
  const [copied, setCopied] = useState(false)
  const acc = ACCOUNTS.find((a) => a.key === m.acc)
  const tx = m[lang] || m.th
  const items = media || []
  const onCopy = () => {
    if (!acc) return
    copyToClipboard(acc.raw).then((ok) => {
      if (!ok) return
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }
  return (
    <FadeUp className="mission-card">
      <div className="mission-card-head" style={{ '--accent': m.accent }}>
        <div className="mission-icon"><FontAwesomeIcon icon={m.icon} /></div>
        <div>
          <h3>{tx.name}</h3>
          <p>{tx.desc}</p>
        </div>
      </div>

      {items.length > 0
        ? <MissionCarousel items={items} name={tx.name} accent={m.accent} />
        : <div className="mission-nomedia-strip" style={{ '--accent': m.accent }}><FontAwesomeIcon icon={faClock} /> {t.noMedia}</div>
      }

      {acc && (
        <div className="mission-donate" dir="ltr">
          <div className="mission-acc">
            <span className="mission-acc-label">{t.acc}</span>
            <span className="mission-acc-num">{acc.acc}</span>
          </div>
          <button className="mission-donate-btn" style={{ '--accent': m.accent }} onClick={onCopy}>
            <FontAwesomeIcon icon={copied ? faCheck : faCopy} /> {copied ? t.copied : t.donate}
          </button>
        </div>
      )}
    </FadeUp>
  )
}

export default function Missions() {
  const { lang } = useLang()
  const go = useNavigate()
  const t = T[lang]
  const heroParallaxRef = useParallax(0.15)
  const [mediaMap, setMediaMap] = useState({})

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'missionMedia'), (snap) => {
      const map = {}
      snap.docs.forEach((d) => { map[d.id] = d.data().media || [] })
      setMediaMap(map)
    }, () => {})
    return unsub
  }, [])

  const qx = QURBAN_CARD[lang] || QURBAN_CARD.th

  return (
    <main className="page missions-page">
      <section className="page-band">
        <div className="fc-pattern hero-pattern" ref={heroParallaxRef}></div>
        <div className="inner">
          <span className="badge">{t.eyebrow}</span>
          <h1>{t.h1}</h1>
          <p>{t.lead}</p>
        </div>
      </section>

      <div className="missions-stage">
        <div className="missions-grid">
          {[...MISSIONS].sort((a, b) => ((mediaMap[b.key]?.length || 0) > 0) - ((mediaMap[a.key]?.length || 0) > 0)).map((m) => (
            <MissionCard key={m.key} m={m} media={mediaMap[m.key]} lang={lang} t={t} />
          ))}

          {/* การ์ดกุรบาน — ลิงก์ไปหน้ารายละเอียด */}
          <FadeUp className="mission-card mission-card-link" onClick={() => go(QURBAN_CARD.page)}>
            <div className="mission-card-head" style={{ '--accent': QURBAN_CARD.accent }}>
              <div className="mission-icon"><FontAwesomeIcon icon={QURBAN_CARD.icon} /></div>
              <div>
                <h3>{qx.name}</h3>
                <p>{qx.desc}</p>
              </div>
            </div>
            <button className="mission-link-btn" style={{ '--accent': QURBAN_CARD.accent }}>
              {qx.cta} <FontAwesomeIcon icon={faArrowRight} />
            </button>
          </FadeUp>
        </div>
      </div>

      <Footer />
    </main>
  )
}
