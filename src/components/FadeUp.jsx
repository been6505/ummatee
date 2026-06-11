import { useEffect, useRef, useState } from 'react'

// ห่อ element ใด ๆ ให้ fade ขึ้นเมื่อเลื่อนมาเห็น (IntersectionObserver)
export default function FadeUp({ as: Tag = 'div', className = '', children, ...rest }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.12 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Tag ref={ref} className={`fade-up ${visible ? 'in' : ''} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  )
}
