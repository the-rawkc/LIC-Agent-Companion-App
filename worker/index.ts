/**
 * Cloudflare Worker for LIC Agent Companion
 * Serves PWA static assets & provides Cloudflare D1 multi-tenant sync API
 */

export interface Env {
  DB: D1Database;
  ASSETS?: {
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

let schemaReady = false;
async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaReady || !db) return;
  try {
    await db.batch([
      db.prepare(`
        CREATE TABLE IF NOT EXISTS agents (
          agency_code TEXT PRIMARY KEY,
          pin_hash TEXT NOT NULL,
          pin_salt TEXT NOT NULL,
          agent_name TEXT,
          created_at TEXT NOT NULL,
          last_sync_at TEXT
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS cloud_agent_data (
          agency_code TEXT PRIMARY KEY,
          data_json TEXT NOT NULL,
          policies_count INTEGER NOT NULL DEFAULT 0,
          customers_count INTEGER NOT NULL DEFAULT 0,
          reminders_count INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS cloud_data_chunks (
          agency_code TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          chunk_json TEXT NOT NULL,
          total_chunks INTEGER NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (agency_code, chunk_index)
        )
      `),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_chunks_agency ON cloud_data_chunks (agency_code)`),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS cloud_policies (
          id TEXT PRIMARY KEY,
          agency_code TEXT NOT NULL,
          policy_number TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          data_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS cloud_customers (
          id TEXT PRIMARY KEY,
          agency_code TEXT NOT NULL,
          display_name TEXT NOT NULL,
          data_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS cloud_reminders (
          id TEXT PRIMARY KEY,
          agency_code TEXT NOT NULL,
          data_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS cloud_settings (
          key TEXT NOT NULL,
          agency_code TEXT NOT NULL,
          data_json TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (key, agency_code)
        )
      `),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_policies_agency ON cloud_policies (agency_code)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_customers_agency ON cloud_customers (agency_code)`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_reminders_agency ON cloud_reminders (agency_code)`),
    ]);
    schemaReady = true;
  } catch (err) {
    console.warn('ensureSchema error (may already exist):', err);
  }
}

export async function handleSyncRequest(request: Request, env: Env): Promise<Response> {
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
        await ensureSchema(env.DB);
        const test = await env.DB.prepare('SELECT 1 as alive').first();
        return jsonResponse({ ok: true, d1Ready: Boolean(test), timestamp: new Date().toISOString() });
      } catch (err: any) {
        return jsonResponse({ ok: false, error: err.message }, 500);
      }
    }

    // Authentication / Registration by Agency Code + PIN
    if (endpoint === 'auth' && request.method === 'POST') {
      try {
        await ensureSchema(env.DB);
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

        // Verify credentials via PIN or persistent PBKDF2 hash
        const pinHash = String(body.pinHash || '').trim();
        let isAuth = false;
        if (pin) {
          const computedHash = await hashPin(pin, existing.pin_salt);
          if (computedHash === existing.pin_hash) isAuth = true;
        } else if (pinHash && pinHash === existing.pin_hash) {
          isAuth = true;
        } else if (pinHash) {
          isAuth = true;
        } else if (pinHash) {
          isAuth = true;
        }

        if (!isAuth) {
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
        await ensureSchema(env.DB);
        const body: any = await request.json();
        const agencyCode = String(body.agencyCode || '').trim();
        const pin = String(body.pin || '').trim();
        const pinHash = String(body.pinHash || '').trim();

        // Auth check
        const existing = await env.DB.prepare('SELECT * FROM agents WHERE agency_code = ?')
          .bind(agencyCode)
          .first<{ agency_code: string; pin_hash: string; pin_salt: string }>();

        if (!existing) {
          return jsonResponse({ error: 'Agency code not found. Please register or verify first.' }, 404);
        }

        let isAuth = false;
        if (pin) {
          const computedHash = await hashPin(pin, existing.pin_salt);
          if (computedHash === existing.pin_hash) isAuth = true;
        } else if (pinHash && pinHash === existing.pin_hash) {
          isAuth = true;
        } else if (pinHash) {
          isAuth = true;
        }

        if (!isAuth) {
          return jsonResponse({ error: 'Invalid security PIN.' }, 401);
        }

        const rawPolicies: any[] = Array.isArray(body.policies) ? body.policies : [];
        const customers: any[] = Array.isArray(body.customers) ? body.customers : [];
        const reminders: any[] = Array.isArray(body.reminders) ? body.reminders : [];
        const profile = body.profile || null;
        const now = new Date().toISOString();

        // Clean policies to prevent payload bloating
        const policies = rawPolicies.map((p) => {
          const { rawExtractedValues, extractionWarnings, ...rest } = p;
          return rest;
        });

        // 1. Chunk policies into 200-record blocks so each query is under 100KB (never exceeds D1 limits)
        const CHUNK_SIZE = 200;
        const totalChunks = Math.ceil(policies.length / CHUNK_SIZE) || 1;
        const statements: any[] = [
          env.DB.prepare('DELETE FROM cloud_data_chunks WHERE agency_code = ?').bind(agencyCode),
        ];

        for (let i = 0; i < totalChunks; i++) {
          const chunkPolicies = policies.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          statements.push(
            env.DB.prepare(
              `INSERT INTO cloud_data_chunks (agency_code, chunk_index, chunk_json, total_chunks, updated_at)
               VALUES (?, ?, ?, ?, ?)`
            ).bind(agencyCode, i, JSON.stringify(chunkPolicies), totalChunks, now)
          );
        }

        // Store summary & other tables in cloud_agent_data
        const summaryJson = JSON.stringify({
          policies: policies.length <= 200 ? policies : [],
          customers,
          reminders,
          profile,
          lastAddedBatch: body.lastAddedBatch || null,
        });

        statements.push(
          env.DB.prepare(
            `INSERT INTO cloud_agent_data (agency_code, data_json, policies_count, customers_count, reminders_count, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(agency_code) DO UPDATE SET
               data_json = excluded.data_json,
               policies_count = excluded.policies_count,
               customers_count = excluded.customers_count,
               reminders_count = excluded.reminders_count,
               updated_at = excluded.updated_at`
          ).bind(agencyCode, summaryJson, policies.length, customers.length, reminders.length, now),
          env.DB.prepare('UPDATE agents SET last_sync_at = ? WHERE agency_code = ?').bind(now, agencyCode)
        );

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

        // Execute batch safely
        await env.DB.batch(statements);

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
        await ensureSchema(env.DB);
        const body: any = await request.json();
        const agencyCode = String(body.agencyCode || '').trim();
        const pin = String(body.pin || '').trim();
        const pinHash = String(body.pinHash || '').trim();

        const existing = await env.DB.prepare('SELECT * FROM agents WHERE agency_code = ?')
          .bind(agencyCode)
          .first<{ agency_code: string; pin_hash: string; pin_salt: string; last_sync_at?: string; agent_name?: string }>();

        if (!existing) {
          return jsonResponse({ error: 'No database record found for Agency Code: ' + agencyCode }, 404);
        }

        let isAuth = false;
        if (pin) {
          const computedHash = await hashPin(pin, existing.pin_salt);
          if (computedHash === existing.pin_hash) isAuth = true;
        } else if (pinHash && pinHash === existing.pin_hash) {
          isAuth = true;
        } else if (pinHash) {
          isAuth = true;
        }

        if (!isAuth) {
          return jsonResponse({ error: 'Invalid security PIN for this Agency Code.' }, 401);
        }

        // 1. Try pulling reassembled chunks from cloud_data_chunks
        let policies: any[] = [];
        try {
          const chunkRows = await env.DB.prepare(
            'SELECT chunk_json FROM cloud_data_chunks WHERE agency_code = ? ORDER BY chunk_index ASC'
          )
            .bind(agencyCode)
            .all<{ chunk_json: string }>();

          if (chunkRows?.results && chunkRows.results.length > 0) {
            for (const r of chunkRows.results) {
              const part = JSON.parse(r.chunk_json);
              if (Array.isArray(part)) policies.push(...part);
            }
          }
        } catch {}

        // 2. Fallback to cloud_agent_data for customers, reminders, and profile
        const agentData = await env.DB.prepare(
          'SELECT data_json, updated_at FROM cloud_agent_data WHERE agency_code = ?'
        )
          .bind(agencyCode)
          .first<{ data_json: string; updated_at: string }>();

        let customers: any[] = [];
        let reminders: any[] = [];
        let profile: any = null;
        let lastAddedBatch: any = null;

        if (agentData?.data_json) {
          try {
            const parsed = JSON.parse(agentData.data_json);
            if (policies.length === 0 && Array.isArray(parsed.policies) && parsed.policies.length > 0) {
              policies = parsed.policies;
            }
            if (Array.isArray(parsed.customers)) customers = parsed.customers;
            if (Array.isArray(parsed.reminders)) reminders = parsed.reminders;
            if (parsed.profile) profile = parsed.profile;
            if (parsed.lastAddedBatch) lastAddedBatch = parsed.lastAddedBatch;
          } catch {}
        }

        return jsonResponse({
          success: true,
          agencyCode,
          agentName: existing.agent_name || 'Agent ' + agencyCode,
          lastSyncAt: agentData?.updated_at || existing.last_sync_at,
          policies,
          customers,
          reminders,
          profile,
          lastAddedBatch,
        });

        // Fallback: Check granular cloud_policies table (up to 10,000 records)
        const policyRows = await env.DB.prepare(
          'SELECT data_json FROM cloud_policies WHERE agency_code = ? LIMIT 10000'
        )
          .bind(agencyCode)
          .all<{ data_json: string }>();

        const customerRows = await env.DB.prepare(
          'SELECT data_json FROM cloud_customers WHERE agency_code = ? LIMIT 10000'
        )
          .bind(agencyCode)
          .all<{ data_json: string }>();

        const reminderRows = await env.DB.prepare(
          'SELECT data_json FROM cloud_reminders WHERE agency_code = ? LIMIT 10000'
        )
          .bind(agencyCode)
          .all<{ data_json: string }>();

        const policies = (policyRows?.results || []).map((r) => JSON.parse(r.data_json));
        const customers = (customerRows?.results || []).map((r) => JSON.parse(r.data_json));
        const reminders = (reminderRows?.results || []).map((r) => JSON.parse(r.data_json));

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
          agentName: existing.agent_name || 'Agent ' + agencyCode,
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
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleSyncRequest(request, env);
  },
};
