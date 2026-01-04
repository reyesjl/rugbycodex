import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    nodePolyfills({
      protocolImports: true,
    }),
  ],
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
