import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Proxy Qdrant requests through Vite dev server to bypass CORS
        '/qdrant-proxy': {
          target: env.VITE_QDRANT_URL || 'http://localhost:6333',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/qdrant-proxy/, ''),
          headers: {
            'api-key': env.VITE_QDRANT_API_KEY || '',
          },
        },
      },
    },
  };
})
