import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  assetsInclude: ['**/*.pdf']
})

// vite.config.js (v3 way)
// export default defineConfig({
//   plugins: [vue()], // No tailwindcss() plugin
//   css: {
//     postcss: {
//       plugins: [tailwindcss(), autoprefixer()],
//     },
//   },
// })
