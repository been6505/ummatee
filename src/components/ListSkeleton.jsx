// Skeleton แถบชิมเมอร์ทั่วไป — ใช้แทนข้อความ "กำลังโหลด..." เดิมในทุกหน้า ระหว่างรอข้อมูลจาก Firestore
// ใช้ sk-block/sk-line (shimmer keyframe) ที่ประกาศไว้แล้วใน shop.css (โหลดทั้งแอปอยู่แล้ว)
export default function ListSkeleton({ rows = 4 }) {
  return (
    <div className="list-skeleton" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="list-skeleton-row">
          <div className="sk-line" style={{ height: 14, width: `${85 - i * 6}%` }} />
        </div>
      ))}
    </div>
  )
}
