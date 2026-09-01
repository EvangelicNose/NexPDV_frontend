import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isProduction = process.env.NODE_ENV === 'production'

const basePath = isProduction ? '/NexPDV_frontend/' : '/'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: basePath,
  server: { port: 3000 },
  preview: { port: 3000 },
})
