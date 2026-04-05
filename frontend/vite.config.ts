import type { ClientRequest, IncomingMessage } from 'node:http';

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

type ProxyEventEmitter = {
  on(event: 'proxyReq', handler: (proxyReq: ClientRequest, req: IncomingMessage) => void): void;
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiServerTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000';

  const apiProxy = {
    // Must be `/api/` not `/api` — otherwise React route `/api-demo` is proxied.
    '/api/': {
      target: apiServerTarget,
      changeOrigin: true,
      /** Forward real browser host so OpenAPI `servers` use the public hostname for :3000 / :3001, not 127.0.0.1. */
      configure(proxy: ProxyEventEmitter) {
        proxy.on('proxyReq', (proxyReq: ClientRequest, req: IncomingMessage) => {
          const host = req.headers.host;
          const hostStr = Array.isArray(host) ? host[0] : host;
          if (hostStr) proxyReq.setHeader('X-Forwarded-Host', hostStr);
          const xf = req.headers['x-forwarded-proto'];
          const xfStr = Array.isArray(xf) ? xf[0] : xf;
          const proto =
            typeof xfStr === 'string'
              ? xfStr.split(',')[0].trim().replace(/:$/, '')
              : 'http';
          proxyReq.setHeader('X-Forwarded-Proto', proto);
        });
      },
    },
  };

  return {
    build: {
      target: 'es2020',
    },
    plugins: [react()],
    server: {
      // Listen on all interfaces so a remote browser can use http://<server-ip>:5173 (firewall must allow 5173).
      host: true,
      proxy: apiProxy,
    },
    preview: {
      host: true,
      proxy: apiProxy,
    },
  };
});
