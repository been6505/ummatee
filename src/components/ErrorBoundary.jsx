import { Component } from 'react'

// ตรวจว่าเป็น error จาก chunk โหลดไม่ได้ (มักเกิดหลัง deploy เพราะ hash ของไฟล์เปลี่ยน
// แต่เบราว์เซอร์ยังถือ index.html เก่าที่อ้างชื่อ chunk เดิมซึ่งถูกลบไปแล้ว)
export function isChunkLoadError(error) {
  const msg = (error && (error.message || error.toString())) || ''
  return /dynamically imported module|module script failed|Failed to fetch|Loading chunk|importing a module script failed/i.test(msg)
}

// กันจอขาว: ถ้าหน้าใดเรนเดอร์ผิดพลาด (รวมถึง chunk โหลดไม่ได้หลัง deploy)
// ให้แสดงข้อความ + ปุ่มโหลดใหม่ แทนที่จะขาวทั้งจอ และพยายาม reload ให้อัตโนมัติ 1 ครั้ง
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    // chunk เก่าหลุดหลัง deploy → reload ครั้งเดียวเพื่อดึง index.html + chunk ใหม่
    if (isChunkLoadError(error) && !sessionStorage.getItem('chunkReload')) {
      sessionStorage.setItem('chunkReload', '1')
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          <div>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🔄</div>
            <h2 style={{ margin: '0 0 8px', color: '#1b5e36' }}>กำลังอัปเดตเวอร์ชันใหม่</h2>
            <p style={{ color: '#666', marginBottom: 22 }}>กรุณาโหลดหน้านี้อีกครั้ง · Please reload</p>
            <button
              onClick={() => { sessionStorage.removeItem('chunkReload'); window.location.reload() }}
              style={{ padding: '11px 28px', borderRadius: 12, border: 'none', background: '#2e7d52', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
            >
              โหลดใหม่
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
