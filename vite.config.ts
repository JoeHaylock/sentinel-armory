import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/sentinel-armory/lab/',
  plugins: [react()],
})
