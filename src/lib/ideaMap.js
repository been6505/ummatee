// ตรรกะของแท็บ "ไอเดีย" (มายด์แมป) — แยกออกมาเป็นฟังก์ชันล้วนเพื่อเทสต์ได้โดยไม่ต้องมี DOM/Firestore
//
// เก็บเส้นเชื่อมเป็น array `links` บนโน้ดต้นทาง ไม่ทำ collection แยก
// เพราะเส้นไม่มีข้อมูลของตัวเอง (ไม่มีป้าย/สี) และการลบโน้ดต้องลบเส้นที่ชี้ถึงมันด้วย
// ถ้าแยก collection จะต้องลบสองที่ให้ atomic ซึ่งกฎ Firestore ฝั่ง client การันตีให้ไม่ได้

// ขอบเขตผ้าใบ (พิกัดที่บันทึกลง Firestore) — กันโน้ดหลุดออกไปนอกพื้นที่จนหาไม่เจอ
export const CANVAS_W = 2000
export const CANVAS_H = 1400
export const NODE_W = 180
export const NODE_H = 92

/** บังคับพิกัดให้อยู่ในผ้าใบ และปัดเป็นจำนวนเต็ม (พิกัดทศนิยมยาวๆ เปลืองพื้นที่เอกสารเปล่าๆ) */
export function clampPos(x, y) {
  const nx = Number.isFinite(Number(x)) ? Number(x) : 0
  const ny = Number.isFinite(Number(y)) ? Number(y) : 0
  return {
    x: Math.round(Math.min(Math.max(nx, 0), CANVAS_W - NODE_W)),
    y: Math.round(Math.min(Math.max(ny, 0), CANVAS_H - NODE_H)),
  }
}

/**
 * เพิ่มเส้นเชื่อม a → b
 * กันเชื่อมตัวเอง และกันเส้นซ้ำ (รวมกรณีที่ b → a มีอยู่แล้ว เพราะเส้นในมายด์แมปนี้ไม่มีทิศ)
 * @returns links ชุดใหม่ของโน้ด a หรือ null ถ้าไม่ควรเพิ่ม (ผู้เรียกจะได้ไม่ต้องเขียน Firestore เปล่าๆ)
 */
export function addLink(nodes, aId, bId) {
  if (!aId || !bId || aId === bId) return null
  const a = nodes.find((n) => n.id === aId)
  const b = nodes.find((n) => n.id === bId)
  if (!a || !b) return null
  const aLinks = Array.isArray(a.links) ? a.links : []
  const bLinks = Array.isArray(b.links) ? b.links : []
  if (aLinks.includes(bId) || bLinks.includes(aId)) return null
  return [...aLinks, bId]
}

/** ลบเส้น a ↔ b — คืนรายการงานที่ต้องเขียน (ฝั่งไหนถือเส้นอยู่ก็ฝั่งนั้น) */
export function removeLinkUpdates(nodes, aId, bId) {
  const out = []
  for (const [from, to] of [[aId, bId], [bId, aId]]) {
    const n = nodes.find((x) => x.id === from)
    const links = Array.isArray(n?.links) ? n.links : []
    if (links.includes(to)) out.push({ id: from, links: links.filter((l) => l !== to) })
  }
  return out
}

/** ลบโน้ด: ต้องเก็บกวาดเส้นของโน้ดอื่นที่ชี้มาหามันด้วย ไม่งั้นเหลือเส้นชี้ไปที่ไม่มีอยู่ */
export function deleteNodeUpdates(nodes, id) {
  return nodes
    .filter((n) => n.id !== id && Array.isArray(n.links) && n.links.includes(id))
    .map((n) => ({ id: n.id, links: n.links.filter((l) => l !== id) }))
}

/**
 * เส้นที่ต้องวาด — คู่ละครั้งเดียวแม้ทั้งสองฝั่งจะเก็บ id ของกันและกันไว้
 * ข้ามเส้นที่ปลายทางถูกลบไปแล้ว (ข้อมูลเก่าอาจค้าง) เพื่อไม่ให้วาดเส้นลอยไปที่ว่าง
 */
export function edgesOf(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const seen = new Set()
  const out = []
  for (const n of nodes) {
    for (const to of Array.isArray(n.links) ? n.links : []) {
      const target = byId.get(to)
      if (!target) continue
      const key = [n.id, to].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ from: n, to: target, key })
    }
  }
  return out
}

/** จุดกลางโน้ด — ใช้เป็นปลายเส้นใน SVG */
export const centerOf = (n) => ({
  x: (Number(n.x) || 0) + NODE_W / 2,
  y: (Number(n.y) || 0) + NODE_H / 2,
})

/** ตำแหน่งเริ่มต้นของโน้ดใหม่ — เรียงเป็นตะแกรงกันวางทับกันจนมองไม่เห็นว่ามีหลายใบ */
export function nextFreePos(nodes) {
  const gapX = NODE_W + 30
  const gapY = NODE_H + 40
  const perRow = Math.max(1, Math.floor(CANVAS_W / gapX))
  for (let i = 0; i < 500; i++) {
    const p = clampPos(20 + (i % perRow) * gapX, 20 + Math.floor(i / perRow) * gapY)
    const taken = nodes.some((n) => Math.abs((Number(n.x) || 0) - p.x) < 8 && Math.abs((Number(n.y) || 0) - p.y) < 8)
    if (!taken) return p
  }
  return clampPos(20, 20)
}
