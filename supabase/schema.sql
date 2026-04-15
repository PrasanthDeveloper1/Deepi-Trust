-- ═══════════════════════════════════════════════════════════════════════════
-- DEEPI TRUST & DONATIONS — Supabase PostgreSQL Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Helper: get calling user's role ────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- ─── 1. PROFILES ─────────────────────────────────────────────────────────────
-- Extends auth.users with app-specific fields
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email        TEXT NOT NULL,
  name         TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('admin','donor','agent','center')),
  phone        TEXT,
  address      TEXT,
  coords       JSONB,          -- { lat, lng }
  upi_id       TEXT,           -- Agents: UPI ID for payment
  payment_qr   TEXT,           -- Agents: base64 QR code image
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users see their own profile; admin sees all
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR get_my_role() = 'admin');

-- Users insert their own profile on signup
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Users update their own profile; admin updates any
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR get_my_role() = 'admin');

-- ─── 2. DONATIONS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS donations (
  id                    TEXT PRIMARY KEY,
  donor_id              UUID NOT NULL REFERENCES profiles(id),
  donor_name            TEXT NOT NULL,
  food_name             TEXT NOT NULL,
  quantity              TEXT NOT NULL,
  pickup_location       TEXT NOT NULL,
  pickup_coords         JSONB,
  prep_time             TEXT,
  expiry_time           TEXT,
  quality               TEXT DEFAULT 'Good',
  status                TEXT DEFAULT 'pending',
  photos                TEXT[] DEFAULT '{}',
  ai_score              INTEGER,
  ai_details            JSONB,
  agent_id              UUID REFERENCES profiles(id),
  agent_name            TEXT,
  center_id             UUID REFERENCES profiles(id),
  center_name           TEXT,
  delivery_fee          INTEGER,
  delivery_distance     NUMERIC,
  pickup_photos         TEXT[] DEFAULT '{}',
  drop_photos           TEXT[] DEFAULT '{}',
  pickup_qty_confirmed  TEXT,
  drop_qty_confirmed    TEXT,
  reject_reason         TEXT,
  has_discrepancy       BOOLEAN DEFAULT FALSE,
  discrepancy_note      TEXT,
  dispatched_at         TIMESTAMPTZ,
  assigned_at           TIMESTAMPTZ,
  picked_at             TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  received_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- Admin sees all; donors see their own; agents see assigned + open-broadcast;
-- centers see theirs
CREATE POLICY "donations_select" ON donations FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR donor_id = auth.uid()
    OR agent_id = auth.uid()
    OR center_id = auth.uid()
    OR (status = 'dispatched' AND get_my_role() = 'agent')
  );

CREATE POLICY "donations_insert" ON donations FOR INSERT TO authenticated
  WITH CHECK (donor_id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY "donations_update" ON donations FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'admin'
    OR donor_id = auth.uid()
    OR agent_id = auth.uid()
    OR center_id = auth.uid()
  );

-- ─── 3. DELIVERY REQUESTS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_requests (
  id           TEXT PRIMARY KEY,
  donation_id  TEXT NOT NULL REFERENCES donations(id),
  center_id    UUID REFERENCES profiles(id),
  center_name  TEXT,
  center_coords JSONB,
  pickup_coords JSONB,
  fee          INTEGER,
  distance_km  NUMERIC,
  status       TEXT DEFAULT 'open',    -- open | accepted | expired
  accepted_by  UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE delivery_requests ENABLE ROW LEVEL SECURITY;

-- All authenticated agents can see open requests; admin sees all
CREATE POLICY "delivery_requests_select" ON delivery_requests FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR status = 'open'
    OR accepted_by = auth.uid()
  );

CREATE POLICY "delivery_requests_insert" ON delivery_requests FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "delivery_requests_update" ON delivery_requests FOR UPDATE TO authenticated
  USING (get_my_role() IN ('admin','agent'));

-- ─── 4. PAYMENTS (Crowdfunding) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id           TEXT PRIMARY KEY,
  donor_name   TEXT NOT NULL,
  email        TEXT,
  amount       INTEGER NOT NULL,
  status       TEXT DEFAULT 'review',   -- review | completed
  proof        TEXT,                     -- base64 payment screenshot
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (anonymous donors); admin can read/update all
CREATE POLICY "payments_insert" ON payments FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "payments_select" ON payments FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "payments_update" ON payments FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin');

-- ─── 5. AGENT FEES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_fees (
  id           TEXT PRIMARY KEY,
  agent_id     UUID NOT NULL REFERENCES profiles(id),
  agent_name   TEXT NOT NULL,
  donation_id  TEXT REFERENCES donations(id),
  food_name    TEXT,
  distance_km  NUMERIC,
  fee          INTEGER,
  status       TEXT DEFAULT 'pending',  -- pending | paid
  paid_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_fees ENABLE ROW LEVEL SECURITY;

-- Agents see their own fees; admin sees all
CREATE POLICY "agent_fees_select" ON agent_fees FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY "agent_fees_insert" ON agent_fees FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin','agent'));

CREATE POLICY "agent_fees_update" ON agent_fees FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin');

-- ─── 6. AGENT LOCATIONS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_locations (
  agent_id    UUID REFERENCES profiles(id) PRIMARY KEY,
  lat         NUMERIC NOT NULL,
  lng         NUMERIC NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_locations ENABLE ROW LEVEL SECURITY;

-- All authenticated users can see agent locations (for live tracking)
CREATE POLICY "agent_locations_select" ON agent_locations FOR SELECT TO authenticated
  USING (true);

-- Agents write their own location; admin can too
CREATE POLICY "agent_locations_upsert" ON agent_locations FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY "agent_locations_update" ON agent_locations FOR UPDATE TO authenticated
  USING (agent_id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY "agent_locations_delete" ON agent_locations FOR DELETE TO authenticated
  USING (agent_id = auth.uid() OR get_my_role() = 'admin');

-- ─── 7. NOTIFICATIONS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id),
  role        TEXT,              -- 'all' = broadcast to all; or specific role
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  type        TEXT DEFAULT 'info',
  read        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users see their own + broadcast notifications
CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR role = 'all' OR get_my_role() = 'admin');

-- Any authenticated user can insert notifications (system use)
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR get_my_role() = 'admin');

-- ─── 8. ADMIN SETTINGS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_settings (
  key    TEXT PRIMARY KEY,
  value  TEXT
);

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings; only admin writes
CREATE POLICY "admin_settings_select" ON admin_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admin_settings_insert" ON admin_settings FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "admin_settings_update" ON admin_settings FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin');

-- ─── INDEXES for performance ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_donations_donor     ON donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_donations_agent     ON donations(agent_id);
CREATE INDEX IF NOT EXISTS idx_donations_center    ON donations(center_id);
CREATE INDEX IF NOT EXISTS idx_donations_status    ON donations(status);
CREATE INDEX IF NOT EXISTS idx_delivery_req_status ON delivery_requests(status);
CREATE INDEX IF NOT EXISTS idx_agent_fees_agent    ON agent_fees(agent_id);
CREATE INDEX IF NOT EXISTS idx_notif_user          ON notifications(user_id);

-- ─── SEED: Admin account ─────────────────────────────────────────────────────
-- After running this schema, sign up normally as admin@deepitrust.org / admin123
-- via the app's signup page, then manually update role to 'admin' here:
--
-- UPDATE profiles SET role = 'admin' WHERE email = 'admin@deepitrust.org';
--
-- OR create admin directly (adjust the UUID to match the auth.users entry):
-- INSERT INTO profiles (id, email, name, role)
-- VALUES ('<auth-uuid>', 'admin@deepitrust.org', 'Admin User', 'admin');
