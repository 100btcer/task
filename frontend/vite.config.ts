import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiServerTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000';

  const apiProxy = {
    // Must be `/api/` not `/api` — otherwise React route `/api-demo` is proxied.
    '/api/': {
      target: apiServerTarget,
      changeOrigin: true,
    },
  };

  return {
    build: {
      target: 'es2020',
    },
    plugins: [react()],
    server: {
      proxy: apiProxy,
    },
    preview: {
      proxy: apiProxy,
    },
  };
});
