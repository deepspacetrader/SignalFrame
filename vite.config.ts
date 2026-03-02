import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    base: '/signalframe/',
    plugins: [
        react(),
    ],
    server: {
        proxy: {
            '/api/nvidia-tts': {
                target: 'http://localhost:3002',
                changeOrigin: true,
            }
        }
    }
})
