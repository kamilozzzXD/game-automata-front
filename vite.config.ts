import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { codeInspectorPlugin } from 'code-inspector-plugin'

export default defineConfig({
  plugins: [
    codeInspectorPlugin({
      bundler: 'vite',
      showSwitch: true,
      hotKeys: ['altKey']
    }),
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': process.env.VITE_API_URL || 'http://127.0.0.1:8000'
    }
  },
  preview: {
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': process.env.VITE_API_URL || 'http://127.0.0.1:8000'
    }
  }
})