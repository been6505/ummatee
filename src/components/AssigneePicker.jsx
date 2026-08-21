import { useStaffDirectory, memberLabel, findMember, ROLE_LABEL } from '../data/staffDirectory.js'

// ช่องเลือก "ผู้รับผิดชอบ" ใช้ร่วมกันทุกที่ที่มอบหมายงานได้ (บอร์ด/คอนเทนต์/แคมเปญ/อีเวนต์)
// เก็บเป็น uid ของ staff ไม่ใช่ชื่อที่พิมพ์เอง — ชื่อที่พิมพ์เองผูกกับ "งานของฉัน" ไม่ได้
// และสะกดต่างกันนิดเดียวก็กลายเป็นคนละคนทันที
export default function AssigneePicker({ value, onChange, label = 'ผู้รับผิดชอบ', disabled }) {
  const { members, loading } = useStaffDirectory()

  // คนที่ถูกมอบหมายไว้แต่ไม่อยู่ในสมุดแล้ว (ลาออก/ถูกปิดใช้งาน) ต้องยังเห็นว่าเคยเป็นของใคร
  // ถ้าปล่อยให้ select หาค่าไม่เจอ มันจะเด้งไปเป็น "ยังไม่มอบหมาย" เงียบๆ ทั้งที่ข้อมูลยังอยู่
  const assigned = value ? findMember(members, value) : null
  const options = assigned?.missing ? [...members, assigned] : members

  return (
    <label className="assignee-picker">
      {label}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled || loading}
      >
        <option value="">{loading ? 'กำลังโหลดรายชื่อ…' : 'ยังไม่มอบหมาย'}</option>
        {options.map((m) => (
          <option key={m.uid} value={m.uid}>
            {memberLabel(m)}{m.missing ? ' (ไม่อยู่ในทีมแล้ว)' : m.role ? ` · ${ROLE_LABEL[m.role] || m.role}` : ''}
          </option>
        ))}
      </select>
      {!loading && members.length === 0 && (
        <span className="assignee-hint">ยังไม่มีรายชื่อทีม — ให้แอดมินสูงสุดกด "อัปเดตสมุดรายชื่อทีม" ที่หน้าจัดการ Staff</span>
      )}
    </label>
  )
}

// ป้ายชื่อผู้รับผิดชอบแบบอ่านอย่างเดียว — ใช้ในลิสต์/การ์ดที่ไม่มีที่พอให้ใส่ทั้ง select
export function AssigneeTag({ uid }) {
  const { members } = useStaffDirectory()
  if (!uid) return null
  const m = findMember(members, uid)
  return (
    <span className={`assignee-tag${m.missing ? ' assignee-tag-missing' : ''}`} title={m.email || ''}>
      {memberLabel(m)}
    </span>
  )
}
