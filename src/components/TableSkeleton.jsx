// Skeleton แถวตารางระหว่างรอโหลดข้อมูล — ใช้ sk-block/sk-line (shimmer) ที่ประกาศไว้แล้วใน shop.css
// cols = จำนวนคอลัมน์ของตารางที่ครอบ, rows = จำนวนแถวหลอกที่จะโชว์
export default function TableSkeleton({ cols = 4, rows = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} aria-hidden="true">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c}><div className="sk-line" style={{ height: 14, width: c === 0 ? '70%' : '85%' }} /></td>
          ))}
        </tr>
      ))}
    </>
  )
}
