import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Ummatee Thailand — Vite + React config
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // อัปเดต service worker อัตโนมัติเมื่อมีเวอร์ชันใหม่ ไม่ต้องรอผู้ใช้ปิดแท็บเอง
      // อย่า precache ไฟล์ HTML ของหน้าอื่น (ไม่มีอยู่แล้ว เป็น SPA) และไม่ต้อง cache รูปสินค้า Cloudinary
      // (โดเมนนอก อัปเดตบ่อย) — cache เฉพาะ asset ของแอปเอง
      includeAssets: ['favicon-512.png', 'logo.png', 'logo-trim.png', 'admin-manifest.webmanifest', 'admin-icon-192.png', 'admin-icon-512.png', 'admin-icon-512-maskable.png'],
      manifest: {
        name: 'Ummatee Thailand — มูลนิธิอุมมะตี',
        short_name: 'Ummatee',
        description: 'ให้ 100 ถึง 100 — ร่วมบริจาคช่วยเหลือผู้ยากไร้ทั่วโลก, ภารกิจกุรบาน, Iftar For Gaza และ Um Shop',
        lang: 'th',
        start_url: '/',
        display: 'standalone', // เปิดแบบเต็มจอเหมือนแอป ไม่มีแถบ URL ของเบราว์เซอร์
        background_color: '#ffffff',
        theme_color: '#1B5E36',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/favicon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // ไม่ cache Firestore/Cloudinary/Google Fonts ไว้ล่วงหน้า แค่ปล่อยผ่านตามปกติ (network) —
        // เว็บนี้เป็นข้อมูลสด (สต็อก/ออเดอร์/บริจาค) แคชนานไปจะโชว์ข้อมูลเก่าได้
        // ไม่รวม png ใน precache — มีรูปโปสเตอร์ขนาดหลาย MB อยู่ใน public/ ถ้า precache จะทำให้ติดตั้งครั้งแรกช้ามาก
        // (ไอคอนแอปเล็กๆ ที่ manifest อ้างถึงยังโหลดได้ปกติแม้ไม่ได้ precache)
        globPatterns: ['**/*.{js,css,html,svg,ico}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  base: '/',
  server: { port: 4323, strictPort: false },
  // ข้ามไฟล์ metadata ของ macOS (._*) ที่โผล่บน external drive
  test: { exclude: ['**/node_modules/**', '**/dist/**', '**/._*'] },
  build: {
    rollupOptions: {
      output: {
        // แยก vendor chunk ที่นานๆ เปลี่ยนที (react/fontawesome/firebase) ออกจากโค้ดของเรา —
        // เวลา deploy โค้ดใหม่ ผู้ใช้โหลดเฉพาะ chunk ที่เปลี่ยน ไม่ต้องโหลด vendor ซ้ำ
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['@fortawesome/react-fontawesome', '@fortawesome/free-solid-svg-icons', '@fortawesome/free-brands-svg-icons'],
        },
      },
    },
  },
})
