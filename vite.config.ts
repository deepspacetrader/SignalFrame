import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    base: '/',
    plugins: [
        react(),
    ],
server: {
    proxy: {
      '/api/nvidia-tts': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/api/nim': {
        target: 'https://integrate.api.nvidia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nim/, '/v1'),
        headers: {
          'Origin': 'https://integrate.api.nvidia.com',
        },
      },
    }
  }
})
