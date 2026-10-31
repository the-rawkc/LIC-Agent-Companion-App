-- LIC Agent Companion: Cloudflare D1 Database Schema
-- Multi-tenant by agency_code

CREATE TABLE IF NOT EXISTS agents (
  agency_code TEXT PRIMARY KEY,
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  agent_name TEXT,
  created_at TEXT NOT NULL,
  last_sync_at TEXT
);

CREATE TABLE IF NOT EXISTS cloud_policies (
  id TEXT PRIMARY KEY,
  agency_code TEXT NOT NULL,
  policy_number TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (agency_code) REFERENCES agents (agency_code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_policies_agency ON cloud_policies (agency_code);
CREATE INDEX IF NOT EXISTS idx_policies_num ON cloud_policies (agency_code, policy_number);

CREATE TABLE IF NOT EXISTS cloud_customers (
  id TEXT PRIMARY KEY,
  agency_code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (agency_code) REFERENCES agents (agency_code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customers_agency ON cloud_customers (agency_code);

CREATE TABLE IF NOT EXISTS cloud_reminders (
  id TEXT PRIMARY KEY,
  agency_code TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (agency_code) REFERENCES agents (agency_code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reminders_agency ON cloud_reminders (agency_code);
