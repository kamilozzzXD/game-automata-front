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
})