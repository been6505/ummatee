// ห้องฉายจำลอง 3 มิติของหน้าจอง NAZA for GAZA — พอร์ตมาจากต้นแบบ NAZA_Booking.html
// โหลดแบบ dynamic import จาก NazaRoom3D.jsx เท่านั้น (three.js ~600kB ไม่ควรติดไปกับหน้าแรกของงาน)
//
// API แบบ imperative: buildRoom({...}) คืน { apply, start, stop, enterPov, exitPov, dispose }
// ไม่ได้ผูก React — React ฝั่ง NazaRoom3D ส่งสถานะที่นั่งเข้ามาผ่าน apply() อย่างเดียว
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'

const MINT = new THREE.Color('#f4f4f1'), FREE = new THREE.Color('#2b2b2c')
const SRGB = THREE.SRGBColorSpace

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }
function hashStr(t) { let h = 2166136261; for (const c of t) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }

/* ---------- procedural textures ---------- */
function woodTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d'); const r = rng(42)
  const pw = 128
  for (let col = 0; col < 8; col++) {
    let y = -Math.floor(r() * 500)
    while (y < 1024) {
      const len = 380 + Math.floor(r() * 420)
      const l = 19 + r() * 9, h = 24 + r() * 8
      x.fillStyle = `hsl(${h},${30 + r() * 12}%,${l}%)`; x.fillRect(col * pw, y, pw, len)
      for (let g = 0; g < 26; g++) { x.strokeStyle = `rgba(${r() < .5 ? '40,22,10' : '120,80,45'},${.05 + r() * .09})`; x.lineWidth = .6 + r() * 1.6; x.beginPath(); const gx = col * pw + r() * pw; x.moveTo(gx, y); x.bezierCurveTo(gx + (r() - .5) * 14, y + len * .33, gx + (r() - .5) * 14, y + len * .66, gx + (r() - .5) * 8, y + len); x.stroke() }
      x.fillStyle = 'rgba(10,6,3,.75)'; x.fillRect(col * pw, y, pw, 2)
      y += len
    }
    x.fillStyle = 'rgba(10,6,3,.8)'; x.fillRect(col * pw, 0, 2, 1024)
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = SRGB; return t
}
function veneerTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d'); const r = rng(9)
  for (let p = 0; p < 4; p++) {
    x.fillStyle = `hsl(${26 + r() * 5},${32 + r() * 8}%,${24 + r() * 5}%)`; x.fillRect(p * 256, 0, 256, 512)
    for (let g = 0; g < 40; g++) { x.strokeStyle = `rgba(${r() < .5 ? '35,18,8' : '140,95,55'},${.05 + r() * .08})`; x.lineWidth = .5 + r() * 2; x.beginPath(); const gx = p * 256 + r() * 256; x.moveTo(gx, 0); x.bezierCurveTo(gx + (r() - .5) * 30, 170, gx + (r() - .5) * 30, 340, gx + (r() - .5) * 20, 512); x.stroke() }
    x.fillStyle = 'rgba(5,3,2,.85)'; x.fillRect(p * 256, 0, 3, 512)
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = SRGB; return t
}
function fabricBump() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const r = rng(5)
  x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 4000; i++) { const v = 110 + Math.floor(r() * 40); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(r() * 256, r() * 256, 1.5, 1.5) }
  for (let i = 0; i < 256; i += 3) { x.fillStyle = 'rgba(0,0,0,.06)'; x.fillRect(0, i, 256, 1) }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t
}
async function screenTexture() {
  try { await Promise.race([Promise.all([document.fonts.load('124px "Archivo Black"'), document.fonts.load('800 60px Kanit'), document.fonts.load('700 40px Kanit')]), new Promise((r) => setTimeout(r, 2500))]) } catch { /* ใช้ฟอนต์สำรอง */ }
  const W = 1280, H = 720, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); const r = rng(77)
  const g = x.createRadialGradient(W / 2, H * .45, 40, W / 2, H / 2, W * .65); g.addColorStop(0, '#232325'); g.addColorStop(1, '#060606'); x.fillStyle = g; x.fillRect(0, 0, W, H)
  for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(230,230,230,${r() * .35})`; const s = r() * 2.2; x.fillRect(r() * W, H * .72 + r() * H * .28, s, s) }
  x.textAlign = 'center'; x.textBaseline = 'alphabetic'
  x.fillStyle = '#d9d9d6'; x.font = '500 26px Kanit, sans-serif'
  if ('letterSpacing' in x) x.letterSpacing = '10px'
  x.fillText('UMMATEE THE SERIES', W / 2, 170)
  if ('letterSpacing' in x) x.letterSpacing = '0px'
  x.fillStyle = '#eef2ec'; x.font = '250px "Archivo Black", Impact, sans-serif'
  x.fillText('NAZA', W / 2, 430)
  // รอยแตก
  x.strokeStyle = '#141415'
  for (let k = 0; k < 46; k++) { let px = W * .18 + r() * W * .64, py = 210 + r() * 230; x.lineWidth = 1 + r() * 3.2; x.beginPath(); x.moveTo(px, py); for (let s = 0; s < 6; s++) { px += (r() - .5) * 70; py += (r() - .3) * 40; x.lineTo(px, py) } x.stroke() }
  for (let k = 0; k < 900; k++) { x.fillStyle = 'rgba(20,20,21,.9)'; const s = r() * 4; x.fillRect(W * .17 + r() * W * .66, 200 + r() * 240, s, s) }
  const a = 'FOR '; x.font = '800 60px Kanit, sans-serif'; const wb = x.measureText('GAZA').width; x.font = '500 60px Kanit, sans-serif'; const wa = x.measureText(a).width
  const sx = W / 2 - (wa + wb) / 2; x.textAlign = 'left'; x.fillStyle = '#eef2ec'; x.fillText(a, sx, 520); x.font = '800 60px Kanit, sans-serif'; x.fillStyle = '#e3262f'; x.fillText('GAZA', sx + wa, 520)
  x.textAlign = 'center'; x.font = '700 40px Kanit, sans-serif'; x.fillStyle = '#a6a6ab'; x.fillText('เมื่อชีวิตคนเป็นแค่ตัวเลข', W / 2, 610)
  const t = new THREE.CanvasTexture(c); t.colorSpace = SRGB; return t
}
function labelCanvas() { const c = document.createElement('canvas'); c.width = 256; c.height = 128; return c }
function drawLabel(c, text, state) {
  const x = c.getContext('2d'); x.clearRect(0, 0, 256, 128)
  x.fillStyle = state === 'sel' ? 'rgba(246,246,243,.97)' : 'rgba(12,12,12,.72)'
  x.beginPath(); if (x.roundRect) x.roundRect(28, 22, 200, 84, 26); else x.rect(28, 22, 200, 84); x.fill()
  x.lineWidth = 3; x.strokeStyle = state === 'sel' ? '#ffffff' : 'rgba(220,220,220,.45)'; x.stroke()
  x.fillStyle = state === 'sel' ? '#141416' : '#e6e6e3'; x.font = '600 58px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 66)
}

/* ---------- บีนแบ็ก ---------- */
function beanGeometry() {
  const g = new THREE.SphereGeometry(0.5, 48, 32); const p = g.attributes.position; const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    let y = v.y
    y = y < 0 ? y * 0.36 : y * 0.9
    // แอ่งที่นั่งหันไปทางจอ (-z) พนักพิงยกขึ้นด้าน +z
    const dent = Math.exp(-((v.x * v.x) / 0.07 + ((v.z + 0.08) ** 2) / 0.06))
    if (y > 0) { y -= dent * 0.2; if (v.z > 0.05) y += (v.z - 0.05) * 0.55 * Math.min(1, y / 0.3) }
    const bulge = 1 + 0.14 * Math.max(0, 1 - Math.abs(y + 0.05) / 0.22)
    let px = v.x * bulge, pz = v.z * bulge * 1.06
    const wr = 0.012 * Math.sin(v.x * 23 + v.z * 17) * Math.sin(y * 19)
    px += px * wr; pz += pz * wr
    p.setXYZ(i, px, y + 0.18, pz)
  }
  g.computeVertexNormals(); return g
}

/* ---------- คนนั่ง (แทนที่นั่งที่มีผู้จองแล้ว) ---------- */
function personGeoms() {
  return {
    torso: new THREE.CapsuleGeometry(0.16, 0.3, 6, 14), head: new THREE.SphereGeometry(0.11, 20, 14),
    hair: new THREE.SphereGeometry(0.118, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), arm: new THREE.CapsuleGeometry(0.055, 0.32, 4, 8), leg: new THREE.CapsuleGeometry(0.07, 0.42, 4, 10),
  }
}
function makePerson(G, seed, onChair = false) {
  const r = rng(seed), pick = (a) => a[Math.floor(r() * a.length)]
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: .85 })
  const shirt = mat(pick(['#d9dde3', '#2f3b4f', '#7a1d22', '#56664a', '#c9b79c', '#1e1e22', '#3c2f4a', '#e6e1d6'])), skin = mat(pick(['#c99b78', '#a87556', '#e2b894', '#8a5a3c']))
  const hair = mat(pick(['#17110e', '#3b2a1f', '#0e0e10', '#4a3426'])), pants = mat(pick(['#22252b', '#3a3f4a', '#2e2a24', '#151618']))
  const g = new THREE.Group(), lean = onChair ? 0.08 + r() * 0.08 : 0.32 + r() * 0.12
  const dir = new THREE.Vector3(0, Math.cos(lean), Math.sin(lean))
  const torso = new THREE.Mesh(G.torso, shirt); torso.position.set(0, onChair ? 0.82 : 0.62, onChair ? 0.06 : 0.12); torso.rotation.x = lean; g.add(torso)
  const head = new THREE.Mesh(G.head, skin); head.position.copy(torso.position).addScaledVector(dir, 0.38); g.add(head)
  const hr = new THREE.Mesh(G.hair, hair); hr.position.copy(head.position); hr.rotation.x = 0.55; g.add(hr)
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(G.arm, shirt); arm.position.set(s * 0.21, onChair ? 0.76 : 0.58, onChair ? 0.0 : 0.06); arm.rotation.set(lean * 0.6 - (onChair ? 0.5 : 0), 0, s * 0.18); g.add(arm)
    if (onChair) {
      const th = new THREE.Mesh(G.leg, pants); th.position.set(s * 0.1, 0.53, -0.16); th.rotation.x = Math.PI / 2; th.scale.set(1, 0.75, 1); g.add(th)
      const sh = new THREE.Mesh(G.leg, pants); sh.position.set(s * 0.1, 0.27, -0.38); sh.scale.set(0.9, 0.8, 0.9); g.add(sh)
    } else { const leg = new THREE.Mesh(G.leg, pants); leg.position.set(s * 0.1, 0.38, -0.28); leg.rotation.x = Math.PI / 2 - 0.25; g.add(leg) }
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true })
  g.rotation.y = (r() - .5) * 0.2
  return g
}

/* ---------- ห้อง ---------- */
// onToggle(seatId) — ผู้ใช้แตะที่นั่ง · onPov(seatId|null) — เข้า/ออกมุมมองจากที่นั่ง
export function buildRoom({ canvas: cvs, wrap, rows: ROWS, onToggle, onPov, onHover }) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const renderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  // ต้นแบบออกแบบแสงไว้กับ three r143 (ก่อนเปลี่ยนเป็นหน่วยแสงแบบฟิสิกส์) — เปิดโหมดแสงแบบเดิมไว้ให้ห้องสว่างเท่าต้นแบบ
  renderer.useLegacyLights = true
  renderer.outputColorSpace = SRGB
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  RectAreaLightUniformsLib.init()

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#0c0a08')
  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 60)
  const W = 10, ZF = -7.5, ZB = 9.2, H = 3.2

  // ผนัง/พื้น
  const wood = woodTexture(); wood.repeat.set(W / 1.44, (ZB - ZF) / 1.44); wood.anisotropy = renderer.capabilities.getMaxAnisotropy()
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, ZB - ZF), new THREE.MeshStandardMaterial({ map: wood, roughness: .5, metalness: 0 }))
  floor.rotation.x = -Math.PI / 2; floor.position.z = (ZF + ZB) / 2; floor.receiveShadow = true; scene.add(floor)
  const plaster = new THREE.MeshStandardMaterial({ color: '#8f8a83', roughness: .95 })
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, ZB - ZF), new THREE.MeshStandardMaterial({ color: '#36312c', roughness: 1 }))
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, (ZF + ZB) / 2); scene.add(ceil)
  const front = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ color: '#9a948c', roughness: .95 })); front.position.set(0, H / 2, ZF); scene.add(front)
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), plaster); back.rotation.y = Math.PI; back.position.set(0, H / 2, ZB); scene.add(back)
  const ven = veneerTexture(); ven.repeat.set((ZB - ZF) / 2.4, 1)
  const left = new THREE.Mesh(new THREE.PlaneGeometry(ZB - ZF, H), new THREE.MeshStandardMaterial({ map: ven, roughness: .6 })); left.rotation.y = Math.PI / 2; left.position.set(-W / 2, H / 2, (ZF + ZB) / 2); left.receiveShadow = true; scene.add(left)
  const right = new THREE.Mesh(new THREE.PlaneGeometry(ZB - ZF, H), plaster); right.rotation.y = -Math.PI / 2; right.position.set(W / 2, H / 2, (ZF + ZB) / 2); right.receiveShadow = true; scene.add(right)
  const skirt = new THREE.MeshStandardMaterial({ color: '#1a1714', roughness: .7 })
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, ZB - ZF), skirt); b.position.set(s * (W / 2 - 0.015), 0.045, (ZF + ZB) / 2); scene.add(b) }

  // ฝ้าเหนือจอ
  const sof = new THREE.Mesh(new THREE.BoxGeometry(W, 0.35, 1.2), new THREE.MeshStandardMaterial({ color: '#2c2824', roughness: 1 })); sof.position.set(0, H - 0.175, ZF + 0.6); scene.add(sof)

  // จอ
  const sw = 4.6, sh = sw * 9 / 16, sy = 1.62
  const frame = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.16, sh + 0.16, 0.06), new THREE.MeshStandardMaterial({ color: '#0b0b0b', roughness: .6 })); frame.position.set(0, sy, ZF + 0.04); scene.add(frame)
  const screenMat = new THREE.MeshBasicMaterial({ color: '#151515', toneMapped: false })
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), screenMat); screen.position.set(0, sy, ZF + 0.075); scene.add(screen)
  let disposed = false
  screenTexture().then((t) => { if (disposed) { t.dispose(); return } screenMat.map = t; screenMat.color.set('#e2e2e0'); screenMat.needsUpdate = true })
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .07, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(sw * 1.7, sh * 1.9), glowMat); halo.position.set(0, sy, ZF + 0.02); scene.add(halo)
  const sl = new THREE.RectAreaLight('#e8e8e6', 5.5, sw, sh); sl.position.set(0, sy, ZF + 0.1); sl.lookAt(0, sy, 0); scene.add(sl)

  // โปรเจกเตอร์บนพื้น + ลำแสง
  const proj = new THREE.Group()
  const pb = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.28), new THREE.MeshStandardMaterial({ color: '#d5d8d6', roughness: .4 })); pb.position.y = 0.06; pb.castShadow = true; proj.add(pb)
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16), new THREE.MeshBasicMaterial({ color: '#f6f6f4', toneMapped: false })); lens.rotation.x = Math.PI / 2; lens.position.set(0.07, 0.07, -0.15); proj.add(lens)
  proj.position.set(0, 0, -4.75); scene.add(proj)
  {
    const from = new THREE.Vector3(0.07, 0.07, -4.9), to = new THREE.Vector3(0, sy, ZF + 0.08)
    const len = from.distanceTo(to)
    const beamGeo = new THREE.CylinderGeometry(0.02, sw * 0.66, len, 4, 1, true); beamGeo.rotateY(Math.PI / 4); beamGeo.translate(0, -len / 2, 0)
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }))
    beam.position.copy(from); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize())
    beam.scale.set(1, 1, sh / sw * 1.4); scene.add(beam)
  }

  // หน้าต่างสูงผนังขวา (กลางคืน)
  const glass = new THREE.MeshBasicMaterial({ color: '#24356a' })
  const mull = new THREE.MeshStandardMaterial({ color: '#121212', roughness: .6 })
  const wz0 = -5.6, wz1 = 7.6, nWin = 5, wl = (wz1 - wz0) / nWin
  for (let i = 0; i < nWin; i++) {
    const cz = wz0 + wl * (i + .5)
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(wl - 0.12, 0.55), glass); pane.rotation.y = -Math.PI / 2; pane.position.set(W / 2 - 0.01, 2.62, cz); scene.add(pane)
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.68, 0.08), mull); m.position.set(W / 2 - 0.03, 2.62, cz - wl / 2); scene.add(m)
  }
  for (const yy of [2.31, 2.93]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, wz1 - wz0), mull); m.position.set(W / 2 - 0.03, yy, (wz0 + wz1) / 2); scene.add(m) }

  // ไฟราง
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 13), new THREE.MeshStandardMaterial({ color: '#111', roughness: .5 })); rail.position.set(W / 2 - 0.75, H - 0.03, 0.6); scene.add(rail)
  const headGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.16, 14), headMat = new THREE.MeshStandardMaterial({ color: '#151515', roughness: .4 })
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#fff3df', toneMapped: false })
  for (const z of [-4.6, -1.2, 2.2, 5.6]) {
    const hd = new THREE.Mesh(headGeo, headMat); hd.position.set(W / 2 - 0.75, H - 0.14, z); hd.rotation.z = -0.55; scene.add(hd)
    const bl = new THREE.Mesh(new THREE.CircleGeometry(0.04, 14), bulbMat); bl.position.set(W / 2 - 0.71, H - 0.2, z); bl.rotation.set(0, Math.PI / 2, -0.55 - Math.PI / 2); scene.add(bl)
    const sp = new THREE.SpotLight('#ffd9ad', 2.6, 6.5, 0.42, 0.85, 1.2); sp.position.set(W / 2 - 0.75, H - 0.2, z); sp.target.position.set(W / 2, 0.9, z); scene.add(sp, sp.target)
  }
  // ดาวน์ไลต์ + ไฟหลักที่ทอดเงา
  const dlMat = new THREE.MeshBasicMaterial({ color: '#fff1d9', toneMapped: false })
  for (const xx of [-2.6, 0, 2.6]) for (const z of [-5.5, -1.5, 2.5, 6.5]) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), dlMat); d.rotation.x = Math.PI / 2; d.position.set(xx, H - 0.005, z); scene.add(d) }
  const key = new THREE.SpotLight('#ffe6c4', 1.1, 14, 1.05, 0.9, 1); key.position.set(-0.5, H - 0.05, 1.2); key.target.position.set(0, 0, -0.3)
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0006; key.shadow.radius = 6; scene.add(key, key.target)
  scene.add(new THREE.HemisphereLight('#c8d4cc', '#2a2017', 0.32))
  const backFill = new THREE.PointLight('#ffdcb0', 0.35, 9, 1.5); backFill.position.set(0, 2.6, 7.6); scene.add(backFill)

  // ที่นั่ง
  const ROWZ = []; { let z = -3.1; ROWS.forEach((r, i) => { if (i > 0) { const a = ROWS[i - 1][2], b = r[2]; z += a === 'bean' && b === 'bean' ? 1.45 : a === 'bean' ? 1.35 : 1.0 } ROWZ.push(z) }) }
  const SP = 1.3, CSP = 0.95
  const chairSeatG = new THREE.BoxGeometry(0.46, 0.05, 0.44); chairSeatG.translate(0, 0.45, 0)
  const chairBackG = new THREE.BoxGeometry(0.46, 0.42, 0.04); chairBackG.rotateX(-0.12); chairBackG.translate(0, 0.7, 0.21)
  const legG = new THREE.CylinderGeometry(0.014, 0.014, 0.45, 8)
  const metal = new THREE.MeshStandardMaterial({ color: '#9a9a98', roughness: .35, metalness: .8 })
  const beanG = beanGeometry(), bump = fabricBump(), PG = personGeoms()
  const ringGeo = new THREE.RingGeometry(0.5, 0.62, 48)
  const seats = new Map(), pickables = []
  ROWS.forEach(([row, n, type], ri) => {
    const isBean = type === 'bean'
    for (let i = 1; i <= n; i++) {
      const id = row + i, r = rng(hashStr(id))
      const x = isBean ? (i - 1 - (n - 1) / 2) * SP + (r() - .5) * 0.12 : (i - 1 - (n - 1) / 2) * CSP + (n % 2 === 0 ? (i > n / 2 ? 0.35 : -0.35) : 0)
      const z = ROWZ[ri] + (isBean ? (r() - .5) * 0.14 : 0)
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = isBean ? (r() - .5) * 0.26 - x * 0.03 : -x * 0.015
      const mat = isBean ? new THREE.MeshStandardMaterial({ color: FREE.clone(), roughness: .88, bumpMap: bump, bumpScale: 0.015, emissive: '#000000' })
        : new THREE.MeshStandardMaterial({ color: FREE.clone(), roughness: .55, emissive: '#000000' })
      let bean
      if (isBean) { bean = new THREE.Mesh(beanG, mat); bean.scale.setScalar(0.82); bean.castShadow = true; bean.receiveShadow = true; bean.userData.seat = id; g.add(bean) }
      else {
        bean = new THREE.Group(); bean.scale.setScalar(1)
        const st = new THREE.Mesh(chairSeatG, mat), bk = new THREE.Mesh(chairBackG, mat)
        for (const m of [st, bk]) { m.castShadow = true; m.receiveShadow = true; m.userData.seat = id; bean.add(m) }
        for (const [lx, lz] of [[-.2, -.19], [.2, -.19], [-.2, .19], [.2, .19]]) { const l = new THREE.Mesh(legG, metal); l.position.set(lx, 0.225, lz); l.castShadow = true; l.userData.seat = id; bean.add(l) }
        g.add(bean)
      }
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012; ring.visible = false; g.add(ring)
      const lc = labelCanvas(); drawLabel(lc, id, 'free'); const lt = new THREE.CanvasTexture(lc); lt.colorSpace = SRGB; lt.anisotropy = 4
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.21), new THREE.MeshBasicMaterial({ map: lt, transparent: true, depthWrite: false, toneMapped: false }))
      label.rotation.x = -Math.PI / 2; label.position.set(0, 0.006, isBean ? 0.68 : 0.4); if (!isBean) label.scale.setScalar(0.8); g.add(label)
      if (!isBean) ring.scale.setScalar(0.72)
      const person = makePerson(PG, hashStr('p' + id), !isBean); person.visible = false; person.traverse((o) => { if (o.isMesh) o.userData.seat = id }); g.add(person)
      const takenColor = isBean ? new THREE.Color(['#1b1c1d', '#151617', '#6e1b1f', '#1f2633', '#232120'][Math.floor(r() * 5)]) : FREE.clone()
      scene.add(g); pickables.push(bean, person)
      seats.set(id, { id, g, bean, mat, ring, label, lc, lt, person, takenColor, state: 'free', pop: 0, base: isBean ? 0.82 : 1, eye: new THREE.Vector3(x, isBean ? 1.02 : 1.18, z + (isBean ? 0.12 : 0.05)) })
    }
  })

  // กล้อง + การหมุน
  const controls = new OrbitControls(camera, cvs)
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false
  controls.minDistance = 3.5; controls.maxDistance = 10.5; controls.minPolarAngle = 0.55; controls.maxPolarAngle = 1.42
  controls.minAzimuthAngle = -0.85; controls.maxAzimuthAngle = 0.85; controls.rotateSpeed = 0.6
  const OVER = { pos: new THREE.Vector3(0, 2.85, 8.4), tgt: new THREE.Vector3(0, 0.55, -1.3) }
  camera.position.copy(OVER.pos); controls.target.copy(OVER.tgt); controls.update()
  let tween = null, pov = null, enableT = null
  function flyTo(pos, tgt, ms = 900) {
    if (reduce) ms = 1
    tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos.clone(), t1: tgt.clone(), start: performance.now(), ms }
  }
  function enterPov(id) {
    const s = seats.get(id); if (!s) return
    pov = id; controls.enabled = false; clearTimeout(enableT)
    flyTo(s.eye, new THREE.Vector3(s.eye.x * 0.35, sy - 0.1, ZF))
    onPov?.(id)
  }
  function exitPov() {
    if (!pov) return
    pov = null; flyTo(OVER.pos, OVER.tgt); enableT = setTimeout(() => { controls.enabled = true }, reduce ? 0 : 900)
    onPov?.(null)
  }

  // การแตะเลือก
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  function seatAt(e) {
    const rc = cvs.getBoundingClientRect(); ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    const hit = ray.intersectObjects(pickables, true).find((h) => h.object.visible && h.object.userData.seat && (h.object.parent.visible !== false))
    return hit ? hit.object.userData.seat : null
  }
  let down = null, hover = null
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY }; onHover?.() }
  const onUp = (e) => {
    if (!down) return; const d = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null
    if (d > 8) return
    const id = seatAt(e); if (id) onToggle?.(id)
  }
  const onMove = (e) => {
    if (e.pointerType !== 'mouse' || down) return
    const id = seatAt(e); if (id === hover) return
    hover = id; cvs.style.cursor = id ? 'pointer' : 'grab'; paint()
  }
  cvs.addEventListener('pointerdown', onDown)
  cvs.addEventListener('pointerup', onUp)
  cvs.addEventListener('pointermove', onMove)

  // สถานะที่นั่ง
  let curRound = null
  function paint() {
    for (const s of seats.values()) {
      const tk = s.state === 'taken', sel = s.state === 'sel'
      s.mat.color.copy(tk ? s.takenColor : sel ? MINT : FREE)
      s.mat.emissive.set(sel ? '#4a4a48' : (hover === s.id && !tk ? '#2a2a2a' : '#000000'))
      s.ring.visible = sel; s.person.visible = tk; s.label.visible = !tk
    }
  }
  function apply(d) {
    if (!d) return
    if (d.round !== curRound) { curRound = d.round; exitPov() }
    for (const s of seats.values()) {
      const ns = d.taken.includes(s.id) ? 'taken' : d.selected.includes(s.id) ? 'sel' : 'free'
      if (ns !== s.state) {
        if (ns === 'sel' && !reduce) s.pop = 1
        if ((ns === 'sel') !== (s.state === 'sel')) { drawLabel(s.lc, s.id, ns === 'sel' ? 'sel' : 'free'); s.lt.needsUpdate = true }
        s.state = ns
      }
    }
    paint()
  }

  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1 ? 62 : 52; camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize); ro.observe(wrap)

  let running = false, active = false
  function tick() {
    if (!active || disposed) { running = false; return }
    const now = performance.now()
    if (tween) {
      const k = Math.min(1, (now - tween.start) / tween.ms); const e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
      camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.t0, tween.t1, e)
      camera.lookAt(controls.target)
      if (k >= 1) tween = null
    } else if (controls.enabled) controls.update()
    for (const s of seats.values()) {
      if (s.pop > 0) { s.pop = Math.max(0, s.pop - 0.05); const b = Math.sin((1 - s.pop) * Math.PI) * 0.08, k = s.base; s.bean.scale.set(k * (1 + b * .5), k * (1 - b), k * (1 + b * .5)) }
      if (s.ring.visible) s.ring.material.opacity = 0.6 + 0.25 * Math.sin(now / 380)
    }
    glowMat.opacity = 0.06 + 0.015 * Math.sin(now / 900)
    renderer.render(scene, camera)
    requestAnimationFrame(tick)
  }
  function start() { active = true; resize(); if (!running) { running = true; requestAnimationFrame(tick) } }
  function stop() { active = false }

  function dispose() {
    disposed = true; active = false; clearTimeout(enableT)
    ro.disconnect(); controls.dispose()
    cvs.removeEventListener('pointerdown', onDown); cvs.removeEventListener('pointerup', onUp); cvs.removeEventListener('pointermove', onMove)
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
      ms.forEach((m) => { m.map?.dispose(); m.bumpMap?.dispose(); m.dispose() })
    })
    renderer.dispose()
  }

  return { apply, start, stop, enterPov, exitPov, dispose }
}
