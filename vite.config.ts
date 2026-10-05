import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const basePath = '/'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: basePath,
  server: { port: 3000 },
  preview: { port: 3000 },
})
