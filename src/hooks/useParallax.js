import { useEffect, useRef } from 'react'

// ใส่เอฟเฟกต์ parallax แบบเบาๆ ให้เลเยอร์พื้นหลังของ hero/banner
// เลื่อนช้ากว่าหน้าจอเล็กน้อยตอน scroll (ไม่ใช้ background-attachment:fixed เพราะ iOS Safari กระตุก)
// speed: สัดส่วนความเร็วเทียบกับ scroll ปกติ ยิ่งน้อยยิ่งขยับน้อย (0.15 = ขยับ 15% ของระยะ scroll)
export default function useParallax(speed = 0.15) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // เคารพ prefers-reduced-motion — ไม่ผูก scroll listener เลย ปล่อย transform เป็นค่าเริ่มต้น (none)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return

    // ปิด parallax บนจอมือถือ/แท็บเล็ตแคบ (<768px) — translate ตาม scroll บน iOS Safari มือถือกระตุกง่าย
    // เนื้อหา/รูปยังอยู่นิ่งตามปกติ แค่ไม่มีเอฟเฟกต์เลื่อนต่างความเร็ว
    const isMobile = () => window.innerWidth < 768

    let ticking = false
    const update = () => {
      ticking = false
      if (isMobile()) { el.style.transform = ''; return }
      const rect = el.getBoundingClientRect()
      // คำนวณจากตำแหน่งของ element เอง ไม่ใช่ window.scrollY ตรงๆ กันเพี้ยนตอนหน้ามี sticky/offset อื่นๆ
      const offset = rect.top * speed
      el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`
    }
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [speed])

  return ref
}
