import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import { CORE, GROUPS, OUTPUT } from '../data/systemMap.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDiagramProject, faArrowRight } from '@fortawesome/free-solid-svg-icons'

// แผนผังระบบ (/admin/system-map) — หน้าเดียวที่ตอบว่า "ระบบนี้มีอะไรให้ใช้บ้าง และต่อกันยังไง"
//
// มีหน้าแอดมิน 35 หน้าอยู่ในเมนูหลายชั้น คนเข้าใหม่หรือคนที่หายไปนานไม่มีทางรู้ว่ามีอะไรอยู่ตรงไหน
// นอกจากไล่กางเมนูทีละกลุ่ม หน้านี้กางให้เห็นทั้งหมดในหน้าจอเดียว กดกล่องไหนก็เข้าไปทำงานได้เลย
//
// โครงผังอยู่ใน data/systemMap.js (มีเทสต์เช็คว่าไม่มีลิงก์ตาย) ที่นี่ทำหน้าที่วาดอย่างเดียว
export default function AdminSystemMap() {
  return (
    <StaffRoleGuard allowedRoles={['admin', 'staff', 'social', 'field']}>
      {() => (
        <main className="admin-dash">
          <AdminNav />
          <div className="admin-wrap">
            <div className="admin-head">
              <div>
                <h1><FontAwesomeIcon icon={faDiagramProject} /> แผนผังระบบ</h1>
                <p>ทุกอย่างที่ระบบหลังบ้านทำได้ — กดกล่องไหนก็เข้าไปทำงานตรงนั้นได้เลย</p>
              </div>
            </div>

            {/* ชั้นฐาน — ไม่ใช่ "งาน" แต่เป็นสิ่งที่ทุกงานวางอยู่บน จึงแยกออกมาก่อนกลุ่มงานจริง */}
            <section className="sm-layer">
              <div className="sm-layer-label">พื้นฐานของระบบ</div>
              <div className="sm-core">
                {CORE.map((c) => (
                  <a key={c.key} className="sm-core-box" href={c.href}>
                    <strong>{c.label}</strong>
                    <span>{c.desc}</span>
                  </a>
                ))}
              </div>
            </section>

            <div className="sm-arrow" aria-hidden>↓</div>

            <section className="sm-layer">
              <div className="sm-layer-label">งานที่ทำได้</div>
              <div className="sm-groups">
                {GROUPS.map((g) => (
                  <div key={g.key} className={`sm-group sm-group-${g.tone}`}>
                    <div className="sm-group-head">{g.label}</div>
                    {g.items.map((it) => (
                      <a key={it.href} className="sm-item" href={it.href}>
                        <strong>{it.label}</strong>
                        <span>{it.desc}</span>
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            </section>

            <div className="sm-arrow" aria-hidden>↓</div>

            <section className="sm-layer">
              <div className="sm-layer-label">สิ่งที่คนข้างนอกเห็น</div>
              <div className="sm-output">
                {OUTPUT.map((o) => (
                  <a key={o.href} className="sm-out-box" href={o.href}>
                    <div>
                      <strong>{o.label}</strong>
                      <span>{o.desc}</span>
                    </div>
                    <FontAwesomeIcon icon={faArrowRight} />
                  </a>
                ))}
              </div>
            </section>
          </div>
        </main>
      )}
    </StaffRoleGuard>
  )
}
