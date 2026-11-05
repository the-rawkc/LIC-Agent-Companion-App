import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

function localSyncPlugin(): Plugin {
  const localAgents = new Map<string, { pin: string; agentName?: string; createdAt: string; lastSyncAt: string }>();
  const localData = new Map<string, { policies: any[]; customers: any[]; reminders: any[]; profile?: any; updatedAt: string }>();

  function jsonRes(res: any, data: any, status = 200) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end(JSON.stringify(data));
  }

  const handler = async (req: any, res: any, next: any) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/sync/')) {
      return next();
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return res.end();
    }

    const endpoint = url.pathname.replace('/api/sync/', '');

    if (endpoint === 'status' && req.method === 'GET') {
      return jsonRes(res, { ok: true, d1Ready: true, timestamp: new Date().toISOString() });
    }

    // Collect body
    let bodyText = '';
    for await (const chunk of req) {
      bodyText += chunk;
    }
    let body: any = {};
    try {
      body = bodyText ? JSON.parse(bodyText) : {};
    } catch {}

    const agencyCode = String(body.agencyCode || '').trim();
    const pin = String(body.pin || '').trim();

    if (endpoint === 'auth' && req.method === 'POST') {
      if (!agencyCode || agencyCode.length < 4) {
        return jsonRes(res, { error: 'Agency code must be at least 4 characters.' }, 400);
      }
      if (!pin || pin.length < 4) {
        return jsonRes(res, { error: 'Security PIN must be at least 4 digits.' }, 400);
      }

      const existing = localAgents.get(agencyCode);
      if (!existing) {
        localAgents.set(agencyCode, {
          pin,
          agentName: body.agentName,
          createdAt: new Date().toISOString(),
          lastSyncAt: new Date().toISOString(),
        });
        return jsonRes(res, {
          success: true,
          isNew: true,
          agencyCode,
          agentName: body.agentName || 'Agent ' + agencyCode,
          message: 'Agent registered successfully on local sync server.',
        });
      }

      if (existing.pin !== pin) {
        return jsonRes(res, { error: 'Invalid security PIN for this Agency Code.' }, 401);
      }

      return jsonRes(res, {
        success: true,
        isNew: false,
        agencyCode,
        agentName: existing.agentName || 'Agent ' + agencyCode,
        message: 'Authenticated successfully.',
      });
    }

    if (endpoint === 'push' && req.method === 'POST') {
      const existing = localAgents.get(agencyCode);
      if (!existing) {
        localAgents.set(agencyCode, {
          pin,
          agentName: body.agentName,
          createdAt: new Date().toISOString(),
          lastSyncAt: new Date().toISOString(),
        });
      } else if (existing.pin !== pin) {
        return jsonRes(res, { error: 'Invalid security PIN.' }, 401);
      }

      const now = new Date().toISOString();
      localData.set(agencyCode, {
        policies: Array.isArray(body.policies) ? body.policies : [],
        customers: Array.isArray(body.customers) ? body.customers : [],
        reminders: Array.isArray(body.reminders) ? body.reminders : [],
        profile: body.profile || null,
        updatedAt: now,
      });

      const updatedAgent = localAgents.get(agencyCode)!;
      updatedAgent.lastSyncAt = now;

      return jsonRes(res, {
        success: true,
        agencyCode,
        syncedAt: now,
        counts: {
          policies: body.policies?.length || 0,
          customers: body.customers?.length || 0,
          reminders: body.reminders?.length || 0,
        },
      });
    }

    if (endpoint === 'pull' && req.method === 'POST') {
      const existing = localAgents.get(agencyCode);
      if (!existing) {
        return jsonRes(res, { error: 'No database record found for Agency Code: ' + agencyCode }, 404);
      }
      if (existing.pin !== pin) {
        return jsonRes(res, { error: 'Invalid security PIN for this Agency Code.' }, 401);
      }

      const data = localData.get(agencyCode) || {
        policies: [],
        customers: [],
        reminders: [],
        profile: null,
        updatedAt: existing.lastSyncAt,
      };

      return jsonRes(res, {
        success: true,
        agencyCode,
        agentName: existing.agentName || 'Agent ' + agencyCode,
        lastSyncAt: data.updatedAt,
        policies: data.policies,
        customers: data.customers,
        reminders: data.reminders,
        profile: data.profile,
      });
    }

    jsonRes(res, { error: 'Not found' }, 404);
  };

  return {
    name: 'local-sync-middleware',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    localSyncPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', 'icons/*.png'],
      manifest: {
        name: 'LIC Agent Companion',
        short_name: 'LIC Companion',
        description: 'Secure, offline-first policy management and tracking for LIC insurance agents',
        theme_color: '#0b192c',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src')
    }
  },
  // @ts-ignore
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  }
})
