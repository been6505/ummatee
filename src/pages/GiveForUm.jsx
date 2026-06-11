import FadeUp from '../components/FadeUp.jsx'
import Footer from '../components/Footer.jsx'
import { useLang } from '../i18n.jsx'

const T = {
  th: {
    eyebrow: 'งาน "ให้" ครั้งที่ 6 · GIVE',
    h1a: 'ให้ ', h1b: ' ถึง ',
    lead: 'เทศกาลแห่งการแบ่งปัน ออกร้านขายอาหารและเสื้อผ้า ฟังบรรยาย พบปะอินฟลูเอนเซอร์ และโซนเด็กเล่นสุดสนุก ตลอด 3 วันเต็ม',
    date: 'วัน', dateV: '3-5 กรกฎาคม 2569',
    place: 'สถานที่', placeV: 'กกท (ราชมังคลากีฬาสถาน)',
    time: 'เวลา', timeV: '14.00 - 23.00 น.',
    actEyebrow: 'กิจกรรมภายในงาน', actTitle: 'มาร่วมสนุกและอิ่มบุญไปด้วยกัน',
    acts: [
      { e: '🍛', h: 'ออกร้านอาหาร', p: 'ร้านอาหารหลากหลายเมนูให้เลือกชิมตลอดงาน' },
      { e: '👕', h: 'ออกร้านเสื้อผ้า', p: 'เลือกซื้อเสื้อผ้าและสินค้าจากร้านค้าที่มาออกบูธ' },
      { e: '🎤', h: 'บรรยายธรรม', p: 'รับฟังการบรรยายให้ข้อคิดและแง่มุมดี ๆ ตลอดงาน' },
      { e: '🎡', h: 'โซนเด็กเล่น', p: 'เครื่องเล่นและกิจกรรมสนุก ๆ สำหรับเด็ก ๆ' },
      { e: '🎙️', h: 'พูดคุยกับอินฟลูฯ', p: 'ฟังเรื่องราวจากอินฟลูเอนเซอร์และผู้ช่วยเหลือสังคม' },
    ],
  },
  en: {
    eyebrow: 'GIVE Event · 6th Edition',
    h1a: 'Give ', h1b: ' Reach ',
    lead: 'A festival of giving — food and clothing stalls, talks, influencer meet-ups, and a fun kids zone. Three full days.',
    date: 'Date', dateV: '3-5 July 2026',
    place: 'Venue', placeV: 'SAT (Rajamangala National Stadium)',
    time: 'Time', timeV: '14:00 - 23:00',
    actEyebrow: 'Event Activities', actTitle: 'Join the Fun and the Blessings',
    acts: [
      { e: '🍛', h: 'Food Stalls', p: 'A wide variety of food vendors to enjoy throughout the event' },
      { e: '👕', h: 'Clothing Stalls', p: 'Shop clothing and goods from vendor booths' },
      { e: '🎤', h: 'Talks & Lectures', p: 'Inspiring talks and insights throughout the event' },
      { e: '🎡', h: 'Kids Zone', p: 'Rides and fun activities for children' },
      { e: '🎙️', h: 'Influencer Talks', p: 'Hear stories from influencers and humanitarian helpers' },
    ],
  },
  ar: {
    eyebrow: 'فعالية "العطاء" السادسة · GIVE',
    h1a: 'أعطِ ', h1b: ' تصل ',
    lead: 'مهرجان العطاء — أكشاك طعام وملابس، محاضرات، لقاءات مع المؤثرين، ومنطقة ألعاب ممتعة للأطفال. ثلاثة أيام كاملة.',
    date: 'التاريخ', dateV: '3-5 يوليو 2026',
    place: 'المكان', placeV: 'ملعب راجامانجالا الوطني',
    time: 'الوقت', timeV: '14:00 - 23:00',
    actEyebrow: 'أنشطة الفعالية', actTitle: 'شاركنا المتعة والأجر',
    acts: [
      { e: '🍛', h: 'أكشاك الطعام', p: 'تشكيلة واسعة من المأكولات طوال الفعالية' },
      { e: '👕', h: 'أكشاك الملابس', p: 'تسوّق الملابس والمنتجات من أجنحة الباعة' },
      { e: '🎤', h: 'محاضرات', p: 'محاضرات ملهمة وفوائد قيّمة طوال الفعالية' },
      { e: '🎡', h: 'منطقة الأطفال', p: 'ألعاب وأنشطة ممتعة للأطفال' },
      { e: '🎙️', h: 'لقاءات المؤثرين', p: 'استمع لقصص المؤثرين والعاملين في المجال الإنساني' },
    ],
  },
}

export default function GiveForUm() {
  const { lang } = useLang()
  const t = T[lang]
  return (
    <main className="page">
      <section className="iftar-hero">
        <div className="fc-pattern hero-pattern"></div>
        <div className="inner">
          <span className="iftar-eyebrow"><span>🤲</span> {t.eyebrow}</span>
          <h1>{t.h1a}<span className="accent">100</span>{t.h1b}<span className="accent">100</span></h1>
          <p className="lead">{t.lead}</p>
          <div className="info-boxes">
            <div className="info-box"><div className="ib-ic">📅</div><div className="ib-k">{t.date}</div><div className="ib-v">{t.dateV}</div></div>
            <div className="info-box"><div className="ib-ic">📍</div><div className="ib-k">{t.place}</div><div className="ib-v">{t.placeV}</div></div>
            <div className="info-box"><div className="ib-ic">⏰</div><div className="ib-k">{t.time}</div><div className="ib-v">{t.timeV}</div></div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 40 }}>
        <div className="wrap">
          <FadeUp>
            <img
              src="/721119853_1607959538003595_185415737813897318_n.jpg"
              alt="GIVE ครั้งที่ 6 - ให้ 100 ถึง 100"
              style={{ width: '100%', borderRadius: 16, display: 'block' }}
            />
          </FadeUp>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <FadeUp className="section-head">
            <span className="eyebrow-sm">{t.actEyebrow}</span>
            <h2>{t.actTitle}</h2>
            <div className="gold-rule"></div>
          </FadeUp>
          <div className="help-grid">
            {t.acts.map((a, i) => (
              <FadeUp className="help-item" key={i}>
                <div className="he">{a.e}</div>
                <h4>{a.h}</h4>
                <p>{a.p}</p>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
