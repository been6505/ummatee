import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ummatee Thailand — Vite + React config
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 4323, strictPort: false },
})
