import { useEffect } from 'react'
import { getSunGradient } from '../utils/sunGradient.js'

// เซ็ต CSS custom properties (--sun-angle, --sun-color-light, --sun-color-dark) บน <html>
// ให้ .admin-dash ทุกหน้า (แต่ละหน้า admin มี <main className="admin-dash"> ของตัวเอง) อ่านค่าเดียวกันได้
// อัปเดตทุก 5 นาทีพอ เพราะความสว่างเปลี่ยนช้าเทียบกับรอบเวลาใช้งานจริง
export default function useSunGradient() {
  useEffect(() => {
    const apply = () => {
      const { angleDeg, colorLight, colorDark } = getSunGradient()
      const root = document.documentElement.style
      root.setProperty('--sun-angle', `${angleDeg}deg`)
      root.setProperty('--sun-color-light', colorLight)
      root.setProperty('--sun-color-dark', colorDark)
    }
    apply()
    const id = setInterval(apply, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])
}
