import { describe, it, expect } from 'vitest'
import {
  clampPos, addLink, removeLinkUpdates, deleteNodeUpdates, edgesOf, centerOf, nextFreePos,
  CANVAS_W, CANVAS_H, NODE_W, NODE_H,
} from './ideaMap.js'

const N = (id, extra = {}) => ({ id, title: id, x: 0, y: 0, links: [], ...extra })

describe('clampPos', () => {
  it('กันโน้ดหลุดออกนอกผ้าใบทั้งสี่ด้าน', () => {
    expect(clampPos(-50, -50)).toEqual({ x: 0, y: 0 })
    expect(clampPos(99999, 99999)).toEqual({ x: CANVAS_W - NODE_W, y: CANVAS_H - NODE_H })
  })
  it('ปัดเป็นจำนวนเต็ม', () => {
    expect(clampPos(10.4, 20.6)).toEqual({ x: 10, y: 21 })
  })
  it('ค่าที่ไม่ใช่ตัวเลขถือเป็น 0 ไม่ใช่ NaN (NaN จะทำให้โน้ดหายไปจากหน้าจอ)', () => {
    expect(clampPos(undefined, 'abc')).toEqual({ x: 0, y: 0 })
    expect(clampPos(null, NaN)).toEqual({ x: 0, y: 0 })
  })
})

describe('addLink', () => {
  const nodes = [N('a'), N('b'), N('c')]
  it('เชื่อมสองโน้ดได้', () => {
    expect(addLink(nodes, 'a', 'b')).toEqual(['b'])
  })
  it('เชื่อมตัวเองไม่ได้', () => {
    expect(addLink(nodes, 'a', 'a')).toBeNull()
  })
  it('เส้นซ้ำไม่เพิ่มอีก', () => {
    const withLink = [N('a', { links: ['b'] }), N('b'), N('c')]
    expect(addLink(withLink, 'a', 'b')).toBeNull()
  })
  it('เส้นย้อนทางถือว่าซ้ำ (เส้นไม่มีทิศ)', () => {
    const withLink = [N('a'), N('b', { links: ['a'] })]
    expect(addLink(withLink, 'a', 'b')).toBeNull()
  })
  it('โน้ดที่ไม่มีอยู่จริงคืน null', () => {
    expect(addLink(nodes, 'a', 'zzz')).toBeNull()
    expect(addLink(nodes, '', 'b')).toBeNull()
  })
  it('links ที่ไม่ใช่ array (ข้อมูลเก่า) ไม่ทำให้พัง', () => {
    expect(addLink([N('a', { links: undefined }), N('b')], 'a', 'b')).toEqual(['b'])
  })
})

describe('removeLinkUpdates', () => {
  it('ลบจากฝั่งที่ถือเส้นอยู่', () => {
    const nodes = [N('a', { links: ['b'] }), N('b')]
    expect(removeLinkUpdates(nodes, 'a', 'b')).toEqual([{ id: 'a', links: [] }])
  })
  it('ถือคนละฝั่งก็ลบได้ (กดลบจากปลายไหนก็ได้)', () => {
    const nodes = [N('a'), N('b', { links: ['a'] })]
    expect(removeLinkUpdates(nodes, 'a', 'b')).toEqual([{ id: 'b', links: [] }])
  })
  it('ถือทั้งสองฝั่ง (ข้อมูลซ้ำ) ลบทั้งคู่', () => {
    const nodes = [N('a', { links: ['b'] }), N('b', { links: ['a'] })]
    expect(removeLinkUpdates(nodes, 'a', 'b')).toHaveLength(2)
  })
  it('ไม่มีเส้นอยู่ = ไม่ต้องเขียนอะไร', () => {
    expect(removeLinkUpdates([N('a'), N('b')], 'a', 'b')).toEqual([])
  })
})

describe('deleteNodeUpdates', () => {
  it('เก็บกวาดเส้นของโน้ดอื่นที่ชี้มาหาโน้ดที่ถูกลบ', () => {
    const nodes = [N('a', { links: ['b'] }), N('b'), N('c', { links: ['b', 'a'] })]
    expect(deleteNodeUpdates(nodes, 'b')).toEqual([
      { id: 'a', links: [] },
      { id: 'c', links: ['a'] },
    ])
  })
  it('ไม่มีใครชี้มา = ไม่ต้องเขียนอะไร', () => {
    expect(deleteNodeUpdates([N('a'), N('b')], 'b')).toEqual([])
  })
})

describe('edgesOf', () => {
  it('คู่ละเส้นเดียวแม้เก็บ id ไว้ทั้งสองฝั่ง', () => {
    const nodes = [N('a', { links: ['b'] }), N('b', { links: ['a'] })]
    expect(edgesOf(nodes)).toHaveLength(1)
  })
  it('ข้ามเส้นที่ปลายทางถูกลบไปแล้ว ไม่วาดเส้นลอย', () => {
    const nodes = [N('a', { links: ['ghost'] }), N('b')]
    expect(edgesOf(nodes)).toEqual([])
  })
  it('คืนตัวโน้ดจริงมาให้ ใช้คำนวณพิกัดปลายเส้นได้ทันที', () => {
    const nodes = [N('a', { links: ['b'], x: 10, y: 20 }), N('b', { x: 300, y: 400 })]
    const [e] = edgesOf(nodes)
    expect(centerOf(e.from)).toEqual({ x: 10 + NODE_W / 2, y: 20 + NODE_H / 2 })
    expect(centerOf(e.to)).toEqual({ x: 300 + NODE_W / 2, y: 400 + NODE_H / 2 })
  })
})

describe('nextFreePos', () => {
  it('โน้ดใหม่ไม่ทับใบเดิม', () => {
    const first = nextFreePos([])
    const second = nextFreePos([N('a', first)])
    expect(second).not.toEqual(first)
  })
  it('อยู่ในผ้าใบเสมอ', () => {
    const many = Array.from({ length: 60 }, (_, i) => N(`n${i}`, nextFreePos([])))
    const p = nextFreePos(many)
    expect(p.x).toBeGreaterThanOrEqual(0)
    expect(p.y).toBeGreaterThanOrEqual(0)
    expect(p.x).toBeLessThanOrEqual(CANVAS_W - NODE_W)
    expect(p.y).toBeLessThanOrEqual(CANVAS_H - NODE_H)
  })
})
