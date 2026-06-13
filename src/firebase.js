// ตั้งค่าเชื่อมต่อ Firebase (โปรเจกต์ ummatee-app) และ export ตัว Firestore (db) ให้หน้าอื่นใช้
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'

// ค่า config นี้เป็นข้อมูลสาธารณะของ Firebase ฝั่ง client (ไม่ใช่ secret)
const firebaseConfig = {
  apiKey: 'AIzaSyBYD1pYwC-ygjn2PFgLV7t7FYfgI0x56Mw',
  authDomain: 'ummatee-app.firebaseapp.com',
  projectId: 'ummatee-app',
  storageBucket: 'ummatee-app.firebasestorage.app',
  messagingSenderId: '703058924415',
  appId: '1:703058924415:web:31c5ac18c832ba5856804a',
  measurementId: 'G-0L9D8QTV3B',
}

const app = initializeApp(firebaseConfig)

// App Check (reCAPTCHA v3) — ป้องกันการเรียก Firebase API จากนอกเว็บไซต์จริง
// site key เป็นค่า public ใส่ในโค้ดได้ปลอดภัย (ตรงข้ามกับ secret key ที่ตั้งไว้ใน Firebase Console เท่านั้น)
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LcMsBstAAAAAPMSX2f747OyTpGwu59Hcd42OS3h'),
  isTokenAutoRefreshEnabled: true,
})

export const db = getFirestore(app)
export const auth = getAuth(app)
