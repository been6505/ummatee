import { createContext, useContext } from 'react'

// แชร์ฟังก์ชันเปลี่ยนหน้า (go) ให้ทุก component เรียกใช้ได้
export const NavCtx = createContext(() => {})
export const useNavigate = () => useContext(NavCtx)
