import FadeUp from '../components/FadeUp.jsx'
import Footer from '../components/Footer.jsx'
import { useLang } from '../i18n.jsx'
import { useQurbanData } from '../data/qurbanData.js'

// หน้า public สรุปภารกิจกุรบาน 1447/2026 — สถิติรวม รายละเอียดราย missions และโดนัทชาร์ต 100 วัว
// ข้อความแยกตามภาษา
const T = {
  th: {
    eyebrow: 'ภารกิจกุรบาน · Qurban Help Worldwide',
    h1a: 'กุรบาน ', lead: 'ผู้ยากไร้ทั่วโลก 2569 — ส่งต่อเนื้อกุรบานถึงพี่น้องผู้ยากไร้ใน 31 ประเทศทั่วโลก',
    stats: [
      { e: '🌍', l: 'ประเทศที่ได้รับ', v: '31', u: 'ประเทศ' },
      { e: '🐄', l: 'วัว', v: '279', u: 'ตัว' },
      { e: '🐑', l: 'แกะ', v: '17', u: 'ตัว' },
      { e: '📦', l: 'รวมทั้งหมด', v: '1,948', u: 'ส่วน' },
    ],
    chartEyebrow: 'สัดส่วนวัวกุรบาน 100 ตัว ทั่วโลก', chartTitle: '31 ประเทศที่ได้รับความช่วยเหลือ',
    donutUnit: 'วัว / cow',
    detailEyebrow: 'รายละเอียดเพิ่มเติม', detailTitle: 'ปาเลสไตน์ · ซีเรีย · ไทย · นานาชาติ',
    cow: 'วัว', sheep: 'แกะ',
    world: 'WORLDWIDE — นานาชาติ 31 ประเทศ · แกะอีก 5 ตัว',
    thai: 'THAI — ประเทศไทย',
    palestine: 'PALESTINE — Gaza 1,000 ส่วน · Al Aqsa 10 ส่วน',
    syria: 'SYRIA — ซีเรีย',
  },
  en: {
    eyebrow: 'Qurban Mission · Qurban Help Worldwide',
    h1a: 'Qurban ', lead: 'For the needy worldwide 2026 — delivering qurban meat to our brothers and sisters in 31 countries',
    stats: [
      { e: '🌍', l: 'Recipient Countries', v: '31', u: 'countries' },
      { e: '🐄', l: 'Cows', v: '279', u: 'cows' },
      { e: '🐑', l: 'Sheep', v: '17', u: 'sheep' },
      { e: '📦', l: 'Total', v: '1,948', u: 'portions' },
    ],
    chartEyebrow: 'Distribution of 100 Qurban Cows Worldwide', chartTitle: '31 Countries Receiving Aid',
    donutUnit: 'cows',
    detailEyebrow: 'More Details', detailTitle: 'Palestine · Syria · Thailand · Worldwide',
    cow: 'cows', sheep: 'sheep',
    world: 'WORLDWIDE — 31 countries · plus 5 sheep',
    thai: 'THAI — Thailand',
    palestine: 'PALESTINE — Gaza 1,000 portions · Al Aqsa 10 portions',
    syria: 'SYRIA',
  },
  ar: {
    eyebrow: 'مهمة الأضاحي · حول العالم',
    h1a: 'الأضاحي ', lead: 'للمحتاجين حول العالم 2026 — إيصال لحوم الأضاحي إلى إخواننا في 31 دولة',
    stats: [
      { e: '🌍', l: 'الدول المستفيدة', v: '31', u: 'دولة' },
      { e: '🐄', l: 'الأبقار', v: '279', u: 'بقرة' },
      { e: '🐑', l: 'الأغنام', v: '17', u: 'رأساً' },
      { e: '📦', l: 'الإجمالي', v: '1,948', u: 'حصة' },
    ],
    chartEyebrow: 'توزيع 100 بقرة أضاحي حول العالم', chartTitle: '31 دولة مستفيدة من المساعدات',
    donutUnit: 'بقرة',
    detailEyebrow: 'تفاصيل إضافية', detailTitle: 'فلسطين · سوريا · تايلاند · دولي',
    cow: 'بقرة', sheep: 'رأس غنم',
    world: 'دولي — 31 دولة · إضافة إلى 5 رؤوس غنم',
    thai: 'تايلاند',
    palestine: 'فلسطين — غزة 1,000 حصة · الأقصى 10 حصص',
    syria: 'سوريا',
  },
}

// ค่าคงที่ของวงโดนัท: รัศมีและเส้นรอบวง (ใช้คำนวณความยาวแต่ละชิ้น)
const R = 80
const CIRC = 2 * Math.PI * R

// โดนัทชาร์ตวาดด้วย SVG — แต่ละประเทศเป็นเส้นโค้ง 1 ชิ้น ความยาวตามสัดส่วนจำนวนวัว
function DonutChart({ unit, countries, colors, total }) {
  let offset = 0
  return (
    <svg viewBox="0 0 200 200" className="qurban-donut">
      <circle cx="100" cy="100" r={R} fill="none" stroke="#eee" strokeWidth="32" />
      {countries.map((c, i) => {
        const len = (c.v / total) * CIRC
        const seg = (
          <circle
            key={c.n}
            cx="100" cy="100" r={R}
            fill="none"
            stroke={colors[i]}
            strokeWidth="32"
            strokeDasharray={`${len} ${CIRC - len}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 100 100)"
          >
            <title>{c.n}: {c.v}</title>
          </circle>
        )
        offset += len
        return seg
      })}
      <circle cx="100" cy="100" r={R - 16} fill="var(--paper, #fff)" />
      <text x="100" y="94" textAnchor="middle" fontSize="28" fontWeight="800" fill="var(--green-deep, #1a5c3a)">{total}</text>
      <text x="100" y="116" textAnchor="middle" fontSize="13" fill="var(--green-mid, #2e7d52)">{unit}</text>
    </svg>
  )
}

export default function Qurban2026() {
  const { lang } = useLang()
  const t = T[lang]
  const { data: q, loading } = useQurbanData()

  if (loading) return null

  const COUNTRIES = q.countries
  const COUNTRY_COLORS = COUNTRIES.map((_, i) => `hsl(${Math.round((i * 360) / COUNTRIES.length)}, 65%, 55%)`)

  // รวม Palestine / Syria / Thailand เข้ากับยอดนานาชาติแยกตามประเทศ + Afghanistan เป็นกราฟวงกลมเดียว
  const ALL_DATA = [
    { n: 'Palestine', v: q.categories.palestine },
    { n: 'Syria', v: q.categories.syria },
    { n: 'Thailand', v: q.categories.thailand },
    ...COUNTRIES,
    { n: 'Afghanistan', v: q.afghanistanSheep },
  ]
  const ALL_COLORS = ['#1B5E36', '#C9302C', '#2196f3', ...COUNTRY_COLORS, '#999']
  const ALL_TOTAL = ALL_DATA.reduce((s, c) => s + c.v, 0)

  const stats = [
    { ...t.stats[0], v: String(q.summary.countries) },
    { ...t.stats[1], v: String(q.summary.cows) },
    { ...t.stats[2], v: String(q.summary.sheep) },
    { ...t.stats[3], v: q.summary.total.toLocaleString() },
  ]

  return (
    <main className="page qurban-page">
      <section className="iftar-hero">
        <div className="fc-pattern hero-pattern"></div>
        <div className="inner">
          <span className="iftar-eyebrow"><span>🐑</span> {t.eyebrow}</span>
          <h1>{t.h1a}<span className="accent">1447</span></h1>
          <p className="lead">{t.lead}</p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="help-grid">
            {stats.map((s, i) => (
              <FadeUp className="help-item" key={i}>
                <div className="he">{s.e}</div>
                <h4>{s.v} <span style={{ fontSize: '1rem', fontWeight: 400 }}>{s.u}</span></h4>
                <p>{s.l}</p>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <FadeUp className="section-head">
            <h2>{t.detailTitle}</h2>
            <div className="gold-rule"></div>
          </FadeUp>
          <div className="help-grid">
            <FadeUp className="help-item">
              <div className="he">🇵🇸</div>
              <h4>{q.categories.palestine} <span style={{ fontSize: '0.6em', fontWeight: 400 }}>{t.cow}</span></h4>
              <p>{t.palestine}</p>
            </FadeUp>
            <FadeUp className="help-item">
              <div className="he">🇸🇾</div>
              <h4>{q.categories.syria} <span style={{ fontSize: '0.6em', fontWeight: 400 }}>{t.sheep}</span></h4>
              <p>{t.syria}</p>
            </FadeUp>
            <FadeUp className="help-item">
              <div className="he">🇹🇭</div>
              <h4>{q.categories.thailand} <span style={{ fontSize: '0.6em', fontWeight: 400 }}>{t.cow}</span></h4>
              <p>{t.thai}</p>
            </FadeUp>
            <FadeUp className="help-item">
              <div className="he">🌍</div>
              <h4>{q.categories.worldwide} <span style={{ fontSize: '0.6em', fontWeight: 400 }}>{t.cow}</span></h4>
              <p>{t.world}</p>
            </FadeUp>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <FadeUp className="section-head">
            <span className="eyebrow-sm">{t.chartEyebrow}</span>
            <h2>{t.chartTitle}</h2>
            <div className="gold-rule"></div>
          </FadeUp>
          <div className="qurban-chart-wrap">
            <DonutChart unit={t.donutUnit} countries={ALL_DATA} colors={ALL_COLORS} total={ALL_TOTAL} />
            <div className="qurban-legend">
              {ALL_DATA.map((c, i) => (
                <div className="qurban-legend-item" key={c.n}>
                  <span className="dot" style={{ background: ALL_COLORS[i] }}></span>
                  <span className="name">{c.n}</span>
                  <span className="val">{c.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
