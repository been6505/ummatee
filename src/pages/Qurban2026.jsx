import FadeUp from '../components/FadeUp.jsx'
import Footer from '../components/Footer.jsx'
import { useLang } from '../i18n.jsx'

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

// จำนวนวัวกุรบาน (รวม 100 ตัว) แยกตามประเทศในภารกิจนานาชาติ
const COUNTRIES = [
  { n: 'India', v: 55 },
  { n: 'Chad', v: 13 },
  { n: 'Bangladesh', v: 3 },
  { n: 'Benin', v: 2 },
  { n: 'Ethiopia', v: 2 },
  { n: 'Kenya', v: 2 },
  { n: 'Mozambique', v: 2 },
  { n: 'Nigeria', v: 2 },
  { n: 'Kashmir', v: 1 },
  { n: 'Yemen', v: 1 },
  { n: 'Indonesia', v: 1 },
  { n: 'Lebanon', v: 1 },
  { n: 'Pakistan', v: 1 },
  { n: 'Nepal', v: 1 },
  { n: 'Sudan', v: 1 },
  { n: 'Myanmar', v: 1 },
  { n: 'Mauritania', v: 1 },
  { n: 'Sierra Leone', v: 1 },
  { n: 'South Sudan', v: 1 },
  { n: 'Malawi', v: 1 },
  { n: 'Somalia', v: 1 },
  { n: 'Cameroon', v: 1 },
  { n: 'Uganda', v: 1 },
  { n: 'Niger', v: 1 },
  { n: 'Tanzania', v: 1 },
  { n: 'Rohingya', v: 1 },
  { n: 'Burkina Faso', v: 1 },
]

const TOTAL_COW = COUNTRIES.reduce((s, c) => s + c.v, 0) // 100

// สร้างสีไล่โทนให้แต่ละประเทศ
const COLORS = COUNTRIES.map((_, i) => `hsl(${Math.round((i * 360) / COUNTRIES.length)}, 65%, 55%)`)

// ค่าคงที่ของวงโดนัท: รัศมีและเส้นรอบวง (ใช้คำนวณความยาวแต่ละชิ้น)
const R = 80
const CIRC = 2 * Math.PI * R

// โดนัทชาร์ตวาดด้วย SVG — แต่ละประเทศเป็นเส้นโค้ง 1 ชิ้น ความยาวตามสัดส่วนจำนวนวัว
function DonutChart({ unit }) {
  let offset = 0
  return (
    <svg viewBox="0 0 200 200" className="qurban-donut">
      <circle cx="100" cy="100" r={R} fill="none" stroke="#eee" strokeWidth="32" />
      {COUNTRIES.map((c, i) => {
        const len = (c.v / TOTAL_COW) * CIRC
        const seg = (
          <circle
            key={c.n}
            cx="100" cy="100" r={R}
            fill="none"
            stroke={COLORS[i]}
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
      <text x="100" y="94" textAnchor="middle" fontSize="28" fontWeight="800" fill="var(--green-deep, #1a5c3a)">100</text>
      <text x="100" y="116" textAnchor="middle" fontSize="13" fill="var(--green-mid, #2e7d52)">{unit}</text>
    </svg>
  )
}

export default function Qurban2026() {
  const { lang } = useLang()
  const t = T[lang]
  return (
    <main className="page">
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
            {t.stats.map((s, i) => (
              <FadeUp className="help-item" key={i}>
                <div className="he">{s.e}</div>
                <h4>{s.v} <span style={{ fontSize: '0.6em', fontWeight: 400 }}>{s.u}</span></h4>
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
              <h4>145 <span style={{ fontSize: '0.6em', fontWeight: 400 }}>{t.cow}</span></h4>
              <p>{t.palestine}</p>
            </FadeUp>
            <FadeUp className="help-item">
              <div className="he">🇸🇾</div>
              <h4>12 <span style={{ fontSize: '0.6em', fontWeight: 400 }}>{t.sheep}</span></h4>
              <p>{t.syria}</p>
            </FadeUp>
            <FadeUp className="help-item">
              <div className="he">🇹🇭</div>
              <h4>34 <span style={{ fontSize: '0.6em', fontWeight: 400 }}>{t.cow}</span></h4>
              <p>{t.thai}</p>
            </FadeUp>
            <FadeUp className="help-item">
              <div className="he">🌍</div>
              <h4>100 <span style={{ fontSize: '0.6em', fontWeight: 400 }}>{t.cow}</span></h4>
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
            <DonutChart unit={t.donutUnit} />
            <div className="qurban-legend">
              {COUNTRIES.map((c, i) => (
                <div className="qurban-legend-item" key={c.n}>
                  <span className="dot" style={{ background: COLORS[i] }}></span>
                  <span className="name">{c.n}</span>
                  <span className="val">{c.v}</span>
                </div>
              ))}
              <div className="qurban-legend-item">
                <span className="dot" style={{ background: '#999' }}></span>
                <span className="name">Afghanistan ({t.sheep})</span>
                <span className="val">5</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
