import { useState, useEffect } from 'react'
import { ACCOUNTS } from '../data/accounts'
import { useLang } from '../i18n.jsx'
import FadeUp from '../components/FadeUp.jsx'
import CopyIcon from '../components/CopyIcon.jsx'
import Footer from '../components/Footer.jsx'
import { db } from '../firebase.js'
import { doc, setDoc, updateDoc, increment } from 'firebase/firestore'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShieldHalved, faScroll, faHandPointer, faHeart, faCheck, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import useParallax from '../hooks/useParallax.js'

const statsRef = () => doc(db, 'stats', 'donation')

function trackView() {
  // views เป็น top-level field ใช้ setDoc+merge ได้ปกติ
  // เดิม catch เงียบสนิท — ถ้าเขียนล้ม (permission/App Check/network) จะไม่มีทางรู้เลยว่าสถิติทำไมไม่ขึ้น
  setDoc(statsRef(), { views: increment(1) }, { merge: true })
    .catch((e) => console.error('trackView failed:', e.code || e.message))
}

function trackCopy(key) {
  // updateDoc ถึงจะ handle dot-notation path ได้ถูกต้อง (nested field)
  // ถ้า doc ยังไม่มี ให้ fallback setDoc สร้างใหม่
  updateDoc(statsRef(), { [`copies.${key}`]: increment(1) })
    .catch((e1) =>
      setDoc(statsRef(), { copies: { [key]: increment(1) } }, { merge: true })
        .catch((e2) => console.error('trackCopy failed:', e1.code || e1.message, '/', e2.code || e2.message))
    )
}

// หน้าร่วมบริจาค — แสดงบัญชี ibank ทั้ง 8 บัญชี แตะคัดลอกเลขบัญชีได้
// ข้อความแยกตามภาษา
const T = {
  th: {
    badge: 'ร่วมบริจาค · Donation',
    h1a: 'ให้ ', h1b: ' ถึง ',
    p: 'ทุกบาทที่คุณบริจาคผ่านมูลนิธิอุมมะตี ส่งถึงมือผู้รับเต็มจำนวน แตะที่บัญชีเพื่อคัดลอกเลขบัญชีได้ทันที',
    bankName: 'ธนาคารอิสลามแห่งประเทศไทย (ibank)',
    bankAcc: 'ชื่อบัญชี: มูลนิธิอุมมะตี · Ummatee Foundation',
    hint: 'แตะที่รายการบัญชีเพื่อคัดลอกเลขบัญชี',
    trust1h: 'ให้ 100% ถึง 100', trust1p: 'ทุกการบริจาคส่งถึงมือผู้รับเต็มจำนวน ตรวจสอบได้',
    trust2h: 'ถูกต้องตามหลักศาสนา', trust2p: 'จัดการซะกาตและวะกัฟตามหลักชะรีอะฮ์อย่างเคร่งครัด',
  },
  en: {
    badge: 'Donation',
    h1a: 'Give ', h1b: ' Reach ',
    p: 'Every baht you donate through Ummatee Foundation reaches recipients in full. Tap an account to copy the account number instantly.',
    bankName: 'Islamic Bank of Thailand (ibank)',
    bankAcc: 'Account name: Ummatee Foundation',
    hint: 'Tap an account row to copy the account number',
    trust1h: '100% Transparent', trust1p: 'Every donation is delivered in full and fully traceable',
    trust2h: 'Shariah Compliant', trust2p: 'Zakat and waqf managed strictly according to Shariah principles',
  },
  ar: {
    badge: 'تبرّع · Donation',
    h1a: 'أعطِ ', h1b: ' تصل ',
    p: 'كل بات تتبرع به عبر مؤسسة أمّتي يصل كاملاً إلى المستحقين. اضغط على الحساب لنسخ رقمه فوراً.',
    bankName: 'البنك الإسلامي التايلاندي (ibank)',
    bankAcc: 'اسم الحساب: مؤسسة أمّتي · Ummatee Foundation',
    hint: 'اضغط على الحساب لنسخ رقم الحساب',
    trust1h: 'شفافية 100%', trust1p: 'كل تبرع يصل كاملاً للمستحقين وقابل للتحقق',
    trust2h: 'موافق للشريعة', trust2p: 'إدارة الزكاة والوقف وفق أحكام الشريعة بدقة',
  },
}

// แถวบัญชีธนาคาร 1 แถว — แตะเพื่อคัดลอกเลขบัญชี (ตัดช่องว่างออกก่อนคัดลอก)
function AccountRow({ a, lang }) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  const fallback = (text) => {
    const t = document.createElement('textarea')
    t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'
    document.body.appendChild(t); t.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch (e) { /* noop */ }
    document.body.removeChild(t)
    return ok
  }
  // แสดง "คัดลอกแล้ว" เฉพาะเมื่อคัดลอกสำเร็จจริง — ถ้าไม่สำเร็จต้องไม่หลอกผู้บริจาคว่าคัดลอกได้
  // (คลิปบอร์ดจะยังเป็นค่าเก่า ถ้าโดนวางในแอปธนาคารอาจโอนผิดบัญชี)
  // ถ้าคัดลอกไม่สำเร็จจริง (สิทธิ์คลิปบอร์ดโดนบล็อก ฯลฯ) ต้องมี feedback ให้เห็น ไม่ใช่ปล่อยเงียบเหมือนปุ่มไม่ทำงาน
  const copy = () => {
    const clean = a.raw.replace(/\s/g, '')
    const onSuccess = () => {
      trackCopy(a.key)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
    const onFail = () => {
      setFailed(true)
      setTimeout(() => setFailed(false), 2200)
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(clean)
        .then(onSuccess)
        .catch(() => { if (fallback(clean)) onSuccess(); else onFail() })
    } else if (fallback(clean)) {
      onSuccess()
    } else {
      onFail()
    }
  }
  return (
    <FadeUp className="don-row" onClick={copy} dir="ltr">
      <div className="don-icon">{a.icon}</div>
      <div className="don-info">
        <div className="don-name">{lang === 'ar' ? a.en : a.name}</div>
        <div className="don-name-en">{a.en}</div>
      </div>
      <div className="don-acc" dir="ltr">{a.acc}</div>
      {failed ? (
        <div className="don-copy failed" title="คัดลอกไม่สำเร็จ — กรุณาลองใหม่หรือจดเลขบัญชีเอง">
          <FontAwesomeIcon icon={faTriangleExclamation} />
        </div>
      ) : (
        <div className={`don-copy ${copied ? 'copied' : ''}`}>{copied ? <FontAwesomeIcon icon={faCheck} /> : <CopyIcon />}</div>
      )}
    </FadeUp>
  )
}

export default function Donation() {
  const { lang } = useLang()
  const t = T[lang]
  const heroParallaxRef = useParallax(0.15)
  useEffect(() => { trackView() }, [])
  return (
    <main className="page">
      <section className="page-band">
        <div className="fc-pattern hero-pattern" ref={heroParallaxRef}></div>
        <div className="inner">
          <span className="badge">{t.badge}</span>
          <h1>{t.h1a}<span className="accent">100</span>{t.h1b}<span className="accent">100</span></h1>
          <p>{t.p}</p>
        </div>
      </section>

      <div className="don-stage">
        <FadeUp className="ibank-badge">
          <div className="ib-logo">
            <img src="/ibank.png" alt="ธนาคารอิสลามแห่งประเทศไทย" />
          </div>
          <div>
            <div className="ib-name">{t.bankName}</div>
            <div className="ib-sub">{t.bankAcc}</div>
          </div>
        </FadeUp>

        <p className="don-hint"><FontAwesomeIcon icon={faHandPointer} /> {t.hint}</p>

        <div className="bank-accounts">
          {ACCOUNTS.map((a) => <AccountRow a={a} key={a.acc} lang={lang} />)}
        </div>

        <div className="trust-grid">
          <FadeUp className="trust-card"><div className="te"><FontAwesomeIcon icon={faShieldHalved} /></div><h4>{t.trust1h}</h4><p>{t.trust1p}</p></FadeUp>
          <FadeUp className="trust-card"><div className="te"><FontAwesomeIcon icon={faScroll} /></div><h4>{t.trust2h}</h4><p>{t.trust2p}</p></FadeUp>
        </div>
      </div>

      <Footer />
    </main>
  )
}
