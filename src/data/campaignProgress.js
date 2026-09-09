// ความคืบหน้าเทียบเป้าของแคมเปญ
//
// อยู่แยกจาก campaignLinks.js เพราะไฟล์นั้น import firebase.js ซึ่งเรียก initializeAppCheck
// ที่ต้องมี document — เทสต์จะรันไม่ได้ถ้าฟังก์ชันบริสุทธิ์ไปอยู่ปนกับมัน (ปัญหาเดียวกับ orderStatus.js)

// คุมไม่ให้เกิน 100% เพราะแถบที่ยาวเกินกรอบทำให้ layout พัง
// แต่คืน rawPct แยกไว้ด้วย — "ได้เกินเป้า" เป็นข้อมูลที่อยากเห็นจริงๆ ไม่ควรถูกตัดทิ้ง
export function campaignProgress(campaign) {
  const goal = Number(campaign?.goalAmount) || 0
  const current = Number(campaign?.currentAmount) || 0
  if (goal <= 0) return { pct: 0, rawPct: 0, goal, current, hasGoal: false }
  const rawPct = Math.round((current / goal) * 100)
  return { pct: Math.min(rawPct, 100), rawPct, goal, current, hasGoal: true }
}
