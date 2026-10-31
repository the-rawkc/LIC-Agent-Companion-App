/**
 * Cloudflare Worker for LIC Agent Companion
 * Serves PWA static assets & provides Cloudflare D1 multi-tenant sync API
 */

export interface Env {
  DB: D1Database;
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

// Security: PBKDF2-HMAC-SHA256 verification using Web Crypto (built into Cloudflare Workers)
async function hashPin(pin: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = new Uint8Array(saltHex.length / 2);
  for (let i = 0; i < saltHex.length; i += 2) {
    salt[i / 2] = parseInt(saltHex.substring(i, i + 2), 16);
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exported = await crypto.subtle.exportKey('raw', key);
  return Array.from(new Uint8Array(exported))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // API Routes under /api/sync/*
    if (url.pathname.startsWith('/api/sync/')) {
      const endpoint = url.pathname.replace('/api/sync/', '');

      // Healthcheck
      if (endpoint === 'status' && request.method === 'GET') {
        try {
          const test = await env.DB.prepare('SELECT 1 as alive').first();
          return jsonResponse({ ok: true, d1Ready: Boolean(test), timestamp: new Date().toISOString() });
        } catch (err: any) {
          return jsonResponse({ ok: false, error: err.message }, 500);
        }
      }

      // Authentication / Registration by Agency Code + PIN
      if (endpoint === 'auth' && request.method === 'POST') {
        try {
          const body: any = await request.json();
          const agencyCode = String(body.agencyCode || '').trim();
          const pin = String(body.pin || '').trim();

          if (!agencyCode || agencyCode.length < 4) {
            return jsonResponse({ error: 'Agency code must be at least 4 characters.' }, 400);
          }
          if (!pin || pin.length < 4) {
            return jsonResponse({ error: 'Security PIN must be at least 4 digits.' }, 400);
          }

          // Check if agent exists
          const existing = await env.DB.prepare('SELECT * FROM agents WHERE agency_code = ?')
            .bind(agencyCode)
            .first<{ agency_code: string; pin_hash: string; pin_salt: string; agent_name?: string }>();

          if (!existing) {
            // Register agent
            const salt = generateSalt();
            const hash = await hashPin(pin, salt);
            const now = new Date().toISOString();

            await env.DB.prepare(
              'INSERT INTO agents (agency_code, pin_hash, pin_salt, agent_name, created_at, last_sync_at) VALUES (?, ?, ?, ?, ?, ?)'
            )
              .bind(agencyCode, hash, salt, body.agentName || null, now, now)
              .run();

            return jsonResponse({
              success: true,
              isNew: true,
              agencyCode,
              agentName: body.agentName || 'Agent ' + agencyCode,
              message: 'Agent registered successfully.',
            });
          }

          // Verify existing PIN
          const computedHash = await hashPin(pin, existing.pin_salt);
          if (computedHash !== existing.pin_hash) {
            return jsonResponse({ error: 'Invalid security PIN for this Agency Code.' }, 401);
          }

          return jsonResponse({
            success: true,
            isNew: false,
            agencyCode,
            agentName: existing.agent_name || 'Agent ' + agencyCode,
            message: 'Authenticated successfully.',
          });
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 500);
        }
      }

      // Push Local Data to Cloudflare D1
      if (endpoint === 'push' && request.method === 'POST') {
        try {
          const body: any = await request.json();
          const agencyCode = String(body.agencyCode || '').trim();
          const pin = String(body.pin || '').trim();

          // Auth check
          const existing = await env.DB.prepare('SELECT * FROM agents WHERE agency_code = ?')
            .bind(agencyCode)
            .first<{ agency_code: string; pin_hash: string; pin_salt: string }>();

          if (!existing) {
            return jsonResponse({ error: 'Agency code not found. Please register or verify first.' }, 404);
          }

          const computedHash = await hashPin(pin, existing.pin_salt);
          if (computedHash !== existing.pin_hash) {
            return jsonResponse({ error: 'Invalid security PIN.' }, 401);
          }

          const policies: any[] = Array.isArray(body.policies) ? body.policies : [];
          const customers: any[] = Array.isArray(body.customers) ? body.customers : [];
          const reminders: any[] = Array.isArray(body.reminders) ? body.reminders : [];
          const profile = body.profile || null;
          const now = new Date().toISOString();

          // Ensure cloud_settings table exists
          try {
            await env.DB.prepare(
              `CREATE TABLE IF NOT EXISTS cloud_settings (
                key TEXT NOT NULL,
                agency_code TEXT NOT NULL,
                data_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (key, agency_code)
              )`
            ).run();
          } catch {}

          // Chunk queries to stay well within D1 batch boundaries (maximum 100 statements per batch)
          const statements: any[] = [];

          if (profile) {
            statements.push(
              env.DB.prepare(
                `INSERT INTO cloud_settings (key, agency_code, data_json, updated_at)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(key, agency_code) DO UPDATE SET
                   data_json = excluded.data_json,
                   updated_at = excluded.updated_at`
              ).bind('agent_profile', agencyCode, JSON.stringify(profile), now)
            );
          }

          for (const p of policies) {
            statements.push(
              env.DB.prepare(
                `INSERT INTO cloud_policies (id, agency_code, policy_number, customer_id, data_json, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   policy_number = excluded.policy_number,
                   customer_id = excluded.customer_id,
                   data_json = excluded.data_json,
                   updated_at = excluded.updated_at`
              ).bind(p.id, agencyCode, String(p.policyNumber), String(p.customerId), JSON.stringify(p), now)
            );
          }

          for (const c of customers) {
            statements.push(
              env.DB.prepare(
                `INSERT INTO cloud_customers (id, agency_code, display_name, data_json, updated_at)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   display_name = excluded.display_name,
                   data_json = excluded.data_json,
                   updated_at = excluded.updated_at`
              ).bind(c.id, agencyCode, String(c.displayName), JSON.stringify(c), now)
            );
          }

          for (const r of reminders) {
            statements.push(
              env.DB.prepare(
                `INSERT INTO cloud_reminders (id, agency_code, data_json, updated_at)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   data_json = excluded.data_json,
                   updated_at = excluded.updated_at`
              ).bind(r.id, agencyCode, JSON.stringify(r), now)
            );
          }

          statements.push(
            env.DB.prepare('UPDATE agents SET last_sync_at = ? WHERE agency_code = ?').bind(now, agencyCode)
          );

          // Execute in batches of 50
          const BATCH_SIZE = 50;
          for (let i = 0; i < statements.length; i += BATCH_SIZE) {
            const chunk = statements.slice(i, i + BATCH_SIZE);
            await env.DB.batch(chunk);
          }

          return jsonResponse({
            success: true,
            agencyCode,
            syncedAt: now,
            counts: {
              policies: policies.length,
              customers: customers.length,
              reminders: reminders.length,
            },
          });
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 500);
        }
      }

      // Pull All Cloud Data for an Agency Code
      if (endpoint === 'pull' && request.method === 'POST') {
        try {
          const body: any = await request.json();
          const agencyCode = String(body.agencyCode || '').trim();
          const pin = String(body.pin || '').trim();

          const existing = await env.DB.prepare('SELECT * FROM agents WHERE agency_code = ?')
            .bind(agencyCode)
            .first<{ agency_code: string; pin_hash: string; pin_salt: string; last_sync_at?: string }>();

          if (!existing) {
            return jsonResponse({ error: 'No database record found for Agency Code: ' + agencyCode }, 404);
          }

          const computedHash = await hashPin(pin, existing.pin_salt);
          if (computedHash !== existing.pin_hash) {
            return jsonResponse({ error: 'Invalid security PIN for this Agency Code.' }, 401);
          }

          // Fetch policies
          const policyRows = await env.DB.prepare(
            'SELECT data_json FROM cloud_policies WHERE agency_code = ?'
          )
            .bind(agencyCode)
            .all<{ data_json: string }>();

          // Fetch customers
          const customerRows = await env.DB.prepare(
            'SELECT data_json FROM cloud_customers WHERE agency_code = ?'
          )
            .bind(agencyCode)
            .all<{ data_json: string }>();

          // Fetch reminders
          const reminderRows = await env.DB.prepare(
            'SELECT data_json FROM cloud_reminders WHERE agency_code = ?'
          )
            .bind(agencyCode)
            .all<{ data_json: string }>();

          const policies = policyRows.results.map((r) => JSON.parse(r.data_json));
          const customers = customerRows.results.map((r) => JSON.parse(r.data_json));
          const reminders = reminderRows.results.map((r) => JSON.parse(r.data_json));

          let profile = null;
          try {
            const profileRow = await env.DB.prepare(
              'SELECT data_json FROM cloud_settings WHERE agency_code = ? AND key = ?'
            )
              .bind(agencyCode, 'agent_profile')
              .first<{ data_json: string }>();
            if (profileRow?.data_json) {
              profile = JSON.parse(profileRow.data_json);
            }
          } catch {}

          return jsonResponse({
            success: true,
            agencyCode,
            lastSyncAt: existing.last_sync_at,
            policies,
            customers,
            reminders,
            profile,
          });
        } catch (err: any) {
          return jsonResponse({ error: err.message }, 500);
        }
      }

      return jsonResponse({ error: 'Not found' }, 404);
    }

    // Fallback: Serve Static PWA from ./dist
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('LIC Agent Companion API running.', { status: 200 });
  },
};
