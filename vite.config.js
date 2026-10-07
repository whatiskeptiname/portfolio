import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Served from the root of the custom domain, https://susang.com.np/
  base: '/',
  plugins: [react()],
  build: {
    // three.js is ~720 kB on its own and only loads with the 3D city.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Keep three.js in its own chunk so the landing page doesn't pay for it.
        manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined),
      },
    },
  },
  test: {
    environment: 'node',
  },
})
